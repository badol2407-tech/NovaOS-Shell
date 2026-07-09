import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { isFirebaseAdminConfigured } from "../lib/env";
import { getFirestoreDb } from "../lib/firebaseAdmin";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Verifies Firebase Admin connectivity. Returns "disabled" (not an error)
// when Firebase isn't configured, so this is safe to poll on every deploy.
router.get("/healthz/firebase", async (_req, res) => {
  if (!isFirebaseAdminConfigured()) {
    res.json({ status: "disabled" });
    return;
  }

  try {
    const db = await getFirestoreDb();
    await db.listCollections();
    res.json({ status: "ok" });
  } catch (err) {
    logger.error({ err }, "Firebase Admin health check failed");
    res.status(503).json({ status: "error" });
  }
});

export default router;
