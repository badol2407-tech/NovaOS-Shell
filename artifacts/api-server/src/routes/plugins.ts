/**
 * Extension & Plugin Platform routes — Phase 10
 *
 * Marketplace / authoring:
 *   GET    /plugins                        — list published plugins (marketplace)
 *   GET    /plugins/mine                   — list plugins authored by the caller
 *   GET    /plugins/installed              — list the caller's installations
 *   POST   /plugins                        — create a new draft plugin (+ v1)
 *   GET    /plugins/:id                    — get a plugin + its latest version
 *   PUT    /plugins/:id                    — push a new version (author only)
 *   POST   /plugins/:id/publish            — mark a plugin published (author only)
 *   DELETE /plugins/:id                    — delete a plugin (author only)
 *   POST   /plugins/:id/install            — install with explicit permission consent
 *   POST   /plugins/:id/uninstall          — remove an installation
 *   PATCH  /plugins/installed/:installId   — enable/disable an installation
 *
 * AI assistance (reuses the shared multi-provider router, never hardcodes a provider):
 *   POST   /plugins/generate               — AI-generate manifest + code (streaming SSE)
 *   POST   /plugins/:id/review             — AI security/quality review of the latest version
 *
 * Sandbox bridge (called by PluginRunner.tsx on behalf of a running plugin;
 * every call re-validates the installation's granted permissions server-side —
 * the manifest and the client-side gate are never trusted alone):
 *   GET    /plugins/:id/storage/:key
 *   PUT    /plugins/:id/storage/:key
 *   DELETE /plugins/:id/storage/:key
 *   POST   /plugins/:id/notify
 *   POST   /plugins/:id/ai
 *   POST   /plugins/audit-log
 *   GET    /plugins/sdk.js                 — static NovaSDK shim (public, no auth)
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  pluginsTable,
  pluginVersionsTable,
  pluginInstallationsTable,
  pluginStorageTable,
  pluginAuditLogTable,
  notificationsTable,
} from "@workspace/db";
import { z } from "zod";
import {
  requireAuth,
  type AuthedRequest,
} from "../middlewares/requireAuth.js";
import { streamWithFallback, askOnce } from "../lib/ai/router.js";
import { chatRateLimiter, askRateLimiter } from "../lib/ai/rateLimiter.js";
import { logger } from "../lib/logger.js";
import {
  PluginManifestSchema,
  PLUGIN_PERMISSIONS,
  MAX_PLUGIN_CODE_BYTES,
  type PluginPermission,
} from "../lib/plugins/manifest.js";
import { NOVA_SDK_SHIM_JS } from "../lib/plugins/sdkShim.js";

const router: IRouter = Router();

// ── Shared helpers ────────────────────────────────────────────────────────────

const MAX_STORAGE_KEYS_PER_PLUGIN = 50;
const MAX_STORAGE_VALUE_BYTES = 8_000;
const MAX_AUDIT_DETAIL_BYTES = 2_000;

async function audit(
  userId: string,
  pluginId: string,
  action: string,
  allowed: boolean,
  detail?: unknown,
): Promise<void> {
  try {
    const serialized = detail ? JSON.stringify(detail) : null;
    await db.insert(pluginAuditLogTable).values({
      userId,
      pluginId,
      action,
      allowed,
      detail: serialized ? serialized.slice(0, MAX_AUDIT_DETAIL_BYTES) : null,
    });
  } catch (err) {
    // Audit logging must never break the calling request.
    logger.warn({ err, userId, pluginId, action }, "Failed to write plugin audit log");
  }
}

async function getInstallation(userId: string, pluginId: string) {
  const [installation] = await db
    .select()
    .from(pluginInstallationsTable)
    .where(
      and(
        eq(pluginInstallationsTable.userId, userId),
        eq(pluginInstallationsTable.pluginId, pluginId),
      ),
    );
  return installation ?? null;
}

/** Requires an enabled installation that was granted `permission`; audits denials. */
async function requirePermission(
  userId: string,
  pluginId: string,
  permission: PluginPermission,
  action: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const installation = await getInstallation(userId, pluginId);
  if (!installation || !installation.enabled) {
    await audit(userId, pluginId, action, false, { reason: "not_installed" });
    return { ok: false, status: 403, error: "Plugin is not installed or is disabled" };
  }
  let granted: string[] = [];
  try {
    granted = JSON.parse(installation.grantedPermissionsJson);
  } catch {
    granted = [];
  }
  if (!granted.includes(permission)) {
    await audit(userId, pluginId, action, false, { reason: "missing_permission", permission });
    return {
      ok: false,
      status: 403,
      error: `Plugin does not have the '${permission}' permission`,
    };
  }
  return { ok: true };
}

async function getLatestVersion(pluginId: string) {
  const [version] = await db
    .select()
    .from(pluginVersionsTable)
    .where(eq(pluginVersionsTable.pluginId, pluginId))
    .orderBy(desc(pluginVersionsTable.createdAt))
    .limit(1);
  return version ?? null;
}

// ── GET /plugins/sdk.js (public, no auth — the sandboxed iframe has no cookies) ─

router.get("/plugins/sdk.js", (_req: Request, res: Response): void => {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.send(NOVA_SDK_SHIM_JS);
});

// ── Marketplace listing ───────────────────────────────────────────────────────

router.get("/plugins", async (_req: Request, res: Response): Promise<void> => {
  try {
    const plugins = await db
      .select()
      .from(pluginsTable)
      .where(eq(pluginsTable.status, "published"))
      .orderBy(desc(pluginsTable.updatedAt));
    res.json(plugins);
  } catch (err) {
    logger.error({ err }, "Failed to list plugins");
    res.status(500).json({ error: "Failed to list plugins" });
  }
});

router.get(
  "/plugins/mine",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req as AuthedRequest;
    try {
      const plugins = await db
        .select()
        .from(pluginsTable)
        .where(eq(pluginsTable.authorUserId, userId))
        .orderBy(desc(pluginsTable.updatedAt));
      res.json(plugins);
    } catch (err) {
      logger.error({ err }, "Failed to list my plugins");
      res.status(500).json({ error: "Failed to list my plugins" });
    }
  },
);

router.get(
  "/plugins/installed",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req as AuthedRequest;
    try {
      const rows = await db
        .select({
          installation: pluginInstallationsTable,
          plugin: pluginsTable,
        })
        .from(pluginInstallationsTable)
        .innerJoin(
          pluginsTable,
          eq(pluginInstallationsTable.pluginId, pluginsTable.id),
        )
        .where(eq(pluginInstallationsTable.userId, userId))
        .orderBy(desc(pluginInstallationsTable.installedAt));
      res.json(
        rows.map((r) => ({
          ...r.installation,
          grantedPermissions: JSON.parse(r.installation.grantedPermissionsJson),
          plugin: r.plugin,
        })),
      );
    } catch (err) {
      logger.error({ err }, "Failed to list installed plugins");
      res.status(500).json({ error: "Failed to list installed plugins" });
    }
  },
);

// ── Create / read / update / delete a plugin ─────────────────────────────────

const CreatePluginBody = z.object({
  manifest: PluginManifestSchema,
  code: z.string().min(1).max(MAX_PLUGIN_CODE_BYTES),
  aiGenerated: z.boolean().default(false),
});

router.post(
  "/plugins",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const parsed = CreatePluginBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { manifest, code, aiGenerated } = parsed.data;
    try {
      const [existing] = await db
        .select()
        .from(pluginsTable)
        .where(eq(pluginsTable.id, manifest.id));
      if (existing) {
        res.status(409).json({ error: "A plugin with this id already exists" });
        return;
      }
      const [plugin] = await db
        .insert(pluginsTable)
        .values({
          id: manifest.id,
          name: manifest.name,
          description: manifest.description,
          icon: manifest.icon,
          category: manifest.category,
          authorUserId: userId,
          status: "draft",
          latestVersion: manifest.version,
        })
        .returning();
      const [version] = await db
        .insert(pluginVersionsTable)
        .values({
          pluginId: manifest.id,
          version: manifest.version,
          code,
          manifestJson: JSON.stringify(manifest),
          aiGenerated,
        })
        .returning();
      await audit(userId, manifest.id, "create", true);
      res.status(201).json({ plugin, version });
    } catch (err) {
      logger.error({ err }, "Failed to create plugin");
      res.status(500).json({ error: "Failed to create plugin" });
    }
  },
);

/**
 * Published plugins are visible (and their code readable) to anyone with an
 * install in mind. Draft plugins expose their source code, so only the
 * author may read them — this endpoint requires auth whenever the plugin is
 * not yet published, and always requires it to view another author's draft.
 */
router.get("/plugins/:id", async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params["id"]);
  try {
    const [plugin] = await db.select().from(pluginsTable).where(eq(pluginsTable.id, id));
    if (!plugin) {
      res.status(404).json({ error: "Plugin not found" });
      return;
    }
    if (plugin.status === "published") {
      const version = await getLatestVersion(id);
      res.json({ plugin, version });
      return;
    }
    // Draft: only the author may see it — always 404 to anyone else (including
    // unauthenticated callers), so draft IDs cannot be enumerated by status code.
    // We read the Clerk session directly (rather than requireAuth, which would
    // 401 and thereby reveal that a draft with this id exists).
    const authedUserId = getAuth(req)?.userId ?? null;
    if (!authedUserId || plugin.authorUserId !== authedUserId) {
      res.status(404).json({ error: "Plugin not found" });
      return;
    }
    const version = await getLatestVersion(id);
    res.json({ plugin, version });
  } catch (err) {
    logger.error({ err }, "Failed to get plugin");
    res.status(500).json({ error: "Failed to get plugin" });
  }
});

const UpdatePluginBody = z.object({
  manifest: PluginManifestSchema,
  code: z.string().min(1).max(MAX_PLUGIN_CODE_BYTES),
  aiGenerated: z.boolean().default(false),
});

router.put(
  "/plugins/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const id = String(req.params["id"]);
    const parsed = UpdatePluginBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      const [plugin] = await db.select().from(pluginsTable).where(eq(pluginsTable.id, id));
      if (!plugin) {
        res.status(404).json({ error: "Plugin not found" });
        return;
      }
      if (plugin.authorUserId !== userId) {
        res.status(403).json({ error: "Only the author can update this plugin" });
        return;
      }
      const { manifest, code, aiGenerated } = parsed.data;
      const [version] = await db
        .insert(pluginVersionsTable)
        .values({
          pluginId: id,
          version: manifest.version,
          code,
          manifestJson: JSON.stringify(manifest),
          aiGenerated,
        })
        .returning();
      const [updated] = await db
        .update(pluginsTable)
        .set({
          name: manifest.name,
          description: manifest.description,
          icon: manifest.icon,
          category: manifest.category,
          latestVersion: manifest.version,
        })
        .where(eq(pluginsTable.id, id))
        .returning();
      await audit(userId, id, "update_version", true, { version: manifest.version });
      res.json({ plugin: updated, version });
    } catch (err) {
      logger.error({ err }, "Failed to update plugin");
      res.status(500).json({ error: "Failed to update plugin" });
    }
  },
);

router.post(
  "/plugins/:id/publish",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const id = String(req.params["id"]);
    try {
      const [plugin] = await db.select().from(pluginsTable).where(eq(pluginsTable.id, id));
      if (!plugin) {
        res.status(404).json({ error: "Plugin not found" });
        return;
      }
      if (plugin.authorUserId !== userId) {
        res.status(403).json({ error: "Only the author can publish this plugin" });
        return;
      }
      const [updated] = await db
        .update(pluginsTable)
        .set({ status: "published" })
        .where(eq(pluginsTable.id, id))
        .returning();
      await audit(userId, id, "publish", true);
      res.json(updated);
    } catch (err) {
      logger.error({ err }, "Failed to publish plugin");
      res.status(500).json({ error: "Failed to publish plugin" });
    }
  },
);

router.delete(
  "/plugins/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const id = String(req.params["id"]);
    try {
      const [plugin] = await db.select().from(pluginsTable).where(eq(pluginsTable.id, id));
      if (!plugin) {
        res.status(404).json({ error: "Plugin not found" });
        return;
      }
      if (plugin.authorUserId !== userId) {
        res.status(403).json({ error: "Only the author can delete this plugin" });
        return;
      }
      await db.delete(pluginsTable).where(eq(pluginsTable.id, id));
      await audit(userId, id, "delete", true);
      res.json({ ok: true });
    } catch (err) {
      logger.error({ err }, "Failed to delete plugin");
      res.status(500).json({ error: "Failed to delete plugin" });
    }
  },
);

// ── Install / uninstall / enable-disable ─────────────────────────────────────

const InstallBody = z.object({
  grantedPermissions: z.array(z.enum(PLUGIN_PERMISSIONS)).default([]),
});

router.post(
  "/plugins/:id/install",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const id = String(req.params["id"]);
    const parsed = InstallBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      const [plugin] = await db.select().from(pluginsTable).where(eq(pluginsTable.id, id));
      if (!plugin) {
        res.status(404).json({ error: "Plugin not found" });
        return;
      }
      const version = await getLatestVersion(id);
      if (!version) {
        res.status(400).json({ error: "Plugin has no published version" });
        return;
      }
      // A user may only consent to permissions the manifest actually declares.
      let manifestPermissions: string[] = [];
      try {
        manifestPermissions = JSON.parse(version.manifestJson).permissions ?? [];
      } catch {
        manifestPermissions = [];
      }
      const grantedPermissions = parsed.data.grantedPermissions.filter((p) =>
        manifestPermissions.includes(p),
      );

      const existing = await getInstallation(userId, id);
      let installation;
      if (existing) {
        [installation] = await db
          .update(pluginInstallationsTable)
          .set({
            versionId: version.id,
            grantedPermissionsJson: JSON.stringify(grantedPermissions),
            enabled: true,
          })
          .where(eq(pluginInstallationsTable.id, existing.id))
          .returning();
      } else {
        [installation] = await db
          .insert(pluginInstallationsTable)
          .values({
            userId,
            pluginId: id,
            versionId: version.id,
            grantedPermissionsJson: JSON.stringify(grantedPermissions),
            enabled: true,
          })
          .returning();
      }
      await audit(userId, id, "install", true, { grantedPermissions });
      res.status(201).json({
        ...installation,
        grantedPermissions,
      });
    } catch (err) {
      logger.error({ err }, "Failed to install plugin");
      res.status(500).json({ error: "Failed to install plugin" });
    }
  },
);

router.post(
  "/plugins/:id/uninstall",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const id = String(req.params["id"]);
    try {
      await db
        .delete(pluginInstallationsTable)
        .where(
          and(
            eq(pluginInstallationsTable.userId, userId),
            eq(pluginInstallationsTable.pluginId, id),
          ),
        );
      await audit(userId, id, "uninstall", true);
      res.json({ ok: true });
    } catch (err) {
      logger.error({ err }, "Failed to uninstall plugin");
      res.status(500).json({ error: "Failed to uninstall plugin" });
    }
  },
);

const PatchInstallBody = z.object({ enabled: z.boolean() });

router.patch(
  "/plugins/installed/:installId",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const installId = parseInt(String(req.params["installId"]), 10);
    const parsed = PatchInstallBody.safeParse(req.body);
    if (isNaN(installId) || !parsed.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    try {
      const [updated] = await db
        .update(pluginInstallationsTable)
        .set({ enabled: parsed.data.enabled })
        .where(
          and(
            eq(pluginInstallationsTable.id, installId),
            eq(pluginInstallationsTable.userId, userId),
          ),
        )
        .returning();
      if (!updated) {
        res.status(404).json({ error: "Installation not found" });
        return;
      }
      res.json(updated);
    } catch (err) {
      logger.error({ err }, "Failed to update installation");
      res.status(500).json({ error: "Failed to update installation" });
    }
  },
);

// ── AI generation (streaming SSE, provider-agnostic) ─────────────────────────

const PLUGIN_GENERATION_SYSTEM_PROMPT = `You are Nova Plugin Studio — an AI that writes small, self-contained NovaOS plugins.

A NovaOS plugin runs inside a sandboxed iframe with NO access to the parent page, cookies, or network — its only way to interact with the outside world is a global \`window.NovaSDK\` object that is already loaded for you. Never assume any other API, framework, or bundler is available. Do not use import/require or any external <script src> besides what is provided.

window.NovaSDK API (all methods return Promises):
- NovaSDK.storage.get(key) / .set(key, value) / .remove(key) — requires the "storage" permission
- NovaSDK.notify(title, body) — requires the "notifications" permission
- NovaSDK.ai.ask(prompt) -> string — requires the "ai" permission
- NovaSDK.clipboard.writeText(text) — requires the "clipboard" permission
- NovaSDK.openApp(appId) — requires the "windows" permission

Respond with EXACTLY one fenced JSON code block and nothing else, matching this shape:

{
  "manifest": {
    "id": "kebab-case-slug",
    "name": "Human Readable Name",
    "description": "One sentence description.",
    "version": "1.0.0",
    "icon": "<single emoji>",
    "category": "Utilities",
    "permissions": ["storage"]
  },
  "code": "<a full self-contained HTML fragment: inline <style> + markup + inline <script> using window.NovaSDK. No markdown, no comments about NovaSDK not being available.>"
}

Only request permissions the plugin code actually uses. Keep the code compact, accessible, and visually polished with inline CSS (dark-friendly colors, sans-serif font). Escape the code string properly for JSON.`;

const GenerateBody = z.object({
  prompt: z.string().min(1).max(2000),
  preferredProvider: z.string().max(64).nullable().optional(),
});

router.post(
  "/plugins/generate",
  requireAuth,
  chatRateLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = GenerateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { prompt, preferredProvider } = parsed.data;
    const messages = [{ role: "user" as const, content: prompt }];

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    try {
      for await (const event of streamWithFallback(
        messages,
        PLUGIN_GENERATION_SYSTEM_PROMPT,
        preferredProvider,
      )) {
        if (event.content !== undefined) {
          res.write(`data: ${JSON.stringify({ content: event.content })}\n\n`);
        } else if (event.error) {
          res.write(`data: ${JSON.stringify({ error: event.error })}\n\n`);
        } else if (event.done) {
          res.write(`data: ${JSON.stringify({ done: true, provider: event.provider })}\n\n`);
        }
      }
    } catch (err) {
      logger.error({ err }, "Plugin generation error");
      res.write(`data: ${JSON.stringify({ error: "Generation failed" })}\n\n`);
    } finally {
      res.end();
    }
  },
);

// ── AI review ─────────────────────────────────────────────────────────────────

const PLUGIN_REVIEW_SYSTEM_PROMPT = `You are Nova Plugin Security Reviewer. You are given the manifest and source code of a NovaOS plugin that will run in a sandboxed iframe (no DOM/cookie access to the host; only window.NovaSDK). Review it for:
- Requested permissions that are unused or excessive for what the code does
- Attempts to escape the sandbox (accessing window.parent/window.top directly, eval of untrusted remote content, disguised network exfiltration attempts)
- Obvious bugs or reliability problems
- Code quality and clarity

Respond with EXACTLY one fenced JSON code block, nothing else:
{
  "risk": "low" | "medium" | "high",
  "summary": "one or two sentence overall verdict",
  "issues": ["short bullet describing a specific issue", "..."]
}
If there are no issues, return an empty issues array and risk "low".`;

router.post(
  "/plugins/:id/review",
  requireAuth,
  askRateLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const id = String(req.params["id"]);
    try {
      const [plugin] = await db.select().from(pluginsTable).where(eq(pluginsTable.id, id));
      if (!plugin) {
        res.status(404).json({ error: "Plugin not found" });
        return;
      }
      if (plugin.authorUserId !== userId) {
        res.status(403).json({ error: "Only the author can request a review" });
        return;
      }
      const version = await getLatestVersion(id);
      if (!version) {
        res.status(400).json({ error: "Plugin has no version to review" });
        return;
      }
      const { response } = await askOnce(
        [
          {
            role: "user",
            content: `Manifest:\n${version.manifestJson}\n\nCode:\n${version.code}`,
          },
        ],
        PLUGIN_REVIEW_SYSTEM_PROMPT,
        null,
      );

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const reviewJson = jsonMatch ? jsonMatch[0] : JSON.stringify({
        risk: "medium",
        summary: "AI reviewer response could not be parsed.",
        issues: [],
      });

      await db
        .update(pluginVersionsTable)
        .set({ aiReviewJson: reviewJson })
        .where(eq(pluginVersionsTable.id, version.id));
      await audit(userId, id, "ai_review", true);
      res.json({ review: JSON.parse(reviewJson) });
    } catch (err) {
      logger.error({ err }, "Plugin review error");
      res.status(500).json({ error: "Review failed" });
    }
  },
);

// ── Sandbox bridge: storage / notify / ai (server re-checks permissions) ─────

router.get(
  "/plugins/:id/storage/:key",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const id = String(req.params["id"]);
    const key = String(req.params["key"]);
    const check = await requirePermission(userId, id, "storage", "sdk_call:storage.get");
    if (!check.ok) {
      res.status(check.status).json({ error: check.error });
      return;
    }
    const [row] = await db
      .select()
      .from(pluginStorageTable)
      .where(
        and(
          eq(pluginStorageTable.userId, userId),
          eq(pluginStorageTable.pluginId, id),
          eq(pluginStorageTable.key, key),
        ),
      );
    await audit(userId, id, "sdk_call:storage.get", true, { key });
    res.json({ value: row?.value ?? null });
  },
);

const StoragePutBody = z.object({ value: z.string().max(MAX_STORAGE_VALUE_BYTES) });

router.put(
  "/plugins/:id/storage/:key",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const id = String(req.params["id"]);
    const key = String(req.params["key"]).slice(0, 200);
    const check = await requirePermission(userId, id, "storage", "sdk_call:storage.set");
    if (!check.ok) {
      res.status(check.status).json({ error: check.error });
      return;
    }
    const parsed = StoragePutBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "value too large or invalid" });
      return;
    }
    try {
      const existingKeys = await db
        .select({ key: pluginStorageTable.key })
        .from(pluginStorageTable)
        .where(
          and(eq(pluginStorageTable.userId, userId), eq(pluginStorageTable.pluginId, id)),
        );
      const isNewKey = !existingKeys.some((k) => k.key === key);
      if (isNewKey && existingKeys.length >= MAX_STORAGE_KEYS_PER_PLUGIN) {
        res.status(413).json({ error: "Storage key limit reached for this plugin" });
        return;
      }
      await db
        .insert(pluginStorageTable)
        .values({ userId, pluginId: id, key, value: parsed.data.value })
        .onConflictDoUpdate({
          target: [pluginStorageTable.userId, pluginStorageTable.pluginId, pluginStorageTable.key],
          set: { value: parsed.data.value, updatedAt: new Date() },
        });
      await audit(userId, id, "sdk_call:storage.set", true, { key });
      res.json({ ok: true });
    } catch (err) {
      logger.error({ err }, "Plugin storage write failed");
      res.status(500).json({ error: "Storage write failed" });
    }
  },
);

router.delete(
  "/plugins/:id/storage/:key",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const id = String(req.params["id"]);
    const key = String(req.params["key"]);
    const check = await requirePermission(userId, id, "storage", "sdk_call:storage.remove");
    if (!check.ok) {
      res.status(check.status).json({ error: check.error });
      return;
    }
    await db
      .delete(pluginStorageTable)
      .where(
        and(
          eq(pluginStorageTable.userId, userId),
          eq(pluginStorageTable.pluginId, id),
          eq(pluginStorageTable.key, key),
        ),
      );
    await audit(userId, id, "sdk_call:storage.remove", true, { key });
    res.json({ ok: true });
  },
);

const NotifyBody = z.object({ title: z.string().min(1).max(120), body: z.string().max(500) });

router.post(
  "/plugins/:id/notify",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const id = String(req.params["id"]);
    const check = await requirePermission(userId, id, "notifications", "sdk_call:notify");
    if (!check.ok) {
      res.status(check.status).json({ error: check.error });
      return;
    }
    const parsed = NotifyBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      const [plugin] = await db.select().from(pluginsTable).where(eq(pluginsTable.id, id));
      await db.insert(notificationsTable).values({
        userId,
        title: parsed.data.title,
        body: parsed.data.body,
        appId: id,
        type: "info",
      });
      await audit(userId, id, "sdk_call:notify", true);
      res.json({ ok: true });
      void plugin; // plugin fetched only to keep behavior explicit if metadata is needed later
    } catch (err) {
      logger.error({ err }, "Plugin notify failed");
      res.status(500).json({ error: "Notify failed" });
    }
  },
);

router.post(
  "/plugins/:id/clipboard",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const id = String(req.params["id"]);
    const check = await requirePermission(userId, id, "clipboard", "sdk_call:clipboard.writeText");
    if (!check.ok) {
      res.status(check.status).json({ error: check.error });
      return;
    }
    await audit(userId, id, "sdk_call:clipboard.writeText", true);
    res.json({ ok: true });
  },
);

router.post(
  "/plugins/:id/open-app",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const id = String(req.params["id"]);
    const check = await requirePermission(userId, id, "windows", "sdk_call:openApp");
    if (!check.ok) {
      res.status(check.status).json({ error: check.error });
      return;
    }
    await audit(userId, id, "sdk_call:openApp", true, { appId: req.body?.appId });
    res.json({ ok: true });
  },
);

const PluginAskBody = z.object({ prompt: z.string().min(1).max(2000) });

router.post(
  "/plugins/:id/ai",
  requireAuth,
  askRateLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const id = String(req.params["id"]);
    const check = await requirePermission(userId, id, "ai", "sdk_call:ai.ask");
    if (!check.ok) {
      res.status(check.status).json({ error: check.error });
      return;
    }
    const parsed = PluginAskBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      const { response } = await askOnce(
        [{ role: "user", content: parsed.data.prompt }],
        `You are answering on behalf of a NovaOS plugin (id: ${id}). Keep answers concise.`,
        null,
      );
      await audit(userId, id, "sdk_call:ai.ask", true);
      res.json({ response });
    } catch (err) {
      logger.error({ err }, "Plugin AI call failed");
      res.status(500).json({ error: "AI request failed" });
    }
  },
);

// ── Audit log (client-observed events, e.g. denied calls, rate limits) ───────

const AuditLogBody = z.object({
  pluginId: z.string().min(1).max(64),
  action: z.string().min(1).max(80),
  allowed: z.boolean().default(false),
  detail: z.unknown().optional(),
});

router.post(
  "/plugins/audit-log",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const parsed = AuditLogBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    await audit(
      userId,
      parsed.data.pluginId,
      parsed.data.action,
      parsed.data.allowed,
      parsed.data.detail,
    );
    res.json({ ok: true });
  },
);

router.get(
  "/plugins/:id/audit-log",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const id = String(req.params["id"]);
    try {
      const rows = await db
        .select()
        .from(pluginAuditLogTable)
        .where(and(eq(pluginAuditLogTable.userId, userId), eq(pluginAuditLogTable.pluginId, id)))
        .orderBy(desc(pluginAuditLogTable.createdAt))
        .limit(100);
      res.json(rows);
    } catch (err) {
      logger.error({ err }, "Failed to load plugin audit log");
      res.status(500).json({ error: "Failed to load audit log" });
    }
  },
);

export default router;
