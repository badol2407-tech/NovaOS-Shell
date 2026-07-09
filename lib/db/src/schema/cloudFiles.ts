/**
 * Phase 11 — Cloud Code Editor
 *
 * Cloud files are workspace-scoped code files stored in Postgres.
 * They are the backing store for the CloudEditor app.
 */

import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";

export const cloudFilesTable = pgTable(
  "cloud_files",
  {
    id: serial("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    /** Creator / last editor */
    createdByUserId: text("created_by_user_id").notNull(),
    lastEditedByUserId: text("last_edited_by_user_id").notNull(),
    /** Relative path within the workspace, e.g. "src/index.ts" */
    path: text("path").notNull(),
    /** Detected or inferred language, e.g. "typescript", "python" */
    language: text("language").notNull().default("plaintext"),
    content: text("content").notNull().default(""),
    /** Soft-delete: excluded from listings but row retained for history */
    deleted: boolean("deleted").notNull().default(false),
    /** Monotonic version number incremented on each save (optimistic lock) */
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("cloud_files_workspace_path_uniq").on(table.workspaceId, table.path),
    index("cloud_files_workspace_id_idx").on(table.workspaceId),
  ],
);

export const insertCloudFileSchema = createInsertSchema(cloudFilesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCloudFile = z.infer<typeof insertCloudFileSchema>;
export type CloudFileRow = typeof cloudFilesTable.$inferSelect;
