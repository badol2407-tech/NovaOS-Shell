/**
 * Phase 11 — Workspace Role Hierarchy
 *
 * owner > admin > editor > viewer. Used by both REST route guards and the
 * realtime socket layer so permission semantics stay identical across
 * transports.
 */

import { eq, and } from "drizzle-orm";
import { db, workspacesTable, workspaceMembersTable } from "@workspace/db";

export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer";

const RANK: Record<WorkspaceRole, number> = {
  owner: 3,
  admin: 2,
  editor: 1,
  viewer: 0,
};

export function roleAtLeast(role: WorkspaceRole | null, min: WorkspaceRole): boolean {
  if (!role) return false;
  return RANK[role] >= RANK[min];
}

/** Resolves the caller's effective role in a workspace, or null if not a member/owner. */
export async function getMemberRole(
  workspaceId: string,
  userId: string,
): Promise<WorkspaceRole | null> {
  const [workspace] = await db
    .select({ ownerUserId: workspacesTable.ownerUserId })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId));

  if (!workspace) return null;
  if (workspace.ownerUserId === userId) return "owner";

  const [member] = await db
    .select({ role: workspaceMembersTable.role })
    .from(workspaceMembersTable)
    .where(
      and(
        eq(workspaceMembersTable.workspaceId, workspaceId),
        eq(workspaceMembersTable.userId, userId),
      ),
    );

  return (member?.role as WorkspaceRole | undefined) ?? null;
}
