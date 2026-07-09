/**
 * General-purpose sliding-window rate limiter for non-AI endpoints.
 *
 * Uses the same in-process pattern as the AI rate limiter — sufficient for
 * development and single-instance deployments. Keyed by (userId + action)
 * so each user gets an independent bucket per protected action.
 */

import type { Request, Response, NextFunction } from "express";
import type { AuthedRequest } from "./requireAuth.js";

interface Window {
  timestamps: number[];
}

const store = new Map<string, Window>();

/**
 * Creates a rate-limiter middleware.
 *
 * @param maxRequests  Maximum requests allowed in the window.
 * @param windowMs     Window length in milliseconds.
 * @param actionKey    Stable string identifying the action being limited
 *                     (e.g. "workspace_create"). Scoped per user.
 */
export function createRateLimiter(
  maxRequests: number,
  windowMs: number,
  actionKey: string,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = (req as AuthedRequest).userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const key = `${actionKey}:${userId}`;
    const now = Date.now();
    const cutoff = now - windowMs;

    let entry = store.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      store.set(key, entry);
    }

    // Evict timestamps outside the window
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

    if (entry.timestamps.length >= maxRequests) {
      const retryAfterMs = (entry.timestamps[0] ?? now) + windowMs - now;
      res.setHeader("Retry-After", Math.ceil(retryAfterMs / 1000).toString());
      res.status(429).json({
        error: `Rate limit exceeded. Max ${maxRequests} requests per ${Math.round(windowMs / 60_000)} minute(s). Please try again later.`,
      });
      return;
    }

    entry.timestamps.push(now);
    next();
  };
}

// ── Pre-built limiters ───────────────────────────────────────────────────────

/** 10 workspace creates per user per hour. */
export const workspaceCreateLimiter = createRateLimiter(10, 60 * 60_000, "workspace_create");

/** 20 invite sends per user per hour. */
export const inviteSendLimiter = createRateLimiter(20, 60 * 60_000, "invite_send");

/** 60 comments per user per minute. */
export const commentPostLimiter = createRateLimiter(60, 60_000, "comment_post");

/** 30 file creates per user per hour. */
export const fileCreateLimiter = createRateLimiter(30, 60 * 60_000, "file_create");

/** 5 workspace deletes per user per hour (destructive action). */
export const workspaceDeleteLimiter = createRateLimiter(5, 60 * 60_000, "workspace_delete");
