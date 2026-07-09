/**
 * Phase 11 — Collaborative Workspace API
 *
 * Workspaces:
 *   GET    /workspaces                       — list user's workspaces (owner + member)
 *   POST   /workspaces                       — create a new workspace
 *   GET    /workspaces/:id                   — get workspace detail + members
 *   PATCH  /workspaces/:id                   — update name/description/color (owner)
 *   DELETE /workspaces/:id                   — delete workspace (owner)
 *
 * Members:
 *   GET    /workspaces/:id/members           — list members
 *   DELETE /workspaces/:id/members/:userId   — remove member (owner or self-leave)
 *
 * Invites:
 *   POST   /workspaces/:id/invites           — send invite by email
 *   GET    /workspaces/:id/invites           — list pending invites (owner)
 *   DELETE /workspaces/:id/invites/:inviteId — revoke invite (owner)
 *   POST   /workspaces/invites/accept        — accept invite by token (any authed user)
 *
 * Activity:
 *   GET    /workspaces/:id/activity          — recent workspace activity feed
 */

import { Router, type IRouter } from "express";
import { and, desc, eq, gt, or } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import {
  db,
  workspacesTable,
  workspaceMembersTable,
  workspaceInvitesTable,
  workspaceActivityTable,
} from "@workspace/db";
import { z } from "zod/v4";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth.js";
import {
  workspaceCreateLimiter,
  workspaceDeleteLimiter,
  inviteSendLimiter,
} from "../middlewares/generalRateLimiter.js";
import { logger } from "../lib/logger.js";
import { getMemberRole, roleAtLeast } from "../lib/collab/roles.js";

const router: IRouter = Router();

// ── Helpers ─────────────────────────────────────────────────────────────────

async function logActivity(
  workspaceId: string,
  actorUserId: string,
  actorDisplayName: string,
  action: string,
  context?: Record<string, unknown>,
) {
  try {
    await db.insert(workspaceActivityTable).values({
      workspaceId,
      actorUserId,
      actorDisplayName,
      action,
      contextJson: context ? JSON.stringify(context) : null,
    });
  } catch (err) {
    // Non-fatal — don't crash the main request if activity logging fails
    logger.warn({ err, workspaceId, action }, "workspace_activity_log_failed");
  }
}

async function isMember(workspaceId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: workspaceMembersTable.id })
    .from(workspaceMembersTable)
    .where(
      and(
        eq(workspaceMembersTable.workspaceId, workspaceId),
        eq(workspaceMembersTable.userId, userId),
      ),
    );
  return Boolean(row);
}

async function isOwner(workspaceId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ ownerUserId: workspacesTable.ownerUserId })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId));
  return row?.ownerUserId === userId;
}

// ── Validation schemas ───────────────────────────────────────────────────────

const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex colour like #6366f1")
    .optional(),
});

const updateWorkspaceSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

const sendInviteSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(["admin", "editor", "viewer"]).optional().default("editor"),
  displayName: z.string().trim().max(100).optional(),
});

const updateMemberRoleSchema = z.object({
  role: z.enum(["admin", "editor", "viewer"]),
});

const acceptInviteSchema = z.object({
  token: z.string().trim().min(1),
  displayName: z.string().trim().max(100).optional(),
});

// ── GET /workspaces ──────────────────────────────────────────────────────────

router.get("/workspaces", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;

  // Workspaces where user is owner
  const owned = await db
    .select()
    .from(workspacesTable)
    .where(eq(workspacesTable.ownerUserId, userId))
    .orderBy(desc(workspacesTable.updatedAt));

  // Workspaces where user is a member (not owner)
  const memberRows = await db
    .select({ workspaceId: workspaceMembersTable.workspaceId })
    .from(workspaceMembersTable)
    .where(eq(workspaceMembersTable.userId, userId));

  const memberWorkspaceIds = memberRows
    .map((r) => r.workspaceId)
    .filter((id) => !owned.some((w) => w.id === id));

  const memberWorkspaces =
    memberWorkspaceIds.length > 0
      ? await db
          .select()
          .from(workspacesTable)
          .where(
            or(
              ...memberWorkspaceIds.map((id) =>
                eq(workspacesTable.id, id),
              ),
            ),
          )
          .orderBy(desc(workspacesTable.updatedAt))
      : [];

  res.json({
    owned,
    member: memberWorkspaces,
  });
});

// ── POST /workspaces ─────────────────────────────────────────────────────────

router.post("/workspaces", requireAuth, workspaceCreateLimiter, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  const parsed = createWorkspaceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    return;
  }
  const { name, description, color } = parsed.data;

  const displayName: string =
    (req.body as Record<string, unknown>).displayName?.toString().trim() || userId;

  const [workspace] = await db
    .insert(workspacesTable)
    .values({
      ownerUserId: userId,
      name,
      description: description ?? "",
      color: color ?? "#6366f1",
    })
    .returning();

  if (!workspace) {
    res.status(500).json({ error: "Failed to create workspace" });
    return;
  }

  // Auto-add owner as member
  await db.insert(workspaceMembersTable).values({
    workspaceId: workspace.id,
    userId,
    displayName,
    role: "owner",
  });

  await logActivity(workspace.id, userId, displayName, "workspace_created", { name });

  res.status(201).json(workspace);
});

// ── GET /workspaces/:id ──────────────────────────────────────────────────────

router.get("/workspaces/:id", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  const workspaceId = req.params["id"] as string;

  const [workspace] = await db
    .select()
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId));

  if (!workspace) {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }

  const canAccess = workspace.ownerUserId === userId || (await isMember(workspaceId, userId));
  if (!canAccess) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const members = await db
    .select()
    .from(workspaceMembersTable)
    .where(eq(workspaceMembersTable.workspaceId, workspaceId))
    .orderBy(workspaceMembersTable.joinedAt);

  res.json({ ...workspace, members });
});

// ── PATCH /workspaces/:id ────────────────────────────────────────────────────

router.patch("/workspaces/:id", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  const workspaceId = req.params["id"] as string;

  if (!(await isOwner(workspaceId, userId))) {
    res.status(403).json({ error: "Only the workspace owner can update it" });
    return;
  }

  const parsed = updateWorkspaceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    return;
  }

  const update: Partial<typeof workspacesTable.$inferInsert> = {};
  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.description !== undefined) update.description = parsed.data.description ?? "";
  if (parsed.data.color !== undefined) update.color = parsed.data.color;

  const [updated] = await db
    .update(workspacesTable)
    .set(update)
    .where(eq(workspacesTable.id, workspaceId))
    .returning();

  res.json(updated);
});

// ── DELETE /workspaces/:id ───────────────────────────────────────────────────

router.delete("/workspaces/:id", requireAuth, workspaceDeleteLimiter, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  const workspaceId = req.params["id"] as string;

  if (!(await isOwner(workspaceId, userId))) {
    res.status(403).json({ error: "Only the workspace owner can delete it" });
    return;
  }

  await db
    .delete(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId));

  res.sendStatus(204);
});

// ── GET /workspaces/:id/members ──────────────────────────────────────────────

router.get("/workspaces/:id/members", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  const workspaceId = req.params["id"] as string;

  if (!(await isMember(workspaceId, userId))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const members = await db
    .select()
    .from(workspaceMembersTable)
    .where(eq(workspaceMembersTable.workspaceId, workspaceId))
    .orderBy(workspaceMembersTable.joinedAt);

  res.json(members);
});

// ── DELETE /workspaces/:id/members/:memberId ─────────────────────────────────

router.delete(
  "/workspaces/:id/members/:memberId",
  requireAuth,
  async (req, res): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const workspaceId = req.params["id"] as string;
    const memberId = Number(req.params["memberId"]);

    if (isNaN(memberId)) {
      res.status(400).json({ error: "Invalid member id" });
      return;
    }

    const [member] = await db
      .select()
      .from(workspaceMembersTable)
      .where(
        and(
          eq(workspaceMembersTable.id, memberId),
          eq(workspaceMembersTable.workspaceId, workspaceId),
        ),
      );

    if (!member) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    // Must be admin-or-above OR self-leave
    const callerRole = await getMemberRole(workspaceId, userId);
    const canManage = roleAtLeast(callerRole, "admin");
    if (!canManage && member.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    // Owner cannot remove themselves (would leave workspace ownerless)
    if (member.userId === userId && callerRole === "owner") {
      res.status(400).json({ error: "Owner cannot leave their own workspace. Delete it instead." });
      return;
    }
    // Admins cannot remove the owner or other admins — only the owner can.
    if (canManage && callerRole !== "owner" && (member.role === "owner" || member.role === "admin") && member.userId !== userId) {
      res.status(403).json({ error: "Only the owner can remove an admin" });
      return;
    }

    await db
      .delete(workspaceMembersTable)
      .where(eq(workspaceMembersTable.id, memberId));

    await logActivity(workspaceId, userId, member.displayName, "member_left", {
      removedUserId: member.userId,
    });

    res.sendStatus(204);
  },
);

// ── PATCH /workspaces/:id/members/:memberId ──────────────────────────────────
// Change a member's role. Owner can promote/demote anyone (except themselves,
// which is meaningless — ownership doesn't move here). Admins can only manage
// editors/viewers, never other admins or the owner.

router.patch(
  "/workspaces/:id/members/:memberId",
  requireAuth,
  async (req, res): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const workspaceId = req.params["id"] as string;
    const memberId = Number(req.params["memberId"]);

    if (isNaN(memberId)) {
      res.status(400).json({ error: "Invalid member id" });
      return;
    }

    const callerRole = await getMemberRole(workspaceId, userId);
    if (!roleAtLeast(callerRole, "admin")) {
      res.status(403).json({ error: "Only an admin or the owner can change member roles" });
      return;
    }

    const parsed = updateMemberRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
      return;
    }

    const [member] = await db
      .select()
      .from(workspaceMembersTable)
      .where(
        and(eq(workspaceMembersTable.id, memberId), eq(workspaceMembersTable.workspaceId, workspaceId)),
      );
    if (!member) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    if (callerRole !== "owner" && member.role === "admin") {
      res.status(403).json({ error: "Only the owner can change an admin's role" });
      return;
    }
    if (callerRole !== "owner" && parsed.data.role === "admin") {
      res.status(403).json({ error: "Only the owner can promote a member to admin" });
      return;
    }

    const [updated] = await db
      .update(workspaceMembersTable)
      .set({ role: parsed.data.role })
      .where(eq(workspaceMembersTable.id, memberId))
      .returning();

    await logActivity(workspaceId, userId, member.displayName, "member_role_changed", {
      targetUserId: member.userId,
      role: parsed.data.role,
    });

    res.json(updated);
  },
);

// ── POST /workspaces/:id/invites ─────────────────────────────────────────────

router.post(
  "/workspaces/:id/invites",
  requireAuth,
  inviteSendLimiter,
  async (req, res): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const workspaceId = req.params["id"] as string;

    const callerRole = await getMemberRole(workspaceId, userId);
    if (!roleAtLeast(callerRole, "admin")) {
      res.status(403).json({ error: "Only an admin or the owner can send invites" });
      return;
    }

    const parsed = sendInviteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
      return;
    }

    const { email, role } = parsed.data;
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const [invite] = await db
      .insert(workspaceInvitesTable)
      .values({
        workspaceId,
        inviterUserId: userId,
        inviteeEmail: email,
        token,
        role,
        expiresAt,
      })
      .returning();

    const inviterDisplayName: string =
      (req.body as Record<string, unknown>).inviterDisplayName?.toString() || userId;

    await logActivity(workspaceId, userId, inviterDisplayName, "member_invited", {
      email,
      role,
    });

    res.status(201).json(invite);
  },
);

// ── GET /workspaces/:id/invites ──────────────────────────────────────────────

router.get(
  "/workspaces/:id/invites",
  requireAuth,
  async (req, res): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const workspaceId = req.params["id"] as string;

    if (!roleAtLeast(await getMemberRole(workspaceId, userId), "admin")) {
      res.status(403).json({ error: "Only an admin or the owner can list invites" });
      return;
    }

    const invites = await db
      .select()
      .from(workspaceInvitesTable)
      .where(
        and(
          eq(workspaceInvitesTable.workspaceId, workspaceId),
          eq(workspaceInvitesTable.status, "pending"),
        ),
      )
      .orderBy(desc(workspaceInvitesTable.createdAt));

    res.json(invites);
  },
);

// ── DELETE /workspaces/:id/invites/:inviteId ─────────────────────────────────

router.delete(
  "/workspaces/:id/invites/:inviteId",
  requireAuth,
  async (req, res): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const workspaceId = req.params["id"] as string;
    const inviteId = Number(req.params["inviteId"]);

    if (isNaN(inviteId)) {
      res.status(400).json({ error: "Invalid invite id" });
      return;
    }

    if (!roleAtLeast(await getMemberRole(workspaceId, userId), "admin")) {
      res.status(403).json({ error: "Only an admin or the owner can revoke invites" });
      return;
    }

    const [updated] = await db
      .update(workspaceInvitesTable)
      .set({ status: "revoked" })
      .where(
        and(
          eq(workspaceInvitesTable.id, inviteId),
          eq(workspaceInvitesTable.workspaceId, workspaceId),
        ),
      )
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Invite not found" });
      return;
    }

    res.sendStatus(204);
  },
);

// ── POST /workspaces/invites/accept ──────────────────────────────────────────

router.post(
  "/workspaces/invites/accept",
  requireAuth,
  async (req, res): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const parsed = acceptInviteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
      return;
    }

    const { token, displayName } = parsed.data;
    const now = new Date();

    const [invite] = await db
      .select()
      .from(workspaceInvitesTable)
      .where(eq(workspaceInvitesTable.token, token));

    if (!invite) {
      res.status(404).json({ error: "Invite not found" });
      return;
    }
    if (invite.status !== "pending") {
      res.status(409).json({ error: `Invite is already ${invite.status}` });
      return;
    }
    if (invite.expiresAt < now) {
      res.status(410).json({ error: "Invite has expired" });
      return;
    }

    const alreadyMember = await isMember(invite.workspaceId, userId);
    if (alreadyMember) {
      res.status(409).json({ error: "You are already a member of this workspace" });
      return;
    }

    // ── Atomic accept: conditional UPDATE + INSERT inside a transaction ──────
    // The UPDATE only succeeds if the token is still pending and not expired.
    // Under concurrent requests only one UPDATE wins (PostgreSQL row-level lock),
    // so the token is guaranteed to be consumed exactly once.
    let acceptedInvite: typeof invite | undefined;
    let workspace: typeof workspacesTable.$inferSelect | undefined;

    try {
      await db.transaction(async (tx) => {
        const [locked] = await tx
          .update(workspaceInvitesTable)
          .set({ status: "accepted" })
          .where(
            and(
              eq(workspaceInvitesTable.id, invite.id),
              eq(workspaceInvitesTable.status, "pending"),
              gt(workspaceInvitesTable.expiresAt, now),
            ),
          )
          .returning();

        if (!locked) {
          // Another request consumed the token first (or it expired between checks)
          throw Object.assign(new Error("INVITE_CONSUMED"), { code: "INVITE_CONSUMED" });
        }
        acceptedInvite = locked;

        await tx.insert(workspaceMembersTable).values({
          workspaceId: locked.workspaceId,
          userId,
          displayName: displayName ?? userId,
          role: locked.role,
        });

        const [ws] = await tx
          .select()
          .from(workspacesTable)
          .where(eq(workspacesTable.id, locked.workspaceId));
        workspace = ws;
      });
    } catch (err) {
      const e = err as { code?: string; message?: string };
      if (e.code === "INVITE_CONSUMED") {
        res.status(409).json({ error: "Invite has already been used or expired" });
        return;
      }
      throw err; // propagate unexpected errors
    }

    const actorName = displayName ?? userId;
    await logActivity(acceptedInvite!.workspaceId, userId, actorName, "invite_accepted", {
      email: acceptedInvite!.inviteeEmail,
    });

    res.json({ workspace, role: acceptedInvite!.role });
  },
);

// ── GET /workspaces/:id/activity ─────────────────────────────────────────────

router.get(
  "/workspaces/:id/activity",
  requireAuth,
  async (req, res): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const workspaceId = req.params["id"] as string;

    if (!(await isMember(workspaceId, userId))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const limit = Math.min(Number(req.query["limit"] ?? 50), 100);

    const activity = await db
      .select()
      .from(workspaceActivityTable)
      .where(eq(workspaceActivityTable.workspaceId, workspaceId))
      .orderBy(desc(workspaceActivityTable.createdAt))
      .limit(limit);

    res.json(activity);
  },
);

export default router;
