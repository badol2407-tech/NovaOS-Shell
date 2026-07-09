---
name: Realtime CRDT/socket access control
description: Long-lived sockets must actively re-check membership and evict/close on revocation — covers both Socket.IO and Yjs WebSocket layers, plus Firestore presence rules.
---

# Realtime Access Control

## Rule
All long-lived WebSocket/Socket.IO connections must:
1. Verify membership at upgrade/handshake time
2. Re-verify on every high-consequence event (chat, terminal, AI relay)
3. Run a 15-second periodic sweep that evicts revoked members from rooms/connections

**Why:** Auth at connect time only lets a since-removed member keep reading/writing until they disconnect. Cursor/presence events are too frequent to re-check on each, but chat/terminal/project events are low-frequency enough to bear the DB cost.

**How to apply:**
- Socket.IO: `revalidateMembership()` called inside `chat:message`, `terminal:event`, `project:update`, `ai:message` handlers
- Yjs: `getMemberRole()` called in the 15s sweep, `ws.close(4001, 'membership_revoked')` on revocation
- Both layers have a `setInterval(15_000)` sweep keyed to `httpServer.on('close')` cleanup

## Terminal Input Gate
Terminal *input* (commands) requires `admin+` role. Terminal *output* (read-only mirror) allows `editor+`. This asymmetry prevents unprivileged editors from injecting commands into shared sessions. The role constant used in code is `"admin"` — if you see `"editor"` for the input path, it's a bug.

## Firestore Presence Rules
`nova_presence/{workspaceId}/users/{userId}` needs **operation-specific rules**:
- `create`, `update`: require `request.auth.uid == userId && request.resource.data.userId == userId`
- `delete`: require only `request.auth.uid == userId` — `request.resource` is unavailable on deletes
- Using a single `allow write` that checks `request.resource.data` will silently block all `deleteDoc` calls, leaving stale "online" ghosts in the presence list.

## Presence Read Scope
Any authenticated Firebase user who knows the workspace UUID can read presence. Full cross-store membership checks (Postgres Clerk ↔ Firestore Firebase) are impractical. The workspace UUID is the implicit secret — only returned to members via the Clerk-gated REST API.
