---
name: Orval Params name collision (path + query params on the same operation)
description: TS2308 duplicate export in generated zod/types barrels when an OpenAPI operation mixes path and query parameters.
---

When an OpenAPI operation has BOTH path parameters and query parameters (e.g.
`GET /things/{id}/sub?filter=x`), Orval's `zod` client and its plain TS
`types` output can both generate a type/schema named `{OperationId}Params`:

- The zod client names the **path-params** validator `{OperationId}Params`.
- The plain TS types module (consumed by the react-query client) names the
  **query-params** type `{OperationId}Params` too (it only needs to expose
  query params as a function argument, since path params become positional
  args).

If a package barrel does `export * from "./generated/api"` and
`export * from "./generated/types"`, this produces a TS2308 "already
exported a member" error. Operations with ONLY path params or ONLY query
params don't collide (query-only ones get a `{OperationId}QueryParams` name
from the zod side, which differs from the plain `{OperationId}Params` on the
types side).

**Why:** Discovered while adding a `listGitHubCommits`-style endpoint
(path: owner/repo, query: branch/per_page) to a pnpm-workspace project's
OpenAPI spec — `pnpm run codegen` failed typecheck with TS2308 on the
`api-zod` package.

**How to apply:** Don't hand-edit generated files. Instead, make the
package's own `index.ts` barrel (if hand-authored, not itself generated)
export explicit named types from `./generated/types` and exclude the
colliding name, since that particular TS-only type is normally unused
outside the `api-client-react` package anyway. Verify with
`grep -rn "{Name}" <package>/src` before excluding, to confirm it is
actually unused within the package doing the barrel export.
