/**
 * Phase 11 — Cloud Code Editor
 *
 * A full-featured code editor backed by workspace cloud files.
 * Layout: file-tree sidebar (left) + CodeMirror editor (right).
 *
 * Features:
 *  - List / create / delete workspace files
 *  - CodeMirror 6 editor with language auto-detection
 *  - Auto-save with optimistic versioning (conflict detection)
 *  - Online presence: shows who else is viewing the same file
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FolderOpen, Plus, Trash2, Save, Loader2, FileCode,
  ChevronRight, AlertCircle, Users, RefreshCw, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useUser } from '@clerk/react';
import { toast } from 'sonner';
import CodeMirror from '@uiw/react-codemirror';
import { oneDark } from '@codemirror/theme-one-dark';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { json } from '@codemirror/lang-json';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { markdown } from '@codemirror/lang-markdown';
import { sql } from '@codemirror/lang-sql';
import type { Extension } from '@codemirror/state';

import { collaborationApi } from '../CollaborationHub/api';
import { cloudEditorApi } from './api';
import { usePresence } from '@/hooks/usePresence';
import type { Workspace } from '../CollaborationHub/types';
import type { CloudFile, CloudFileListItem } from './types';

// ── Language → CodeMirror extension ─────────────────────────────────────────

function getLangExtension(language: string): Extension[] {
  switch (language) {
    case 'typescript': return [javascript({ typescript: true })];
    case 'javascript': return [javascript()];
    case 'python':     return [python()];
    case 'rust':       return [rust()];
    case 'json':       return [json()];
    case 'css':
    case 'scss':       return [css()];
    case 'html':       return [html()];
    case 'markdown':   return [markdown()];
    case 'sql':        return [sql()];
    default:           return [];
  }
}

// ── File tree ────────────────────────────────────────────────────────────────

function getFileIcon(language: string): string {
  const icons: Record<string, string> = {
    typescript: '🟦', javascript: '🟨', python: '🐍',
    rust: '🦀', json: '📋', css: '🎨', html: '🌐',
    markdown: '📝', sql: '🗄️', shell: '⚡', go: '🐹',
  };
  return icons[language] ?? '📄';
}

function FileTree({
  files,
  selectedId,
  onSelect,
  onDelete,
  onNew,
}: {
  files: CloudFileListItem[];
  selectedId: number | null;
  onSelect: (f: CloudFileListItem) => void;
  onDelete: (f: CloudFileListItem) => void;
  onNew: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b border-white/5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-semibold text-white uppercase tracking-wide">Files</span>
        </div>
        <button
          onClick={onNew}
          className="p-1 rounded text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
          title="New file"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {files.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <FileCode className="w-6 h-6 text-muted-foreground/40 mx-auto mb-1.5" />
            <p className="text-xs text-muted-foreground">No files yet</p>
            <button
              onClick={onNew}
              className="mt-1.5 text-xs text-primary hover:underline"
            >
              Create one
            </button>
          </div>
        ) : (
          files.map((f) => (
            <div
              key={f.id}
              className={cn(
                'group flex items-center gap-2 px-3 py-1.5 cursor-pointer text-sm transition-colors',
                selectedId === f.id
                  ? 'bg-primary/20 text-white'
                  : 'text-muted-foreground hover:bg-white/5 hover:text-white',
              )}
              onClick={() => onSelect(f)}
            >
              <span className="text-xs flex-shrink-0">{getFileIcon(f.language)}</span>
              <span className="flex-1 truncate font-mono text-xs">{f.path}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(f); }}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-red-400 transition-all"
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Workspace picker ─────────────────────────────────────────────────────────

function WorkspacePicker({
  onSelect,
  displayName,
}: {
  onSelect: (ws: Workspace) => void;
  displayName: string;
}) {
  const [list, setList] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    collaborationApi.listWorkspaces()
      .then((data) => setList([...data.owned, ...data.member]))
      .catch(() => toast.error('Failed to load workspaces'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center px-6">
          <FolderOpen className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-white mb-1">No workspaces found</p>
          <p className="text-xs text-muted-foreground">
            Create a workspace in the Collaboration Hub first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-72">
        <p className="text-sm font-medium text-white mb-3 text-center">Select a workspace to edit files</p>
        <div className="space-y-2">
          {list.map((ws) => (
            <button
              key={ws.id}
              onClick={() => onSelect(ws)}
              className="w-full flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors text-left"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                style={{ backgroundColor: ws.color }}
              >
                {ws.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-medium text-white">{ws.name}</div>
                {ws.description && <div className="text-xs text-muted-foreground truncate">{ws.description}</div>}
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── New file dialog ──────────────────────────────────────────────────────────

function NewFileDialog({
  onConfirm,
  onClose,
}: {
  onConfirm: (path: string) => void;
  onClose: () => void;
}) {
  const [path, setPath] = useState('');

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-zinc-900 border border-white/10 rounded-xl p-5 w-80 shadow-2xl"
      >
        <h3 className="text-sm font-semibold text-white mb-3">New File</h3>
        <input
          autoFocus
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder:text-white/30 focus:outline-none focus:border-primary/50"
          placeholder="src/index.ts"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && path.trim()) onConfirm(path.trim());
            if (e.key === 'Escape') onClose();
          }}
        />
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 px-3 py-1.5 text-sm text-muted-foreground hover:text-white border border-white/10 rounded-lg transition-colors">Cancel</button>
          <button
            onClick={() => path.trim() && onConfirm(path.trim())}
            disabled={!path.trim()}
            className="flex-1 px-3 py-1.5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            Create
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

const AUTOSAVE_DELAY = 1500; // ms after last keystroke

export default function CloudEditorApp() {
  const { user } = useUser();
  const userId = user?.id ?? null;
  const displayName = user?.fullName ?? user?.username ?? user?.primaryEmailAddress?.emailAddress ?? 'User';

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [files, setFiles] = useState<CloudFileListItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<CloudFile | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [loadingFile, setLoadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [showNewFile, setShowNewFile] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestContentRef = useRef('');

  // Presence: broadcast which file is open
  const focusKey = selectedFile ? `file:${selectedFile.path}` : workspace ? `workspace:${workspace.id}` : undefined;
  const { onlineUsers } = usePresence(
    workspace?.id ?? null,
    userId,
    displayName,
    focusKey,
  );

  // Viewers of the same file
  const sameFileViewers = onlineUsers.filter(
    (u) => u.userId !== userId && u.focus === focusKey,
  );

  const loadFiles = useCallback(async (wsId: string) => {
    try {
      const list = await cloudEditorApi.listFiles(wsId);
      setFiles(list);
    } catch {
      toast.error('Failed to load files');
    }
  }, []);

  const openFile = useCallback(async (fileItem: CloudFileListItem) => {
    if (!workspace) return;
    setLoadingFile(true);
    setConflict(false);
    setIsDirty(false);
    try {
      const full = await cloudEditorApi.getFile(workspace.id, fileItem.id);
      setSelectedFile(full);
      setEditorContent(full.content ?? '');
      latestContentRef.current = full.content ?? '';
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open file');
    } finally {
      setLoadingFile(false);
    }
  }, [workspace]);

  const save = useCallback(async (content: string) => {
    if (!workspace || !selectedFile) return;
    setSaving(true);
    try {
      const updated = await cloudEditorApi.saveFile(workspace.id, selectedFile.id, {
        content,
        version: selectedFile.version,
        displayName,
      });
      setSelectedFile(updated);
      setIsDirty(false);
      setConflict(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      if (msg.toLowerCase().includes('version conflict') || msg.toLowerCase().includes('conflict')) {
        setConflict(true);
        toast.error('Version conflict — someone else edited this file. Reload to see their changes.');
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  }, [workspace, selectedFile, displayName]);

  // Auto-save after AUTOSAVE_DELAY ms of no typing
  const handleEditorChange = useCallback((value: string) => {
    setEditorContent(value);
    latestContentRef.current = value;
    setIsDirty(true);

    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      void save(latestContentRef.current);
    }, AUTOSAVE_DELAY);
  }, [save]);

  // Cleanup timer on unmount
  useEffect(() => () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); }, []);

  const handleNewFile = async (path: string) => {
    if (!workspace) return;
    setShowNewFile(false);
    try {
      const file = await cloudEditorApi.createFile(workspace.id, { path, displayName });
      setFiles((prev) => [...prev, file]);
      await openFile(file);
      toast.success(`Created ${path}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create file');
    }
  };

  const handleDeleteFile = async (file: CloudFileListItem) => {
    if (!workspace) return;
    if (!confirm(`Delete "${file.path}"?`)) return;
    try {
      await cloudEditorApi.deleteFile(workspace.id, file.id);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      if (selectedFile?.id === file.id) {
        setSelectedFile(null);
        setEditorContent('');
      }
      toast.success(`Deleted ${file.path}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete file');
    }
  };

  const handleSelectWorkspace = async (ws: Workspace) => {
    setWorkspace(ws);
    setSelectedFile(null);
    setEditorContent('');
    await loadFiles(ws.id);
  };

  const langExtensions = selectedFile ? getLangExtension(selectedFile.language) : [];

  return (
    <div className="flex h-full bg-zinc-950 text-foreground font-sans overflow-hidden relative">
      {showNewFile && (
        <NewFileDialog
          onConfirm={handleNewFile}
          onClose={() => setShowNewFile(false)}
        />
      )}

      {/* ── No workspace selected ── */}
      {!workspace ? (
        <>
          <div className="absolute top-0 left-0 right-0 px-5 py-3 border-b border-white/5 flex items-center gap-2 bg-zinc-900/80 z-10">
            <FileCode className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-white">Cloud Editor</span>
          </div>
          <div className="flex-1 flex flex-col pt-12">
            <WorkspacePicker onSelect={handleSelectWorkspace} displayName={displayName} />
          </div>
        </>
      ) : (
        <>
          {/* ── File tree sidebar ── */}
          <div className="w-48 border-r border-white/5 flex flex-col bg-zinc-900/50 flex-shrink-0">
            {/* Workspace badge */}
            <div
              className="px-3 py-2 flex items-center gap-2 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors"
              onClick={() => { setWorkspace(null); setSelectedFile(null); setFiles([]); }}
              title="Change workspace"
            >
              <div
                className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: workspace.color }}
              >
                {workspace.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs font-medium text-white truncate flex-1">{workspace.name}</span>
              <X className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            </div>

            <FileTree
              files={files}
              selectedId={selectedFile?.id ?? null}
              onSelect={openFile}
              onDelete={handleDeleteFile}
              onNew={() => setShowNewFile(true)}
            />
          </div>

          {/* ── Editor area ── */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Toolbar */}
            <div className="px-4 py-2 border-b border-white/5 flex items-center gap-3 bg-zinc-900/30 flex-shrink-0">
              {selectedFile ? (
                <>
                  <span className="text-xs font-mono text-white/80 flex-1 truncate">
                    {getFileIcon(selectedFile.language)} {selectedFile.path}
                  </span>

                  {/* Co-viewers */}
                  {sameFileViewers.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-emerald-400">
                      <Users className="w-3.5 h-3.5" />
                      {sameFileViewers.map((u) => u.displayName).join(', ')}
                    </div>
                  )}

                  {/* Save status */}
                  <div className="flex items-center gap-1.5 text-xs">
                    {saving ? (
                      <span className="text-amber-400 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Saving…
                      </span>
                    ) : conflict ? (
                      <span className="text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Conflict
                      </span>
                    ) : isDirty ? (
                      <span className="text-muted-foreground">Unsaved</span>
                    ) : (
                      <span className="text-emerald-500">Saved</span>
                    )}
                  </div>

                  <button
                    onClick={() => save(editorContent)}
                    disabled={saving || !isDirty}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-primary/20 text-primary rounded-md hover:bg-primary/30 disabled:opacity-40 transition-colors"
                  >
                    <Save className="w-3 h-3" /> Save
                  </button>

                  {conflict && (
                    <button
                      onClick={() => openFile(selectedFile)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-amber-500/20 text-amber-400 rounded-md hover:bg-amber-500/30 transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" /> Reload
                    </button>
                  )}
                </>
              ) : (
                <span className="text-xs text-muted-foreground">Select a file to edit</span>
              )}
            </div>

            {/* Editor */}
            {loadingFile ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : selectedFile ? (
              <div className="flex-1 overflow-hidden">
                <CodeMirror
                  value={editorContent}
                  height="100%"
                  theme={oneDark}
                  extensions={langExtensions}
                  onChange={handleEditorChange}
                  className="h-full text-sm"
                  basicSetup={{
                    lineNumbers: true,
                    foldGutter: true,
                    autocompletion: true,
                    bracketMatching: true,
                    indentOnInput: true,
                  }}
                />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <FileCode className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Select a file from the sidebar</p>
                  <button
                    onClick={() => setShowNewFile(true)}
                    className="mt-2 text-xs text-primary hover:underline"
                  >
                    or create a new file
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
