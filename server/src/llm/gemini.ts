import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";
import { MissionDraftSchema, type Decision, type MissionDraft } from "../policy/types.js";

// Uses @google/genai's Interactions API (ai.interactions.create), not the legacy
// @google/generative-ai package or models.generateContent — Google deprecated the
// old generateContent REST path for current models (confirmed via live testing,
// Oct 2026) and now points callers at the Interactions API instead.
const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

// Structural shape only (the SDK doesn't export its own Interaction/GoogleGenAIInteraction
// type) — covers just what we read: model_output steps containing text content blocks.
interface InteractionWithSteps {
    steps: Array<{ type: string; content?: Array<{ type: string; text?: string }> }>;
}

/** Plain text from an Interaction's model_output steps (interaction.outputs/output_text don't exist in JS v2). */
function extractOutputText(interaction: InteractionWithSteps): string {
    return interaction.steps
        .filter((step) => step.type === "model_output")
        .flatMap((step) => step.content ?? [])
        .filter((content) => content.type === "text" && typeof content.text === "string")
        .map((content) => content.text as string)
        .join("");
}


const SYSTEM_PROMPT = `You convert a manager's natural-language spending instruction into a structured JSON policy for an AI agent payment permission system called Palpay Rail.

Return a JSON object describing: title, purpose, vendorAllowlist, maxAmount, totalBudget, currency, allowRecurring, approvalTriggers, expiresAt.
- title: short human-readable name for this mission (max 120 chars)
- purpose: one or two sentences describing what the payment is for
- vendorAllowlist: array of specific vendor/service names the agent may pay (infer from the instruction; if none named, make a best-effort guess at a category description as a single-element array)
- maxAmount: positive number, the maximum for any SINGLE payment, in major currency units (e.g. dollars, not cents)
- totalBudget: positive number, the maximum TOTAL that may be spent across the whole mission. Must be >= maxAmount. If the instruction describes one purchase (e.g. "a flight under $250"), set this equal to maxAmount. Only make it larger when the instruction clearly allows repeated spending (e.g. "up to $20 per tool, $200 total").
- currency: 3-letter ISO currency code (default "USD" if not specified)
- allowRecurring: boolean, true only if the instruction explicitly allows a subscription/recurring charge
- approvalTriggers: array, may only contain the string "near_limit" (include it if the instruction implies the manager wants to review amounts close to the limit), otherwise an empty array
- expiresAt: ISO 8601 datetime string for when this permission expires (if not specified, default to 30 days from now)`;

const MISSION_DRAFT_JSON_SCHEMA = {
    type: "object",
    properties: {
        title: { type: "string" },
        purpose: { type: "string" },
        vendorAllowlist: { type: "array", items: { type: "string" } },
        maxAmount: { type: "number" },
        totalBudget: { type: "number" },
        currency: { type: "string" },
        allowRecurring: { type: "boolean" },
        approvalTriggers: { type: "array", items: { type: "string", enum: ["near_limit"] } },
        expiresAt: { type: "string" },
    },
    required: [
        "title",
        "purpose",
        "vendorAllowlist",
        "maxAmount",
        "totalBudget",
        "currency",
        "allowRecurring",
        "approvalTriggers",
        "expiresAt",
    ],
};

/**
 * Calls Gemini to produce a DRAFT policy only. The caller (route handler) must
 * require explicit manager confirmation before this draft becomes an active mission.
 */
export async function draftMissionFromInstruction(instruction: string): Promise<MissionDraft> {
    const interaction = await ai.interactions.create({
        model: env.GEMINI_MODEL,
        input: `${SYSTEM_PROMPT}\n\nCurrent date/time (UTC): ${new Date().toISOString()}\n\nManager instruction: """${instruction}"""`,
        response_format: MISSION_DRAFT_JSON_SCHEMA,
        response_mime_type: "application/json",
    });

    const outputText = extractOutputText(interaction);

    let parsedJson: unknown;
    try {
        parsedJson = JSON.parse(outputText);
    } catch {
        throw new Error("Gemini did not return valid JSON for the policy draft.");
    }

    const parsed = MissionDraftSchema.safeParse(parsedJson);
    if (!parsed.success) {
        throw new Error(
            `Gemini draft failed validation, ask the manager to fill the policy manually: ${JSON.stringify(
                parsed.error.flatten().fieldErrors,
            )}`,
        );
    }

    return parsed.data;
}

export interface ExplainDecisionParams {
    decision: Decision;
    matchedRules: string[];
    failedRules: string[];
    missionTitle: string;
    missionPurpose: string;
    vendor: string;
    itemDescription: string;
    amount: number;
    currency: string;
    isRecurring: boolean;
    spentToDate?: number;
    totalBudget?: number;
}

const EXPLAIN_SYSTEM_PROMPT = `You explain, in one or two plain-English sentences, why Palpay Rail's policy engine made a payment decision. You are explain-only: the decision below is already final and deterministic — you never change it, only describe it in friendly, specific terms a non-technical manager would understand. Reference the actual vendor/amount/mission and the specific matched or failed rule(s). Do not mention rule codenames verbatim (e.g. say "this mission doesn't allow subscriptions" not "recurring_allowed failed"). Keep it short. Return plain text only, no markdown, no JSON.`;

/**
 * Explain-only: called AFTER the deterministic policy engine has already decided.
 * A failure here never affects the decision — callers should treat this as optional
 * display text and swallow errors.
 */
export async function explainDecision(params: ExplainDecisionParams): Promise<string> {
    const budgetLine =
        params.totalBudget !== undefined && params.spentToDate !== undefined
            ? `\nMission budget: ${params.currency} ${params.spentToDate.toFixed(2)} already spent of ${params.currency} ${params.totalBudget.toFixed(2)} total`
            : "";

    const input = `${EXPLAIN_SYSTEM_PROMPT}

Decision: ${params.decision}
Matched rules: ${params.matchedRules.join(", ") || "none"}
Failed rules: ${params.failedRules.join(", ") || "none"}
Mission: "${params.missionTitle}" — ${params.missionPurpose}${budgetLine}
Request: ${params.vendor}, "${params.itemDescription}", ${params.currency} ${params.amount.toFixed(2)}, ${params.isRecurring ? "recurring" : "one-time"}`;

    const interaction = await ai.interactions.create({
        model: env.GEMINI_MODEL,
        input,
    });

    return extractOutputText(interaction).trim();
}

