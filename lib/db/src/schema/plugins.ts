import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Phase 10 — Extension & Plugin Platform
 *
 * A plugin is a single-file HTML/JS widget that runs inside a sandboxed
 * (`sandbox="allow-scripts"`, no `allow-same-origin`) iframe with no DOM/
 * cookie access to the host page. All capability is granted through the
 * NovaSDK postMessage bridge (see api-server/src/lib/plugins/) and is
 * gated by the permissions the installing user explicitly consented to.
 */

// ── Plugins (metadata + ownership) ───────────────────────────────────────────

export const pluginsTable = pgTable(
  "plugins",
  {
    id: text("id").primaryKey(), // slug, e.g. "pomodoro-timer"
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    icon: text("icon").notNull().default("🧩"), // emoji or icon URL
    category: text("category").notNull().default("Utilities"),
    authorUserId: text("author_user_id").notNull(),
    status: text("status", { enum: ["draft", "published"] })
      .notNull()
      .default("draft"),
    latestVersion: text("latest_version").notNull().default("1.0.0"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("plugins_status_updated_at_idx").on(table.status, table.updatedAt)],
);

// ── Plugin versions (immutable code snapshots) ───────────────────────────────

export const pluginVersionsTable = pgTable(
  "plugin_versions",
  {
    id: serial("id").primaryKey(),
    pluginId: text("plugin_id")
      .notNull()
      .references(() => pluginsTable.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    code: text("code").notNull(), // sandboxed HTML/JS body (no <html>/<head> wrapper)
    manifestJson: text("manifest_json").notNull(), // PluginManifest (see manifest.ts)
    aiGenerated: boolean("ai_generated").notNull().default(false),
    aiReviewJson: text("ai_review_json"), // last AI review verdict, nullable until reviewed
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("plugin_versions_plugin_id_created_at_idx").on(table.pluginId, table.createdAt)],
);

// ── Installations (per-user consent + enable state) ──────────────────────────

export const pluginInstallationsTable = pgTable(
  "plugin_installations",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    pluginId: text("plugin_id")
      .notNull()
      .references(() => pluginsTable.id, { onDelete: "cascade" }),
    versionId: integer("version_id")
      .notNull()
      .references(() => pluginVersionsTable.id, { onDelete: "cascade" }),
    grantedPermissionsJson: text("granted_permissions_json")
      .notNull()
      .default("[]"),
    enabled: boolean("enabled").notNull().default(true),
    installedAt: timestamp("installed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [unique().on(table.userId, table.pluginId)],
);

// ── Per-plugin, per-user key/value storage (SDK `storage` permission) ────────

export const pluginStorageTable = pgTable(
  "plugin_storage",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    pluginId: text("plugin_id")
      .notNull()
      .references(() => pluginsTable.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [unique().on(table.userId, table.pluginId, table.key)],
);

// ── Audit log (every SDK call attempt, allowed or denied) ────────────────────

export const pluginAuditLogTable = pgTable(
  "plugin_audit_log",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    pluginId: text("plugin_id").notNull(),
    action: text("action").notNull(), // e.g. "sdk_call:storage.set", "install", "permission_denied"
    allowed: boolean("allowed").notNull().default(true),
    detail: text("detail"), // short JSON-serialized context, capped in application code
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("plugin_audit_log_user_plugin_created_at_idx").on(
      table.userId,
      table.pluginId,
      table.createdAt,
    ),
  ],
);

// ── Insert schemas / row types ────────────────────────────────────────────────

export const insertPluginSchema = createInsertSchema(pluginsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertPluginVersionSchema = createInsertSchema(
  pluginVersionsTable,
).omit({ id: true, createdAt: true });
export const insertPluginInstallationSchema = createInsertSchema(
  pluginInstallationsTable,
).omit({ id: true, installedAt: true, updatedAt: true });
export const insertPluginStorageSchema = createInsertSchema(
  pluginStorageTable,
).omit({ id: true, updatedAt: true });
export const insertPluginAuditLogSchema = createInsertSchema(
  pluginAuditLogTable,
).omit({ id: true, createdAt: true });

export type InsertPlugin = z.infer<typeof insertPluginSchema>;
export type PluginRow = typeof pluginsTable.$inferSelect;
export type InsertPluginVersion = z.infer<typeof insertPluginVersionSchema>;
export type PluginVersionRow = typeof pluginVersionsTable.$inferSelect;
export type InsertPluginInstallation = z.infer<
  typeof insertPluginInstallationSchema
>;
export type PluginInstallationRow = typeof pluginInstallationsTable.$inferSelect;
export type InsertPluginStorage = z.infer<typeof insertPluginStorageSchema>;
export type PluginStorageRow = typeof pluginStorageTable.$inferSelect;
export type InsertPluginAuditLog = z.infer<typeof insertPluginAuditLogSchema>;
export type PluginAuditLogRow = typeof pluginAuditLogTable.$inferSelect;
