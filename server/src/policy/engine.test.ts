import { describe, expect, it } from "vitest";
import { evaluateRequest } from "./engine.js";
import type { MissionRecord, PurchaseRequestInput } from "./types.js";

const NOW = new Date("2026-10-08T12:00:00.000Z");

function makeMission(overrides: Partial<MissionRecord> = {}): MissionRecord {
    return {
        id: "11111111-1111-1111-1111-111111111111",
        title: "Transcription tool",
        rawInstruction: "Find a one-time transcription service, approved vendor, under $25, no subscription.",
        purpose: "One-time video transcription for project X",
        vendorAllowlist: ["Acme Transcribe"],
        maxAmount: 25,
        currency: "USD",
        allowRecurring: false,
        approvalTriggers: [],
        status: "active",
        expiresAt: "2026-12-01T00:00:00.000Z",
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:00:00.000Z",
        ...overrides,
    };
}

function makeRequest(overrides: Partial<PurchaseRequestInput> = {}): PurchaseRequestInput {
    return {
        missionId: "11111111-1111-1111-1111-111111111111",
        vendor: "Acme Transcribe",
        itemDescription: "One-time transcription of a 30-minute video",
        amount: 19,
        currency: "USD",
        isRecurring: false,
        ...overrides,
    };
}

describe("evaluateRequest", () => {
    it("allows a compliant one-time request from an approved vendor under the limit", () => {
        const result = evaluateRequest(makeMission(), makeRequest(), NOW);
        expect(result.decision).toBe("ALLOWED");
        expect(result.failedRules).toEqual([]);
    });

    it("blocks the same price when it is a recurring subscription", () => {
        const result = evaluateRequest(makeMission(), makeRequest({ isRecurring: true }), NOW);
        expect(result.decision).toBe("BLOCKED");
        expect(result.failedRules).toContain("recurring_allowed");
    });

    it("blocks a request from a vendor outside the allowlist", () => {
        const result = evaluateRequest(makeMission(), makeRequest({ vendor: "Shady Vendor LLC" }), NOW);
        expect(result.decision).toBe("BLOCKED");
        expect(result.failedRules).toContain("vendor_allowed");
    });

    it("blocks a request exceeding the max amount", () => {
        const result = evaluateRequest(makeMission(), makeRequest({ amount: 30 }), NOW);
        expect(result.decision).toBe("BLOCKED");
        expect(result.failedRules).toContain("within_max_amount");
    });

    it("blocks a request on an expired mission", () => {
        const result = evaluateRequest(makeMission({ expiresAt: "2026-01-01T00:00:00.000Z" }), makeRequest(), NOW);
        expect(result.decision).toBe("BLOCKED");
        expect(result.failedRules).toContain("mission_not_expired");
    });

    it("blocks a request on a non-active (draft/cancelled) mission", () => {
        const result = evaluateRequest(makeMission({ status: "cancelled" }), makeRequest(), NOW);
        expect(result.decision).toBe("BLOCKED");
        expect(result.failedRules).toContain("mission_active");
    });

    it("blocks a currency mismatch", () => {
        const result = evaluateRequest(makeMission(), makeRequest({ currency: "EUR" }), NOW);
        expect(result.decision).toBe("BLOCKED");
        expect(result.failedRules).toContain("currency_match");
    });

    it("escalates to NEEDS_APPROVAL for incomplete/ambiguous request fields instead of blocking", () => {
        const result = evaluateRequest(makeMission(), makeRequest({ vendor: "" }), NOW);
        expect(result.decision).toBe("NEEDS_APPROVAL");
        expect(result.failedRules).toContain("valid_request_fields");
    });

    it("escalates near-limit amounts to NEEDS_APPROVAL only when the mission opts in", () => {
        const mission = makeMission({ approvalTriggers: ["near_limit"] });
        const result = evaluateRequest(mission, makeRequest({ amount: 24 }), NOW);
        expect(result.decision).toBe("NEEDS_APPROVAL");
        expect(result.failedRules).toContain("below_near_limit_threshold");
    });

    it("allows a near-limit amount when the mission has not opted into near_limit escalation", () => {
        const result = evaluateRequest(makeMission(), makeRequest({ amount: 24 }), NOW);
        expect(result.decision).toBe("ALLOWED");
    });
});
