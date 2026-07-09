import { pgTable, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Per-user Nova AI preferences — lets a user pin a preferred provider
 * (still falls back to the default chain if unavailable) and tune the
 * assistant's response style.
 */
export const aiPreferencesTable = pgTable("ai_preferences", {
  userId: text("user_id").primaryKey(),
  preferredProvider: text("preferred_provider"),
  temperature: real("temperature").notNull().default(0.7),
  responseStyle: text("response_style", {
    enum: ["concise", "balanced", "detailed"],
  })
    .notNull()
    .default("balanced"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertAiPreferencesSchema = createInsertSchema(
  aiPreferencesTable,
).omit({ updatedAt: true });
export type InsertAiPreferences = z.infer<typeof insertAiPreferencesSchema>;
export type AiPreferencesRow = typeof aiPreferencesTable.$inferSelect;
