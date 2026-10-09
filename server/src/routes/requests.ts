import { Router } from "express";
import { env } from "../config/env.js";
import { requireBearerToken } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { evaluateRequest } from "../policy/engine.js";
import { PurchaseRequestInputSchema } from "../policy/types.js";
import { getMissionById } from "../db/missions.js";
import {
    createRequest,
    getMissionSpentToDate,
    getRequestById,
    listRequests,
    recordPaypalResult,
    setApprovalStatus,
    updateRuleTrace,
} from "../db/requests.js";
import { paypalClient } from "../paypal/client.js";
import { processPurchaseRequest } from "../services/purchaseRequests.js";

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

        const { record, paypalError } = await processPurchaseRequest(mission, parsed.data);
        res.status(201).json(paypalError ? { ...record, paypalError } : record);
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

// Approving re-runs the full policy check against CURRENT mission state before paying.
// The decision made at submission time is not trusted here: the mission may have been
// cancelled, expired, or had its budget consumed by other requests in the meantime.
requestsRouter.post("/:id/approve", requireManager, async (req, res) => {
    try {
        const request = await getRequestById(req.params.id);
        if (!request || request.approvalStatus !== "pending") {
            res.status(404).json({ error: "not_found_or_already_decided" });
            return;
        }

        const mission = await getMissionById(request.missionId);
        if (!mission) {
            res.status(404).json({ error: "mission_not_found" });
            return;
        }

        const spentToDate = await getMissionSpentToDate(mission.id);
        const recheck = evaluateRequest(
            mission,
            {
                missionId: request.missionId,
                vendor: request.vendor,
                itemDescription: request.itemDescription,
                amount: request.amount,
                currency: request.currency,
                isRecurring: request.isRecurring,
            },
            { spentToDate },
        );

        if (recheck.decision === "BLOCKED") {
            const reason = `Approval refused: the mission no longer permits this payment (${recheck.failedRules.join(", ")}).`;
            const rejected = await setApprovalStatus(request.id, "rejected", reason);
            if (!rejected) {
                res.status(404).json({ error: "not_found_or_already_decided" });
                return;
            }
            await updateRuleTrace(request.id, recheck.matchedRules, recheck.failedRules);
            res.status(409).json({
                error: "revalidation_failed",
                failedRules: recheck.failedRules,
                request: { ...rejected, matchedRules: recheck.matchedRules, failedRules: recheck.failedRules },
            });
            return;
        }

        const updated = await setApprovalStatus(request.id, "approved");
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
                vendor: updated.vendor,
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
