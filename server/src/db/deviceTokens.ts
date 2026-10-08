import { supabase } from "./supabase.js";

/** Registers (or re-registers) the manager's device for push notifications. Idempotent on token. */
export async function registerDeviceToken(fcmToken: string): Promise<void> {
    const { error } = await supabase.from("device_tokens").upsert({ fcm_token: fcmToken }, { onConflict: "fcm_token" });
    if (error) {
        throw new Error(`Failed to register device token: ${error.message}`);
    }
}

export async function listDeviceTokens(): Promise<string[]> {
    const { data, error } = await supabase.from("device_tokens").select("fcm_token");
    if (error) {
        throw new Error(`Failed to list device tokens: ${error.message}`);
    }
    return (data as Array<{ fcm_token: string }>).map((row) => row.fcm_token);
}
