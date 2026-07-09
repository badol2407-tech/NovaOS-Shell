---
name: Workspace package TypeScript type resolution
description: How to make workspace libs resolvable via project references in this monorepo.
---

## Rule
Every `lib/*` package that is consumed via TypeScript project references must have:
1. A `tsconfig.json` with `"composite": true`, `"emitDeclarationOnly": true`, `"outDir": "dist"`.
2. The `package.json` `exports` field must include a `"types"` condition pointing to `./dist/index.d.ts` (not just `"default": "./src/index.ts"`).
3. The dist declarations must be **built** (`npx tsc --project tsconfig.json` in the lib directory) before the consuming workspace will typecheck clean.

**Why:** TypeScript project references always read from `outDir` (dist), not src. Without the `"types"` export condition, tsc falls back to the `"default"` condition (src/index.ts) but the project reference constraint prevents reading TypeScript source from another project's src tree.

**How to apply:** Whenever a workspace lib is added or updated, run `npx tsc --project tsconfig.json` in its directory and confirm `package.json` has `"types": "./dist/index.d.ts"` in its exports.

Affected packages fixed: `@workspace/api-client-react`, `@workspace/db`, `@workspace/api-zod`.
