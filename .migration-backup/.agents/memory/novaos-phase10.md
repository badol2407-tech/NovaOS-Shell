---
name: NovaOS Phase 10 — Extension & Plugin Platform
description: Durable decisions, security constraints, and post-review fixes applied during Phase 10 completion.
---

## Phase 10: Extension & Plugin Platform

### What was built
Full plugin marketplace inside NovaOS: author → publish → install → run lifecycle.
- Backend: `artifacts/api-server/src/routes/plugins.ts` — full REST API (marketplace, CRUD, AI generation, sandbox bridge, audit log)
- Schema: `lib/db/src/schema/plugins.ts` — pluginsTable, pluginVersionsTable, pluginInstallationsTable, pluginStorageTable, pluginAuditLogTable
- Frontend: `artifacts/novaos/src/components/os/apps/PluginManager/` — MarketplaceTab, InstalledTab, MyPluginsTab, PermissionConsentDialog, PluginRunner
- SDK shim: `artifacts/api-server/src/lib/plugins/sdkShim.ts` served at `GET /plugins/sdk.js`
- Manifest schema + permission enum: `artifacts/api-server/src/lib/plugins/manifest.ts`

### Security constraints (applied during post-review hardening)

**Why:** Code review surfaced two High and two Medium issues that were fixed before final commit.

1. **Draft-install gate** (`plugins.ts` install route): Non-authors MUST NOT install draft plugins. Guard: `plugin.status !== "published" && plugin.authorUserId !== userId → 403`.
2. **iframe CSP** (`PluginRunner.tsx`): All plugin iframes must carry a strict `Content-Security-Policy` meta tag in `srcDoc`. Policy: `default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; connect-src 'self'; img-src data: blob:`. No external network access.
3. **manifest.id integrity** (`plugins.ts` update route): `manifest.id` in the PUT body must equal the `:id` URL param or return 400.
4. **Unique version constraint** (`lib/db/src/schema/plugins.ts`): `unique("plugin_versions_plugin_id_version_uniq").on(table.pluginId, table.version)` — prevents duplicate semver rows.

### openApp bridge
`PluginRunner.tsx` dispatches `window.dispatchEvent(new CustomEvent("novaos:plugin-open-app", { detail: { appId } }))`.
`Desktop.tsx` `DesktopContent` listens on `"novaos:plugin-open-app"`, looks up the app in the `apps` list, and calls `openWindow(appId, appData.name, appData.icon)`.
**Why:** The bridge was wired server-side but the client-side listener was missing — apps would silently do nothing when a plugin called `sdk.openApp()`.

### TypeScript
All three typecheck targets pass clean (no errors):
- `pnpm run typecheck:libs` (composite libs)
- `pnpm --filter @workspace/api-server run typecheck`
- `pnpm --filter @workspace/novaos run typecheck`

### GitHub push
Requires user to connect GitHub account in Replit's Git pane. Local commit `6ef40bb` is one ahead of `origin/main` (248acd8).
