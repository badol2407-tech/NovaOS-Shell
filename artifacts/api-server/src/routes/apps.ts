import { Router, type IRouter } from "express";
import { db, appsTable } from "@workspace/db";
import { ListAppsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/apps", async (_req, res): Promise<void> => {
  const apps = await db.select().from(appsTable);
  res.json(ListAppsResponse.parse(apps));
});

export default router;
