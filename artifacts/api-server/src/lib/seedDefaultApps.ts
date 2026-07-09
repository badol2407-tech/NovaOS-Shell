/**
 * seedDefaultApps
 *
 * Upserts the built-in NovaOS apps into the database on server startup.
 * Uses ON CONFLICT DO UPDATE so updates to name/icon/description are applied
 * on the next restart.
 *
 * To add a new built-in app: extend DEFAULT_APPS below.
 * To update an existing app's name/icon: change it here and redeploy.
 */

import { db, appsTable } from "@workspace/db";
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
  {
    id: "terminal",
    name: "Terminal",
    icon: "https://api.iconify.design/fluent-emoji-flat/laptop.svg",
    category: "Developer",
    description: "AI-powered developer terminal with full shell simulation",
  },
  {
    id: "github",
    name: "GitHub",
    icon: "https://api.iconify.design/skill-icons/github-dark.svg",
    category: "Developer",
    description: "Browse repositories, view commits, and manage your GitHub projects",
  },
  {
    id: "projects",
    name: "Projects",
    icon: "https://api.iconify.design/fluent-emoji-flat/clipboard.svg",
    category: "Productivity",
    description: "Manage projects and tasks with a Kanban board",
  },
  {
    id: "nova",
    name: "Nova AI",
    icon: "https://api.iconify.design/fluent-emoji-flat/sparkles.svg",
    category: "AI",
    description: "Intelligent AI assistant powered by Gemini, Groq, OpenRouter, and Ollama",
  },
] as const;

export async function seedDefaultApps(): Promise<void> {
  try {
    for (const app of DEFAULT_APPS) {
      await db
        .insert(appsTable)
        .values(app)
        .onConflictDoUpdate({
          target: appsTable.id,
          set: {
            name: app.name,
            icon: app.icon,
            category: app.category,
            description: app.description,
          },
        });
    }
    logger.info({ count: DEFAULT_APPS.length }, "Default apps seeded");
  } catch (err) {
    // Non-fatal: the app still runs without seeded records.
    // Log the error so it appears in server logs during diagnostics.
    logger.warn({ err }, "seedDefaultApps: failed to seed (non-fatal)");
  }
}
