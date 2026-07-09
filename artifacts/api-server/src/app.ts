import express, { type Express, type ErrorRequestHandler } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

const app: Express = express();

// ── Security headers ─────────────────────────────────────────────────────────
// Applied before all other middleware so every response carries them,
// including error responses and health-check probes.
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  // Single combined Permissions-Policy — includes interest-cohort for FLoC opt-out
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()",
  );
  next();
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Both Clerk middlewares are mounted before the body parsers -- the proxy
// streams raw bytes, and clerkMiddleware must see the request before any
// body-parsing middleware touches it.
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

const allowedOrigins = [
  process.env.REPLIT_DEV_DOMAIN && `https://${process.env.REPLIT_DEV_DOMAIN}`,
  process.env.WEB_APP_URL,
].filter((origin): origin is string => Boolean(origin));

// In production, an empty allow-list must fail closed (reject cross-origin
// requests) rather than reflect any origin. Development keeps the permissive
// fallback so local/proxy previews without WEB_APP_URL set still work.
const isProduction = process.env.NODE_ENV === "production";
const corsOrigin =
  allowedOrigins.length > 0 ? allowedOrigins : !isProduction;

app.use(
  cors({
    credentials: true,
    origin: corsOrigin,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Catch-all error handler. Must be registered last. Never leak stack traces
// or internal error details to clients — log them server-side instead.
const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  req.log?.error({ err }, "Unhandled request error");
  if (res.headersSent) {
    return;
  }
  res.status(500).json({ error: "Internal server error" });
};
app.use(errorHandler);

export default app;
