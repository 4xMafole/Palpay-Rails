import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

function safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    // Lengths must match before timingSafeEqual (it throws on mismatched length);
    // compare against a fixed-length buffer first so this isn't itself a timing leak.
    if (bufA.length !== bufB.length) {
        timingSafeEqual(bufA, bufA);
        return false;
    }
    return timingSafeEqual(bufA, bufB);
}

function extractBearerToken(req: Request): string | null {
    const header = req.header("authorization");
    if (!header?.startsWith("Bearer ")) {
        return null;
    }
    return header.slice("Bearer ".length).trim();
}

/** Requires `Authorization: Bearer <expectedKey>`. Used to gate money-moving/admin endpoints. */
export function requireBearerToken(expectedKey: string) {
    return (req: Request, res: Response, next: NextFunction) => {
        const token = extractBearerToken(req);
        if (!token || !safeEqual(token, expectedKey)) {
            res.status(401).json({ error: "unauthorized" });
            return;
        }
        next();
    };
}
