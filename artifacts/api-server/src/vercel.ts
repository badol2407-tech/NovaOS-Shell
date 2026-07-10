/**
 * Vercel serverless entry point — bundled by build-vercel.mjs into
 * dist/app.vercel.mjs and re-exported by /api/index.js at the repo root.
 *
 * Intentionally excludes:
 *   - app.listen()          (Vercel manages the listener)
 *   - Socket.IO setup       (persistent WebSocket unsupported in serverless)
 *   - Yjs WebSocket setup   (same reason — requires a long-running VM)
 */
import app from "./app";
import { validateEnv } from "./lib/env";
import { seedDefaultApps } from "./lib/seedDefaultApps";
import { seedDefaultWallpapers } from "./lib/seedDefaultWallpapers";

validateEnv();

// Idempotent seeds — safe under concurrent cold starts.
void seedDefaultApps();
void seedDefaultWallpapers();

export default app;
