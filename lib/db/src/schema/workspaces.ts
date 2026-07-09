/**
 * Phase 11 — Collaborative Cloud Development Platform
 *
 * Workspace: a named collaboration space that one or more users can join.
 * Members: per-workspace membership with a role (owner | editor | viewer).
 * Invites: pending email invitations identified by a secure token.
 */

import {
  pgTable,
  text,
  serial,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Workspaces ──────────────────────────────────────────────────────────────

export const workspacesTable = pgTable("workspaces", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  ownerUserId: text("owner_user_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  color: text("color").notNull().default("#6366f1"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ── Workspace Members ───────────────────────────────────────────────────────

export const workspaceMembersTable = pgTable(
  "workspace_members",
  {
    id: serial("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    /** Display name / email stored at invite time for UI; may be stale. */
    displayName: text("display_name").notNull().default(""),
    role: text("role", { enum: ["owner", "editor", "viewer"] })
      .notNull()
      .default("editor"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("workspace_members_workspace_user_uniq").on(
      table.workspaceId,
      table.userId,
    ),
    index("workspace_members_workspace_id_idx").on(table.workspaceId),
    index("workspace_members_user_id_idx").on(table.userId),
  ],
);

// ── Workspace Invites ───────────────────────────────────────────────────────

export const workspaceInvitesTable = pgTable(
  "workspace_invites",
  {
    id: serial("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    inviterUserId: text("inviter_user_id").notNull(),
    inviteeEmail: text("invitee_email").notNull(),
    token: text("token").notNull().unique(),
    role: text("role", { enum: ["editor", "viewer"] })
      .notNull()
      .default("editor"),
    status: text("status", { enum: ["pending", "accepted", "revoked"] })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("workspace_invites_workspace_id_idx").on(table.workspaceId),
    index("workspace_invites_token_idx").on(table.token),
  ],
);

// ── Insert schemas / row types ──────────────────────────────────────────────

export const insertWorkspaceSchema = createInsertSchema(workspacesTable).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertWorkspaceMemberSchema = createInsertSchema(
  workspaceMembersTable,
).omit({ id: true, joinedAt: true });
export const insertWorkspaceInviteSchema = createInsertSchema(
  workspaceInvitesTable,
).omit({ id: true, createdAt: true });

export type InsertWorkspace = z.infer<typeof insertWorkspaceSchema>;
export type WorkspaceRow = typeof workspacesTable.$inferSelect;
export type InsertWorkspaceMember = z.infer<typeof insertWorkspaceMemberSchema>;
export type WorkspaceMemberRow = typeof workspaceMembersTable.$inferSelect;
export type InsertWorkspaceInvite = z.infer<typeof insertWorkspaceInviteSchema>;
export type WorkspaceInviteRow = typeof workspaceInvitesTable.$inferSelect;
