import { evaluateRequest } from "../policy/engine.js";
import type { MissionRecord, PurchaseRequestInput } from "../policy/types.js";
import { getMissionSpentToDate, createRequest, recordPaypalResult, type RequestRecord } from "../db/requests.js";
import { paypalClient } from "../paypal/client.js";
import { sendApprovalPush } from "../push/fcm.js";
import { explainDecision } from "../llm/gemini.js";

export interface ProcessResult {
    record: RequestRecord;
    paypalError?: string;
}

/**
 * The single path by which a proposed purchase becomes a decision (and possibly a
 * payment). Shared by the agent-facing endpoint and the demo simulator so there is
 * exactly one implementation of the money-moving logic.
 */
export async function processPurchaseRequest(
    mission: MissionRecord,
    input: PurchaseRequestInput,
    options: { explain?: boolean } = {},
): Promise<ProcessResult> {
    const spentToDate = await getMissionSpentToDate(mission.id);
    const evaluation = evaluateRequest(mission, input, { spentToDate });

    // Explain-only, generated after the decision is already final; never allowed
    // to affect it. A failure here just means no explanation text, nothing more.
    let explanation: string | null = null;
    if (options.explain !== false) {
        try {
            explanation = await explainDecision({
                decision: evaluation.decision,
                matchedRules: evaluation.matchedRules,
                failedRules: evaluation.failedRules,
                missionTitle: mission.title,
                missionPurpose: mission.purpose,
                vendor: input.vendor,
                itemDescription: input.itemDescription,
                amount: input.amount,
                currency: input.currency,
                isRecurring: input.isRecurring,
                spentToDate,
                totalBudget: mission.totalBudget,
            });
        } catch {
            // Swallow — explanation is a display nicety, not part of the decision.
        }
    }

    let record = await createRequest({
        input,
        decision: evaluation.decision,
        matchedRules: evaluation.matchedRules,
        failedRules: evaluation.failedRules,
        explanation,
    });

    if (evaluation.decision === "ALLOWED") {
        try {
            const result = await paypalClient.createAndCaptureOrder({
                amount: input.amount,
                currency: input.currency,
                description: input.itemDescription,
                requestId: record.id,
                vendor: input.vendor,
            });
            record = await recordPaypalResult(record.id, {
                paypalOrderId: result.orderId,
                paypalStatus: result.status,
            });
        } catch (paypalErr) {
            // The policy decision stands; only payment execution failed. Surface it
            // distinctly so the audit feed doesn't read as "Allowed and paid".
            record = await recordPaypalResult(record.id, { paypalOrderId: null, paypalStatus: "EXECUTION_FAILED" });
            return { record, paypalError: (paypalErr as Error).message };
        }
    }

    if (evaluation.decision === "NEEDS_APPROVAL") {
        await sendApprovalPush({
            requestId: record.id,
            missionTitle: mission.title,
            vendor: input.vendor,
            amount: input.amount,
            currency: input.currency,
        });
    }

    return { record };
}
