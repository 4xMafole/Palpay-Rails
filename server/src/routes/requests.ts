import { Router } from "express";
import { env } from "../config/env.js";
import { requireBearerToken } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { evaluateRequest } from "../policy/engine.js";
import { PurchaseRequestInputSchema } from "../policy/types.js";
import { getMissionById } from "../db/missions.js";
import {
    createRequest,
    getRequestById,
    listRequests,
    recordPaypalResult,
    setApprovalStatus,
} from "../db/requests.js";
import { paypalClient } from "../paypal/client.js";
import { sendApprovalPush } from "../push/fcm.js";
import { explainDecision } from "../llm/gemini.js";

export const requestsRouter = Router();

const requireAgent = requireBearerToken(env.AGENT_API_KEY);
const requireManager = requireBearerToken(env.MANAGER_API_KEY);

// Agent-facing: the only endpoint that accepts purchase intents. The policy engine
// decision below is deterministic. ALLOWED requests pay immediately with zero human
// clicks; NEEDS_APPROVAL requests only pay after an explicit manager approval (Phase 5).
// Rate-limited: every call now also triggers a Gemini explanation (and possibly PayPal).
requestsRouter.post("/", requireAgent, rateLimit({ windowMs: 60_000, max: 30 }), async (req, res) => {
    const parsed = PurchaseRequestInputSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "invalid_request", details: parsed.error.flatten().fieldErrors });
        return;
    }

    try {
        const mission = await getMissionById(parsed.data.missionId);
        if (!mission) {
            res.status(404).json({ error: "mission_not_found" });
            return;
        }

        const evaluation = evaluateRequest(mission, parsed.data);

        // Explain-only, generated after the decision is already final; never allowed
        // to affect it. A failure here just means no explanation text, nothing more.
        let explanation: string | null = null;
        try {
            explanation = await explainDecision({
                decision: evaluation.decision,
                matchedRules: evaluation.matchedRules,
                failedRules: evaluation.failedRules,
                missionTitle: mission.title,
                missionPurpose: mission.purpose,
                vendor: parsed.data.vendor,
                itemDescription: parsed.data.itemDescription,
                amount: parsed.data.amount,
                currency: parsed.data.currency,
                isRecurring: parsed.data.isRecurring,
            });
        } catch {
            // Swallow — explanation is a display nicety, not part of the decision.
        }

        let record = await createRequest({
            input: parsed.data,
            decision: evaluation.decision,
            matchedRules: evaluation.matchedRules,
            failedRules: evaluation.failedRules,
            explanation,
        });

        if (evaluation.decision === "ALLOWED") {
            try {
                const result = await paypalClient.createAndCaptureOrder({
                    amount: parsed.data.amount,
                    currency: parsed.data.currency,
                    description: parsed.data.itemDescription,
                    requestId: record.id,
                });
                record = await recordPaypalResult(record.id, {
                    paypalOrderId: result.orderId,
                    paypalStatus: result.status,
                });
            } catch (paypalErr) {
                // The policy decision stands; only payment execution failed. Surface it
                // distinctly so the audit feed doesn't read as "Allowed and paid".
                record = await recordPaypalResult(record.id, { paypalOrderId: null, paypalStatus: "EXECUTION_FAILED" });
                res.status(201).json({ ...record, paypalError: (paypalErr as Error).message });
                return;
            }
        }

        if (evaluation.decision === "NEEDS_APPROVAL") {
            await sendApprovalPush({
                requestId: record.id,
                missionTitle: mission.title,
                vendor: parsed.data.vendor,
                amount: parsed.data.amount,
                currency: parsed.data.currency,
            });
        }

        res.status(201).json(record);
    } catch (err) {
        res.status(500).json({ error: "request_failed", message: (err as Error).message });
    }
});

requestsRouter.get("/", requireManager, async (_req, res) => {
    try {
        res.json(await listRequests());
    } catch (err) {
        res.status(500).json({ error: "list_failed", message: (err as Error).message });
    }
});

requestsRouter.get("/:id", requireManager, async (req, res) => {
    try {
        const request = await getRequestById(req.params.id);
        if (!request) {
            res.status(404).json({ error: "not_found" });
            return;
        }
        res.json(request);
    } catch (err) {
        res.status(500).json({ error: "fetch_failed", message: (err as Error).message });
    }
});

// Only pending NEEDS_APPROVAL requests can be approved/rejected (setApprovalStatus
// guards this with a WHERE approval_status='pending', so double-taps are a no-op 404).
requestsRouter.post("/:id/approve", requireManager, async (req, res) => {
    try {
        const updated = await setApprovalStatus(req.params.id, "approved");
        if (!updated) {
            res.status(404).json({ error: "not_found_or_already_decided" });
            return;
        }

        try {
            const result = await paypalClient.createAndCaptureOrder({
                amount: updated.amount,
                currency: updated.currency,
                description: updated.itemDescription,
                requestId: updated.id,
            });
            const final = await recordPaypalResult(updated.id, {
                paypalOrderId: result.orderId,
                paypalStatus: result.status,
            });
            res.json(final);
        } catch (paypalErr) {
            const final = await recordPaypalResult(updated.id, { paypalOrderId: null, paypalStatus: "EXECUTION_FAILED" });
            res.status(200).json({ ...final, paypalError: (paypalErr as Error).message });
        }
    } catch (err) {
        res.status(500).json({ error: "approve_failed", message: (err as Error).message });
    }
});

requestsRouter.post("/:id/reject", requireManager, async (req, res) => {
    try {
        const updated = await setApprovalStatus(req.params.id, "rejected");
        if (!updated) {
            res.status(404).json({ error: "not_found_or_already_decided" });
            return;
        }
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: "reject_failed", message: (err as Error).message });
    }
});
