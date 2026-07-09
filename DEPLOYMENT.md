# NovaOS — Production Deployment Guide (Vercel)

This documents how to deploy NovaOS to Vercel from GitHub. Config files
(`vercel.json`, `api/index.ts`, `firebase.json`, `firestore.rules`) are in
place and verified locally (typecheck + build). Actual deployment must be
done from Vercel (this environment cannot invoke the Vercel platform).

## 1. Required environment variables (set in Vercel Project Settings)

Core:
- `DATABASE_URL` — Postgres connection string (production database)
- `NODE_ENV=production`
- `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` — existing Clerk auth (unchanged)
- `WEB_APP_URL` — the production URL (used for CORS allow-list)

Firebase Admin (server-side, additive — only needed if a feature uses Firestore/Firebase token verification):
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (keep the `\n` escapes as a single-line value in Vercel's env UI)

Firebase Client (browser, additive):
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_APP_ID`

None of these are hardcoded anywhere in the codebase — all are read from
`process.env` / `import.meta.env` at runtime, and the server fails fast at
boot (`src/lib/env.ts`) if a required or partially-set group is missing.

## 2. Firebase project setup

1. Create/select a Firebase project → enable **Authentication** → enable
   **Email/Password** and **Google** sign-in providers.
2. Create a **Firestore** database (production mode).
3. Deploy security rules and indexes from this repo:
   ```
   firebase deploy --only firestore:rules,firestore:indexes
   ```
   (`firestore.rules` denies all access by default, then allows a user to
   read/write only their own `users/{uid}` document and subcollections.)
4. Generate a service account key (Project Settings → Service Accounts →
   Generate new private key) for the three `FIREBASE_*` server variables.
5. Copy the Web App config (apiKey, authDomain, appId) for the three
   `VITE_FIREBASE_*` client variables.

## 3. Vercel project configuration

- **Build Command:** `pnpm install && pnpm --filter @workspace/novaos run build`
- **Output Directory:** `artifacts/novaos/dist/public`
- **Install Command:** `pnpm install --frozen-lockfile`
- API routes are served by `api/index.ts`, a serverless function that
  re-exports the existing Express app (`artifacts/api-server/src/app.ts`)
  unchanged — no server logic was duplicated or rewritten.
- `vercel.json` rewrites `/api/*` to that function and sets long-lived cache
  headers for static assets plus baseline security headers
  (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) for
  everything else.

### Known constraint

Vercel's serverless functions are stateless per-invocation. The in-memory AI
rate limiter (`src/lib/ai/rateLimiter.ts`) resets on every cold start on
Vercel, unlike the long-running Replit workflow process. This does not break
functionality, but rate limiting will be weaker on Vercel until it is backed
by a shared store (e.g. Redis/Upstash) — call this out to whoever owns the
Vercel deployment.

## 4. Deploy

1. Push this repository to GitHub (already the `origin`/source repo).
2. In Vercel, "Import Project" from the GitHub repo.
3. Paste in the environment variables from step 1.
4. Deploy. Vercel builds the frontend as a static site and the API as a
   serverless function per `vercel.json`.

## 5. Post-deploy checklist

- [ ] `https://<domain>/api/healthz` returns `{"status":"ok"}`
- [ ] `https://<domain>/api/healthz/firebase` returns `{"status":"ok"}` if
      Firebase Admin env vars are set, or `{"status":"disabled"}` if not
- [ ] Sign in with Clerk works (existing flow, unchanged)
- [ ] Firestore reads/writes succeed for any feature that opts into Firebase
- [ ] No secrets appear in browser devtools/network tab beyond the public
      Firebase Web config (which is meant to be public) and the Clerk
      publishable key (also meant to be public)
