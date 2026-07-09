/**
 * Phase 11 — Real-Time Collaboration Layer
 *
 * Socket.IO server providing:
 *   - Presence (who's online / what they're focused on)
 *   - Live cursor / selection broadcasting
 *   - Shared chat (per-workspace room)
 *   - Terminal session mirroring (leader/follower broadcast)
 *   - Project Manager live updates (task mutations broadcast)
 *   - Shared Nova AI session messages
 *   - Comment / notification push (server -> client fan-out)
 *
 * Auth: the client connects with a Clerk session token in the handshake
 * (`auth.token`). We verify it with Clerk's backend SDK — the same trust
 * boundary as `requireAuth` on REST routes — so socket identity can't be
 * spoofed by passing an arbitrary userId.
 *
 * Rooms are namespaced `workspace:<workspaceId>`. Joining a room requires
 * an existing workspace membership (owner or member row) — enforced on
 * `join-workspace`, re-checked on every mutating event that matters
 * (comment creation, terminal broadcast) since membership can change while
 * a socket stays connected.
 */

import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer, type Socket } from "socket.io";
import { verifyToken } from "@clerk/express";
import { logger } from "../logger.js";
import { getMemberRole, roleAtLeast, type WorkspaceRole } from "./roles.js";

// ── Payload size constants ────────────────────────────────────────────────────
const MAX_CHAT_BODY = 2000;
const MAX_TERMINAL_DATA = 64 * 1024; // 64 KB
const MAX_DISPLAY_NAME = 100;
const MAX_FOCUS_KEY = 200;

interface SocketData {
  userId: string;
  displayName: string;
  /** workspaceId -> role, cached per-connection so we don't re-check DB on every cursor move */
  workspaces: Map<string, WorkspaceRole>;
}

export interface CollabIO {
  io: SocketIOServer;
  /** Push a server-originated event (e.g. new comment, notification) into a workspace room. */
  emitToWorkspace: (workspaceId: string, event: string, payload: unknown) => void;
}

function workspaceRoom(workspaceId: string): string {
  return `workspace:${workspaceId}`;
}

/** Sanitize and truncate a string field from an untrusted client payload. */
function strField(value: unknown, maxLen: number): string {
  if (typeof value !== "string") return "";
  return value.slice(0, maxLen);
}

/** Ensure a number is finite and within range. */
function numField(value: unknown, min = -1e6, max = 1e6): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(max, Math.max(min, value));
}

export function setupRealtimeCollab(httpServer: HttpServer): CollabIO {
  const io = new SocketIOServer(httpServer, {
    path: "/api/collab-socket",
    cors: {
      origin: true,
      credentials: true,
    },
    // Hard cap on incoming message size (Socket.IO default is unbounded).
    maxHttpBufferSize: 1e6, // 1 MB per message
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) {
        next(new Error("UNAUTHENTICATED"));
        return;
      }
      const secretKey = process.env.CLERK_SECRET_KEY;
      if (!secretKey) {
        next(new Error("SERVER_MISCONFIGURED"));
        return;
      }
      const claims = await verifyToken(token, { secretKey });
      const userId = claims.sub;
      if (!userId) {
        next(new Error("UNAUTHENTICATED"));
        return;
      }
      const displayName =
        strField(socket.handshake.auth?.displayName, MAX_DISPLAY_NAME) || userId;
      (socket.data as SocketData) = { userId, displayName, workspaces: new Map() };
      next();
    } catch (err) {
      logger.warn({ err }, "collab_socket_auth_failed");
      next(new Error("UNAUTHENTICATED"));
    }
  });

  /**
   * Re-validates membership against the DB rather than trusting the
   * join-time cache in `data.workspaces` — that cache can go stale if a
   * user is removed/demoted mid-session, and cursor/presence chatter is
   * frequent enough that re-checking on every event would be wasteful. Used
   * on the lower-frequency, higher-consequence events (chat, terminal,
   * project, AI relay) so a removed member can't keep broadcasting into a
   * workspace room until they happen to disconnect.
   */
  async function revalidateMembership(socket: Socket, workspaceId: string): Promise<boolean> {
    const data = socket.data as SocketData;
    if (!data.workspaces.has(workspaceId)) return false;
    const role = await getMemberRole(workspaceId, data.userId);
    if (!role) {
      data.workspaces.delete(workspaceId);
      // Evicting the cache alone isn't enough — the socket stays subscribed
      // to the room's `io.to(room)` fan-out until it explicitly leaves, so a
      // revoked member would keep receiving broadcasts otherwise.
      void socket.leave(workspaceRoom(workspaceId));
      socket.emit("presence:removed", { workspaceId });
      return false;
    }
    data.workspaces.set(workspaceId, role);
    return true;
  }

  // Belt-and-suspenders: periodically re-check every joined workspace for
  // every connected socket, in case a membership revocation happens between
  // mutating events (e.g. a user who is only ever sending cursor/presence
  // updates, which don't revalidate on their own).
  const membershipSweepInterval = setInterval(() => {
    for (const socket of io.sockets.sockets.values()) {
      const data = socket.data as SocketData | undefined;
      if (!data) continue;
      for (const workspaceId of [...data.workspaces.keys()]) {
        void revalidateMembership(socket, workspaceId);
      }
    }
  }, 15_000);
  httpServer.on("close", () => clearInterval(membershipSweepInterval));

  io.on("connection", (socket: Socket) => {
    const data = socket.data as SocketData;

    socket.on("join-workspace", async (payload: { workspaceId?: string }, ack?: (res: unknown) => void) => {
      const workspaceId = strField(payload?.workspaceId, 100);
      if (!workspaceId) return;
      const role = await getMemberRole(workspaceId, data.userId);
      if (!role) {
        ack?.({ ok: false, error: "Forbidden" });
        return;
      }
      data.workspaces.set(workspaceId, role);
      await socket.join(workspaceRoom(workspaceId));
      socket.to(workspaceRoom(workspaceId)).emit("presence:joined", {
        userId: data.userId,
        displayName: data.displayName,
        role,
      });
      ack?.({ ok: true, role });
    });

    socket.on("leave-workspace", (payload: { workspaceId?: string }) => {
      const workspaceId = strField(payload?.workspaceId, 100);
      if (!workspaceId) return;
      data.workspaces.delete(workspaceId);
      void socket.leave(workspaceRoom(workspaceId));
      socket.to(workspaceRoom(workspaceId)).emit("presence:left", { userId: data.userId });
    });

    // ── Presence / cursors ────────────────────────────────────────────────
    socket.on("presence:update", (payload: { workspaceId: string; focus?: string }) => {
      const workspaceId = strField(payload?.workspaceId, 100);
      if (!data.workspaces.has(workspaceId)) return;
      socket.to(workspaceRoom(workspaceId)).emit("presence:update", {
        userId: data.userId,
        displayName: data.displayName,
        focus: strField(payload?.focus, MAX_FOCUS_KEY),
      });
    });

    socket.on(
      "cursor:move",
      (payload: { workspaceId: string; resourceId: string; x: number; y: number; color?: string }) => {
        const workspaceId = strField(payload?.workspaceId, 100);
        if (!data.workspaces.has(workspaceId)) return;
        const x = numField(payload?.x);
        const y = numField(payload?.y);
        if (x === undefined || y === undefined) return;
        socket.to(workspaceRoom(workspaceId)).emit("cursor:move", {
          userId: data.userId,
          displayName: data.displayName,
          resourceId: strField(payload?.resourceId, 200),
          x,
          y,
          color: strField(payload?.color, 20),
        });
      },
    );

    // ── Shared chat ───────────────────────────────────────────────────────
    socket.on("chat:message", async (payload: { workspaceId: string; body: string }) => {
      const workspaceId = strField(payload?.workspaceId, 100);
      if (!(await revalidateMembership(socket, workspaceId))) return;
      const body = strField(payload?.body, MAX_CHAT_BODY);
      if (!body) return;
      io.to(workspaceRoom(workspaceId)).emit("chat:message", {
        userId: data.userId,
        displayName: data.displayName,
        body,
        at: new Date().toISOString(),
      });
    });

    // ── Terminal session mirroring ────────────────────────────────────────
    socket.on(
      "terminal:event",
      async (payload: { workspaceId: string; sessionId: string; kind: "input" | "output"; data: string }) => {
        const workspaceId = strField(payload?.workspaceId, 100);
        if (!(await revalidateMembership(socket, workspaceId))) return;
        const termData = strField(payload?.data, MAX_TERMINAL_DATA);
        const kind = payload?.kind === "input" || payload?.kind === "output" ? payload.kind : "output";

        // Only admins and above can mirror terminal input to prevent command injection.
        // Editors can stream output (read-only); input requires admin+ to prevent
        // unprivileged members from injecting commands into a shared session.
        const role = data.workspaces.get(workspaceId);
        if (kind === "input" && !roleAtLeast(role ?? null, "admin")) return;

        socket.to(workspaceRoom(workspaceId)).emit("terminal:event", {
          userId: data.userId,
          displayName: data.displayName,
          sessionId: strField(payload?.sessionId, 100),
          kind,
          data: termData,
        });
      },
    );

    // ── Project Manager live updates ──────────────────────────────────────
    socket.on(
      "project:update",
      async (payload: { workspaceId: string; projectId?: string | number; reason?: string }) => {
        const workspaceId = strField(payload?.workspaceId, 100);
        if (!(await revalidateMembership(socket, workspaceId))) return;
        socket.to(workspaceRoom(workspaceId)).emit("project:update", {
          userId: data.userId,
          displayName: data.displayName,
          projectId: payload?.projectId,
          reason: strField(payload?.reason, 200),
        });
      },
    );

    // ── Shared Nova AI session ────────────────────────────────────────────
    socket.on(
      "ai:message",
      async (payload: { workspaceId: string; sessionId: string; role: "user" | "assistant"; content: string }) => {
        const workspaceId = strField(payload?.workspaceId, 100);
        if (!(await revalidateMembership(socket, workspaceId))) return;
        const role = payload?.role === "user" || payload?.role === "assistant" ? payload.role : "user";
        io.to(workspaceRoom(workspaceId)).emit("ai:message", {
          userId: data.userId,
          displayName: data.displayName,
          sessionId: strField(payload?.sessionId, 100),
          role,
          content: strField(payload?.content, 8000),
          at: new Date().toISOString(),
        });
      },
    );

    socket.on("disconnect", () => {
      for (const workspaceId of data.workspaces.keys()) {
        socket.to(workspaceRoom(workspaceId)).emit("presence:left", { userId: data.userId });
      }
    });
  });

  return {
    io,
    emitToWorkspace: (workspaceId, event, payload) => {
      io.to(workspaceRoom(workspaceId)).emit(event, payload);
    },
  };
}

/** Re-export for route handlers that need to gate an action by minimum role. */
export { getMemberRole, roleAtLeast, type WorkspaceRole };
