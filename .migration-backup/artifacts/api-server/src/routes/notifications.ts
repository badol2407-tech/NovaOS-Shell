import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import {
  ListNotificationsResponse,
  GetNotificationsSummaryResponse,
  MarkAllNotificationsReadResponse,
  DeleteNotificationParams,
  MarkNotificationReadParams,
  MarkNotificationReadResponse,
} from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;

  const notifications = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt));

  res.json(ListNotificationsResponse.parse(notifications));
});

router.get(
  "/notifications/summary",
  requireAuth,
  async (req, res): Promise<void> => {
    const { userId } = req as AuthedRequest;

    const notifications = await db
      .select()
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.userId, userId),
          eq(notificationsTable.read, false),
        ),
      );

    res.json(
      GetNotificationsSummaryResponse.parse({
        unreadCount: notifications.length,
      }),
    );
  },
);

router.post(
  "/notifications/read-all",
  requireAuth,
  async (req, res): Promise<void> => {
    const { userId } = req as AuthedRequest;

    const updated = await db
      .update(notificationsTable)
      .set({ read: true })
      .where(eq(notificationsTable.userId, userId))
      .returning();

    res.json(MarkAllNotificationsReadResponse.parse(updated));
  },
);

router.delete(
  "/notifications/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    const { userId } = req as AuthedRequest;

    const params = DeleteNotificationParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [deleted] = await db
      .delete(notificationsTable)
      .where(
        and(
          eq(notificationsTable.id, params.data.id),
          eq(notificationsTable.userId, userId),
        ),
      )
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }

    res.sendStatus(204);
  },
);

router.post(
  "/notifications/:id/read",
  requireAuth,
  async (req, res): Promise<void> => {
    const { userId } = req as AuthedRequest;

    const params = MarkNotificationReadParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [notification] = await db
      .update(notificationsTable)
      .set({ read: true })
      .where(
        and(
          eq(notificationsTable.id, params.data.id),
          eq(notificationsTable.userId, userId),
        ),
      )
      .returning();

    if (!notification) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }

    res.json(MarkNotificationReadResponse.parse(notification));
  },
);

export default router;
