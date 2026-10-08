import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { requireBearerToken } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { draftMissionFromInstruction } from "../llm/gemini.js";
import { createMission, getMissionById, listMissions, setMissionStatus } from "../db/missions.js";
import { MissionDraftSchema } from "../policy/types.js";

export const missionsRouter = Router();

const requireManager = requireBearerToken(env.MANAGER_API_KEY);

const DraftRequestSchema = z.object({
    instruction: z.string().trim().min(10).max(2000),
});

// LLM-calling endpoint: rate-limited for cost/abuse control.
missionsRouter.post("/draft", requireManager, rateLimit({ windowMs: 60_000, max: 20 }), async (req, res) => {
    const parsed = DraftRequestSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "invalid_request", details: parsed.error.flatten().fieldErrors });
        return;
    }

    try {
        const draft = await draftMissionFromInstruction(parsed.data.instruction);
        res.json({ draft, rawInstruction: parsed.data.instruction });
    } catch (err) {
        res.status(502).json({ error: "draft_failed", message: (err as Error).message });
    }
});

const CreateMissionSchema = z.object({
    draft: MissionDraftSchema,
    rawInstruction: z.string().trim().min(1).max(2000),
});

// The manager must have reviewed/edited the draft before calling this — it activates immediately.
missionsRouter.post("/", requireManager, async (req, res) => {
    const parsed = CreateMissionSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "invalid_request", details: parsed.error.flatten().fieldErrors });
        return;
    }

    try {
        const mission = await createMission(parsed.data.draft, parsed.data.rawInstruction);
        res.status(201).json(mission);
    } catch (err) {
        res.status(500).json({ error: "create_failed", message: (err as Error).message });
    }
});

missionsRouter.get("/", requireManager, async (_req, res) => {
    try {
        res.json(await listMissions());
    } catch (err) {
        res.status(500).json({ error: "list_failed", message: (err as Error).message });
    }
});

missionsRouter.get("/:id", requireManager, async (req, res) => {
    try {
        const mission = await getMissionById(req.params.id);
        if (!mission) {
            res.status(404).json({ error: "not_found" });
            return;
        }
        res.json(mission);
    } catch (err) {
        res.status(500).json({ error: "fetch_failed", message: (err as Error).message });
    }
});

const PatchMissionSchema = z.object({
    status: z.literal("cancelled"),
});

// MVP scope: the only allowed transition is manual cancellation. Field edits after
// activation and auto-expiry transitions are out of scope.
missionsRouter.patch("/:id", requireManager, async (req, res) => {
    const parsed = PatchMissionSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "invalid_request", details: parsed.error.flatten().fieldErrors });
        return;
    }

    try {
        const mission = await setMissionStatus(req.params.id, parsed.data.status);
        if (!mission) {
            res.status(404).json({ error: "not_found" });
            return;
        }
        res.json(mission);
    } catch (err) {
        res.status(500).json({ error: "update_failed", message: (err as Error).message });
    }
});
