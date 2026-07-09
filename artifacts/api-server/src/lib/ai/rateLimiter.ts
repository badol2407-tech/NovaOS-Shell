/**
 * Simple in-memory sliding-window rate limiter for AI endpoints.
 *
 * Limits are per Clerk userId so different users get independent buckets.
 * The in-process store resets on server restart — sufficient for abuse
 * prevention without requiring Redis in development.
 */

import type { Request, Response, NextFunction } from "express";
import type { AuthedRequest } from "../../middlewares/requireAuth.js";

interface WindowEntry {
  timestamps: number[];
}

const store = new Map<string, WindowEntry>();

/**
 * Creates an Express middleware that enforces a sliding-window rate limit.
 *
 * @param maxRequests  Number of allowed requests per window
 * @param windowMs     Window size in milliseconds
 */
export function createAiRateLimiter(
  maxRequests: number,
  windowMs: number,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = (req as AuthedRequest).userId;
    if (!userId) {
      // requireAuth must be called before this middleware
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const now = Date.now();
    const cutoff = now - windowMs;

    let entry = store.get(userId);
    if (!entry) {
      entry = { timestamps: [] };
      store.set(userId, entry);
    }

    // Evict old timestamps outside the window
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

    if (entry.timestamps.length >= maxRequests) {
      const retryAfterMs =
        entry.timestamps[0]! + windowMs - now;
      res.setHeader("Retry-After", Math.ceil(retryAfterMs / 1000).toString());
      res.status(429).json({
        error: `Rate limit exceeded. You may send at most ${maxRequests} AI requests per ${Math.round(windowMs / 60_000)} minute(s). Please wait before retrying.`,
      });
      return;
    }

    entry.timestamps.push(now);
    next();
  };
}

// Pre-built limiters for the two expensive AI endpoints.
// 30 streaming chat requests per user per minute.
export const chatRateLimiter = createAiRateLimiter(30, 60_000);
// 60 quick-ask requests per user per minute (lighter weight).
export const askRateLimiter = createAiRateLimiter(60, 60_000);
