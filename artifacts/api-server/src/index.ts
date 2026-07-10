import { createServer } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { seedDefaultApps } from "./lib/seedDefaultApps";
import { seedDefaultWallpapers } from "./lib/seedDefaultWallpapers";
import { validateEnv } from "./lib/env";
import { setupRealtimeCollab } from "./lib/collab/realtime";
import { setupYjsServer } from "./lib/collab/yjsServer";

// Fail fast on missing/partial required config before accepting any traffic.
validateEnv();

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Seed built-in apps before accepting traffic.
// This is idempotent — safe to run on every startup.
await seedDefaultApps();
await seedDefaultWallpapers();

// Phase 11 — a raw http.Server (rather than app.listen) is required so both
// Socket.IO (presence/chat/terminal/project/AI events) and the Yjs CRDT
// WebSocket server (collaborative file editing) can attach to the same
// port via the HTTP "upgrade" event.
const httpServer = createServer(app);
setupRealtimeCollab(httpServer);
setupYjsServer(httpServer);

httpServer.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
