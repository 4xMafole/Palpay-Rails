import { defineConfig } from "vitest/config";

// Dummy values only — never real secrets. Lets unit tests import modules that
// eagerly validate process.env (see src/config/env.ts) without needing a real .env.
export default defineConfig({
    test: {
        env: {
            SUPABASE_URL: "http://localhost:54321",
            SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
            PAYPAL_CLIENT_ID: "test-client-id",
            PAYPAL_CLIENT_SECRET: "test-client-secret",
            PAYPAL_ENVIRONMENT: "SANDBOX",
            PAYPAL_SANDBOX_CARD_NUMBER: "4032039999999999",
            PAYPAL_SANDBOX_CARD_EXPIRY: "2028-12",
            PAYPAL_SANDBOX_CARD_CVV: "123",
            PAYPAL_SANDBOX_CARD_NAME: "Test Buyer",
            GEMINI_API_KEY: "test-gemini-key",
            GEMINI_MODEL: "gemini-flash-lite-latest",
            FIREBASE_PROJECT_ID: "test-project",
            FIREBASE_CLIENT_EMAIL: "test@example.com",
            FIREBASE_PRIVATE_KEY: "test-private-key",
            AGENT_API_KEY: "test-agent-key-0123456789abcdef",
            MANAGER_API_KEY: "test-manager-key-0123456789abcdef",
        },
    },
});
