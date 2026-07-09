// Phase 11 — CollaborationHub types

export interface Workspace {
  id: string;
  ownerUserId: string;
  name: string;
  description: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  id: number;
  workspaceId: string;
  userId: string;
  displayName: string;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: string;
}

export interface WorkspaceDetail extends Workspace {
  members: WorkspaceMember[];
}

export interface WorkspaceInvite {
  id: number;
  workspaceId: string;
  inviterUserId: string;
  inviteeEmail: string;
  token: string;
  role: 'editor' | 'viewer';
  status: 'pending' | 'accepted' | 'revoked';
  createdAt: string;
  expiresAt: string;
}

export interface WorkspaceActivity {
  id: number;
  workspaceId: string;
  actorUserId: string;
  actorDisplayName: string;
  action: string;
  contextJson: string | null;
  createdAt: string;
}

export interface WorkspaceList {
  owned: Workspace[];
  member: Workspace[];
}
