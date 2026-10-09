import { env } from "../config/env.js";

// PayPal sandbox integration via direct REST calls (Orders API).
//
// Note: @paypal/agent-toolkit was evaluated and rejected — as of Oct 2026 its published
// release (1.11.0) bundles @langchain/core, langsmith, jsondiffpatch, and mathjs versions
// with unpatched high-severity advisories (incl. prototype pollution and a LangChain
// deserialization bug that enables secret extraction, GHSA-r399-636x-v7f6), and npm has no
// non-breaking fix available. Calling the documented PayPal Orders API directly avoids that
// dependency tree entirely while keeping the same sandbox flow.
//
// This is the ONLY module allowed to call PayPal. It never makes a policy decision itself.

const BASE_URL = env.PAYPAL_ENVIRONMENT === "SANDBOX" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";

export interface OrderResult {
    orderId: string;
    status: string;
}

export interface CreateOrderParams {
    amount: number;
    currency: string;
    description: string;
    /** Our internal request id — doubles as the PayPal idempotency key so retries never double-pay. */
    requestId: string;
    /** Approved vendor name, resolved to a real payee account when a mapping is configured. */
    vendor?: string;
}

interface PayPalTokenResponse {
    access_token: string;
    expires_in: number;
}

interface PayPalOrderResponse {
    id: string;
    status: string;
}

interface CachedToken {
    accessToken: string;
    expiresAt: number;
}

// Maps an approved vendor name to the sandbox merchant that receives the money, so
// the allowlist governs the actual payee and not just a label on the request.
// Vendors with no mapping fall back to the app's own merchant account (see README).
function parseVendorPayees(raw: string): Record<string, string> {
    if (!raw.trim()) {
        return {};
    }
    try {
        const parsed = JSON.parse(raw) as Record<string, string>;
        return Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k.trim().toLowerCase(), v]));
    } catch {
        throw new Error("PAYPAL_VENDOR_PAYEES must be valid JSON, e.g. {\"Acme Transcribe\":\"seller@example.com\"}");
    }
}

const VENDOR_PAYEES = parseVendorPayees(env.PAYPAL_VENDOR_PAYEES);

export function resolvePayeeEmail(vendor: string | undefined): string | undefined {
    return vendor ? VENDOR_PAYEES[vendor.trim().toLowerCase()] : undefined;
}

/**
 * Thin wrapper around PayPal's OAuth + Orders REST endpoints. Instantiated as a
 * singleton for the app; tests construct their own instance for isolated token state.
 */
export class PayPalClient {
    private cachedToken: CachedToken | null = null;

    private async getAccessToken(): Promise<string> {
        if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 60_000) {
            return this.cachedToken.accessToken;
        }

        const basicAuth = Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString("base64");
        const response = await fetch(`${BASE_URL}/v1/oauth2/token`, {
            method: "POST",
            headers: {
                Authorization: `Basic ${basicAuth}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: "grant_type=client_credentials",
        });

        if (!response.ok) {
            throw new Error(`PayPal OAuth token request failed with status ${response.status}`);
        }

        const data = (await response.json()) as PayPalTokenResponse;
        this.cachedToken = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
        return this.cachedToken.accessToken;
    }

    private async request(path: string, idempotencyKey: string): Promise<PayPalOrderResponse> {
        const token = await this.getAccessToken();
        const response = await fetch(`${BASE_URL}${path}`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                "PayPal-Request-Id": idempotencyKey,
            },
        });

        const data = (await response.json()) as PayPalOrderResponse & { details?: unknown };
        if (!response.ok) {
            throw new Error(`PayPal request to ${path} failed (${response.status}): ${JSON.stringify(data)}`);
        }
        return data;
    }

    async createOrder(params: CreateOrderParams): Promise<OrderResult> {
        const token = await this.getAccessToken();
        const payeeEmail = resolvePayeeEmail(params.vendor);
        const response = await fetch(`${BASE_URL}/v2/checkout/orders`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                "PayPal-Request-Id": `create-${params.requestId}`,
            },
            body: JSON.stringify({
                intent: "CAPTURE",
                purchase_units: [
                    {
                        amount: { currency_code: params.currency, value: params.amount.toFixed(2) },
                        description: params.description.slice(0, 127),
                        ...(payeeEmail ? { payee: { email_address: payeeEmail } } : {}),
                    },
                ],
                // Guest/card payment_source: captures immediately, no buyer redirect needed.
                // This is what makes an ALLOWED decision a true zero-click payment.
                payment_source: {
                    card: {
                        number: env.PAYPAL_SANDBOX_CARD_NUMBER,
                        expiry: env.PAYPAL_SANDBOX_CARD_EXPIRY,
                        security_code: env.PAYPAL_SANDBOX_CARD_CVV,
                        name: env.PAYPAL_SANDBOX_CARD_NAME,
                    },
                },
            }),
        });

        const data = (await response.json()) as PayPalOrderResponse & { details?: unknown };
        if (!response.ok) {
            throw new Error(`PayPal create order failed (${response.status}): ${JSON.stringify(data)}`);
        }
        return { orderId: data.id, status: data.status };
    }

    async captureOrder(orderId: string, requestId: string): Promise<OrderResult> {
        const data = await this.request(`/v2/checkout/orders/${orderId}/capture`, `capture-${requestId}`);
        return { orderId: data.id, status: data.status };
    }

    /** Creates and immediately captures a sandbox order. The only path by which Palpay Rail moves money. */
    async createAndCaptureOrder(params: CreateOrderParams): Promise<OrderResult> {
        const created = await this.createOrder(params);
        // A card payment_source often completes the capture during order creation itself.
        if (created.status === "COMPLETED") {
            return created;
        }
        return this.captureOrder(created.orderId, params.requestId);
    }
}

export const paypalClient = new PayPalClient();
