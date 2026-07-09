import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const githubTokensTable = pgTable("github_tokens", {
  userId: text("user_id").primaryKey(),
  accessToken: text("access_token").notNull(),
  login: text("login"),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertGithubTokenSchema = createInsertSchema(githubTokensTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertGithubToken = z.infer<typeof insertGithubTokenSchema>;
export type GithubTokenRow = typeof githubTokensTable.$inferSelect;
