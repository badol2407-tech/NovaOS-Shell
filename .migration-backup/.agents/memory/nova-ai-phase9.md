---
name: Nova AI Phase 9 — Visual App Builder
description: Architecture decisions, bugs caught, and patterns established during Phase 9 (App Builder) of NovaOS.
---

# Nova AI Phase 9 — Visual App Builder

## Architecture

- **State**: `ComponentNode[]` tree stored as JSON text in PostgreSQL (`builder_projects.nodesJson`). Drizzle schema at `lib/db/src/schema/builderProjects.ts`.
- **Backend routes**: `artifacts/api-server/src/routes/appBuilder.ts` — CRUD + streaming AI generation at `POST /app-builder/generate`.
- **Frontend**: `artifacts/novaos/src/components/os/apps/AppBuilder/` — BuilderProvider (useReducer), AppBuilderApp, and 8 sub-components.
- **No Orval codegen** for App Builder endpoints — uses direct `fetch` to avoid the barrel collision issue documented in the Orval memory entries.
- **AI generation** reuses `streamWithFallback` from Nova AI with a specialized system prompt instructing Nova to return `ComponentNode[]` JSON.

## Bugs caught in code review and fixed

1. **MOVE_NODE ancestor check**: moving a node into one of its own descendants deletes the source subtree without reinserting it. Fix: check `isAncestor()` before mutation.
2. **before/after insert**: `insertAfterInTree` was hardcoded to always insert after. Replaced with `insertRelativeInTree(nodes, targetId, node, "before" | "after")`.
3. **Hook rules in ComponentRenderer**: `useState` was called inside `renderNodeContent()` — a plain helper, not a React component — for Switch, Tabs, Accordion. Fix: extract `SwitchRenderer`, `TabsRenderer`, `AccordionRenderer` as named React function components.
4. **SSE parser chunk boundaries**: splitting `chunk.split("\n")` loses partial lines at chunk boundaries. Fix: maintain a `lineBuffer` string, process complete `\n`-terminated lines, carry the remainder forward.
5. **Append mode O(n²) history**: dispatching `ADD_NODE` per generated node creates N history entries and clones state N times. Fix: merge all generated nodes with `state.project.nodes` and dispatch a single `SET_NODES`.
6. **Save error handling**: `fetch` on update never checked `res.ok`. Fix: throw on non-ok response.

## Security hardening applied

- All CRUD endpoints scope by `userId` with Drizzle parameterized queries (no SQL injection risk).
- `MAX_CONTEXT_NODES_BYTES = 8000` cap on `context.currentNodes` in the generate endpoint — prevents oversized prompt payloads (DoS/cost risk).
- `context.selectedNodeType` capped at 64 chars, `preferredProvider` at 64 chars.

**Why:** The AI generation route accepts user-controlled context that flows directly into the prompt; without size caps a malicious request could inflate LLM costs or inject large payloads.

## Integration points

- Registered in `lib/db/src/schema/index.ts` (export)
- Mounted in `artifacts/api-server/src/routes/index.ts`
- Seeded as app entry in `artifacts/api-server/src/lib/seedDefaultApps.ts` (id: `"app-builder"`, category: `"Developer"`)
- Rendered in `artifacts/novaos/src/pages/Desktop.tsx` via `if (appId === 'app-builder') return <AppBuilderApp />`
