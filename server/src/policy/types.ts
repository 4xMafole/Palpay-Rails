import { z } from "zod";

// Only configurable escalation trigger for the MVP: near-limit amounts.
// Hard rule violations (wrong vendor, subscription, expired, over-limit) are
// never configurable — they always BLOCK, per the product spec.
export const APPROVAL_TRIGGERS = ["near_limit"] as const;
export type ApprovalTrigger = (typeof APPROVAL_TRIGGERS)[number];

export const MissionStatusSchema = z.enum(["draft", "active", "expired", "cancelled"]);
export type MissionStatus = z.infer<typeof MissionStatusSchema>;

// Structured policy fields a manager must review and confirm before a mission goes active.
export const MissionDraftSchema = z
    .object({
        title: z.string().trim().min(1).max(120),
        purpose: z.string().trim().min(1).max(500),
        vendorAllowlist: z.array(z.string().trim().min(1)).min(1),
        maxAmount: z.number().positive(),
        // Cumulative cap for the whole mission. Without this, maxAmount alone only
        // limits a single payment and an agent can overspend in small chunks.
        totalBudget: z.number().positive(),
        currency: z
            .string()
            .trim()
            .length(3)
            .transform((c) => c.toUpperCase()),
        allowRecurring: z.boolean(),
        approvalTriggers: z.array(z.enum(APPROVAL_TRIGGERS)).default([]),
        expiresAt: z.string().datetime(),
    })
    .refine((m) => m.totalBudget >= m.maxAmount, {
        message: "totalBudget must be greater than or equal to maxAmount",
        path: ["totalBudget"],
    });
export type MissionDraft = z.infer<typeof MissionDraftSchema>;

// .refine() returns a ZodEffects, which can't be .extend()ed — rebuild from the
// same field definitions instead of duplicating them by hand.
export const MissionRecordSchema = MissionDraftSchema.innerType().extend({
    id: z.string().uuid(),
    rawInstruction: z.string(),
    status: MissionStatusSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
});
export type MissionRecord = z.infer<typeof MissionRecordSchema>;

export const DecisionSchema = z.enum(["ALLOWED", "NEEDS_APPROVAL", "BLOCKED"]);
export type Decision = z.infer<typeof DecisionSchema>;

// Deliberately permissive at the HTTP boundary: only type/length checked here.
// Whether the data is complete enough to decide stays a policy-engine concern,
// so ambiguous/incomplete requests resolve to NEEDS_APPROVAL, not a 400.
export const PurchaseRequestInputSchema = z.object({
    missionId: z.string().uuid(),
    vendor: z.string().trim().max(200).default(""),
    itemDescription: z.string().trim().max(500).default(""),
    amount: z.number().finite(),
    currency: z.string().trim().max(10).default(""),
    isRecurring: z.boolean().default(false),
});
export type PurchaseRequestInput = z.infer<typeof PurchaseRequestInputSchema>;

export interface EvaluationResult {
    decision: Decision;
    matchedRules: string[];
    failedRules: string[];
}

/** Mission state that can change between a request being decided and actually paid. */
export interface SpendContext {
    /** Total already captured for this mission, in the mission's currency. */
    spentToDate: number;
}
