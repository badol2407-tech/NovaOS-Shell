/**
 * Nova AI routes
 *
 * GET  /nova/providers                      — list available AI providers
 * GET  /nova/conversations                  — list user's conversations
 * POST /nova/conversations                  — create a conversation
 * DELETE /nova/conversations/:conversationId — delete a conversation
 * GET  /nova/conversations/:conversationId/messages — fetch message history
 * POST /nova/conversations/:conversationId/chat    — streaming SSE chat
 * POST /nova/ask                            — quick non-streaming ask (for terminal)
 */

import { Router, type IRouter } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, aiConversationsTable, aiMessagesTable } from "@workspace/db";
import {
  GetNovaProviderStatusResponse,
  ListNovaConversationsResponse,
  CreateNovaConversationBody,
  CreateNovaConversationResponse,
  DeleteNovaConversationParams,
  ListNovaMessagesParams,
  ListNovaMessagesResponse,
  SendNovaMessageParams,
  SendNovaMessageBody,
  NovaQuickAskBody,
  NovaQuickAskResponse,
} from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth.js";
import {
  getProviderStatus,
  streamWithFallback,
  askOnce,
} from "../lib/ai/router.js";
import {
  chatRateLimiter,
  askRateLimiter,
} from "../lib/ai/rateLimiter.js";
import { logger } from "../lib/logger.js";

const NOVA_SYSTEM_PROMPT = `You are Nova, an intelligent AI assistant built into NovaOS — a modern web-based operating system.

You help users with:
- File management, organization, and virtual filesystem operations
- Terminal commands, scripting, and developer workflows
- Project planning, task management, and Kanban board management
- GitHub repository browsing and code analysis
- Code explanation, debugging, refactoring, and best practices
- General productivity questions and creative tasks

You are aware of the NovaOS environment (apps: Files, Terminal, GitHub, Projects, Settings, Nova AI).
Be concise, accurate, and helpful. Format code examples in markdown code blocks with the correct language.`;

const router: IRouter = Router();

// ── GET /nova/providers ─────────────────────────────────────────────────────

router.get(
  "/nova/providers",
  requireAuth,
  async (_req, res): Promise<void> => {
    const providers = getProviderStatus();
    res.json(GetNovaProviderStatusResponse.parse({ providers }));
  },
);

// ── GET /nova/conversations ─────────────────────────────────────────────────

router.get(
  "/nova/conversations",
  requireAuth,
  async (req, res): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const rows = await db
      .select()
      .from(aiConversationsTable)
      .where(eq(aiConversationsTable.userId, userId))
      .orderBy(desc(aiConversationsTable.updatedAt));
    res.json(ListNovaConversationsResponse.parse(rows));
  },
);

// ── POST /nova/conversations ────────────────────────────────────────────────

router.post(
  "/nova/conversations",
  requireAuth,
  async (req, res): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const body = CreateNovaConversationBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }
    const [conversation] = await db
      .insert(aiConversationsTable)
      .values({
        userId,
        title: body.data.title ?? "New Conversation",
        model: body.data.model ?? "auto",
      })
      .returning();
    res.status(201).json(CreateNovaConversationResponse.parse(conversation));
  },
);

// ── DELETE /nova/conversations/:conversationId ──────────────────────────────

router.delete(
  "/nova/conversations/:conversationId",
  requireAuth,
  async (req, res): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const params = DeleteNovaConversationParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [deleted] = await db
      .delete(aiConversationsTable)
      .where(
        and(
          eq(aiConversationsTable.id, params.data.conversationId),
          eq(aiConversationsTable.userId, userId),
        ),
      )
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    res.sendStatus(204);
  },
);

// ── GET /nova/conversations/:conversationId/messages ────────────────────────

router.get(
  "/nova/conversations/:conversationId/messages",
  requireAuth,
  async (req, res): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const params = ListNovaMessagesParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [conversation] = await db
      .select()
      .from(aiConversationsTable)
      .where(
        and(
          eq(aiConversationsTable.id, params.data.conversationId),
          eq(aiConversationsTable.userId, userId),
        ),
      );
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    const messages = await db
      .select()
      .from(aiMessagesTable)
      .where(eq(aiMessagesTable.conversationId, params.data.conversationId))
      .orderBy(asc(aiMessagesTable.createdAt));
    res.json(ListNovaMessagesResponse.parse(messages));
  },
);

// ── POST /nova/conversations/:conversationId/chat (SSE streaming) ────────────

router.post(
  "/nova/conversations/:conversationId/chat",
  requireAuth,
  chatRateLimiter,
  async (req, res): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const params = SendNovaMessageParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const body = SendNovaMessageBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    // Verify ownership
    const [conversation] = await db
      .select()
      .from(aiConversationsTable)
      .where(
        and(
          eq(aiConversationsTable.id, params.data.conversationId),
          eq(aiConversationsTable.userId, userId),
        ),
      );
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    // Load history
    const history = await db
      .select()
      .from(aiMessagesTable)
      .where(
        eq(aiMessagesTable.conversationId, params.data.conversationId),
      )
      .orderBy(asc(aiMessagesTable.createdAt));

    // Persist user message immediately
    await db.insert(aiMessagesTable).values({
      conversationId: params.data.conversationId,
      role: "user",
      content: body.data.content,
    });

    // Build message list for AI
    const chatMessages = [
      ...history.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
      { role: "user" as const, content: body.data.content },
    ];

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const write = (event: Record<string, unknown>) =>
      res.write(`data: ${JSON.stringify(event)}\n\n`);

    let fullResponse = "";
    let providerUsed = "unknown";

    try {
      for await (const event of streamWithFallback(
        chatMessages,
        NOVA_SYSTEM_PROMPT,
      )) {
        if (event.error) {
          write({ type: "error", error: event.error });
        } else if (event.content) {
          fullResponse += event.content;
          write({ type: "chunk", content: event.content });
        } else if (event.done) {
          providerUsed = event.provider ?? "unknown";

          if (fullResponse) {
            await db.insert(aiMessagesTable).values({
              conversationId: params.data.conversationId,
              role: "assistant",
              content: fullResponse,
              provider: providerUsed,
            });

            // Update conversation title on first exchange, bump updatedAt always
            const isFirstExchange = history.length === 0;
            const titleUpdate = isFirstExchange
              ? {
                  title:
                    body.data.content.slice(0, 60) +
                    (body.data.content.length > 60 ? "…" : ""),
                  updatedAt: new Date(),
                }
              : { updatedAt: new Date() };

            await db
              .update(aiConversationsTable)
              .set(titleUpdate)
              .where(eq(aiConversationsTable.id, params.data.conversationId));
          }

          write({ type: "done", provider: providerUsed });
          res.end();
          return;
        }
      }
    } catch (err) {
      logger.error({ err }, "Nova chat stream error");
      write({ type: "error", error: "Stream failed unexpectedly" });
      res.end();
    }
  },
);

// ── POST /nova/ask (quick non-streaming, used by the terminal `nova` command) ─

router.post("/nova/ask", requireAuth, askRateLimiter, async (req, res): Promise<void> => {
  const body = NovaQuickAskBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  try {
    const result = await askOnce(
      [{ role: "user", content: body.data.content }],
      NOVA_SYSTEM_PROMPT,
    );
    res.json(NovaQuickAskResponse.parse(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI request failed";
    logger.error({ err }, "Nova quick ask error");
    res.status(503).json({ error: message });
  }
});

export default router;
