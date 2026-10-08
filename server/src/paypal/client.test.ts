import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PayPalClient } from "./client.js";

interface MockResponse {
    ok: boolean;
    status?: number;
    body: unknown;
}

function mockFetchSequence(responses: MockResponse[]) {
    let call = 0;
    return vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => {
        const response = responses[call] ?? responses[responses.length - 1];
        call += 1;
        return {
            ok: response.ok,
            status: response.status ?? (response.ok ? 200 : 400),
            json: async () => response.body,
        } as Response;
    });
}

describe("PayPalClient", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("creates and captures an order, sending distinct idempotency keys for each step", async () => {
        const fetchMock = mockFetchSequence([
            { ok: true, body: { access_token: "token-123", expires_in: 3600 } },
            { ok: true, body: { id: "ORDER-1", status: "CREATED" } },
            { ok: true, body: { id: "ORDER-1", status: "COMPLETED" } },
        ]);
        vi.stubGlobal("fetch", fetchMock);

        const client = new PayPalClient();
        const result = await client.createAndCaptureOrder({
            amount: 19,
            currency: "USD",
            description: "One-time transcription",
            requestId: "req-1",
        });

        expect(result).toEqual({ orderId: "ORDER-1", status: "COMPLETED" });
        expect(fetchMock).toHaveBeenCalledTimes(3);

        const createCall = fetchMock.mock.calls[1];
        expect(createCall[1]?.headers).toMatchObject({ "PayPal-Request-Id": "create-req-1" });

        const captureCall = fetchMock.mock.calls[2];
        expect(captureCall[1]?.headers).toMatchObject({ "PayPal-Request-Id": "capture-req-1" });
    });

    it("reuses the cached OAuth token across multiple calls", async () => {
        const fetchMock = mockFetchSequence([
            { ok: true, body: { access_token: "token-123", expires_in: 3600 } },
            { ok: true, body: { id: "ORDER-1", status: "CREATED" } },
            { ok: true, body: { id: "ORDER-2", status: "CREATED" } },
        ]);
        vi.stubGlobal("fetch", fetchMock);

        const client = new PayPalClient();
        await client.createOrder({ amount: 10, currency: "USD", description: "a", requestId: "req-1" });
        await client.createOrder({ amount: 10, currency: "USD", description: "b", requestId: "req-2" });

        const oauthCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes("/oauth2/token"));
        expect(oauthCalls).toHaveLength(1);
    });

    it("throws when PayPal returns a non-ok response, without a second (phantom) call", async () => {
        const fetchMock = mockFetchSequence([
            { ok: true, body: { access_token: "token-123", expires_in: 3600 } },
            { ok: false, status: 422, body: { message: "Invalid amount" } },
        ]);
        vi.stubGlobal("fetch", fetchMock);

        const client = new PayPalClient();
        await expect(
            client.createOrder({ amount: -1, currency: "USD", description: "bad", requestId: "req-1" }),
        ).rejects.toThrow(/PayPal create order failed/);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
