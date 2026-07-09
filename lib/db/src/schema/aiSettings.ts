import { pgTable, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Per-user Nova AI system settings — operational toggles distinct from
 * taste-based preferences (ai_preferences). Controls how much context Nova
 * keeps and whether streaming/history/suggestions are enabled.
 */
export const aiSettingsTable = pgTable("ai_settings", {
  userId: text("user_id").primaryKey(),
  streamingEnabled: boolean("streaming_enabled").notNull().default(true),
  memoryEnabled: boolean("memory_enabled").notNull().default(true),
  maxContextMessages: integer("max_context_messages").notNull().default(20),
  suggestionsEnabled: boolean("suggestions_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertAiSettingsSchema = createInsertSchema(aiSettingsTable).omit(
  { updatedAt: true },
);
export type InsertAiSettings = z.infer<typeof insertAiSettingsSchema>;
export type AiSettingsRow = typeof aiSettingsTable.$inferSelect;
