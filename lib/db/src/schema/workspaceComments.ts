/**
 * Phase 11 — Comments & Mentions
 *
 * Comments attach to any workspace-scoped resource (a cloud file, a project
 * task, etc.) identified by (resourceType, resourceId). Mentions are plain
 * Clerk user IDs extracted server-side from `@displayName` tokens matched
 * against the workspace's member list; storing resolved IDs (not raw text)
 * keeps notification fan-out simple and stable even if a member renames.
 */

import { pgTable, text, serial, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";

export const workspaceCommentsTable = pgTable(
  "workspace_comments",
  {
    id: serial("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    /** e.g. "file" | "task" | "project" */
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    authorUserId: text("author_user_id").notNull(),
    authorDisplayName: text("author_display_name").notNull().default(""),
    body: text("body").notNull(),
    /** JSON array of mentioned Clerk user IDs, e.g. ["user_abc"] */
    mentionedUserIdsJson: text("mentioned_user_ids_json").notNull().default("[]"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("workspace_comments_resource_idx").on(
      table.workspaceId,
      table.resourceType,
      table.resourceId,
    ),
  ],
);

export const insertWorkspaceCommentSchema = createInsertSchema(
  workspaceCommentsTable,
).omit({ id: true, createdAt: true });

export type InsertWorkspaceComment = z.infer<typeof insertWorkspaceCommentSchema>;
export type WorkspaceCommentRow = typeof workspaceCommentsTable.$inferSelect;
