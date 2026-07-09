---
name: Platform stack substitution for Next.js/Supabase/Vercel requests
description: What to substitute when a user asks for a stack Replit doesn't support directly (Next.js, Supabase, Vercel).
---

When a user requests Next.js + Supabase + Vercel (or similar unsupported combo), Replit's artifact tooling doesn't support them directly. Substitute:
- Next.js → React + Vite (`react-vite` skill / artifact)
- Vercel hosting/functions → Express API server artifact
- Supabase Postgres → `@workspace/db` (Postgres + Drizzle)
- Supabase Auth → Clerk (Replit-managed), unless the user explicitly asks for "Sign in with Replit"
- PostHog / other add-ons not yet wired → defer and say so explicitly

**Why:** These are hard platform constraints, not preferences — silently building the requested stack fails, and silently substituting without telling the user causes confusion later when they expect Next.js conventions.

**How to apply:** State the substitution plan to the user before building, once, up front. Don't re-litigate it per feature.
