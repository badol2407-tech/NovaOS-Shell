/**
 * Phase 11 — Real-time collaboration client
 *
 * Thin singleton wrapper around socket.io-client, authenticated with the
 * current Clerk session token. Lives alongside (does not replace) the
 * Firestore-based `usePresence` hook — this is the transport for live
 * cursors, shared chat, terminal/project/AI event relay, and comment push,
 * none of which Firestore presence covers.
 */

import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

/** Resolves the same-origin collab socket path, honoring the artifact base path in dev/preview. */
function socketPath(): string {
  const base = import.meta.env.BASE_URL || '/';
  const prefix = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${prefix}/api/collab-socket`;
}

export function getCollabSocket(getToken: () => Promise<string | null>, displayName: string): Socket {
  if (socket) return socket;

  socket = io({
    path: socketPath(),
    transports: ['websocket'],
    autoConnect: false,
    auth: async (cb) => {
      const token = await getToken();
      cb({ token, displayName });
    },
  });

  socket.connect();
  return socket;
}

export function disconnectCollabSocket(): void {
  socket?.disconnect();
  socket = null;
}

/**
 * Base URL + room name for the y-websocket CRDT connection to a given cloud
 * file. `WebsocketProvider` connects to `${base}/${roomName}?token=...`, so
 * the doc name doubles as the path segment the server uses to key the doc.
 */
export async function yjsConnectionInfo(
  getToken: () => Promise<string | null>,
  workspaceId: string,
  fileId: number | string,
): Promise<{ base: string; roomName: string; token: string }> {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const base = import.meta.env.BASE_URL || '/';
  const prefix = base.endsWith('/') ? base.slice(0, -1) : base;
  const token = (await getToken()) ?? '';
  return {
    base: `${protocol}://${window.location.host}${prefix}/api/yjs`,
    roomName: `file:${workspaceId}:${fileId}`,
    token,
  };
}
