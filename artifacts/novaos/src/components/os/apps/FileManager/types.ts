export type NodeType = 'file' | 'folder';

export type MimeCategory = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'code' | 'other';

export interface VFSNode {
  id: string;
  name: string;
  type: NodeType;
  parentId: string | null;
  children: string[]; // folder-only: ordered child ids
  createdAt: number; // timestamp
  modifiedAt: number;
  size: number; // bytes (files only; folders show recursive size)
  mimeType: string;
  mimeCategory: MimeCategory;
  isFavorite: boolean;
  color?: string; // optional folder tint
  tags?: string[];
}

export type SortKey = 'name' | 'date' | 'size' | 'type';
export type SortDir = 'asc' | 'desc';
export type ViewMode = 'grid' | 'list';

export interface Clipboard {
  ids: string[];
  operation: 'copy' | 'cut';
  originFolderId: string;
}

export interface ContextMenuState {
  x: number;
  y: number;
  targetId: string | null; // null = background
}

export interface DragState {
  draggingIds: string[];
  overFolderId: string | null;
}

export interface FileManagerState {
  nodes: Record<string, VFSNode>;

  // navigation
  currentFolderId: string;
  history: string[];
  historyIndex: number;

  // selection
  selectedIds: string[];

  // view
  viewMode: ViewMode;
  sortBy: SortKey;
  sortDir: SortDir;

  // search
  searchQuery: string;

  // clipboard
  clipboard: Clipboard | null;

  // recent (file ids, max 20)
  recentIds: string[];

  // ui transient
  renamingId: string | null;
  newItemDialog: { open: boolean; type: NodeType; parentId: string } | null;
  contextMenu: ContextMenuState | null;
  drag: DragState;
}
