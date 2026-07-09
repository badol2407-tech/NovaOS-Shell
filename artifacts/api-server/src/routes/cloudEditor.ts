/**
 * Phase 11 — Cloud Code Editor API
 *
 * Files are scoped to a workspace. Any workspace member can read/edit/create.
 * Only the workspace owner can delete files (hard access-control rule).
 * Optimistic locking via `version` field prevents silent overwrites.
 *
 *   GET    /workspaces/:id/files           — list files in workspace (no content)
 *   POST   /workspaces/:id/files           — create a new file
 *   GET    /workspaces/:id/files/:fileId   — get file content + metadata
 *   PUT    /workspaces/:id/files/:fileId   — save file content (optimistic lock)
 *   DELETE /workspaces/:id/files/:fileId   — soft-delete (owner only)
 */

import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  cloudFilesTable,
  workspaceMembersTable,
  workspaceActivityTable,
  workspacesTable,
} from "@workspace/db";
import { z } from "zod/v4";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const MAX_FILE_BYTES = 500_000; // 500 KB per file

// ── Helpers ─────────────────────────────────────────────────────────────────

type ResLike = Parameters<Parameters<typeof router.use>[1]>[1];

/**
 * Resolves workspace membership for the calling user.
 * Returns { ok: true, isOwner } on success; sends 403/404 and returns
 * { ok: false } on failure (caller must `return` immediately).
 */
async function assertWorkspaceMember(
  workspaceId: string,
  userId: string,
  res: ResLike,
): Promise<{ ok: false } | { ok: true; isOwner: boolean }> {
  const [workspace] = await db
    .select({ ownerUserId: workspacesTable.ownerUserId })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId));

  if (!workspace) {
    res.status(404).json({ error: "Workspace not found" });
    return { ok: false };
  }

  if (workspace.ownerUserId === userId) return { ok: true, isOwner: true };

  const [member] = await db
    .select({ id: workspaceMembersTable.id })
    .from(workspaceMembersTable)
    .where(
      and(
        eq(workspaceMembersTable.workspaceId, workspaceId),
        eq(workspaceMembersTable.userId, userId),
      ),
    );

  if (!member) {
    res.status(403).json({ error: "Forbidden" });
    return { ok: false };
  }
  return { ok: true, isOwner: false };
}

function detectLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    rs: "rust",
    go: "go",
    java: "java",
    cs: "csharp",
    cpp: "cpp",
    c: "c",
    md: "markdown",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    html: "html",
    css: "css",
    scss: "scss",
    sh: "shell",
    bash: "shell",
    sql: "sql",
    graphql: "graphql",
    gql: "graphql",
  };
  return map[ext] ?? "plaintext";
}

async function logActivity(
  workspaceId: string,
  actorUserId: string,
  actorDisplayName: string,
  action: string,
  context?: Record<string, unknown>,
) {
  try {
    await db.insert(workspaceActivityTable).values({
      workspaceId,
      actorUserId,
      actorDisplayName,
      action,
      contextJson: context ? JSON.stringify(context) : null,
    });
  } catch (err) {
    logger.warn({ err }, "cloud_editor_activity_log_failed");
  }
}

// ── Validation ───────────────────────────────────────────────────────────────

const createFileSchema = z.object({
  path: z
    .string()
    .trim()
    .min(1)
    .max(300)
    .regex(/^[^\0<>:"|?*\\]+$/, "Invalid file path"),
  content: z.string().max(MAX_FILE_BYTES).optional().default(""),
});

const saveFileSchema = z.object({
  content: z.string().max(MAX_FILE_BYTES),
  /** Client must pass the version it last saw; rejected with 409 if stale */
  version: z.number().int().min(1),
  displayName: z.string().trim().max(100).optional(),
});

// ── GET /workspaces/:id/files ────────────────────────────────────────────────

router.get(
  "/workspaces/:id/files",
  requireAuth,
  async (req, res): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const workspaceId = req.params["id"] as string;

    const auth = await assertWorkspaceMember(workspaceId, userId, res);
    if (!auth.ok) return;

    const files = await db
      .select({
        id: cloudFilesTable.id,
        workspaceId: cloudFilesTable.workspaceId,
        path: cloudFilesTable.path,
        language: cloudFilesTable.language,
        createdByUserId: cloudFilesTable.createdByUserId,
        lastEditedByUserId: cloudFilesTable.lastEditedByUserId,
        version: cloudFilesTable.version,
        deleted: cloudFilesTable.deleted,
        createdAt: cloudFilesTable.createdAt,
        updatedAt: cloudFilesTable.updatedAt,
        // Intentionally no `content` — avoid large blobs in list responses
      })
      .from(cloudFilesTable)
      .where(
        and(
          eq(cloudFilesTable.workspaceId, workspaceId),
          eq(cloudFilesTable.deleted, false),
        ),
      );

    res.json(files);
  },
);

// ── POST /workspaces/:id/files ───────────────────────────────────────────────

router.post(
  "/workspaces/:id/files",
  requireAuth,
  async (req, res): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const workspaceId = req.params["id"] as string;

    const auth = await assertWorkspaceMember(workspaceId, userId, res);
    if (!auth.ok) return;

    const parsed = createFileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
      return;
    }

    const { path, content } = parsed.data;
    const language = detectLanguage(path);

    const [file] = await db
      .insert(cloudFilesTable)
      .values({
        workspaceId,
        createdByUserId: userId,
        lastEditedByUserId: userId,
        path,
        language,
        content,
      })
      .returning();

    if (!file) {
      res.status(500).json({ error: "Failed to create file" });
      return;
    }

    const displayName: string =
      (req.body as Record<string, unknown>).displayName?.toString() || userId;

    await logActivity(workspaceId, userId, displayName, "file_created", {
      fileName: path,
    });

    res.status(201).json(file);
  },
);

// ── GET /workspaces/:id/files/:fileId ────────────────────────────────────────

router.get(
  "/workspaces/:id/files/:fileId",
  requireAuth,
  async (req, res): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const workspaceId = req.params["id"] as string;
    const fileId = Number(req.params["fileId"]);

    if (isNaN(fileId)) {
      res.status(400).json({ error: "Invalid file id" });
      return;
    }

    const auth = await assertWorkspaceMember(workspaceId, userId, res);
    if (!auth.ok) return;

    const [file] = await db
      .select()
      .from(cloudFilesTable)
      .where(
        and(
          eq(cloudFilesTable.id, fileId),
          eq(cloudFilesTable.workspaceId, workspaceId),
          eq(cloudFilesTable.deleted, false),
        ),
      );

    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    res.json(file);
  },
);

// ── PUT /workspaces/:id/files/:fileId ────────────────────────────────────────

router.put(
  "/workspaces/:id/files/:fileId",
  requireAuth,
  async (req, res): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const workspaceId = req.params["id"] as string;
    const fileId = Number(req.params["fileId"]);

    if (isNaN(fileId)) {
      res.status(400).json({ error: "Invalid file id" });
      return;
    }

    const auth = await assertWorkspaceMember(workspaceId, userId, res);
    if (!auth.ok) return;

    const parsed = saveFileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
      return;
    }

    const { content, version, displayName } = parsed.data;

    // Optimistic lock — update only succeeds when client's version matches current
    const [updated] = await db
      .update(cloudFilesTable)
      .set({
        content,
        lastEditedByUserId: userId,
        version: version + 1,
      })
      .where(
        and(
          eq(cloudFilesTable.id, fileId),
          eq(cloudFilesTable.workspaceId, workspaceId),
          eq(cloudFilesTable.version, version),
          eq(cloudFilesTable.deleted, false),
        ),
      )
      .returning();

    if (!updated) {
      // Distinguish version conflict from missing file
      const [existing] = await db
        .select({ id: cloudFilesTable.id })
        .from(cloudFilesTable)
        .where(
          and(
            eq(cloudFilesTable.id, fileId),
            eq(cloudFilesTable.workspaceId, workspaceId),
          ),
        );

      if (!existing) {
        res.status(404).json({ error: "File not found" });
      } else {
        res.status(409).json({
          error: "Version conflict — file was modified by another user. Reload and retry.",
        });
      }
      return;
    }

    const actorName = displayName ?? userId;
    await logActivity(workspaceId, userId, actorName, "file_edited", {
      fileName: updated.path,
    });

    res.json(updated);
  },
);

// ── DELETE /workspaces/:id/files/:fileId (owner only) ────────────────────────

router.delete(
  "/workspaces/:id/files/:fileId",
  requireAuth,
  async (req, res): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const workspaceId = req.params["id"] as string;
    const fileId = Number(req.params["fileId"]);

    if (isNaN(fileId)) {
      res.status(400).json({ error: "Invalid file id" });
      return;
    }

    // Only workspace owners may delete files.
    // Members with editor/viewer roles cannot delete to prevent accidental data loss.
    const auth = await assertWorkspaceMember(workspaceId, userId, res);
    if (!auth.ok) return;
    if (!auth.isOwner) {
      res.status(403).json({ error: "Only the workspace owner can delete files" });
      return;
    }

    const [file] = await db
      .select()
      .from(cloudFilesTable)
      .where(
        and(
          eq(cloudFilesTable.id, fileId),
          eq(cloudFilesTable.workspaceId, workspaceId),
          eq(cloudFilesTable.deleted, false),
        ),
      );

    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    await db
      .update(cloudFilesTable)
      .set({ deleted: true })
      .where(eq(cloudFilesTable.id, fileId));

    const displayName: string =
      (req.body as Record<string, unknown>)?.displayName?.toString() || userId;

    await logActivity(workspaceId, userId, displayName, "file_deleted", {
      fileName: file.path,
    });

    res.sendStatus(204);
  },
);

export default router;
