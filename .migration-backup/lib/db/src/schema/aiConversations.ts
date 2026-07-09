import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const aiConversationsTable = pgTable("ai_conversations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  title: text("title").notNull().default("New Conversation"),
  model: text("model").notNull().default("auto"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertAiConversationSchema = createInsertSchema(
  aiConversationsTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertAiConversation = z.infer<typeof insertAiConversationSchema>;
export type AiConversationRow = typeof aiConversationsTable.$inferSelect;
