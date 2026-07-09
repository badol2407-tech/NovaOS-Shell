---
name: Clerk server middleware order
description: Both Clerk middlewares (proxy + clerkMiddleware), not just the proxy, must run before Express body parsers.
---

When wiring Clerk on an Express API server, mount **both** `clerkProxyMiddleware` and `clerkMiddleware(...)` before `express.json()`/`express.urlencoded()`. It's easy to correctly place the proxy first (the skill template emphasizes this) but then mount `clerkMiddleware` after the body parsers since it's not part of the same template file.

**Why:** `clerkMiddleware` needs to see the raw request before body-parsing middleware touches it; placing it after the parsers passed typechecking/build but is wrong ordering that a reviewer will flag.

**How to apply:** In `app.ts`, mount proxy path handler, then `clerkMiddleware(...)`, then CORS, then body parsers, then routes.
