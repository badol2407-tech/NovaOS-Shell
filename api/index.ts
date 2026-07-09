// Vercel serverless entry point for the NovaOS API.
// Vercel's Node runtime treats a default-exported Express app as a request
// handler directly. This file does not duplicate the Express setup itself
// (that lives only in artifacts/api-server/src/app.ts) or call app.listen()
// (Vercel manages the listener) — but it does mirror the same startup-time
// side effects that artifacts/api-server/src/index.ts runs for the Replit
// workflow (env validation, default app seeding), since Vercel never
// executes index.ts.
//
// Note: Phase 11 WebSocket features (Socket.IO realtime + Yjs CRDT) are
// intentionally excluded here — Vercel serverless functions do not support
// persistent WebSocket connections. Those features require the long-running
// Replit workflow (artifacts/api-server) or a dedicated VM deployment.
import app from "../artifacts/api-server/src/app";
import { validateEnv } from "../artifacts/api-server/src/lib/env";
import { seedDefaultApps } from "../artifacts/api-server/src/lib/seedDefaultApps";

validateEnv();

// Best-effort, idempotent seed. Runs once per cold start; safe under
// concurrent invocations since seedDefaultApps upserts on conflict.
void seedDefaultApps();

export default app;
