import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4000),

    SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

    PAYPAL_CLIENT_ID: z.string().min(1),
    PAYPAL_CLIENT_SECRET: z.string().min(1),
    PAYPAL_ENVIRONMENT: z.enum(["SANDBOX", "PRODUCTION"]).default("SANDBOX"),

    // Guest/card payment_source so ALLOWED requests capture with zero buyer redirect.
    // Generate via developer.paypal.com/dashboard > Testing Tools > Generate test card.
    PAYPAL_SANDBOX_CARD_NUMBER: z.string().min(1),
    PAYPAL_SANDBOX_CARD_EXPIRY: z.string().regex(/^\d{4}-\d{2}$/, "expected YYYY-MM"),
    PAYPAL_SANDBOX_CARD_CVV: z.string().min(3).max(4),
    PAYPAL_SANDBOX_CARD_NAME: z.string().min(1).default("Palpay Rail Sandbox Buyer"),

    GEMINI_API_KEY: z.string().min(1),
    // Override if the default model hits its free-tier daily quota — any valid
    // model id from https://ai.google.dev/gemini-api/docs/models works here.
    GEMINI_MODEL: z.string().min(1).default("gemini-flash-lite-latest"),

    FIREBASE_PROJECT_ID: z.string().min(1),
    FIREBASE_CLIENT_EMAIL: z.string().min(1),
    FIREBASE_PRIVATE_KEY: z.string().min(1),

    AGENT_API_KEY: z.string().min(16, "AGENT_API_KEY must be a long random secret"),
    MANAGER_API_KEY: z.string().min(16, "MANAGER_API_KEY must be a long random secret"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
        console.error("Invalid environment configuration:");
        console.error(parsed.error.flatten().fieldErrors);
        throw new Error("Environment validation failed. Check .env against .env.example.");
    }
    return parsed.data;
}

export const env = loadEnv();
