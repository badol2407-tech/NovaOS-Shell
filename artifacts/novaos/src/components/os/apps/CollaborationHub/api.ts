// Phase 11 — CollaborationHub API helpers
// Uses native fetch (same pattern as PluginManager/api.ts) to call the
// Express backend without waiting for codegen to finish.

import type {
  Workspace,
  WorkspaceDetail,
  WorkspaceInvite,
  WorkspaceActivity,
  WorkspaceList,
} from './types';

const BASE = '/api';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    credentials: 'include',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const collaborationApi = {
  listWorkspaces: () => apiFetch<WorkspaceList>('/workspaces'),

  createWorkspace: (data: {
    name: string;
    description?: string;
    color?: string;
    displayName?: string;
  }) =>
    apiFetch<Workspace>('/workspaces', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getWorkspace: (id: string) => apiFetch<WorkspaceDetail>(`/workspaces/${id}`),

  updateWorkspace: (
    id: string,
    data: { name?: string; description?: string; color?: string },
  ) =>
    apiFetch<Workspace>(`/workspaces/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteWorkspace: (id: string) =>
    apiFetch<void>(`/workspaces/${id}`, { method: 'DELETE' }),

  listMembers: (workspaceId: string) =>
    apiFetch<WorkspaceDetail['members']>(`/workspaces/${workspaceId}/members`),

  removeMember: (workspaceId: string, memberId: number) =>
    apiFetch<void>(`/workspaces/${workspaceId}/members/${memberId}`, {
      method: 'DELETE',
    }),

  updateMemberRole: (workspaceId: string, memberId: number, role: 'admin' | 'editor' | 'viewer') =>
    apiFetch<void>(`/workspaces/${workspaceId}/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  listInvites: (workspaceId: string) =>
    apiFetch<WorkspaceInvite[]>(`/workspaces/${workspaceId}/invites`),

  sendInvite: (
    workspaceId: string,
    data: { email: string; role?: 'admin' | 'editor' | 'viewer'; inviterDisplayName?: string },
  ) =>
    apiFetch<WorkspaceInvite>(`/workspaces/${workspaceId}/invites`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  revokeInvite: (workspaceId: string, inviteId: number) =>
    apiFetch<void>(`/workspaces/${workspaceId}/invites/${inviteId}`, {
      method: 'DELETE',
    }),

  acceptInvite: (data: { token: string; displayName?: string }) =>
    apiFetch<{ workspace: Workspace; role: string }>('/workspaces/invites/accept', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getActivity: (workspaceId: string, limit = 50) =>
    apiFetch<WorkspaceActivity[]>(
      `/workspaces/${workspaceId}/activity?limit=${limit}`,
    ),
};
