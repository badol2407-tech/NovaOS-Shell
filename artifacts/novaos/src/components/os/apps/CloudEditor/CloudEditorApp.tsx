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
 *  - Real-time collaborative editing via Yjs CRDT (opt-in per file)
 *  - Online presence: shows who else is viewing the same file
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  FolderOpen, Plus, Trash2, Save, Loader2, FileCode,
  ChevronRight, AlertCircle, Users, RefreshCw, X, Radio, Wifi, WifiOff,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useUser, useAuth } from '@clerk/react';
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
import { WebsocketProvider } from 'y-websocket';
import { yCollab } from 'y-codemirror.next';

import { collaborationApi } from '../CollaborationHub/api';
import { cloudEditorApi } from './api';
import { usePresence } from '@/hooks/usePresence';
import { yjsConnectionInfo } from '@/lib/collabSocket';
import type { Workspace } from '../CollaborationHub/types';
import type { CloudFile, CloudFileListItem } from './types';

// ── Live CRDT collaboration ──────────────────────────────────────────────────
function useLiveCollab(
  workspaceId: string | null,
  fileId: number | null,
  userId: string | null,
  displayName: string,
  enabled: boolean,
) {
  const { getToken } = useAuth();
  const [extension, setExtension] = useState<Extension | null>(null);
  const [peerCount, setPeerCount] = useState(0);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const providerRef = useRef<WebsocketProvider | null>(null);

  useEffect(() => {
    if (!enabled || !workspaceId || !fileId || !userId) {
      setExtension(null);
      setPeerCount(0);
      setStatus('disconnected');
      return;
    }

    let cancelled = false;
    let provider: WebsocketProvider | null = null;
    setStatus('connecting');

    void (async () => {
      const { base, roomName, token } = await yjsConnectionInfo(
        () => getToken(),
        workspaceId,
        fileId,
      );
      if (cancelled) return;

      provider = new WebsocketProvider(base, roomName, undefined as never, {
        params: { token },
      });
      providerRef.current = provider;

      provider.on('status', ({ status: s }: { status: string }) => {
        setStatus(s === 'connected' ? 'connected' : s === 'connecting' ? 'connecting' : 'disconnected');
      });

      provider.awareness.setLocalStateField('user', {
        name: displayName,
        color: `hsl(${Math.abs(userId.charCodeAt(userId.length - 1) * 37) % 360}, 70%, 60%)`,
      });

      const updatePeers = () => setPeerCount(provider!.awareness.getStates().size - 1);
      provider.awareness.on('change', updatePeers);
      updatePeers();

      const ytext = provider.doc.getText('content');
      setExtension(yCollab(ytext, provider.awareness));
      setStatus('connected');
    })();

    return () => {
      cancelled = true;
      provider?.destroy();
      providerRef.current = null;
      setExtension(null);
      setPeerCount(0);
      setStatus('disconnected');
    };
  }, [enabled, workspaceId, fileId, userId, displayName, getToken]);

  return { extension, peerCount, status };
}

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

const FILE_ICONS: Record<string, string> = {
  typescript: '🟦', javascript: '🟨', python: '🐍',
  rust: '🦀', json: '📋', css: '🎨', html: '🌐',
  markdown: '📝', sql: '🗄️', shell: '⚡', go: '🐹',
};

function getFileIcon(language: string): string {
  return FILE_ICONS[language] ?? '📄';
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
      <div className="px-3 py-2.5 border-b border-white/8 flex items-center justify-between flex-shrink-0 bg-white/3">
        <div className="flex items-center gap-1.5">
          <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-semibold text-white uppercase tracking-wider">Files</span>
        </div>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onNew}
          className="p-1 rounded-md text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
          title="New file"
        >
          <Plus className="w-3.5 h-3.5" />
        </motion.button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {files.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <FileCode className="w-6 h-6 text-muted-foreground/30 mx-auto mb-1.5" />
            <p className="text-xs text-muted-foreground">No files yet</p>
            <button onClick={onNew} className="mt-1.5 text-xs text-primary hover:underline">
              Create one
            </button>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {files.map((f) => (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -4 }}
                className={cn(
                  'group flex items-center gap-2 px-3 py-1.5 cursor-pointer text-sm transition-colors',
                  selectedId === f.id
                    ? 'bg-primary/20 text-white border-l-2 border-primary'
                    : 'text-muted-foreground hover:bg-white/5 hover:text-white border-l-2 border-transparent',
                )}
                onClick={() => onSelect(f)}
              >
                <span className="text-xs flex-shrink-0">{getFileIcon(f.language)}</span>
                <span className="flex-1 truncate font-mono text-xs">{f.path}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(f); }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-red-400 transition-all rounded"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

// ── Workspace picker ─────────────────────────────────────────────────────────

function WorkspacePicker({
  onSelect,
}: {
  onSelect: (ws: Workspace) => void;
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
          <FolderOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-white mb-1">No workspaces found</p>
          <p className="text-xs text-muted-foreground">Create a workspace in the Collaboration Hub first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-80">
        <p className="text-sm font-medium text-white mb-4 text-center">Select a workspace</p>
        <div className="space-y-2">
          {list.map((ws) => (
            <motion.button
              key={ws.id}
              whileHover={{ scale: 1.02, x: 2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(ws)}
              className="w-full flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl transition-all text-left backdrop-blur-sm"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0 shadow-sm"
                style={{ backgroundColor: ws.color }}
              >
                {ws.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white">{ws.name}</div>
                {ws.description && <div className="text-xs text-muted-foreground truncate">{ws.description}</div>}
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto flex-shrink-0" />
            </motion.button>
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
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 8 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="bg-zinc-900/95 backdrop-blur-xl border border-white/15 rounded-2xl p-5 w-80 shadow-2xl"
      >
        <h3 className="text-sm font-semibold text-white mb-3">New File</h3>
        <input
          autoFocus
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white font-mono placeholder:text-white/30 focus:outline-none focus:border-primary/60 transition-all"
          placeholder="src/index.ts"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && path.trim()) onConfirm(path.trim());
            if (e.key === 'Escape') onClose();
          }}
        />
        <p className="text-[10px] text-muted-foreground/60 mt-1.5">
          Language detected from extension. Supports .ts, .py, .rs, .json, .md, and more.
        </p>
        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 text-sm text-muted-foreground hover:text-white border border-white/10 rounded-xl transition-colors hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={() => path.trim() && onConfirm(path.trim())}
            disabled={!path.trim()}
            className="flex-1 px-3 py-2 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-40 transition-all shadow-sm shadow-primary/20"
          >
            Create
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

const AUTOSAVE_DELAY = 1500;

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
  const [liveCollab, setLiveCollab] = useState(false);

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestContentRef = useRef('');

  // Presence: broadcast which file is open
  const focusKey = selectedFile ? `file:${selectedFile.path}` : workspace ? `workspace:${workspace.id}` : undefined;
  const { onlineUsers } = usePresence(workspace?.id ?? null, userId, displayName, focusKey);
  const sameFileViewers = onlineUsers.filter((u) => u.userId !== userId && u.focus === focusKey);

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
      if (msg.toLowerCase().includes('conflict')) {
        setConflict(true);
        toast.error('Version conflict — someone else edited this file. Reload to see their changes.');
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  }, [workspace, selectedFile, displayName]);

  const handleEditorChange = useCallback((value: string) => {
    setEditorContent(value);
    latestContentRef.current = value;
    setIsDirty(true);
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      void save(latestContentRef.current);
    }, AUTOSAVE_DELAY);
  }, [save]);

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
  const { extension: liveExtension, peerCount, status: collabStatus } = useLiveCollab(
    workspace?.id ?? null,
    selectedFile?.id ?? null,
    userId,
    displayName,
    liveCollab && !!selectedFile,
  );

  const editorExtensions = useMemo(
    () => (liveExtension ? [...langExtensions, liveExtension] : langExtensions),
    [langExtensions, liveExtension],
  );

  useEffect(() => { setLiveCollab(false); }, [selectedFile?.id, workspace?.id]);

  return (
    <div className="flex h-full bg-zinc-950 text-foreground font-sans overflow-hidden relative">
      <AnimatePresence>
        {showNewFile && (
          <NewFileDialog onConfirm={(p) => void handleNewFile(p)} onClose={() => setShowNewFile(false)} />
        )}
      </AnimatePresence>

      {/* ── No workspace selected ── */}
      {!workspace ? (
        <>
          <div className="absolute top-0 left-0 right-0 px-5 py-3 border-b border-white/8 flex items-center gap-2 bg-zinc-900/80 backdrop-blur-md z-10">
            <FileCode className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-white">Cloud Editor</span>
          </div>
          <div className="flex-1 flex flex-col pt-12">
            <WorkspacePicker onSelect={(ws) => void handleSelectWorkspace(ws)} />
          </div>
        </>
      ) : (
        <>
          {/* ── File tree sidebar ── */}
          <div className="w-48 border-r border-white/8 flex flex-col bg-black/20 backdrop-blur-sm flex-shrink-0">
            {/* Workspace badge */}
            <motion.div
              className="px-3 py-2 flex items-center gap-2 border-b border-white/8 cursor-pointer hover:bg-white/5 transition-colors bg-white/3"
              onClick={() => { setWorkspace(null); setSelectedFile(null); setFiles([]); }}
              title="Change workspace"
              whileHover={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
            >
              <div
                className="w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center text-xs font-bold text-white shadow-sm"
                style={{ backgroundColor: workspace.color }}
              >
                {workspace.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs font-medium text-white truncate flex-1">{workspace.name}</span>
              <X className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            </motion.div>

            <FileTree
              files={files}
              selectedId={selectedFile?.id ?? null}
              onSelect={(f) => void openFile(f)}
              onDelete={(f) => void handleDeleteFile(f)}
              onNew={() => setShowNewFile(true)}
            />
          </div>

          {/* ── Editor area ── */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Toolbar */}
            <div className="px-4 py-2.5 border-b border-white/8 flex items-center gap-3 bg-black/20 backdrop-blur-sm flex-shrink-0">
              {selectedFile ? (
                <>
                  <span className="text-xs font-mono text-white/80 flex-1 truncate">
                    {getFileIcon(selectedFile.language)} {selectedFile.path}
                    <span className="ml-2 text-muted-foreground/50 text-[10px]">v{selectedFile.version}</span>
                  </span>

                  {/* Co-viewers */}
                  {sameFileViewers.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-0.5">
                      <Users className="w-3 h-3" />
                      {sameFileViewers.map((u) => u.displayName).join(', ')}
                    </div>
                  )}

                  {/* Live collab toggle */}
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setLiveCollab((v) => !v)}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-all border',
                      liveCollab
                        ? collabStatus === 'connected'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        : 'bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10',
                    )}
                    title="Toggle real-time collaborative editing"
                  >
                    {liveCollab
                      ? collabStatus === 'connected'
                        ? <Wifi className="w-3 h-3" />
                        : <Loader2 className="w-3 h-3 animate-spin" />
                      : <Radio className="w-3 h-3" />
                    }
                    {liveCollab
                      ? collabStatus === 'connected'
                        ? `Live${peerCount > 0 ? ` · ${peerCount}` : ''}`
                        : 'Connecting…'
                      : 'Live'
                    }
                  </motion.button>

                  {/* Save status */}
                  <div className="flex items-center gap-1.5 text-xs">
                    {liveCollab && collabStatus === 'connected' ? (
                      <span className="text-emerald-500">Synced</span>
                    ) : saving ? (
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
                      <span className="text-emerald-500/70">Saved</span>
                    )}
                  </div>

                  {!liveCollab && (
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => void save(editorContent)}
                      disabled={saving || !isDirty}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-primary/15 text-primary rounded-lg hover:bg-primary/25 disabled:opacity-30 transition-all border border-primary/20"
                    >
                      <Save className="w-3 h-3" /> Save
                    </motion.button>
                  )}

                  {conflict && !liveCollab && (
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      onClick={() => void openFile(selectedFile)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-amber-500/15 text-amber-400 rounded-lg hover:bg-amber-500/25 transition-all border border-amber-500/20"
                    >
                      <RefreshCw className="w-3 h-3" /> Reload
                    </motion.button>
                  )}
                </>
              ) : (
                <span className="text-xs text-muted-foreground">Select a file to edit</span>
              )}
            </div>

            {/* Editor */}
            {loadingFile ? (
              <div className="flex-1 flex items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                >
                  <Loader2 className="w-6 h-6 text-muted-foreground" />
                </motion.div>
              </div>
            ) : selectedFile ? (
              <motion.div
                key={selectedFile.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
                className="flex-1 overflow-hidden"
              >
                <CodeMirror
                  value={editorContent}
                  height="100%"
                  theme={oneDark}
                  extensions={editorExtensions}
                  onChange={liveCollab ? undefined : handleEditorChange}
                  editable
                  className="h-full text-sm"
                  basicSetup={{
                    lineNumbers: true,
                    foldGutter: true,
                    autocompletion: true,
                    bracketMatching: true,
                    indentOnInput: true,
                    highlightActiveLine: true,
                    highlightSelectionMatches: true,
                  }}
                />
              </motion.div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <FileCode className="w-10 h-10 text-muted-foreground/25 mx-auto mb-2" />
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
