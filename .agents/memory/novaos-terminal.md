---
name: NovaOS Terminal — architecture and VFS integration
description: How the Developer Terminal is wired into NovaOS and how it integrates with the VFS.
---

## Shell → VFS contract
- Terminal reads VFS state via `getVFSSnapshot()` from `FileManager/storage/vfsStore`.
- All filesystem mutations (mkdir, touch, rm, mv, cp) return a `vfsMutation: (prev: Record<string, VFSNode>) => Record<string, VFSNode>` function.
- The shell engine applies mutations via `mutateVFS((prev) => ({ ...prev, nodes: mut(prev.nodes) }))`.
- This keeps File Manager windows in sync with terminal operations via `subscribeVFS`.

## Desktop wiring
- `Desktop.tsx` `renderApp(appId)` dispatches on `appId === 'terminal'` → `<TerminalApp />` (the root Provider wrapper).
- Terminal is seeded via `seedDefaultApps.ts` with `id: "terminal"`, `category: "Developer"`.

## Tab / split-pane state
- All state lives in `TerminalProvider` (useReducer). Each tab has independent `session`, `output`, `inputBuffer`.
- Split panes share a tab but have separate `session`/`output` keys (`split*` prefix).
- `activeSplitPane` tracks which pane has focus.

## `&&` chaining
- `dispatch()` in `commands/index.ts` is `async`. Each `&&` part's session and VFS mutations are applied sequentially to a mutable context copy so later commands see earlier mutations.

## MULTI_INSTANCE_APPS
- To allow multiple terminal windows, add `'terminal'` to `MULTI_INSTANCE_APPS` in `OSProvider.tsx`.

## node command security note
- The `node` command uses `new Function` for JS evaluation — intentionally limited scope (no window/document/fetch), but not a true sandbox. Acceptable for a simulated dev terminal; do not expose to untrusted user input.
