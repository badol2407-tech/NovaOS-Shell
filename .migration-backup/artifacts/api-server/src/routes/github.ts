import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, githubTokensTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import { decryptSecret, encryptSecret } from "../lib/crypto";

const router: IRouter = Router();

// ─── Helper: fetch GitHub API ────────────────────────────────────────────────

async function githubFetch(
  path: string,
  token: string,
  params?: Record<string, string | number>,
): Promise<unknown> {
  const url = new URL(`https://api.github.com${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "NovaOS/1.0",
      },
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("GitHub API request timed out after 10 s");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub API error ${res.status}: ${text}`);
  }
  return res.json();
}

// ─── GET /github/status ───────────────────────────────────────────────────────

router.get("/github/status", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  const [row] = await db
    .select()
    .from(githubTokensTable)
    .where(eq(githubTokensTable.userId, userId));

  if (!row) {
    res.json({ connected: false, login: null, avatarUrl: null, name: null });
    return;
  }

  res.json({
    connected: true,
    login: row.login ?? null,
    avatarUrl: row.avatarUrl ?? null,
    name: row.name ?? null,
  });
});

// ─── POST /github/token ────────────────────────────────────────────────────────

router.post("/github/token", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  const { token } = req.body as { token?: string };

  if (!token || typeof token !== "string" || token.trim().length === 0) {
    res.status(400).json({ error: "token is required" });
    return;
  }

  // Validate by calling GitHub API
  let ghUser: { login: string; name?: string; avatar_url?: string };
  try {
    ghUser = (await githubFetch("/user", token.trim())) as typeof ghUser;
  } catch (err) {
    logger.warn({ err }, "GitHub token validation failed");
    res.status(400).json({ error: "Invalid GitHub token — could not authenticate with GitHub API" });
    return;
  }

  // Upsert token record — the PAT is encrypted at rest (AES-256-GCM); only
  // the ciphertext is ever persisted.
  const encryptedToken = encryptSecret(token.trim());
  await db
    .insert(githubTokensTable)
    .values({
      userId,
      accessToken: encryptedToken,
      login: ghUser.login,
      name: ghUser.name ?? null,
      avatarUrl: ghUser.avatar_url ?? null,
    })
    .onConflictDoUpdate({
      target: githubTokensTable.userId,
      set: {
        accessToken: encryptedToken,
        login: ghUser.login,
        name: ghUser.name ?? null,
        avatarUrl: ghUser.avatar_url ?? null,
        updatedAt: new Date(),
      },
    });

  res.json({
    connected: true,
    login: ghUser.login,
    avatarUrl: ghUser.avatar_url ?? null,
    name: ghUser.name ?? null,
  });
});

// ─── DELETE /github/token ──────────────────────────────────────────────────────

router.delete("/github/token", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  await db.delete(githubTokensTable).where(eq(githubTokensTable.userId, userId));
  res.sendStatus(204);
});

// ─── Helper: get token or 403 ─────────────────────────────────────────────────

async function getToken(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ accessToken: githubTokensTable.accessToken })
    .from(githubTokensTable)
    .where(eq(githubTokensTable.userId, userId));
  if (!row) return null;
  try {
    return decryptSecret(row.accessToken);
  } catch (err) {
    logger.error({ err }, "Failed to decrypt stored GitHub token");
    return null;
  }
}

// ─── GET /github/repos ─────────────────────────────────────────────────────────

router.get("/github/repos", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  const token = await getToken(userId);
  if (!token) {
    res.status(403).json({ error: "GitHub token not configured. Connect your GitHub account first." });
    return;
  }

  const sort = (req.query["sort"] as string) || "updated";
  const perPage = Math.min(Number(req.query["per_page"]) || 30, 100);

  try {
    const data = (await githubFetch("/user/repos", token, {
      sort,
      per_page: perPage,
      affiliation: "owner,collaborator,organization_member",
    })) as Array<Record<string, unknown>>;

    const repos = data.map((r) => ({
      id: r["id"],
      name: r["name"],
      fullName: r["full_name"],
      private: r["private"],
      description: r["description"] ?? null,
      defaultBranch: r["default_branch"] ?? "main",
      language: r["language"] ?? null,
      stargazersCount: r["stargazers_count"] ?? 0,
      forksCount: r["forks_count"] ?? 0,
      updatedAt: r["updated_at"],
      htmlUrl: r["html_url"],
    }));

    res.json(repos);
  } catch (err) {
    logger.error({ err }, "Failed to list GitHub repos");
    res.status(502).json({ error: "Failed to fetch repositories from GitHub" });
  }
});

// ─── GET /github/repos/:owner/:repo/branches ──────────────────────────────────

router.get(
  "/github/repos/:owner/:repo/branches",
  requireAuth,
  async (req, res): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const token = await getToken(userId);
    if (!token) {
      res.status(403).json({ error: "GitHub token not configured" });
      return;
    }

    const { owner, repo } = req.params;
    try {
      const data = (await githubFetch(
        `/repos/${owner}/${repo}/branches`,
        token,
        { per_page: 100 },
      )) as Array<Record<string, unknown>>;

      const branches = data.map((b) => ({
        name: b["name"],
        sha: (b["commit"] as Record<string, unknown>)?.["sha"] ?? "",
        protected: b["protected"] ?? false,
      }));

      res.json(branches);
    } catch (err) {
      logger.error({ err }, "Failed to list branches");
      res.status(502).json({ error: "Failed to fetch branches from GitHub" });
    }
  },
);

// ─── GET /github/repos/:owner/:repo/commits ───────────────────────────────────

router.get(
  "/github/repos/:owner/:repo/commits",
  requireAuth,
  async (req, res): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const token = await getToken(userId);
    if (!token) {
      res.status(403).json({ error: "GitHub token not configured" });
      return;
    }

    const { owner, repo } = req.params;
    const branch = (req.query["branch"] as string) || undefined;
    const perPage = Math.min(Number(req.query["per_page"]) || 20, 100);

    try {
      const params: Record<string, string | number> = { per_page: perPage };
      if (branch) params["sha"] = branch;

      const data = (await githubFetch(
        `/repos/${owner}/${repo}/commits`,
        token,
        params,
      )) as Array<Record<string, unknown>>;

      const commits = data.map((c) => {
        const commit = c["commit"] as Record<string, unknown>;
        const author = commit?.["author"] as Record<string, unknown> | undefined;
        const ghAuthor = c["author"] as Record<string, unknown> | null;
        return {
          sha: (c["sha"] as string).slice(0, 7),
          message: ((commit?.["message"] as string) || "").split("\n")[0],
          author: (author?.["name"] as string) || "Unknown",
          authorAvatarUrl: (ghAuthor?.["avatar_url"] as string) ?? null,
          date: author?.["date"] as string,
          htmlUrl: c["html_url"] as string,
        };
      });

      res.json(commits);
    } catch (err) {
      logger.error({ err }, "Failed to list commits");
      res.status(502).json({ error: "Failed to fetch commits from GitHub" });
    }
  },
);

export default router;
