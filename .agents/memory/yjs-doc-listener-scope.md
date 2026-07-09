---
name: Yjs doc listener scope
description: Where to attach Yjs doc/awareness update listeners in a multi-connection server-side relay.
---

When implementing a server-side Yjs relay (e.g. hand-rolled y-websocket protocol) that serves multiple WebSocket connections against one shared `Y.Doc`, attach `doc.on("update", ...)` and `awareness.on("update", ...)` exactly once per doc — at doc-creation time — not inside the per-connection setup function.

**Why:** if each new connection registers its own listener on the shared doc/awareness object, a single update gets broadcast once per currently-connected client (N listeners × 1 update = N broadcasts to each of N peers), causing quadratic protocol noise and get worse as more clients join. This was flagged in code review as a correctness/scalability bug.

**How to apply:** create the listeners inside the doc's lazy-init function (the one that runs on first connection for a given doc name) and close over the connection registry (`Map<WebSocket, ...>`) rather than a per-connection variable, so the single listener can iterate all current connections when broadcasting.
