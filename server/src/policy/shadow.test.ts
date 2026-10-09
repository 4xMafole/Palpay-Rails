import { describe, expect, it } from "vitest";
import { runShadowTest } from "./shadow.js";
import type { MissionDraft } from "./types.js";

const NOW = new Date("2026-10-10T12:00:00.000Z");

function makeDraft(overrides: Partial<MissionDraft> = {}): MissionDraft {
    return {
        title: "Transcription budget",
        purpose: "One-time transcription work",
        vendorAllowlist: ["Acme Transcribe"],
        maxAmount: 25,
        totalBudget: 30,
        currency: "USD",
        allowRecurring: false,
        approvalTriggers: [],
        expiresAt: "2026-12-01T00:00:00.000Z",
        ...overrides,
    };
}

describe("runShadowTest", () => {
    it("reports an outcome for every probe without needing a saved mission", () => {
        const results = runShadowTest(makeDraft(), NOW);
        expect(results.length).toBeGreaterThan(0);
        for (const result of results) {
            expect(["ALLOWED", "NEEDS_APPROVAL", "BLOCKED"]).toContain(result.decision);
        }
    });

    it("shows a typical in-policy purchase passing", () => {
        const results = runShadowTest(makeDraft(), NOW);
        expect(results[0].decision).toBe("ALLOWED");
    });

    it("catches a subscription at an otherwise-allowed price", () => {
        const results = runShadowTest(makeDraft(), NOW);
        const subscription = results.find((r) => r.input.isRecurring);
        expect(subscription?.decision).toBe("BLOCKED");
        expect(subscription?.failedRules).toContain("recurring_allowed");
    });

    it("catches an unapproved vendor", () => {
        const results = runShadowTest(makeDraft(), NOW);
        const rogue = results.find((r) => r.input.vendor === "Unlisted Vendor Co");
        expect(rogue?.decision).toBe("BLOCKED");
        expect(rogue?.failedRules).toContain("vendor_allowed");
    });

    it("escalates an incomplete request instead of allowing it", () => {
        const results = runShadowTest(makeDraft(), NOW);
        const vague = results.find((r) => r.input.vendor === "");
        expect(vague?.decision).toBe("NEEDS_APPROVAL");
    });

    it("demonstrates the cumulative budget running out on repeat purchases", () => {
        // $30 budget with a $12.50 typical probe funds two purchases, so the
        // third must be refused on the budget rule rather than any other.
        const results = runShadowTest(makeDraft(), NOW);
        const repeat = results[results.length - 1];
        expect(repeat.decision).toBe("BLOCKED");
        expect(repeat.failedRules).toContain("within_mission_budget");
    });

    it("stops counting spend once the budget is exhausted", () => {
        const results = runShadowTest(makeDraft(), NOW);
        const finalSpend = results[results.length - 1].runningSpend;
        expect(finalSpend).toBeLessThanOrEqual(makeDraft().totalBudget);
    });

    it("only counts allowed probes toward running spend", () => {
        const results = runShadowTest(makeDraft(), NOW);
        const blocked = results.filter((r) => r.decision === "BLOCKED");
        // A blocked probe must never move the running spend figure.
        for (const result of blocked) {
            const index = results.indexOf(result);
            const previous = index === 0 ? 0 : results[index - 1].runningSpend;
            expect(result.runningSpend).toBe(previous);
        }
    });
});
