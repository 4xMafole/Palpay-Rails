import { supabase } from "./supabase.js";
import type { Decision, PurchaseRequestInput } from "../policy/types.js";

export interface RequestRecord {
    id: string;
    missionId: string;
    vendor: string;
    itemDescription: string;
    amount: number;
    currency: string;
    isRecurring: boolean;
    decision: Decision;
    matchedRules: string[];
    failedRules: string[];
    explanation: string | null;
    approvalStatus: "pending" | "approved" | "rejected" | null;
    decidedAt: string | null;
    paypalOrderId: string | null;
    paypalStatus: string | null;
    createdAt: string;
}

interface RequestRow {
    id: string;
    mission_id: string;
    vendor: string;
    item_description: string;
    amount: number;
    currency: string;
    is_recurring: boolean;
    decision: Decision;
    matched_rules: string[];
    failed_rules: string[];
    explanation: string | null;
    approval_status: RequestRecord["approvalStatus"];
    decided_at: string | null;
    paypal_order_id: string | null;
    paypal_status: string | null;
    created_at: string;
}

function toRequestRecord(row: RequestRow): RequestRecord {
    return {
        id: row.id,
        missionId: row.mission_id,
        vendor: row.vendor,
        itemDescription: row.item_description,
        amount: Number(row.amount),
        currency: row.currency,
        isRecurring: row.is_recurring,
        decision: row.decision,
        matchedRules: row.matched_rules,
        failedRules: row.failed_rules,
        explanation: row.explanation,
        approvalStatus: row.approval_status,
        decidedAt: row.decided_at,
        paypalOrderId: row.paypal_order_id,
        paypalStatus: row.paypal_status,
        createdAt: row.created_at,
    };
}

export interface CreateRequestParams {
    input: PurchaseRequestInput;
    decision: Decision;
    matchedRules: string[];
    failedRules: string[];
    explanation?: string | null;
}

export async function createRequest(params: CreateRequestParams): Promise<RequestRecord> {
    const { input, decision, matchedRules, failedRules, explanation } = params;

    const { data, error } = await supabase
        .from("requests")
        .insert({
            mission_id: input.missionId,
            vendor: input.vendor,
            item_description: input.itemDescription,
            amount: input.amount,
            currency: input.currency,
            is_recurring: input.isRecurring,
            decision,
            matched_rules: matchedRules,
            failed_rules: failedRules,
            explanation: explanation ?? null,
            approval_status: decision === "NEEDS_APPROVAL" ? "pending" : null,
        })
        .select()
        .single();

    if (error || !data) {
        throw new Error(`Failed to create request: ${error?.message ?? "unknown error"}`);
    }
    return toRequestRecord(data as RequestRow);
}

export async function listRequests(): Promise<RequestRecord[]> {
    const { data, error } = await supabase.from("requests").select().order("created_at", { ascending: false });
    if (error) {
        throw new Error(`Failed to list requests: ${error.message}`);
    }
    return (data as RequestRow[]).map(toRequestRecord);
}

export async function getRequestById(id: string): Promise<RequestRecord | null> {
    const { data, error } = await supabase.from("requests").select().eq("id", id).maybeSingle();
    if (error) {
        throw new Error(`Failed to fetch request ${id}: ${error.message}`);
    }
    return data ? toRequestRecord(data as RequestRow) : null;
}

export interface PaypalResult {
    paypalOrderId: string | null;
    paypalStatus: string;
}

/** Records the outcome of an actual PayPal sandbox call against an already-decided request. */
export async function recordPaypalResult(id: string, result: PaypalResult): Promise<RequestRecord> {
    const { data, error } = await supabase
        .from("requests")
        .update({ paypal_order_id: result.paypalOrderId, paypal_status: result.paypalStatus })
        .eq("id", id)
        .select()
        .single();

    if (error || !data) {
        throw new Error(`Failed to record PayPal result for request ${id}: ${error?.message ?? "unknown error"}`);
    }
    return toRequestRecord(data as RequestRow);
}

/** Marks approval-status transitions (approve/reject), wired up to PayPal capture in Phase 5. */
export async function setApprovalStatus(
    id: string,
    approvalStatus: "approved" | "rejected",
): Promise<RequestRecord | null> {
    const { data, error } = await supabase
        .from("requests")
        .update({ approval_status: approvalStatus, decided_at: new Date().toISOString() })
        .eq("id", id)
        .eq("approval_status", "pending")
        .select()
        .maybeSingle();

    if (error) {
        throw new Error(`Failed to update approval status for request ${id}: ${error.message}`);
    }
    return data ? toRequestRecord(data as RequestRow) : null;
}
