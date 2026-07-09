import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const builderProjectsTable = pgTable("builder_projects", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  framework: text("framework", { enum: ["react", "nextjs", "vite"] })
    .notNull()
    .default("react"),
  nodesJson: text("nodes_json").notNull().default("[]"),
  themeJson: text("theme_json").notNull().default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertBuilderProjectSchema = createInsertSchema(
  builderProjectsTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertBuilderProject = z.infer<typeof insertBuilderProjectSchema>;
export type BuilderProjectRow = typeof builderProjectsTable.$inferSelect;
