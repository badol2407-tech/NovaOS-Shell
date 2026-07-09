// Phase 11 — CloudEditor API helpers

import type { CloudFile, CloudFileListItem } from './types';

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

export const cloudEditorApi = {
  listFiles: (workspaceId: string) =>
    apiFetch<CloudFileListItem[]>(`/workspaces/${workspaceId}/files`),

  createFile: (
    workspaceId: string,
    data: { path: string; content?: string; displayName?: string },
  ) =>
    apiFetch<CloudFile>(`/workspaces/${workspaceId}/files`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getFile: (workspaceId: string, fileId: number) =>
    apiFetch<CloudFile>(`/workspaces/${workspaceId}/files/${fileId}`),

  saveFile: (
    workspaceId: string,
    fileId: number,
    data: { content: string; version: number; displayName?: string },
  ) =>
    apiFetch<CloudFile>(`/workspaces/${workspaceId}/files/${fileId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteFile: (workspaceId: string, fileId: number) =>
    apiFetch<void>(`/workspaces/${workspaceId}/files/${fileId}`, {
      method: 'DELETE',
    }),
};
