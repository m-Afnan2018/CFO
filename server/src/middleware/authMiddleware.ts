import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const COOKIE = "cfo_auth";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    const cookies = (req as Request & { cookies: Record<string, string> })
        .cookies;
    const token = cookies?.[COOKIE];

    console.log({cookies, token})
    if (!token) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        jwt.verify(
            token,
            process.env.JWT_SECRET || "fallback-secret-change-this",
        );
        next();
    } catch {
        res.status(401).json({ error: "Invalid token" });
    }
}
