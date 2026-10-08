import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { env } from "../config/env.js";
import { listDeviceTokens } from "../db/deviceTokens.js";

// Env vars commonly store the private key with literal "\n" sequences; convert to real newlines.
const privateKey = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");

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
