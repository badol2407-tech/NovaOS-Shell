# Memory Index

- [y-websocket server-side ESM gap](y-websocket-server-esm.md) — `y-websocket`'s Node server helper isn't exported via package `exports`; hand-roll the protocol with `y-protocols`+`lib0` instead.
- [Realtime CRDT/socket access control](realtime-access-control.md) — long-lived sockets must actively re-check membership and evict/close on revocation, not just cache-evict.
- [Yjs doc listener scope](yjs-doc-listener-scope.md) — register Yjs doc/awareness update listeners once per doc, never per-connection, or updates rebroadcast N× per client.
