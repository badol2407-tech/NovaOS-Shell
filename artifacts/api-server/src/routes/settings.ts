import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, userSettingsTable } from "@workspace/db";
import {
  UpdateMySettingsBody,
  GetMySettingsResponse,
  UpdateMySettingsResponse,
} from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/me/settings", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;

  let [settings] = await db
    .select()
    .from(userSettingsTable)
    .where(eq(userSettingsTable.userId, userId));

  if (!settings) {
    [settings] = await db
      .insert(userSettingsTable)
      .values({ userId })
      .onConflictDoNothing()
      .returning();

    if (!settings) {
      [settings] = await db
        .select()
        .from(userSettingsTable)
        .where(eq(userSettingsTable.userId, userId));
    }
  }

  res.json(GetMySettingsResponse.parse(settings));
});

router.patch("/me/settings", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;

  const parsed = UpdateMySettingsBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid settings update");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await db
    .insert(userSettingsTable)
    .values({ userId })
    .onConflictDoNothing();

  const [settings] = await db
    .update(userSettingsTable)
    .set(parsed.data)
    .where(eq(userSettingsTable.userId, userId))
    .returning();

  res.json(UpdateMySettingsResponse.parse(settings));
});

export default router;
