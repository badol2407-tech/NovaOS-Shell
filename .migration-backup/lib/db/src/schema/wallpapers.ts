import { pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const wallpapersTable = pgTable("wallpapers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  imageUrl: text("image_url").notNull(),
  thumbnailUrl: text("thumbnail_url").notNull(),
});

export const insertWallpaperSchema = createInsertSchema(wallpapersTable);
export type InsertWallpaper = z.infer<typeof insertWallpaperSchema>;
export type WallpaperRow = typeof wallpapersTable.$inferSelect;
