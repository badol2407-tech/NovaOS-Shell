---
name: y-websocket server-side ESM gap
description: y-websocket's Node server utilities aren't importable from ESM; how to implement the sync/awareness relay directly.
---

`y-websocket`'s server-side helper (`bin/utils`) is not exposed through the package's `exports` map, so it cannot be imported from an ESM Node server. This isn't a version fluke to retry — it's structural to how the package ships.

**Why:** attempting `import { setupWSConnection } from "y-websocket/bin/utils"` (or similar) fails to resolve under Node ESM resolution even though the file exists in the package.

**How to apply:** implement the sync/awareness wire protocol directly against `y-protocols/sync`, `y-protocols/awareness`, and `lib0/encoding`+`lib0/decoding`, mounted on the HTTP server's `upgrade` event with a raw `ws` `WebSocketServer`. This is the same protocol the browser's `y-websocket` `WebsocketProvider` speaks — client code does not need to change. Key correctness points learned the hard way:
- Register `doc.on("update", ...)` and `awareness.on("update", ...)` **once per Yjs doc**, not once per connection — a per-connection listener rebroadcasts every update once per currently-connected client, multiplying network traffic by N.
- Track each connection's own awareness client IDs (derived from the doc-level awareness listener's `origin === ws` check) so disconnect cleanup removes exactly that connection's presence states, not a shared/wrong ID.
- Auth (e.g. Clerk token verification + membership check) at `upgrade` time only covers the initial connect — for long-lived CRDT sessions, add a periodic re-check that force-closes the socket if membership is revoked mid-session.
