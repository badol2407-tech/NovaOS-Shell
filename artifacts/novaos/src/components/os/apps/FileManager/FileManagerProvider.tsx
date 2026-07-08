import React, {
  createContext,
  useCallback,
  useContext,
  useReducer,
  ReactNode,
  useRef,
} from 'react';
import {
  FileManagerState,
  VFSNode,
  NodeType,
  SortKey,
  SortDir,
  ViewMode,
  ContextMenuState,
} from './types';
import {
  buildInitialVFS,
  genId,
  getMimeCategory,
  inferMimeType,
  isDescendant,
  HOME_ID,
  ROOT_ID,
} from './vfs';

// ─── State & Actions ─────────────────────────────────────────────────────────

type Action =
  | { type: 'NAVIGATE'; folderId: string }
  | { type: 'NAV_BACK' }
  | { type: 'NAV_FORWARD' }
  | { type: 'SELECT'; ids: string[]; mode: 'replace' | 'toggle' | 'add' | 'range' }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_VIEW_MODE'; mode: ViewMode }
  | { type: 'SET_SORT'; by: SortKey; dir: SortDir }
  | { type: 'SET_SEARCH'; query: string }
  | { type: 'COPY'; ids: string[] }
  | { type: 'CUT'; ids: string[] }
  | { type: 'PASTE'; targetFolderId: string }
  | { type: 'CREATE_NODE'; nodeType: NodeType; name: string; parentId: string }
  | { type: 'RENAME'; id: string; name: string }
  | { type: 'DELETE'; ids: string[] }
  | { type: 'MOVE'; ids: string[]; targetFolderId: string }
  | { type: 'TOGGLE_FAVORITE'; id: string }
  | { type: 'OPEN_ITEM'; id: string }
  | { type: 'SET_RENAMING'; id: string | null }
  | { type: 'OPEN_NEW_ITEM_DIALOG'; nodeType: NodeType; parentId: string }
  | { type: 'CLOSE_NEW_ITEM_DIALOG' }
  | { type: 'SET_CONTEXT_MENU'; menu: ContextMenuState | null }
  | { type: 'SET_DRAG'; draggingIds: string[] }
  | { type: 'SET_DRAG_OVER'; folderId: string | null }
  | { type: 'END_DRAG' };

const initialState: FileManagerState = {
  nodes: buildInitialVFS(),
  currentFolderId: HOME_ID,
  history: [HOME_ID],
  historyIndex: 0,
  selectedIds: [],
  viewMode: 'grid',
  sortBy: 'name',
  sortDir: 'asc',
  searchQuery: '',
  clipboard: null,
  recentIds: [],
  renamingId: null,
  newItemDialog: null,
  contextMenu: null,
  drag: { draggingIds: [], overFolderId: null },
};

function removeFromParent(nodes: Record<string, VFSNode>, id: string): Record<string, VFSNode> {
  const node = nodes[id];
  if (!node?.parentId) return nodes;
  const parent = nodes[node.parentId];
  if (!parent) return nodes;
  return {
    ...nodes,
    [parent.id]: { ...parent, children: parent.children.filter(c => c !== id) },
  };
}

function addToFolder(
  nodes: Record<string, VFSNode>,
  nodeId: string,
  folderId: string
): Record<string, VFSNode> {
  const folder = nodes[folderId];
  if (!folder || folder.type !== 'folder') return nodes;
  if (folder.children.includes(nodeId)) return nodes;
  return {
    ...nodes,
    [folderId]: { ...folder, children: [...folder.children, nodeId] },
    [nodeId]: { ...nodes[nodeId], parentId: folderId },
  };
}

function deleteSubtree(nodes: Record<string, VFSNode>, id: string): Record<string, VFSNode> {
  const node = nodes[id];
  if (!node) return nodes;
  let updated = { ...nodes };
  if (node.type === 'folder') {
    for (const childId of node.children) {
      updated = deleteSubtree(updated, childId);
    }
  }
  updated = removeFromParent(updated, id);
  delete updated[id];
  return updated;
}

function deepCopySubtree(
  nodes: Record<string, VFSNode>,
  sourceId: string,
  newParentId: string
): { nodes: Record<string, VFSNode>; newRootId: string } {
  const source = nodes[sourceId];
  if (!source) return { nodes, newRootId: sourceId };
  const newId = genId();
  let newNodes = {
    ...nodes,
    [newId]: {
      ...source,
      id: newId,
      parentId: newParentId,
      name: source.name,
      children: [],
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    },
  };
  // Add to parent
  const parent = newNodes[newParentId];
  if (parent && parent.type === 'folder') {
    newNodes[newParentId] = { ...parent, children: [...parent.children, newId] };
  }
  if (source.type === 'folder') {
    const newChildIds: string[] = [];
    for (const childId of source.children) {
      const result = deepCopySubtree(newNodes, childId, newId);
      newNodes = result.nodes;
      newChildIds.push(result.newRootId);
    }
    newNodes[newId] = { ...newNodes[newId], children: newChildIds };
  }
  return { nodes: newNodes, newRootId: newId };
}

function getUniqueName(nodes: Record<string, VFSNode>, parentId: string, name: string): string {
  const siblings = (nodes[parentId]?.children ?? []).map(id => nodes[id]?.name ?? '');
  if (!siblings.includes(name)) return name;
  const ext = name.includes('.') && !name.startsWith('.') ? '.' + name.split('.').pop()! : '';
  const base = ext ? name.slice(0, -ext.length) : name;
  let i = 2;
  while (siblings.includes(`${base} ${i}${ext}`)) i++;
  return `${base} ${i}${ext}`;
}

function addToRecent(recentIds: string[], id: string): string[] {
  const filtered = recentIds.filter(r => r !== id);
  return [id, ...filtered].slice(0, 20);
}

function reducer(state: FileManagerState, action: Action): FileManagerState {
  switch (action.type) {
    case 'NAVIGATE': {
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      if (newHistory[newHistory.length - 1] === action.folderId) {
        return { ...state, currentFolderId: action.folderId, selectedIds: [], searchQuery: '' };
      }
      return {
        ...state,
        currentFolderId: action.folderId,
        history: [...newHistory, action.folderId],
        historyIndex: newHistory.length,
        selectedIds: [],
        searchQuery: '',
      };
    }
    case 'NAV_BACK': {
      if (state.historyIndex <= 0) return state;
      const newIndex = state.historyIndex - 1;
      return {
        ...state,
        historyIndex: newIndex,
        currentFolderId: state.history[newIndex],
        selectedIds: [],
        searchQuery: '',
      };
    }
    case 'NAV_FORWARD': {
      if (state.historyIndex >= state.history.length - 1) return state;
      const newIndex = state.historyIndex + 1;
      return {
        ...state,
        historyIndex: newIndex,
        currentFolderId: state.history[newIndex],
        selectedIds: [],
        searchQuery: '',
      };
    }
    case 'SELECT': {
      if (action.mode === 'replace') return { ...state, selectedIds: action.ids };
      if (action.mode === 'add') {
        const set = new Set([...state.selectedIds, ...action.ids]);
        return { ...state, selectedIds: Array.from(set) };
      }
      if (action.mode === 'toggle') {
        const id = action.ids[0];
        if (!id) return state;
        const existing = state.selectedIds.includes(id);
        return {
          ...state,
          selectedIds: existing
            ? state.selectedIds.filter(s => s !== id)
            : [...state.selectedIds, id],
        };
      }
      return state;
    }
    case 'CLEAR_SELECTION':
      return { ...state, selectedIds: [] };
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.mode };
    case 'SET_SORT':
      return { ...state, sortBy: action.by, sortDir: action.dir };
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.query, selectedIds: [] };
    case 'COPY':
      return {
        ...state,
        clipboard: { ids: action.ids, operation: 'copy', originFolderId: state.currentFolderId },
      };
    case 'CUT':
      return {
        ...state,
        clipboard: { ids: action.ids, operation: 'cut', originFolderId: state.currentFolderId },
      };
    case 'PASTE': {
      if (!state.clipboard) return state;
      const { ids, operation } = state.clipboard;
      let nodes = state.nodes;
      const targetId = action.targetFolderId;
      if (operation === 'move' as never || operation === 'cut') {
        // Move: re-parent
        for (const id of ids) {
          if (id === targetId || isDescendant(nodes, id, targetId)) continue;
          nodes = removeFromParent(nodes, id);
          const node = nodes[id];
          if (!node) continue;
          const uniqueName = getUniqueName(nodes, targetId, node.name);
          nodes = {
            ...nodes,
            [id]: { ...node, name: uniqueName, parentId: targetId, modifiedAt: Date.now() },
          };
          nodes = addToFolder(nodes, id, targetId);
        }
        return { ...state, nodes, clipboard: null };
      } else {
        // Copy: deep copy
        for (const id of ids) {
          if (id === targetId || isDescendant(nodes, id, targetId)) continue;
          const result = deepCopySubtree(nodes, id, targetId);
          nodes = result.nodes;
          // rename if collision
          const newId = result.newRootId;
          const newNode = nodes[newId];
          if (newNode) {
            const uniqueName = getUniqueName(
              { ...nodes, [newId]: { ...newNode, name: '' } },
              targetId,
              newNode.name
            );
            if (uniqueName !== newNode.name) {
              nodes = { ...nodes, [newId]: { ...newNode, name: uniqueName } };
            }
          }
        }
        return { ...state, nodes };
      }
    }
    case 'CREATE_NODE': {
      const newId = genId();
      const uniqueName = getUniqueName(state.nodes, action.parentId, action.name);
      const mimeType = action.nodeType === 'file' ? inferMimeType(action.name) : 'inode/directory';
      const newNode: VFSNode = {
        id: newId,
        name: uniqueName,
        type: action.nodeType,
        parentId: action.parentId,
        children: [],
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        size: 0,
        mimeType,
        mimeCategory: getMimeCategory(mimeType),
        isFavorite: false,
      };
      const parent = state.nodes[action.parentId];
      const updatedParent = parent
        ? { ...parent, children: [...parent.children, newId] }
        : parent;
      return {
        ...state,
        nodes: {
          ...state.nodes,
          [newId]: newNode,
          ...(updatedParent ? { [action.parentId]: updatedParent } : {}),
        },
        renamingId: newId,
        newItemDialog: null,
      };
    }
    case 'RENAME': {
      const node = state.nodes[action.id];
      if (!node) return state;
      const uniqueName = node.parentId
        ? getUniqueName(
            { ...state.nodes, [action.id]: { ...node, name: '' } },
            node.parentId,
            action.name
          )
        : action.name;
      return {
        ...state,
        nodes: { ...state.nodes, [action.id]: { ...node, name: uniqueName, modifiedAt: Date.now() } },
        renamingId: null,
      };
    }
    case 'DELETE': {
      // Prevent deletion of structural roots (root, home)
      const PROTECTED_IDS = new Set([ROOT_ID, HOME_ID]);
      const safeIds = action.ids.filter(id => !PROTECTED_IDS.has(id));
      if (safeIds.length === 0) return state;

      let nodes = state.nodes;
      for (const id of safeIds) {
        nodes = deleteSubtree(nodes, id);
      }

      // If currentFolder was deleted (or is a descendant of a deleted node),
      // navigate to nearest surviving ancestor
      let currentFolderId = state.currentFolderId;
      if (!nodes[currentFolderId]) {
        // Walk up original node's ancestry to find a surviving folder
        let ancestor = state.nodes[currentFolderId];
        currentFolderId = HOME_ID; // fallback
        while (ancestor?.parentId) {
          if (nodes[ancestor.parentId]) {
            currentFolderId = ancestor.parentId;
            break;
          }
          ancestor = state.nodes[ancestor.parentId];
        }
      }

      const history = state.history.map(id => (nodes[id] ? id : currentFolderId));

      return {
        ...state,
        nodes,
        currentFolderId,
        history,
        selectedIds: state.selectedIds.filter(id => !safeIds.includes(id)),
        recentIds: state.recentIds.filter(id => !safeIds.includes(id)),
      };
    }
    case 'MOVE': {
      let nodes = state.nodes;
      for (const id of action.ids) {
        if (id === action.targetFolderId || isDescendant(nodes, id, action.targetFolderId)) continue;
        nodes = removeFromParent(nodes, id);
        const node = nodes[id];
        if (!node) continue;
        const uniqueName = getUniqueName(nodes, action.targetFolderId, node.name);
        nodes = {
          ...nodes,
          [id]: { ...node, name: uniqueName, parentId: action.targetFolderId, modifiedAt: Date.now() },
        };
        nodes = addToFolder(nodes, id, action.targetFolderId);
      }
      return { ...state, nodes };
    }
    case 'TOGGLE_FAVORITE': {
      const node = state.nodes[action.id];
      if (!node) return state;
      return {
        ...state,
        nodes: { ...state.nodes, [action.id]: { ...node, isFavorite: !node.isFavorite } },
      };
    }
    case 'OPEN_ITEM': {
      const node = state.nodes[action.id];
      if (!node) return state;
      if (node.type === 'folder') {
        const newHistory = state.history.slice(0, state.historyIndex + 1);
        return {
          ...state,
          currentFolderId: node.id,
          history: [...newHistory, node.id],
          historyIndex: newHistory.length,
          selectedIds: [],
          searchQuery: '',
        };
      }
      return {
        ...state,
        recentIds: addToRecent(state.recentIds, action.id),
        selectedIds: [action.id],
      };
    }
    case 'SET_RENAMING':
      return { ...state, renamingId: action.id };
    case 'OPEN_NEW_ITEM_DIALOG':
      return {
        ...state,
        newItemDialog: { open: true, type: action.nodeType, parentId: action.parentId },
      };
    case 'CLOSE_NEW_ITEM_DIALOG':
      return { ...state, newItemDialog: null };
    case 'SET_CONTEXT_MENU':
      return { ...state, contextMenu: action.menu };
    case 'SET_DRAG':
      return { ...state, drag: { ...state.drag, draggingIds: action.draggingIds } };
    case 'SET_DRAG_OVER':
      return { ...state, drag: { ...state.drag, overFolderId: action.folderId } };
    case 'END_DRAG':
      return { ...state, drag: { draggingIds: [], overFolderId: null } };
    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface FileManagerContextType {
  state: FileManagerState;
  dispatch: React.Dispatch<Action>;
  // Convenient wrappers
  navigate: (folderId: string) => void;
  navBack: () => void;
  navForward: () => void;
  openItem: (id: string) => void;
  select: (ids: string[], mode?: 'replace' | 'toggle' | 'add') => void;
  clearSelection: () => void;
  copyItems: (ids: string[]) => void;
  cutItems: (ids: string[]) => void;
  pasteItems: (targetFolderId?: string) => void;
  deleteItems: (ids: string[]) => void;
  renameItem: (id: string, name: string) => void;
  moveItems: (ids: string[], targetFolderId: string) => void;
  createItem: (type: NodeType, name: string, parentId?: string) => void;
  toggleFavorite: (id: string) => void;
  setSearch: (query: string) => void;
  setViewMode: (mode: ViewMode) => void;
  setSort: (by: SortKey, dir: SortDir) => void;
  startRename: (id: string) => void;
  openNewItemDialog: (type: NodeType, parentId?: string) => void;
  setContextMenu: (menu: ContextMenuState | null) => void;
  startDrag: (ids: string[]) => void;
  setDragOver: (folderId: string | null) => void;
  endDrag: () => void;
}

const FileManagerContext = createContext<FileManagerContextType | undefined>(undefined);

export function FileManagerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const navigate = useCallback((folderId: string) => dispatch({ type: 'NAVIGATE', folderId }), []);
  const navBack = useCallback(() => dispatch({ type: 'NAV_BACK' }), []);
  const navForward = useCallback(() => dispatch({ type: 'NAV_FORWARD' }), []);
  const openItem = useCallback((id: string) => dispatch({ type: 'OPEN_ITEM', id }), []);
  const select = useCallback(
    (ids: string[], mode: 'replace' | 'toggle' | 'add' = 'replace') =>
      dispatch({ type: 'SELECT', ids, mode }),
    []
  );
  const clearSelection = useCallback(() => dispatch({ type: 'CLEAR_SELECTION' }), []);
  const copyItems = useCallback((ids: string[]) => dispatch({ type: 'COPY', ids }), []);
  const cutItems = useCallback((ids: string[]) => dispatch({ type: 'CUT', ids }), []);
  const pasteItems = useCallback(
    (targetFolderId?: string) =>
      dispatch({
        type: 'PASTE',
        targetFolderId: targetFolderId ?? state.currentFolderId,
      }),
    [state.currentFolderId]
  );
  const deleteItems = useCallback((ids: string[]) => dispatch({ type: 'DELETE', ids }), []);
  const renameItem = useCallback(
    (id: string, name: string) => dispatch({ type: 'RENAME', id, name }),
    []
  );
  const moveItems = useCallback(
    (ids: string[], targetFolderId: string) =>
      dispatch({ type: 'MOVE', ids, targetFolderId }),
    []
  );
  const createItem = useCallback(
    (type: NodeType, name: string, parentId?: string) =>
      dispatch({
        type: 'CREATE_NODE',
        nodeType: type,
        name,
        parentId: parentId ?? state.currentFolderId,
      }),
    [state.currentFolderId]
  );
  const toggleFavorite = useCallback(
    (id: string) => dispatch({ type: 'TOGGLE_FAVORITE', id }),
    []
  );
  const setSearch = useCallback(
    (query: string) => dispatch({ type: 'SET_SEARCH', query }),
    []
  );
  const setViewMode = useCallback(
    (mode: ViewMode) => dispatch({ type: 'SET_VIEW_MODE', mode }),
    []
  );
  const setSort = useCallback(
    (by: SortKey, dir: SortDir) => dispatch({ type: 'SET_SORT', by, dir }),
    []
  );
  const startRename = useCallback(
    (id: string) => dispatch({ type: 'SET_RENAMING', id }),
    []
  );
  const openNewItemDialog = useCallback(
    (type: NodeType, parentId?: string) =>
      dispatch({
        type: 'OPEN_NEW_ITEM_DIALOG',
        nodeType: type,
        parentId: parentId ?? state.currentFolderId,
      }),
    [state.currentFolderId]
  );
  const setContextMenu = useCallback(
    (menu: ContextMenuState | null) => dispatch({ type: 'SET_CONTEXT_MENU', menu }),
    []
  );
  const startDrag = useCallback(
    (ids: string[]) => dispatch({ type: 'SET_DRAG', draggingIds: ids }),
    []
  );
  const setDragOver = useCallback(
    (folderId: string | null) => dispatch({ type: 'SET_DRAG_OVER', folderId }),
    []
  );
  const endDrag = useCallback(() => dispatch({ type: 'END_DRAG' }), []);

  return (
    <FileManagerContext.Provider
      value={{
        state,
        dispatch,
        navigate,
        navBack,
        navForward,
        openItem,
        select,
        clearSelection,
        copyItems,
        cutItems,
        pasteItems,
        deleteItems,
        renameItem,
        moveItems,
        createItem,
        toggleFavorite,
        setSearch,
        setViewMode,
        setSort,
        startRename,
        openNewItemDialog,
        setContextMenu,
        startDrag,
        setDragOver,
        endDrag,
      }}
    >
      {children}
    </FileManagerContext.Provider>
  );
}

export function useFileManager() {
  const ctx = useContext(FileManagerContext);
  if (!ctx) throw new Error('useFileManager must be used within FileManagerProvider');
  return ctx;
}
