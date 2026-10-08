import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { requireBearerToken } from "../middleware/auth.js";
import { registerDeviceToken } from "../db/deviceTokens.js";

export const deviceTokensRouter = Router();

const requireManager = requireBearerToken(env.MANAGER_API_KEY);

const RegisterTokenSchema = z.object({
    fcmToken: z.string().trim().min(1),
});

deviceTokensRouter.post("/", requireManager, async (req, res) => {
    const parsed = RegisterTokenSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "invalid_request", details: parsed.error.flatten().fieldErrors });
        return;
    }

    try {
        await registerDeviceToken(parsed.data.fcmToken);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: "register_failed", message: (err as Error).message });
    }
});
