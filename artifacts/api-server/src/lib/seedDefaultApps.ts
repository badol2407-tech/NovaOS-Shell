/**
 * seedDefaultApps
 *
 * Upserts the built-in NovaOS apps into the database on server startup.
 * Uses ON CONFLICT DO NOTHING so re-runs are idempotent and safe.
 *
 * To add a new built-in app: extend DEFAULT_APPS below.
 * To update an existing app's name/icon: change it here and bump the deploy.
 */

import { db, appsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

const DEFAULT_APPS = [
  {
    id: "settings",
    name: "Settings",
    icon: "https://api.iconify.design/fluent-emoji-flat/gear.svg",
    category: "System",
    description: "Customize your NovaOS experience",
  },
  {
    id: "files",
    name: "Files",
    icon: "https://api.iconify.design/fluent-emoji-flat/open-file-folder.svg",
    category: "Productivity",
    description: "Browse and manage your files",
  },
] as const;

export async function seedDefaultApps(): Promise<void> {
  try {
    for (const app of DEFAULT_APPS) {
      await db
        .insert(appsTable)
        .values(app)
        .onConflictDoNothing();
    }
    logger.info({ count: DEFAULT_APPS.length }, "Default apps seeded");
  } catch (err) {
    // Non-fatal: the app still runs without seeded records.
    // Log the error so it appears in server logs during diagnostics.
    logger.warn({ err }, "seedDefaultApps: failed to seed (non-fatal)");
  }
}
