---
name: Realtime CRDT/socket access control
description: Long-lived WebSocket/Socket.IO connections need active revocation, not just cached-permission checks.
---

For any real-time layer (Socket.IO rooms, raw WebSocket/CRDT sessions) built on top of a role/membership model, authorizing once at connect/join time is not sufficient — a user removed or demoted mid-session must lose access promptly, not just have their local cache go stale.

**Why:** caching a role at join time (to avoid a DB round-trip on every high-frequency event like cursor moves) is reasonable for performance, but if revocation only evicts the cache without also (a) leaving the Socket.IO room / closing the socket, and (b) covering connections that never send another mutating event, the revoked user keeps receiving room broadcasts or keeps editing a CRDT doc indefinitely. A code-review pass caught exactly this gap.

**How to apply:**
- On any mutating event handler, re-validate membership against the DB (not just the cache) before relaying, and update/evict the cache based on the result.
- When revalidation fails, actively call `socket.leave(room)` (or close the raw WebSocket) immediately — cache eviction alone does not stop `io.to(room).emit(...)` fan-out to an already-joined socket.
- Add a periodic sweep (e.g. every 15s) over all open connections/rooms as defense-in-depth for idle connections that only send non-revalidating events (presence/cursor-only clients).
- For raw WebSocket protocols with no per-message app-level handler (e.g. hand-rolled Yjs sync), track `{userId, workspaceId}` per connection explicitly and run the same periodic membership sweep, force-closing revoked connections.
