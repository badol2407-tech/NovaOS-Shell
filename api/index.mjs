/**
 * Vercel serverless entry point for the NovaOS API.
 *
 * The pre-bundled app.vercel.mjs contains the Express request handler plus
 * startup-time side effects (env validation, default app seeding). Vercel
 * treats the default export as the request handler.
 *
 * WebSocket features (Socket.IO realtime + Yjs CRDT) are excluded from the
 * bundle — Vercel serverless functions do not support persistent connections.
 */
export { default } from "../artifacts/api-server/dist/vercel.mjs";
