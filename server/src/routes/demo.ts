import { Router } from "express";
import { env } from "../config/env.js";
import { requireBearerToken } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { createMission } from "../db/missions.js";
import { processPurchaseRequest } from "../services/purchaseRequests.js";
import type { MissionDraft } from "../policy/types.js";

export const demoRouter = Router();

const requireManager = requireBearerToken(env.MANAGER_API_KEY);

const APPROVED_VENDOR = "Acme Transcribe";

/**
 * A self-contained mission sized so each attack below trips exactly ONE rule:
 * $25 per payment, $40 total, one-time only. (After the legitimate $19 purchase,
 * $21 remains — enough for the $19 and $12 attempts to clear the budget check and
 * fail only on their own rule, but not enough for the final $25.)
 */
function buildDemoMission(): MissionDraft {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    return {
        title: `Rogue agent simulation — ${new Date().toISOString().slice(11, 19)}`,
        purpose: "Demo mission: one-time transcription from an approved vendor only.",
        vendorAllowlist: [APPROVED_VENDOR],
        maxAmount: 25,
        totalBudget: 40,
        currency: "USD",
        allowRecurring: false,
        approvalTriggers: [],
        expiresAt,
    };
}

/** Each step targets one specific control, in an order that tells a story. */
const ATTACK_STEPS = [
    {
        label: "Legitimate one-time purchase",
        expectation: "Allowed — pays through PayPal automatically",
        input: {
            vendor: APPROVED_VENDOR,
            itemDescription: "Single file transcription, 30 minutes",
            amount: 19,
            currency: "USD",
            isRecurring: false,
        },
    },
    {
        label: "Same vendor, same $19 — but a subscription",
        expectation: "Blocked — this mission does not allow recurring charges",
        input: {
            vendor: APPROVED_VENDOR,
            itemDescription: "Pro plan, billed monthly, auto-renews",
            amount: 19,
            currency: "USD",
            isRecurring: true,
        },
    },
    {
        label: "Cheaper, but an unapproved vendor",
        expectation: "Blocked — vendor is not on the allowlist",
        input: {
            vendor: "QuickScribe Pro",
            itemDescription: "Single file transcription, faster turnaround",
            amount: 12,
            currency: "USD",
            isRecurring: false,
        },
    },
    {
        label: "At the per-payment cap, but over the total budget",
        expectation: "Blocked — would exceed what this mission can ever spend",
        input: {
            vendor: APPROVED_VENDOR,
            itemDescription: "Another transcription batch",
            amount: 25,
            currency: "USD",
            isRecurring: false,
        },
    },
    {
        label: "Vague request with missing details",
        expectation: "Escalated — fails closed and asks you instead of guessing",
        input: {
            vendor: "",
            itemDescription: "",
            amount: 5,
            currency: "USD",
            isRecurring: false,
        },
    },
] as const;

/**
 * One-tap demo: creates a fresh mission and runs a scripted rogue-agent attack
 * through the real policy engine and real PayPal sandbox, so all three outcomes
 * can be seen without configuring an agent or LLM first.
 *
 * Explanations are skipped here (one LLM call per step would make it slow); the
 * matched/failed rules still show exactly why each decision was made.
 */
demoRouter.post("/simulate", requireManager, rateLimit({ windowMs: 60_000, max: 6 }), async (_req, res) => {
    try {
        const mission = await createMission(buildDemoMission(), "One-tap rogue agent simulation");

        const steps = [];
        for (const step of ATTACK_STEPS) {
            const { record, paypalError } = await processPurchaseRequest(
                mission,
                { ...step.input, missionId: mission.id },
                { explain: false },
            );
            steps.push({
                label: step.label,
                expectation: step.expectation,
                requestId: record.id,
                decision: record.decision,
                matchedRules: record.matchedRules,
                failedRules: record.failedRules,
                amount: record.amount,
                currency: record.currency,
                vendor: record.vendor,
                paypalOrderId: record.paypalOrderId,
                paypalStatus: record.paypalStatus,
                ...(paypalError ? { paypalError } : {}),
            });
        }

        res.json({
            missionId: mission.id,
            missionTitle: mission.title,
            totalBudget: mission.totalBudget,
            currency: mission.currency,
            steps,
            summary: {
                allowed: steps.filter((s) => s.decision === "ALLOWED").length,
                needsApproval: steps.filter((s) => s.decision === "NEEDS_APPROVAL").length,
                blocked: steps.filter((s) => s.decision === "BLOCKED").length,
            },
        });
    } catch (err) {
        res.status(500).json({ error: "simulation_failed", message: (err as Error).message });
    }
});
