---
name: Nova AI Phase 8 architecture
description: Key decisions, pitfalls, and constraints from the Phase 8 Nova AI implementation.
---

## Streaming fallback rule
Once any SSE chunk has been yielded to the caller, do NOT fall through to the next AI provider. Mixed output from two providers in one SSE session produces incoherent responses and wrong provenance. The `chunksEmitted` counter in `streamWithFallback` guards this.

**Why:** Code review flagged mid-stream fallback as a corruption bug — partial content from provider A + full content from provider B both persisted as one assistant message.

**How to apply:** Any future changes to `artifacts/api-server/src/lib/ai/router.ts` must preserve the `chunksEmitted > 0` guard.

## Body schemas in api-zod barrel: do NOT add to EXPLICIT_TYPES
Body schemas (`SendNovaMessageBody`, `NovaQuickAskBody`, `NovaQuickAskResponse`) are exported as Zod values from `./generated/api`. If also listed in `EXPLICIT_TYPES` in `fix-zod-barrel.mjs`, the `export type { }` re-export shadows the value export → TS2693 "only refers to a type, but is being used as a value".

EXPLICIT_TYPES is only safe for schema component types that exist in `./generated/types` but NOT as Zod schemas in `./generated/api` (e.g. `NovaConversation`, `NovaMessageRole` — names that differ from the Zod schema names Orval generates for operations).

**Why:** Discovered when api-server typechecked with TS2693 on all three body schema usages.

## Frontend type imports: use api-client-react
The novaos frontend does not depend on `@workspace/api-zod`. `@workspace/api-client-react` re-exports `* from "./generated/api.schemas"` which includes all schema TypeScript types. Import `NovaConversation`, `NovaMessage`, etc. from `@workspace/api-client-react`.

## Orval mutation call shape
For body mutations, Orval wraps the body in `{ data: BodyType<T> }`. Callers must use `createConv.mutate({ data: { title: "..." } })`, not `createConv.mutate({ title: "..." })`.

## Rate limiter placement
`chatRateLimiter` / `askRateLimiter` must be placed AFTER `requireAuth` in the middleware chain — the limiter reads `req.userId` which is only set by `requireAuth`.

## OpenAPI SSE endpoint
The `/nova/conversations/:id/chat` endpoint is SSE (`text/event-stream`). Document it with `content: text/event-stream` in OpenAPI to prevent Orval from generating a usable React Query hook for streaming (clients must use raw `fetch` + `ReadableStream`).

## GitHub push: requires Replit GitHub account link
`gitPush({})` returns `NO_CREDENTIALS` if the user hasn't connected their GitHub account in Replit's Git panel. The commit is local; user must link GitHub to push. Retry `gitPush({})` after they confirm linking — no other action needed.

## EXPLICIT_TYPES also covers plain response schemas without an Input counterpart
`NovaPreferences`/`NovaSettings` (GET response shapes) needed EXPLICIT_TYPES entries just like `NovaConversation` did, while their `*Input` (PUT body) counterparts must stay OUT since Orval already exports those as Zod values. Rule of thumb: if a schema only appears as a response body (never as a request body Orval turns into a Zod mutation schema), it likely needs EXPLICIT_TYPES.

## Validate bounded-choice fields server-side, not just with Zod's generic string type
Fields like `preferredProvider` that must be one of a small canonical set (provider names, enum-like identifiers) need an explicit runtime check against the canonical list (e.g. `PROVIDER_NAMES`) before persisting — Zod's `z.string()` alone won't reject unknown values, and OpenAPI enums are not enforced at runtime by Orval-generated clients.

## Freshly imported repos may have Clerk in `not_configured` state
If authed routes 500 with "Missing Clerk Secret Key" on a project that was imported (not built fresh in this session), check `checkClerkManagementStatus()` early — Clerk may never have been provisioned, blocking all `requireAuth` routes until `setupClerkWhitelabelAuth()` runs.
