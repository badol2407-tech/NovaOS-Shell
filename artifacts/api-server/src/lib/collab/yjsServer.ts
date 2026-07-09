/**
 * Phase 11 — CRDT Collaborative Editing (Yjs)
 *
 * Raw WebSocket server (separate from Socket.IO) speaking the y-websocket
 * wire protocol, mounted at /api/yjs. Each cloud file gets its own Yjs
 * document named `file:<workspaceId>:<fileId>`.
 *
 * `y-websocket`'s own Node server helper (`bin/utils`) isn't exposed through
 * its package "exports" map, so the sync/awareness relay is implemented
 * directly against `y-protocols` + `lib0` here — this is the same protocol
 * the browser's `y-websocket` `WebsocketProvider` speaks, just hand-rolled
 * on the server side.
 *
 * Persistence: the Yjs doc lives in-process (no y-leveldb/y-redis adapter).
 * To keep the existing `cloudFiles` REST/version model as the durable
 * source of truth, we debounce-persist the doc's plain-text content back
 * into Postgres, bumping the same `version` counter the REST PUT endpoint
 * uses for optimistic locking — the CRDT session itself is the
 * conflict-resolution mechanism while it's open.
 */

import type { Server as HttpServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { verifyToken } from "@clerk/express";
import { eq, and } from "drizzle-orm";
import { db, cloudFilesTable } from "@workspace/db";
import { logger } from "../logger.js";
import { getMemberRole } from "./roles.js";

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const DEBOUNCE_MS = 2000;

interface DocEntry {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  /** Each connection's own awareness client IDs, so disconnect cleanup removes
   * exactly that connection's states rather than the shared doc's own ID. */
  conns: Map<WebSocket, Set<number>>;
  /** Version expected on the next persist — guards against overwriting a
   * REST save that landed while the CRDT session was open (see persistDoc). */
  expectedVersion: number | null;
}

const docs = new Map<string, DocEntry>();
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

function getOrCreateDoc(docName: string): DocEntry {
  let entry = docs.get(docName);
  if (entry) return entry;

  const doc = new Y.Doc();
  const awareness = new awarenessProtocol.Awareness(doc);
  entry = { doc, awareness, conns: new Map(), expectedVersion: null };
  docs.set(docName, entry);

  // One listener per doc (not per-connection) — otherwise each connected
  // client's own listener would rebroadcast every update to every peer,
  // multiplying network traffic by connection count.
  doc.on("update", (update: Uint8Array, origin: unknown) => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    const message = encoding.toUint8Array(encoder);
    for (const conn of entry!.conns.keys()) {
      if (conn !== origin) send(conn, message);
    }
    const meta = docMeta.get(docName);
    if (meta) scheduleFilePersist(docName, meta.workspaceId, meta.fileId);
  });

  awareness.on(
    "update",
    (
      { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown,
    ) => {
      const changed = [...added, ...updated, ...removed];
      if (changed.length === 0) return;

      // Track which awareness client IDs originated from this connection so
      // disconnect cleanup can remove exactly those (see the "close" handler).
      if (origin instanceof Object && entry!.conns.has(origin as WebSocket)) {
        const owned = entry!.conns.get(origin as WebSocket)!;
        for (const id of [...added, ...updated]) owned.add(id);
        for (const id of removed) owned.delete(id);
      }

      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, changed));
      const message = encoding.toUint8Array(encoder);
      for (const conn of entry!.conns.keys()) {
        if (conn !== origin) send(conn, message);
      }
    },
  );

  return entry;
}

/** workspaceId/fileId for each open doc, set once on first connection. */
const docMeta = new Map<string, { workspaceId: string; fileId: number }>();

function scheduleFilePersist(docName: string, workspaceId: string, fileId: number) {
  const existing = debounceTimers.get(docName);
  if (existing) clearTimeout(existing);
  debounceTimers.set(
    docName,
    setTimeout(() => {
      void persistDoc(docName, workspaceId, fileId);
    }, DEBOUNCE_MS),
  );
}

/**
 * Persists the doc's text back to Postgres, guarded by the version we last
 * observed — if a REST PUT saved a newer version while the CRDT session was
 * open, this persist is skipped rather than clobbering that write (the CRDT
 * peers still have the authoritative live content; the next edit will
 * re-schedule a persist against the now-current version).
 */
async function persistDoc(docName: string, workspaceId: string, fileId: number) {
  const entry = docs.get(docName);
  if (!entry) return;
  const text = entry.doc.getText("content").toString();
  try {
    const [current] = await db
      .select({ version: cloudFilesTable.version })
      .from(cloudFilesTable)
      .where(and(eq(cloudFilesTable.id, fileId), eq(cloudFilesTable.workspaceId, workspaceId)));
    if (!current) return;

    if (entry.expectedVersion !== null && current.version !== entry.expectedVersion) {
      logger.warn(
        { docName, expected: entry.expectedVersion, actual: current.version },
        "yjs_doc_persist_skipped_stale_version",
      );
      entry.expectedVersion = current.version;
      return;
    }

    const [updated] = await db
      .update(cloudFilesTable)
      .set({ content: text, version: current.version + 1 })
      .where(
        and(
          eq(cloudFilesTable.id, fileId),
          eq(cloudFilesTable.workspaceId, workspaceId),
          eq(cloudFilesTable.version, current.version),
        ),
      )
      .returning({ version: cloudFilesTable.version });

    entry.expectedVersion = updated?.version ?? current.version;
  } catch (err) {
    logger.warn({ err, docName }, "yjs_doc_persist_failed");
  }
}

function send(ws: WebSocket, message: Uint8Array) {
  if (ws.readyState !== ws.OPEN) return;
  try {
    ws.send(message);
  } catch (err) {
    logger.warn({ err }, "yjs_send_failed");
  }
}

/** Tracks the authorized user/workspace for every open Yjs connection, so the
 * periodic sweep below can re-check membership post-connect (auth at
 * upgrade time only would let a since-removed member keep editing). */
const connAuth = new Map<WebSocket, { userId: string; workspaceId: string; docName: string }>();

function bindConnection(
  ws: WebSocket,
  entry: DocEntry,
  docName: string,
  workspaceId: string,
  fileId: number,
  userId: string,
) {
  entry.conns.set(ws, new Set());
  docMeta.set(docName, { workspaceId, fileId });
  connAuth.set(ws, { userId, workspaceId, docName });

  // Initial sync step 1 (tell the client our state vector).
  {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder, entry.doc);
    send(ws, encoding.toUint8Array(encoder));
  }

  // Send current awareness state for existing peers.
  const states = entry.awareness.getStates();
  if (states.size > 0) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(entry.awareness, Array.from(states.keys())),
    );
    send(ws, encoding.toUint8Array(encoder));
  }

  ws.on("message", (raw: Buffer) => {
    try {
      const decoder = decoding.createDecoder(new Uint8Array(raw));
      const messageType = decoding.readVarUint(decoder);
      switch (messageType) {
        case MESSAGE_SYNC: {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MESSAGE_SYNC);
          syncProtocol.readSyncMessage(decoder, encoder, entry.doc, ws);
          if (encoding.length(encoder) > 1) send(ws, encoding.toUint8Array(encoder));
          break;
        }
        case MESSAGE_AWARENESS: {
          // Client-ID ownership tracking happens in the doc-level awareness
          // "update" listener above (keyed off `origin === ws`).
          awarenessProtocol.applyAwarenessUpdate(entry.awareness, decoding.readVarUint8Array(decoder), ws);
          break;
        }
        default:
          break;
      }
    } catch (err) {
      logger.warn({ err, docName }, "yjs_message_failed");
    }
  });

  ws.on("close", () => {
    const ownedClientIds = entry.conns.get(ws);
    entry.conns.delete(ws);
    connAuth.delete(ws);
    if (ownedClientIds && ownedClientIds.size > 0) {
      awarenessProtocol.removeAwarenessStates(entry.awareness, [...ownedClientIds], ws);
    }
    if (entry.conns.size === 0) {
      // Keep the doc warm briefly rather than dropping it instantly — a quick
      // reconnect (tab refresh) shouldn't lose in-flight, not-yet-persisted edits.
      setTimeout(() => {
        if (entry.conns.size === 0) {
          docs.delete(docName);
          docMeta.delete(docName);
        }
      }, 30_000);
    }
  });
}

export function setupYjsServer(httpServer: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "", "http://internal");
    if (!url.pathname.startsWith("/api/yjs")) return; // let other upgrade handlers (Socket.IO) see it

    void (async () => {
      try {
        // y-websocket's WebsocketProvider connects to `${serverUrl}/${roomName}`,
        // so the doc name (`file:<workspaceId>:<fileId>`) arrives as the path
        // segment after /api/yjs/, not as a query param.
        const roomName = decodeURIComponent(url.pathname.replace(/^\/api\/yjs\/?/, ""));
        const [, workspaceId, fileIdRaw] = roomName.split(":");
        const fileId = fileIdRaw;
        const token = url.searchParams.get("token");
        const secretKey = process.env.CLERK_SECRET_KEY;

        if (!token || !workspaceId || !fileId || !secretKey) {
          socket.destroy();
          return;
        }

        const claims = await verifyToken(token, { secretKey });
        const userId = claims.sub;
        if (!userId) {
          socket.destroy();
          return;
        }

        const role = await getMemberRole(workspaceId, userId);
        if (!role) {
          socket.destroy();
          return;
        }

        wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
          const docName = roomName;
          const entry = getOrCreateDoc(docName);

          // Seed a brand-new doc from the current file content so the first
          // connection doesn't start from an empty buffer.
          if (entry.conns.size === 0 && entry.doc.getText("content").length === 0) {
            void db
              .select({ content: cloudFilesTable.content })
              .from(cloudFilesTable)
              .where(and(eq(cloudFilesTable.id, Number(fileId)), eq(cloudFilesTable.workspaceId, workspaceId)))
              .then(([row]) => {
                if (row?.content) {
                  entry.doc.getText("content").insert(0, row.content);
                }
                bindConnection(ws, entry, docName, workspaceId, Number(fileId), userId);
              })
              .catch((err) => {
                logger.warn({ err }, "yjs_seed_failed");
                bindConnection(ws, entry, docName, workspaceId, Number(fileId), userId);
              });
          } else {
            bindConnection(ws, entry, docName, workspaceId, Number(fileId), userId);
          }
        });
      } catch (err) {
        logger.warn({ err }, "yjs_upgrade_failed");
        socket.destroy();
      }
    })();
  });

  // Auth is only checked at upgrade time; re-validate periodically so a
  // member removed mid-session gets disconnected rather than continuing to
  // read/write the CRDT doc indefinitely.
  const membershipSweepInterval = setInterval(() => {
    for (const [ws, auth] of connAuth) {
      void getMemberRole(auth.workspaceId, auth.userId).then((role) => {
        if (!role) {
          logger.info({ docName: auth.docName, userId: auth.userId }, "yjs_conn_revoked");
          ws.close(4001, "membership_revoked");
        }
      });
    }
  }, 15_000);
  httpServer.on("close", () => clearInterval(membershipSweepInterval));
}
