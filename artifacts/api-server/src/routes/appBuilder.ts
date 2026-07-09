/**
 * App Builder routes — Phase 9
 *
 * GET    /app-builder/projects            — list user's builder projects
 * POST   /app-builder/projects            — create a builder project
 * GET    /app-builder/projects/:id        — get a builder project
 * PUT    /app-builder/projects/:id        — update a builder project
 * DELETE /app-builder/projects/:id        — delete a builder project
 * POST   /app-builder/generate            — AI-powered component/layout generation (streaming SSE)
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, builderProjectsTable } from "@workspace/db";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth.js";
import { streamWithFallback } from "../lib/ai/router.js";
import { chatRateLimiter } from "../lib/ai/rateLimiter.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

// ── Validation schemas ───────────────────────────────────────────────────────

const CreateProjectBody = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  framework: z.enum(["react", "nextjs", "vite"]).default("react"),
  nodesJson: z.string().default("[]"),
  themeJson: z.string().default("{}"),
});

const UpdateProjectBody = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  framework: z.enum(["react", "nextjs", "vite"]).optional(),
  nodesJson: z.string().optional(),
  themeJson: z.string().optional(),
});

const GenerateBody = z.object({
  prompt: z.string().min(1).max(2000),
  context: z
    .object({
      currentNodes: z.string().optional(),
      selectedNodeType: z.string().optional(),
    })
    .optional(),
  preferredProvider: z.string().nullable().optional(),
});

const APP_BUILDER_SYSTEM_PROMPT = `You are Nova App Builder — an AI that generates UI component trees for the NovaOS Visual App Builder.

When the user describes a UI, layout, or app, you must respond with a JSON array of ComponentNode objects.

ComponentNode schema:
{
  "id": "<unique string like 'btn_1'>",
  "type": "<ComponentType>",
  "label": "<human label>",
  "props": { /* type-specific props */ },
  "style": { /* optional style overrides */ },
  "children": [ /* nested ComponentNode[] */ ]
}

Valid ComponentType values:
Layout: container, grid, flex, section, divider, spacer
Typography: heading, text, label, badge, link
Inputs: button, input, textarea, select, checkbox, switch, slider, radio, form
Display: card, image, avatar, icon
Navigation: navbar, sidebar, footer, tabs, breadcrumb
Data: table, list, accordion
Charts: chart-bar, chart-line, chart-pie, chart-area

Common props by type:
- heading: { level: 1-6, text: "..." }
- text/label: { text: "..." }
- button: { text: "Click me", variant: "default|outline|ghost|destructive", size: "sm|md|lg" }
- input: { placeholder: "...", type: "text|email|password" }
- textarea: { placeholder: "...", rows: 3 }
- select: { placeholder: "Select...", items: [{ label: "...", value: "..." }] }
- badge: { text: "...", color: "blue|green|red|yellow|purple" }
- card: { /* card uses children for content */ }
- navbar: { brand: "App Name", navLinks: [{ label: "Home", url: "#" }] }
- grid: { cols: 2-4 } + children
- flex: {} + children (flex container)
- image: { src: "https://picsum.photos/400/200", alt: "..." }
- table: { columns: [{ key: "name", label: "Name" }], tableRows: [{ name: "..." }] }
- list: { listItems: ["Item 1", "Item 2"] }
- accordion: { items: [{ title: "...", content: "..." }] }
- tabs: { tabs: [{ label: "Tab 1", content: "Content here" }] }
- chart-bar/line/pie/area: { text: "Sales Data" }

Style fields (all optional):
width, height, minHeight, maxWidth, padding, paddingX, paddingY, margin,
backgroundColor, textColor, borderRadius, fontSize, fontWeight, textAlign,
gap, gridCols, shadow, flexDirection, alignItems, justifyContent

RULES:
1. ONLY return valid JSON — no markdown fences, no explanation, just the JSON array
2. Generate unique IDs for every node (e.g. "hero_1", "btn_2", "card_3")
3. Create realistic, production-quality layouts
4. Use semantic nesting (e.g. buttons inside cards, inputs inside forms)
5. For layout requests, use containers/grids/flex with children
6. For full pages, start with a navbar, then sections, then footer
7. Keep node count reasonable (5-30 nodes for most requests)

Example valid output for "create a hero section":
[
  {
    "id": "hero_1",
    "type": "section",
    "label": "Hero Section",
    "props": {},
    "style": { "padding": "80px", "textAlign": "center", "backgroundColor": "#1e1b4b" },
    "children": [
      { "id": "h1_1", "type": "heading", "label": "Hero Heading", "props": { "level": 1, "text": "Build faster with AI" }, "style": { "textColor": "#ffffff", "fontSize": "3rem", "fontWeight": "700" }, "children": [] },
      { "id": "sub_1", "type": "text", "label": "Subtitle", "props": { "text": "The all-in-one platform for modern developers." }, "style": { "textColor": "#a5b4fc", "fontSize": "1.25rem" }, "children": [] },
      { "id": "btn_1", "type": "button", "label": "CTA Button", "props": { "text": "Get Started", "variant": "default", "size": "lg" }, "style": {}, "children": [] }
    ]
  }
]`;

// ── GET /app-builder/projects ────────────────────────────────────────────────

router.get(
  "/app-builder/projects",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req as AuthedRequest;
    try {
      const projects = await db
        .select()
        .from(builderProjectsTable)
        .where(eq(builderProjectsTable.userId, userId))
        .orderBy(desc(builderProjectsTable.updatedAt));
      res.json(projects);
    } catch (err) {
      logger.error({ err }, "Failed to list builder projects");
      res.status(500).json({ error: "Failed to list projects" });
    }
  },
);

// ── POST /app-builder/projects ───────────────────────────────────────────────

router.post(
  "/app-builder/projects",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const parsed = CreateProjectBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      const [project] = await db
        .insert(builderProjectsTable)
        .values({ userId, ...parsed.data })
        .returning();
      res.status(201).json(project);
    } catch (err) {
      logger.error({ err }, "Failed to create builder project");
      res.status(500).json({ error: "Failed to create project" });
    }
  },
);

// ── GET /app-builder/projects/:id ───────────────────────────────────────────

router.get(
  "/app-builder/projects/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const id = parseInt(String(req.params["id"]), 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid project id" });
      return;
    }
    try {
      const [project] = await db
        .select()
        .from(builderProjectsTable)
        .where(
          and(
            eq(builderProjectsTable.id, id),
            eq(builderProjectsTable.userId, userId),
          ),
        );
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      res.json(project);
    } catch (err) {
      logger.error({ err }, "Failed to get builder project");
      res.status(500).json({ error: "Failed to get project" });
    }
  },
);

// ── PUT /app-builder/projects/:id ───────────────────────────────────────────

router.put(
  "/app-builder/projects/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const id = parseInt(String(req.params["id"]), 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid project id" });
      return;
    }
    const parsed = UpdateProjectBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      const [project] = await db
        .update(builderProjectsTable)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(
          and(
            eq(builderProjectsTable.id, id),
            eq(builderProjectsTable.userId, userId),
          ),
        )
        .returning();
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      res.json(project);
    } catch (err) {
      logger.error({ err }, "Failed to update builder project");
      res.status(500).json({ error: "Failed to update project" });
    }
  },
);

// ── DELETE /app-builder/projects/:id ────────────────────────────────────────

router.delete(
  "/app-builder/projects/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const id = parseInt(String(req.params["id"]), 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid project id" });
      return;
    }
    try {
      const [deleted] = await db
        .delete(builderProjectsTable)
        .where(
          and(
            eq(builderProjectsTable.id, id),
            eq(builderProjectsTable.userId, userId),
          ),
        )
        .returning();
      if (!deleted) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      logger.error({ err }, "Failed to delete builder project");
      res.status(500).json({ error: "Failed to delete project" });
    }
  },
);

// ── POST /app-builder/generate (streaming SSE) ───────────────────────────────

router.post(
  "/app-builder/generate",
  requireAuth,
  chatRateLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = GenerateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { prompt, context, preferredProvider } = parsed.data;

    const contextNote = context?.currentNodes
      ? `\n\nCurrent canvas has these nodes:\n${context.currentNodes}\n\nModify or extend them based on the user's request. Keep existing IDs when updating.`
      : "";

    const messages = [
      {
        role: "user" as const,
        content: `${prompt}${contextNote}`,
      },
    ];

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    try {
      for await (const event of streamWithFallback(
        messages,
        APP_BUILDER_SYSTEM_PROMPT,
        preferredProvider,
      )) {
        if (event.content !== undefined) {
          res.write(`data: ${JSON.stringify({ content: event.content })}\n\n`);
        } else if (event.error) {
          res.write(`data: ${JSON.stringify({ error: event.error })}\n\n`);
        } else if (event.done) {
          res.write(
            `data: ${JSON.stringify({ done: true, provider: event.provider })}\n\n`,
          );
        }
      }
    } catch (err) {
      logger.error({ err }, "App builder generation error");
      res.write(`data: ${JSON.stringify({ error: "Generation failed" })}\n\n`);
    } finally {
      res.end();
    }
  },
);

export default router;
