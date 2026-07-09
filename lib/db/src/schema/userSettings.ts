import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userSettingsTable = pgTable("user_settings", {
  userId: text("user_id").primaryKey(),
  theme: text("theme", { enum: ["light", "dark", "system"] })
    .notNull()
    .default("system"),
  wallpaperId: text("wallpaper_id").notNull().default("aurora"),
  accentColor: text("accent_color").notNull().default("#6366f1"),
  dockPosition: text("dock_position", { enum: ["bottom", "left", "right"] })
    .notNull()
    .default("bottom"),
  dockAutoHide: boolean("dock_auto_hide").notNull().default(false),
  dockPinnedAppIds: text("dock_pinned_app_ids").array().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertUserSettingsSchema = createInsertSchema(
  userSettingsTable,
).omit({ updatedAt: true });
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettingsRow = typeof userSettingsTable.$inferSelect;
