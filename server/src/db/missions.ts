import { supabase } from "./supabase.js";
import type { MissionDraft, MissionRecord, MissionStatus } from "../policy/types.js";

interface MissionRow {
    id: string;
    title: string;
    raw_instruction: string;
    purpose: string;
    vendor_allowlist: string[];
    max_amount: number;
    currency: string;
    allow_recurring: boolean;
    approval_triggers: string[];
    status: MissionStatus;
    expires_at: string;
    created_at: string;
    updated_at: string;
}

function toMissionRecord(row: MissionRow): MissionRecord {
    return {
        id: row.id,
        title: row.title,
        rawInstruction: row.raw_instruction,
        purpose: row.purpose,
        vendorAllowlist: row.vendor_allowlist,
        maxAmount: Number(row.max_amount),
        currency: row.currency,
        allowRecurring: row.allow_recurring,
        approvalTriggers: row.approval_triggers as MissionRecord["approvalTriggers"],
        status: row.status,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export async function createMission(draft: MissionDraft, rawInstruction: string): Promise<MissionRecord> {
    const { data, error } = await supabase
        .from("missions")
        .insert({
            title: draft.title,
            raw_instruction: rawInstruction,
            purpose: draft.purpose,
            vendor_allowlist: draft.vendorAllowlist,
            max_amount: draft.maxAmount,
            currency: draft.currency,
            allow_recurring: draft.allowRecurring,
            approval_triggers: draft.approvalTriggers,
            status: "active",
            expires_at: draft.expiresAt,
        })
        .select()
        .single();

    if (error || !data) {
        throw new Error(`Failed to create mission: ${error?.message ?? "unknown error"}`);
    }
    return toMissionRecord(data as MissionRow);
}

export async function listMissions(): Promise<MissionRecord[]> {
    const { data, error } = await supabase.from("missions").select().order("created_at", { ascending: false });
    if (error) {
        throw new Error(`Failed to list missions: ${error.message}`);
    }
    return (data as MissionRow[]).map(toMissionRecord);
}

export async function getMissionById(id: string): Promise<MissionRecord | null> {
    const { data, error } = await supabase.from("missions").select().eq("id", id).maybeSingle();
    if (error) {
        throw new Error(`Failed to fetch mission ${id}: ${error.message}`);
    }
    return data ? toMissionRecord(data as MissionRow) : null;
}

export async function setMissionStatus(id: string, status: MissionStatus): Promise<MissionRecord | null> {
    const { data, error } = await supabase
        .from("missions")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .maybeSingle();
    if (error) {
        throw new Error(`Failed to update mission ${id}: ${error.message}`);
    }
    return data ? toMissionRecord(data as MissionRow) : null;
}
