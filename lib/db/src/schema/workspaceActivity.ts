/**
 * Phase 11 — Workspace Activity Feed
 *
 * Immutable log of notable workspace events (member joins, file creates/edits,
 * invites sent, etc.). Displayed in the CollaborationHub activity timeline.
 */

import {
  pgTable,
  text,
  serial,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";

export const workspaceActivityTable = pgTable(
  "workspace_activity",
  {
    id: serial("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    /** User who performed the action */
    actorUserId: text("actor_user_id").notNull(),
    actorDisplayName: text("actor_display_name").notNull().default(""),
    /**
     * Action types:
     *   workspace_created, member_joined, member_left, member_invited,
     *   invite_accepted, file_created, file_edited, file_deleted
     */
    action: text("action").notNull(),
    /** Optional JSON context, e.g. { "fileName": "src/index.ts" } */
    contextJson: text("context_json"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("workspace_activity_workspace_id_created_at_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
  ],
);

export const insertWorkspaceActivitySchema = createInsertSchema(
  workspaceActivityTable,
).omit({ id: true, createdAt: true });

export type InsertWorkspaceActivity = z.infer<
  typeof insertWorkspaceActivitySchema
>;
export type WorkspaceActivityRow = typeof workspaceActivityTable.$inferSelect;
