import { Router, type IRouter } from "express";
import { db, wallpapersTable } from "@workspace/db";
import { ListWallpapersResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/wallpapers", async (_req, res): Promise<void> => {
  const wallpapers = await db.select().from(wallpapersTable);
  res.json(ListWallpapersResponse.parse(wallpapers));
});

export default router;
