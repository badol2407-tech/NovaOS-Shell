/**
 * seedDefaultWallpapers
 *
 * Upserts the built-in NovaOS wallpapers into the database on server startup.
 * Uses ON CONFLICT DO UPDATE so name changes are applied on the next restart.
 *
 * To add a new built-in wallpaper: extend DEFAULT_WALLPAPERS below.
 */

import { db, wallpapersTable } from "@workspace/db";
import { logger } from "./logger";

// Solid-black SVG as a data URI — no external file needed.
const BLACK_SVG =
  "data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%3E%3Crect%20width%3D'100%25'%20height%3D'100%25'%20fill%3D'%23000'%2F%3E%3C%2Fsvg%3E";

const DEFAULT_WALLPAPERS = [
  {
    id: "black",
    name: "Pure Black",
    // Stored as a data URI — always works regardless of base-path.
    imageUrl: BLACK_SVG,
    thumbnailUrl: BLACK_SVG,
  },
  {
    id: "welcome-badol",
    name: "Welcome Ashikur Rahman Badol",
    // Relative path — the frontend resolves it with import.meta.env.BASE_URL.
    imageUrl: "wallpapers/welcome-badol.svg",
    thumbnailUrl: "wallpapers/welcome-badol.svg",
  },
] as const;

export async function seedDefaultWallpapers(): Promise<void> {
  try {
    for (const wp of DEFAULT_WALLPAPERS) {
      await db
        .insert(wallpapersTable)
        .values(wp)
        .onConflictDoUpdate({
          target: wallpapersTable.id,
          set: {
            name: wp.name,
            imageUrl: wp.imageUrl,
            thumbnailUrl: wp.thumbnailUrl,
          },
        });
    }
    logger.info({ count: DEFAULT_WALLPAPERS.length }, "Default wallpapers seeded");
  } catch (err) {
    logger.warn({ err }, "seedDefaultWallpapers: failed to seed (non-fatal)");
  }
}
