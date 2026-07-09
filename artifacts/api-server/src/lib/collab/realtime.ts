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

export function setupRealtimeCollab(httpServer: HttpServer): CollabIO {
  const io = new SocketIOServer(httpServer, {
    path: "/api/collab-socket",
    cors: {
      origin: true,
      credentials: true,
    },
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
        (socket.handshake.auth?.displayName as string | undefined)?.slice(0, 100) || userId;
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
      const workspaceId = payload?.workspaceId;
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
      const workspaceId = payload?.workspaceId;
      if (!workspaceId) return;
      data.workspaces.delete(workspaceId);
      void socket.leave(workspaceRoom(workspaceId));
      socket.to(workspaceRoom(workspaceId)).emit("presence:left", { userId: data.userId });
    });

    // ── Presence / cursors ────────────────────────────────────────────────
    socket.on("presence:update", (payload: { workspaceId: string; focus?: string }) => {
      if (!data.workspaces.has(payload.workspaceId)) return;
      socket.to(workspaceRoom(payload.workspaceId)).emit("presence:update", {
        userId: data.userId,
        displayName: data.displayName,
        focus: payload.focus,
      });
    });

    socket.on(
      "cursor:move",
      (payload: { workspaceId: string; resourceId: string; x: number; y: number; color?: string }) => {
        if (!data.workspaces.has(payload.workspaceId)) return;
        socket.to(workspaceRoom(payload.workspaceId)).emit("cursor:move", {
          userId: data.userId,
          displayName: data.displayName,
          resourceId: payload.resourceId,
          x: payload.x,
          y: payload.y,
          color: payload.color,
        });
      },
    );

    // ── Shared chat ───────────────────────────────────────────────────────
    socket.on("chat:message", async (payload: { workspaceId: string; body: string }) => {
      if (!(await revalidateMembership(socket, payload.workspaceId))) return;
      const body = payload.body?.slice(0, 2000);
      if (!body) return;
      io.to(workspaceRoom(payload.workspaceId)).emit("chat:message", {
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
        if (!(await revalidateMembership(socket, payload.workspaceId))) return;
        socket.to(workspaceRoom(payload.workspaceId)).emit("terminal:event", {
          userId: data.userId,
          displayName: data.displayName,
          sessionId: payload.sessionId,
          kind: payload.kind,
          data: payload.data,
        });
      },
    );

    // ── Project Manager live updates ──────────────────────────────────────
    socket.on(
      "project:update",
      async (payload: { workspaceId: string; projectId?: string | number; reason?: string }) => {
        if (!(await revalidateMembership(socket, payload.workspaceId))) return;
        socket.to(workspaceRoom(payload.workspaceId)).emit("project:update", {
          userId: data.userId,
          displayName: data.displayName,
          projectId: payload.projectId,
          reason: payload.reason,
        });
      },
    );

    // ── Shared Nova AI session ────────────────────────────────────────────
    socket.on(
      "ai:message",
      async (payload: { workspaceId: string; sessionId: string; role: "user" | "assistant"; content: string }) => {
        if (!(await revalidateMembership(socket, payload.workspaceId))) return;
        io.to(workspaceRoom(payload.workspaceId)).emit("ai:message", {
          userId: data.userId,
          displayName: data.displayName,
          sessionId: payload.sessionId,
          role: payload.role,
          content: payload.content,
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
