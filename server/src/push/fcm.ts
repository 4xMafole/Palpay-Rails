import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { env } from "../config/env.js";
import { listDeviceTokens } from "../db/deviceTokens.js";

// Local .env stores the PEM with literal "\n" sequences (needs unescaping). Some
// PaaS dashboards (e.g. Render) mangle pasted multi-line secrets, so as a more robust
// alternative FIREBASE_PRIVATE_KEY may instead hold the whole PEM base64-encoded —
// detected by it not starting with the PEM header after trimming.
function resolvePrivateKey(raw: string): string {
    const trimmed = raw.trim();
    if (trimmed.startsWith("-----BEGIN")) {
        return trimmed.replace(/\\n/g, "\n");
    }
    return Buffer.from(trimmed, "base64").toString("utf8");
}

const privateKey = resolvePrivateKey(env.FIREBASE_PRIVATE_KEY);

const app =
    getApps()[0] ??
    initializeApp({
        credential: cert({
            projectId: env.FIREBASE_PROJECT_ID,
            clientEmail: env.FIREBASE_CLIENT_EMAIL,
            privateKey,
        }),
    });

const messaging = getMessaging(app);


/** Pushes a NEEDS_APPROVAL alert to every registered manager device. Best-effort: a failed send is logged, not thrown. */
export async function sendApprovalPush(params: {
    requestId: string;
    missionTitle: string;
    vendor: string;
    amount: number;
    currency: string;
}): Promise<void> {
    const tokens = await listDeviceTokens();
    if (tokens.length === 0) {
        return;
    }

    try {
        await messaging.sendEachForMulticast({
            tokens,
            notification: {
                title: "Approval needed",
                body: `${params.vendor} — ${params.currency} ${params.amount.toFixed(2)} for "${params.missionTitle}"`,
            },
            data: { requestId: params.requestId },
        });
    } catch (err) {
        console.error(`Failed to send approval push for request ${params.requestId}:`, (err as Error).message);
    }
}
