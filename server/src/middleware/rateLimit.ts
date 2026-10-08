import type { NextFunction, Request, Response } from "express";

/** Minimal in-memory fixed-window limiter for cost/abuse control on LLM-calling endpoints. */
export function rateLimit(options: { windowMs: number; max: number }) {
    const hits = new Map<string, { count: number; windowStart: number }>();

    return (req: Request, res: Response, next: NextFunction) => {
        const key = req.ip ?? "unknown";
        const now = Date.now();
        const entry = hits.get(key);

        if (!entry || now - entry.windowStart > options.windowMs) {
            hits.set(key, { count: 1, windowStart: now });
            next();
            return;
        }

        if (entry.count >= options.max) {
            res.status(429).json({ error: "too_many_requests" });
            return;
        }

        entry.count += 1;
        next();
    };
}
