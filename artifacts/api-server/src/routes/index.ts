import { Router, type IRouter } from "express";
import healthRouter from "./health";
import settingsRouter from "./settings";
import wallpapersRouter from "./wallpapers";
import appsRouter from "./apps";
import notificationsRouter from "./notifications";
import githubRouter from "./github";
import projectsRouter from "./projects";
import novaRouter from "./nova";
import appBuilderRouter from "./appBuilder";

const router: IRouter = Router();

router.use(healthRouter);
router.use(settingsRouter);
router.use(wallpapersRouter);
router.use(appsRouter);
router.use(notificationsRouter);
router.use(githubRouter);
router.use(projectsRouter);
router.use(novaRouter);
router.use(appBuilderRouter);

export default router;
