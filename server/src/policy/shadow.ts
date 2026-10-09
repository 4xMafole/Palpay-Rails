import { evaluateRequest } from "../policy/engine.js";
import type { MissionDraft, MissionRecord, PurchaseRequestInput } from "../policy/types.js";

export interface ShadowProbe {
    label: string;
    rationale: string;
    input: Omit<PurchaseRequestInput, "missionId">;
}

export interface ShadowResult extends ShadowProbe {
    decision: string;
    matchedRules: string[];
    failedRules: string[];
    runningSpend: number;
}

/**
 * Builds a representative set of purchase attempts for a draft policy: one that
 * should pass, plus one probe per boundary the mission defines.
 */
export function buildProbes(draft: MissionDraft): ShadowProbe[] {
    const approvedVendor = draft.vendorAllowlist[0] ?? "Approved Vendor";
    const currency = draft.currency;
    const typical = Math.max(0.01, Math.round(draft.maxAmount * 0.5 * 100) / 100);
    const overCap = Math.round((draft.maxAmount + 10) * 100) / 100;

    const probes: ShadowProbe[] = [
        {
            label: `Typical purchase — ${currency} ${typical.toFixed(2)}`,
            rationale: "A normal, in-policy purchase from an approved vendor.",
            input: {
                vendor: approvedVendor,
                itemDescription: "Representative in-policy purchase",
                amount: typical,
                currency,
                isRecurring: false,
            },
        },
        {
            label: `Same price, but a subscription`,
            rationale: "Checks whether recurring charges slip through at an allowed price.",
            input: {
                vendor: approvedVendor,
                itemDescription: "Same item billed monthly",
                amount: typical,
                currency,
                isRecurring: true,
            },
        },
        {
            label: "Unapproved vendor",
            rationale: "Checks the vendor allowlist actually holds.",
            input: {
                vendor: "Unlisted Vendor Co",
                itemDescription: "Same item from a different supplier",
                amount: typical,
                currency,
                isRecurring: false,
            },
        },
        {
            label: `Over the per-payment cap — ${currency} ${overCap.toFixed(2)}`,
            rationale: "Checks the single-payment limit.",
            input: {
                vendor: approvedVendor,
                itemDescription: "Oversized single purchase",
                amount: overCap,
                currency,
                isRecurring: false,
            },
        },
        {
            label: "Incomplete request",
            rationale: "Ambiguous requests should escalate to you, not auto-approve.",
            input: {
                vendor: "",
                itemDescription: "",
                amount: typical,
                currency,
                isRecurring: false,
            },
        },
    ];

    // Repeat the typical purchase to show how far the cumulative budget actually
    // stretches. Probe 1 already consumed one purchase worth, so adding `affordable`
    // more is enough to reach (and cross) the limit. Capped so a generous budget
    // doesn't produce a huge list.
    const affordable = Math.max(1, Math.floor(draft.totalBudget / typical));
    const repeats = Math.min(affordable, 3);
    for (let i = 0; i < repeats; i++) {
        const purchaseNumber = i + 2;
        probes.push({
            label: `Repeat purchase #${purchaseNumber} — ${currency} ${typical.toFixed(2)}`,
            rationale: `This budget funds about ${affordable} purchase(s) of this size in total.`,
            input: {
                vendor: approvedVendor,
                itemDescription: `Repeat purchase number ${purchaseNumber}`,
                amount: typical,
                currency,
                isRecurring: false,
            },
        });
    }

    return probes;
}

/**
 * Shadow mode: runs probes through the real policy engine without writing anything
 * or touching PayPal, so a manager can see what a draft policy would actually do
 * before activating it.
 */
export function runShadowTest(draft: MissionDraft, now: Date = new Date()): ShadowResult[] {
    const probes = buildProbes(draft);

    // A draft has no id/status yet; evaluate it as if it were already active.
    const asMission: MissionRecord = {
        ...draft,
        id: "00000000-0000-0000-0000-000000000000",
        rawInstruction: "",
        status: "active",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
    };

    let runningSpend = 0;
    return probes.map((probe) => {
        const result = evaluateRequest(
            asMission,
            { ...probe.input, missionId: asMission.id },
            { spentToDate: runningSpend },
            now,
        );
        // Only an allowed purchase would actually consume budget.
        if (result.decision === "ALLOWED") {
            runningSpend += probe.input.amount;
        }
        return {
            ...probe,
            decision: result.decision,
            matchedRules: result.matchedRules,
            failedRules: result.failedRules,
            runningSpend,
        };
    });
}
