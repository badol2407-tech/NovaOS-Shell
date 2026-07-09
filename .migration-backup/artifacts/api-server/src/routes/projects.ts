import { Router, type IRouter } from "express";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db, projectsTable, tasksTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { z } from "zod/v4";

const router: IRouter = Router();

const PROJECT_STATUSES = ["active", "archived"] as const;
const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
const TASK_PRIORITIES = ["low", "medium", "high"] as const;

const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "color must be a hex color like #6366f1")
    .optional(),
});

const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "color must be a hex color like #6366f1")
      .optional(),
    status: z.enum(PROJECT_STATUSES).optional(),
  })
  .refine((v: Record<string, unknown>) => Object.keys(v).length > 0, {
    message: "No fields to update",
  });

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(5000).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  dueDate: z.string().trim().min(1).optional(),
});

const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(300).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    dueDate: z.string().trim().min(1).nullable().optional(),
    position: z.number().int().min(0).optional(),
  })
  .refine((v: Record<string, unknown>) => Object.keys(v).length > 0, {
    message: "No fields to update",
  });

// ─── GET /projects ─────────────────────────────────────────────────────────────

router.get("/projects", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;

  // Projects with task count
  const projects = await db
    .select({
      id: projectsTable.id,
      userId: projectsTable.userId,
      name: projectsTable.name,
      description: projectsTable.description,
      color: projectsTable.color,
      status: projectsTable.status,
      taskCount: sql<number>`CAST(COUNT(${tasksTable.id}) AS integer)`,
      createdAt: projectsTable.createdAt,
      updatedAt: projectsTable.updatedAt,
    })
    .from(projectsTable)
    .leftJoin(tasksTable, eq(tasksTable.projectId, projectsTable.id))
    .where(eq(projectsTable.userId, userId))
    .groupBy(projectsTable.id)
    .orderBy(desc(projectsTable.updatedAt));

  res.json(projects);
});

// ─── GET /projects/stats ───────────────────────────────────────────────────────

router.get("/projects/stats", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;

  const [projectCounts] = await db
    .select({
      total: sql<number>`CAST(COUNT(*) AS integer)`,
      active: sql<number>`CAST(COUNT(*) FILTER (WHERE ${projectsTable.status} = 'active') AS integer)`,
    })
    .from(projectsTable)
    .where(eq(projectsTable.userId, userId));

  const [taskCounts] = await db
    .select({
      total: sql<number>`CAST(COUNT(*) AS integer)`,
      todo: sql<number>`CAST(COUNT(*) FILTER (WHERE ${tasksTable.status} = 'todo') AS integer)`,
      inProgress: sql<number>`CAST(COUNT(*) FILTER (WHERE ${tasksTable.status} = 'in_progress') AS integer)`,
      done: sql<number>`CAST(COUNT(*) FILTER (WHERE ${tasksTable.status} = 'done') AS integer)`,
    })
    .from(tasksTable)
    .where(eq(tasksTable.userId, userId));

  res.json({
    totalProjects: projectCounts?.total ?? 0,
    activeProjects: projectCounts?.active ?? 0,
    totalTasks: taskCounts?.total ?? 0,
    todoTasks: taskCounts?.todo ?? 0,
    inProgressTasks: taskCounts?.inProgress ?? 0,
    doneTasks: taskCounts?.done ?? 0,
  });
});

// ─── POST /projects ────────────────────────────────────────────────────────────

router.post("/projects", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" });
    return;
  }
  const { name, description, color } = parsed.data;

  const [project] = await db
    .insert(projectsTable)
    .values({
      userId,
      name,
      description: description ?? null,
      color: color ?? "#6366f1",
    })
    .returning();

  res.status(201).json({ ...project, taskCount: 0 });
});

// ─── GET /projects/:id ─────────────────────────────────────────────────────────

router.get("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  const id = Number(req.params["id"]);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid project id" });
    return;
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const tasks = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.projectId, id), eq(tasksTable.userId, userId)))
    .orderBy(asc(tasksTable.position), asc(tasksTable.createdAt));

  res.json({ ...project, tasks });
});

// ─── PATCH /projects/:id ───────────────────────────────────────────────────────

router.patch("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  const id = Number(req.params["id"]);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid project id" });
    return;
  }

  const parsed = updateProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" });
    return;
  }
  const { name, description, color, status } = parsed.data;

  const updateData: Partial<typeof projectsTable.$inferInsert> = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description ?? null;
  if (color !== undefined) updateData.color = color;
  if (status !== undefined) updateData.status = status;

  const [project] = await db
    .update(projectsTable)
    .set(updateData)
    .where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)))
    .returning();

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  // Get task count (scoped to the same owner as the project, consistent with other endpoints)
  const [{ taskCount }] = await db
    .select({ taskCount: sql<number>`CAST(COUNT(*) AS integer)` })
    .from(tasksTable)
    .where(and(eq(tasksTable.projectId, id), eq(tasksTable.userId, userId)));

  res.json({ ...project, taskCount: taskCount ?? 0 });
});

// ─── DELETE /projects/:id ──────────────────────────────────────────────────────

router.delete("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  const id = Number(req.params["id"]);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid project id" });
    return;
  }

  const [deleted] = await db
    .delete(projectsTable)
    .where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.sendStatus(204);
});

// ─── GET /projects/:id/tasks ───────────────────────────────────────────────────

router.get(
  "/projects/:id/tasks",
  requireAuth,
  async (req, res): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const projectId = Number(req.params["id"]);

    if (isNaN(projectId)) {
      res.status(400).json({ error: "Invalid project id" });
      return;
    }

    // Verify project ownership
    const [project] = await db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const tasks = await db
      .select()
      .from(tasksTable)
      .where(and(eq(tasksTable.projectId, projectId), eq(tasksTable.userId, userId)))
      .orderBy(asc(tasksTable.position), asc(tasksTable.createdAt));

    res.json(tasks);
  },
);

// ─── POST /projects/:id/tasks ──────────────────────────────────────────────────

router.post(
  "/projects/:id/tasks",
  requireAuth,
  async (req, res): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const projectId = Number(req.params["id"]);

    if (isNaN(projectId)) {
      res.status(400).json({ error: "Invalid project id" });
      return;
    }

    // Verify project ownership
    const [project] = await db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const parsed = createTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" });
      return;
    }
    const { title, description, status, priority, dueDate } = parsed.data;

    // Get next position in the same status column
    const [{ maxPos }] = await db
      .select({ maxPos: sql<number>`COALESCE(MAX(${tasksTable.position}), -1)` })
      .from(tasksTable)
      .where(
        and(
          eq(tasksTable.projectId, projectId),
          eq(tasksTable.status, status ?? "todo"),
        ),
      );

    const [task] = await db
      .insert(tasksTable)
      .values({
        projectId,
        userId,
        title,
        description: description ?? null,
        status: status ?? "todo",
        priority: priority ?? "medium",
        dueDate: dueDate ?? null,
        position: (maxPos ?? -1) + 1,
      })
      .returning();

    res.status(201).json(task);
  },
);

// ─── PATCH /projects/:id/tasks/:taskId ────────────────────────────────────────

router.patch(
  "/projects/:id/tasks/:taskId",
  requireAuth,
  async (req, res): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const projectId = Number(req.params["id"]);
    const taskId = Number(req.params["taskId"]);

    if (isNaN(projectId) || isNaN(taskId)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const parsed = updateTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" });
      return;
    }
    const { title, description, status, priority, dueDate, position } = parsed.data;

    const updateData: Partial<typeof tasksTable.$inferInsert> = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description ?? null;
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (dueDate !== undefined) updateData.dueDate = dueDate ?? null;
    if (position !== undefined) updateData.position = position;

    const [task] = await db
      .update(tasksTable)
      .set(updateData)
      .where(
        and(
          eq(tasksTable.id, taskId),
          eq(tasksTable.projectId, projectId),
          eq(tasksTable.userId, userId),
        ),
      )
      .returning();

    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    res.json(task);
  },
);

// ─── DELETE /projects/:id/tasks/:taskId ────────────────────────────────────────

router.delete(
  "/projects/:id/tasks/:taskId",
  requireAuth,
  async (req, res): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const projectId = Number(req.params["id"]);
    const taskId = Number(req.params["taskId"]);

    if (isNaN(projectId) || isNaN(taskId)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const [deleted] = await db
      .delete(tasksTable)
      .where(
        and(
          eq(tasksTable.id, taskId),
          eq(tasksTable.projectId, projectId),
          eq(tasksTable.userId, userId),
        ),
      )
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    res.sendStatus(204);
  },
);

export default router;
