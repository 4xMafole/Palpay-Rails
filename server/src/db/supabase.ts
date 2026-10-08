import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { env } from "../config/env.js";

// Realtime isn't used (the app polls), but supabase-js always constructs a
// RealtimeClient and Node 20 has no native WebSocket — polyfill it.
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    realtime: { transport: WebSocket as never },
});
