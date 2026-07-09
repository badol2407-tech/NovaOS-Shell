// Phase 11 — CloudEditor types

export interface CloudFile {
  id: number;
  workspaceId: string;
  path: string;
  language: string;
  content?: string;
  createdByUserId: string;
  lastEditedByUserId: string;
  version: number;
  deleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CloudFileListItem extends Omit<CloudFile, 'content'> {}
