---
name: FileManager VFS store architecture
description: How the File Manager separates shared VFS state from per-window navigation state, and how persistence is split across two storage slots.
---

# FileManager VFS Store Architecture

## The rule
VFS data (nodes, recentIds) lives in a **module-level singleton** (`vfsStore.ts`).
Per-window view prefs (currentFolderId, viewMode, sortBy, sortDir, previewOpen) persist via `vfsStorage.ts`.
Ephemeral per-window state (selectedIds, clipboard, drag, etc.) is never persisted.

**Why:** Multiple File Manager windows (MULTI_INSTANCE_APPS) would overwrite each other's VFS data if each window owned its own persistence. The singleton ensures all windows share one canonical VFS and one persistence slot.

## Storage keys
- `nova_fm_vfs_v1` — nodes + recentIds (written by vfsStore.ts, version-gated)
- `nova_fm_view_v1` — view prefs (written by vfsStorage.ts, version-gated)

## Loop-prevention for cross-window sync
Each `FileManagerProvider` subscribes to `vfsStore`. After a local mutation it calls `mutateVFS(() => ({nodes, recentIds}))`. `mutateVFS` checks reference equality — if the store's current nodes reference matches, it's a no-op and does NOT re-notify listeners, breaking the potential loop.

The `SYNC_VFS` reducer case also does an early reference-equality return, so the window that triggered the store update doesn't spuriously re-render.

## Stale-closure fix for unmount flush
`flushViewPrefs` on unmount reads from a **ref** (`viewPrefsRef.current`) that is updated on every render, not from the closure over initial state. This avoids the classic "unmount writes stale data" bug.

## How to apply
- Never put VFS node data in per-window reducer state that persists independently.
- Any new field that should survive refresh: if shared across windows → vfsStore, if per-window preference → vfsStorage.
- MULTI_INSTANCE_APPS set is in OSProvider.tsx; add new multi-instance apps there.
