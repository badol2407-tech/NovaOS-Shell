---
name: Orval barrel regeneration
description: Orval always regenerates the workspace-level index.ts; manual edits are overwritten on every codegen run.
---

With `workspace: "/path/to/src"` and `mode: "split"`, orval generates a barrel
`{workspace}/index.ts` that wildcard-exports from the generated folders. This
file is **always regenerated** on every `orval` run — even if it existed before
with hand-authored content.

**Why:** Discovered while trying to fix a TS2308 collision in `lib/api-zod/src/index.ts`.
Every edit to the file was overwritten when `pnpm run codegen` ran orval.

**How to apply:** Never hand-edit the workspace-level `index.ts` directly. Instead:
1. Add a post-codegen script (e.g. `fix-zod-barrel.mjs`) that rewrites the file
   after orval finishes.
2. Wire it into the `codegen` npm script: `orval ... && node ./fix-zod-barrel.mjs && tsc`
3. The script should write the full desired content (not patch), since orval always
   resets the file to wildcard exports first.

Note: `indexFiles: false` in orval config prevents generation of subfolder index files
(e.g. `generated/types/index.ts`) but does NOT prevent generation of the workspace-level
`index.ts`. It makes things worse by removing `types/index.ts` while the generated barrel
still references it.
