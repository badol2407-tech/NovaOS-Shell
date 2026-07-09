/**
 * Plugin manifest schema and permission model — Phase 10.
 *
 * A plugin declares the capabilities it needs up front in its manifest.
 * Users must explicitly consent to each permission at install time
 * (see routes/plugins.ts `POST /plugins/:id/install`). The SDK bridge
 * (see sdkBridge.ts) re-checks the installation's granted permissions on
 * every single call — the manifest alone never grants access.
 */

import { z } from "zod";

export const PLUGIN_PERMISSIONS = [
  "storage",
  "notifications",
  "ai",
  "clipboard",
  "windows",
] as const;

export type PluginPermission = (typeof PLUGIN_PERMISSIONS)[number];

export const PERMISSION_DESCRIPTIONS: Record<PluginPermission, string> = {
  storage: "Save and read its own private data in your NovaOS account.",
  notifications: "Send notifications to your NovaOS Notification Center.",
  ai: "Send prompts to NovaOS's AI assistant on your behalf (rate-limited).",
  clipboard: "Read text you copy and write text to your clipboard.",
  windows: "Open other NovaOS apps on your behalf.",
};

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;

export const PluginManifestSchema = z.object({
  id: z
    .string()
    .regex(SLUG_RE, "id must be a lowercase slug, e.g. 'pomodoro-timer'"),
  name: z.string().min(1).max(80),
  description: z.string().max(500).default(""),
  version: z.string().regex(SEMVER_RE, "version must look like 1.0.0"),
  icon: z.string().min(1).max(2048).default("🧩"),
  category: z.string().min(1).max(40).default("Utilities"),
  permissions: z
    .array(z.enum(PLUGIN_PERMISSIONS))
    .max(PLUGIN_PERMISSIONS.length)
    .default([]),
});

export type PluginManifest = z.infer<typeof PluginManifestSchema>;

/** Max size for plugin source (HTML/JS body) — keeps generation/storage bounded. */
export const MAX_PLUGIN_CODE_BYTES = 60_000;

export function parseManifestJson(raw: string): PluginManifest | null {
  try {
    const parsed = PluginManifestSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
