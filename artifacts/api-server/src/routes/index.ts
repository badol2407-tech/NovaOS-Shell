import { Router, type IRouter } from "express";
import healthRouter from "./health";
import settingsRouter from "./settings";
import wallpapersRouter from "./wallpapers";
import appsRouter from "./apps";
import notificationsRouter from "./notifications";

const router: IRouter = Router();

router.use(healthRouter);
router.use(settingsRouter);
router.use(wallpapersRouter);
router.use(appsRouter);
router.use(notificationsRouter);

export default router;
