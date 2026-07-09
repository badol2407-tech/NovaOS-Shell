// Vercel serverless entry point for the NovaOS API.
// Vercel's Node runtime treats a default-exported Express app as a request
// handler directly — this file only re-exports the existing app, it does
// not duplicate any server setup or call app.listen() (that only happens in
// artifacts/api-server/src/index.ts, which is used for the Replit workflow).
export { default } from "../artifacts/api-server/src/app";
