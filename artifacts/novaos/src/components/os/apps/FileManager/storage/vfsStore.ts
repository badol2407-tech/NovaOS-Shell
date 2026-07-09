/**
 * VFSStore — module-level singleton for shared VFS state.
 *
 * All FileManagerProvider instances read from and write to this store.
 * This solves two problems:
 *   1. Multiple FM windows stay in sync (create a file in window 1 → visible in window 2).
 *   2. No cross-window persistence contention — a single source of truth persists.
 *
 * The store lives outside React's reconciliation cycle, so it is never
 * affected by component mounts, unmounts, or stale closures.
 */

import { VFSNode } from '../types';
import { buildInitialVFS } from '../vfs';

// ─── Storage keys ─────────────────────────────────────────────────────────────

const VFS_KEY = 'nova_fm_vfs_v1';
const VFS_VERSION = 1;

interface PersistedVFS {
  version: number;
  nodes: Record<string, VFSNode>;
  recentIds: string[];
}

// ─── Store state ──────────────────────────────────────────────────────────────

export interface VFSSnapshot {
  nodes: Record<string, VFSNode>;
  recentIds: string[];
}

type Listener = (snap: VFSSnapshot) => void;

// ─── Persistence helpers ──────────────────────────────────────────────────────

function loadFromStorage(): VFSSnapshot {
  try {
    const raw = localStorage.getItem(VFS_KEY);
    if (!raw) return { nodes: buildInitialVFS(), recentIds: [] };
    const parsed = JSON.parse(raw) as Partial<PersistedVFS>;
    if (parsed.version !== VFS_VERSION) {
      localStorage.removeItem(VFS_KEY);
      return { nodes: buildInitialVFS(), recentIds: [] };
    }
    return {
      nodes: parsed.nodes ?? buildInitialVFS(),
      recentIds: parsed.recentIds ?? [],
    };
  } catch {
    return { nodes: buildInitialVFS(), recentIds: [] };
  }
}

let _saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush(snap: VFSSnapshot): void {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try {
      const payload: PersistedVFS = {
        version: VFS_VERSION,
        nodes: snap.nodes,
        recentIds: snap.recentIds,
      };
      localStorage.setItem(VFS_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn('[VFSStore] Failed to persist VFS:', err);
    }
  }, 300);
}

/** Flush synchronously. Called on page unload / window close. */
export function flushVFS(): void {
  if (_saveTimer) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
  }
  try {
    const payload: PersistedVFS = {
      version: VFS_VERSION,
      nodes: _state.nodes,
      recentIds: _state.recentIds,
    };
    localStorage.setItem(VFS_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

// ─── Singleton store ──────────────────────────────────────────────────────────

let _state: VFSSnapshot = loadFromStorage();
const _listeners = new Set<Listener>();

/** Read the current VFS snapshot. */
export function getVFSSnapshot(): VFSSnapshot {
  return _state;
}

/**
 * Atomically update VFS state and notify all subscribers.
 * The updater receives the current snapshot and returns the next snapshot.
 */
export function mutateVFS(updater: (prev: VFSSnapshot) => VFSSnapshot): void {
  const next = updater(_state);
  if (next === _state) return; // nothing changed
  _state = next;
  scheduleFlush(_state);
  for (const listener of _listeners) {
    listener(_state);
  }
}

/** Subscribe to VFS changes. Returns an unsubscribe function. */
export function subscribeVFS(listener: Listener): () => void {
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
}

// ─── Flush on page unload ─────────────────────────────────────────────────────
// Guards against the 300 ms debounce window when the user closes the tab.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushVFS);
}
