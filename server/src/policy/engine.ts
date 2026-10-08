import type { EvaluationResult, MissionRecord, PurchaseRequestInput } from "./types.js";

// A request within this fraction of the mission's max amount escalates to
// NEEDS_APPROVAL instead of auto-allowing, when the mission opts into 'near_limit'.
const NEAR_LIMIT_RATIO = 0.9;

/**
 * Deterministic policy decision. No LLM involved: same mission + same request
 * always produces the same decision. Evaluates every rule (rather than
 * short-circuiting) so the audit feed can show the full matched/failed list.
 */
export function evaluateRequest(
    mission: MissionRecord,
    request: PurchaseRequestInput,
    now: Date = new Date(),
): EvaluationResult {
    const matchedRules: string[] = [];
    const failedRules: string[] = [];

    const record = (name: string, passed: boolean): boolean => {
        (passed ? matchedRules : failedRules).push(name);
        return passed;
    };

    // Fail closed: incomplete/ambiguous requests ask the user rather than silently approving.
    const hasCompleteFields = record(
        "valid_request_fields",
        request.vendor.length > 0 &&
        request.itemDescription.length > 0 &&
        request.amount > 0 &&
        request.currency.length === 3,
    );
    if (!hasCompleteFields) {
        return { decision: "NEEDS_APPROVAL", matchedRules, failedRules };
    }

    // Hard rules below always BLOCK on failure; none are user-configurable.
    const isActive = record("mission_active", mission.status === "active");
    const notExpired = record("mission_not_expired", now.getTime() <= new Date(mission.expiresAt).getTime());
    const vendorAllowed = record(
        "vendor_allowed",
        mission.vendorAllowlist.some((v) => v.trim().toLowerCase() === request.vendor.trim().toLowerCase()),
    );
    const recurringAllowed = record("recurring_allowed", !request.isRecurring || mission.allowRecurring);
    const currencyMatches = record(
        "currency_match",
        request.currency.toUpperCase() === mission.currency.toUpperCase(),
    );
    const withinMaxAmount = record("within_max_amount", request.amount <= mission.maxAmount);

    const hardBlocked = !isActive || !notExpired || !vendorAllowed || !recurringAllowed || !currencyMatches || !withinMaxAmount;
    if (hardBlocked) {
        return { decision: "BLOCKED", matchedRules, failedRules };
    }

    // Soft, user-configurable escalation boundary.
    const nearLimitEnabled = mission.approvalTriggers.includes("near_limit");
    const crossesNearLimit = nearLimitEnabled && request.amount >= mission.maxAmount * NEAR_LIMIT_RATIO;
    const staysBelowNearLimit = record("below_near_limit_threshold", !crossesNearLimit);
    if (!staysBelowNearLimit) {
        return { decision: "NEEDS_APPROVAL", matchedRules, failedRules };
    }

    return { decision: "ALLOWED", matchedRules, failedRules };
}
