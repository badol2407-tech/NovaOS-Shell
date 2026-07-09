/**
 * Phase 11 — Comments & Mentions
 *
 *   GET    /workspaces/:id/comments?resourceType=&resourceId=  — list comments on a resource
 *   POST   /workspaces/:id/comments                            — add a comment (supports @mentions)
 *   DELETE /workspaces/:id/comments/:commentId                 — delete own comment (or admin+)
 */

import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import {
  db,
  workspaceCommentsTable,
  workspaceMembersTable,
  workspaceActivityTable,
  notificationsTable,
} from "@workspace/db";
import { z } from "zod/v4";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth.js";
import { logger } from "../lib/logger.js";
import { getMemberRole, roleAtLeast } from "../lib/collab/roles.js";

const router: IRouter = Router();

const createCommentSchema = z.object({
  resourceType: z.string().trim().min(1).max(50),
  resourceId: z.string().trim().min(1).max(100),
  body: z.string().trim().min(1).max(4000),
});

/** Extracts @displayName mentions and resolves them to member userIds. */
async function resolveMentions(
  workspaceId: string,
  body: string,
): Promise<{ userId: string; displayName: string }[]> {
  const tokens = [...body.matchAll(/@([\w.\- ]{1,50})/g)].map((m) => m[1]!.trim().toLowerCase());
  if (tokens.length === 0) return [];

  const members = await db
    .select({ userId: workspaceMembersTable.userId, displayName: workspaceMembersTable.displayName })
    .from(workspaceMembersTable)
    .where(eq(workspaceMembersTable.workspaceId, workspaceId));

  const matched = new Map<string, { userId: string; displayName: string }>();
  for (const token of tokens) {
    const hit = members.find((m) => m.displayName.toLowerCase() === token);
    if (hit) matched.set(hit.userId, hit);
  }
  return [...matched.values()];
}

router.get("/workspaces/:id/comments", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  const workspaceId = req.params["id"] as string;
  const resourceType = req.query["resourceType"] as string | undefined;
  const resourceId = req.query["resourceId"] as string | undefined;

  if (!resourceType || !resourceId) {
    res.status(400).json({ error: "resourceType and resourceId are required" });
    return;
  }

  const role = await getMemberRole(workspaceId, userId);
  if (!role) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const comments = await db
    .select()
    .from(workspaceCommentsTable)
    .where(
      and(
        eq(workspaceCommentsTable.workspaceId, workspaceId),
        eq(workspaceCommentsTable.resourceType, resourceType),
        eq(workspaceCommentsTable.resourceId, resourceId),
      ),
    )
    .orderBy(asc(workspaceCommentsTable.createdAt));

  res.json(
    comments.map((c) => ({ ...c, mentionedUserIds: JSON.parse(c.mentionedUserIdsJson) as string[] })),
  );
});

router.post("/workspaces/:id/comments", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  const workspaceId = req.params["id"] as string;

  const role = await getMemberRole(workspaceId, userId);
  if (!role) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = createCommentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    return;
  }

  const { resourceType, resourceId, body } = parsed.data;
  const displayName: string =
    (req.body as Record<string, unknown>).displayName?.toString() || userId;

  const mentions = await resolveMentions(workspaceId, body);

  const [comment] = await db
    .insert(workspaceCommentsTable)
    .values({
      workspaceId,
      resourceType,
      resourceId,
      authorUserId: userId,
      authorDisplayName: displayName,
      body,
      mentionedUserIdsJson: JSON.stringify(mentions.map((m) => m.userId)),
    })
    .returning();

  if (!comment) {
    res.status(500).json({ error: "Failed to create comment" });
    return;
  }

  try {
    await db.insert(workspaceActivityTable).values({
      workspaceId,
      actorUserId: userId,
      actorDisplayName: displayName,
      action: "comment_added",
      contextJson: JSON.stringify({ resourceType, resourceId }),
    });

    if (mentions.length > 0) {
      await db.insert(notificationsTable).values(
        mentions
          .filter((m) => m.userId !== userId)
          .map((m) => ({
            userId: m.userId,
            title: `${displayName} mentioned you`,
            body: body.slice(0, 200),
            appId: "collab-hub",
            type: "info" as const,
          })),
      );
    }
  } catch (err) {
    logger.warn({ err }, "comment_side_effects_failed");
  }

  res.status(201).json({ ...comment, mentionedUserIds: mentions.map((m) => m.userId) });
});

router.delete(
  "/workspaces/:id/comments/:commentId",
  requireAuth,
  async (req, res): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const workspaceId = req.params["id"] as string;
    const commentId = Number(req.params["commentId"]);

    if (isNaN(commentId)) {
      res.status(400).json({ error: "Invalid comment id" });
      return;
    }

    const role = await getMemberRole(workspaceId, userId);
    if (!role) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const [comment] = await db
      .select()
      .from(workspaceCommentsTable)
      .where(
        and(eq(workspaceCommentsTable.id, commentId), eq(workspaceCommentsTable.workspaceId, workspaceId)),
      );

    if (!comment) {
      res.status(404).json({ error: "Comment not found" });
      return;
    }

    const canDelete = comment.authorUserId === userId || roleAtLeast(role, "admin");
    if (!canDelete) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    await db.delete(workspaceCommentsTable).where(eq(workspaceCommentsTable.id, commentId));
    res.sendStatus(204);
  },
);

export default router;
