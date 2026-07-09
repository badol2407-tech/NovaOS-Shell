/**
 * VFS View-Preferences Storage
 *
 * Persists per-user view preferences (layout, sort, panel state, last folder).
 * VFS data (nodes, recentIds) is now managed by vfsStore.ts — a module-level
 * singleton that is shared across all File Manager windows.
 *
 * This storage is last-write-wins across windows: the most recently closed
 * window's view preferences are saved. That is fine — view settings are not
 * destructive, and each window restores the persisted starting folder when
 * opened.
 */

import { ViewMode, SortKey, SortDir } from '../types';
import { HOME_ID } from '../vfs';

// ─── Schema ───────────────────────────────────────────────────────────────────

const VIEW_KEY = 'nova_fm_view_v1';
const VIEW_VERSION = 1;

export interface PersistedViewPrefs {
  version: number;
  currentFolderId: string;
  viewMode: ViewMode;
  sortBy: SortKey;
  sortDir: SortDir;
  previewOpen: boolean;
}

// ─── Load / Save ──────────────────────────────────────────────────────────────

export function loadViewPrefs(): Omit<PersistedViewPrefs, 'version'> {
  try {
    const raw = localStorage.getItem(VIEW_KEY);
    if (!raw) return defaultViewPrefs();
    const parsed = JSON.parse(raw) as Partial<PersistedViewPrefs>;
    if (parsed.version !== VIEW_VERSION) {
      localStorage.removeItem(VIEW_KEY);
      return defaultViewPrefs();
    }
    return {
      currentFolderId: parsed.currentFolderId ?? HOME_ID,
      viewMode: parsed.viewMode ?? 'grid',
      sortBy: parsed.sortBy ?? 'name',
      sortDir: parsed.sortDir ?? 'asc',
      previewOpen: parsed.previewOpen ?? false,
    };
  } catch {
    return defaultViewPrefs();
  }
}

function defaultViewPrefs(): Omit<PersistedViewPrefs, 'version'> {
  return {
    currentFolderId: HOME_ID,
    viewMode: 'grid',
    sortBy: 'name',
    sortDir: 'asc',
    previewOpen: false,
  };
}

let _viewSaveTimer: ReturnType<typeof setTimeout> | null = null;

export function saveViewPrefs(prefs: Omit<PersistedViewPrefs, 'version'>): void {
  if (_viewSaveTimer) clearTimeout(_viewSaveTimer);
  _viewSaveTimer = setTimeout(() => {
    try {
      const payload: PersistedViewPrefs = { version: VIEW_VERSION, ...prefs };
      localStorage.setItem(VIEW_KEY, JSON.stringify(payload));
    } catch {
      // ignore quota errors
    }
  }, 300);
}

/** Synchronous flush — call on unmount to avoid losing the last 300 ms. */
export function flushViewPrefs(prefs: Omit<PersistedViewPrefs, 'version'>): void {
  if (_viewSaveTimer) { clearTimeout(_viewSaveTimer); _viewSaveTimer = null; }
  try {
    localStorage.setItem(VIEW_KEY, JSON.stringify({ version: VIEW_VERSION, ...prefs }));
  } catch {
    // ignore
  }
}
