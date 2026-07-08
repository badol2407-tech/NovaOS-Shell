import { pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const appsTable = pgTable("apps", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").notNull(),
  category: text("category").notNull(),
  description: text("description"),
});

export const insertAppSchema = createInsertSchema(appsTable);
export type InsertApp = z.infer<typeof insertAppSchema>;
export type AppRow = typeof appsTable.$inferSelect;
