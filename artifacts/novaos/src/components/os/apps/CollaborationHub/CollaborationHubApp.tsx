/**
 * Phase 11 — Collaboration Hub
 *
 * Main app for managing collaborative workspaces. Four-panel layout:
 *   Left  — workspace list (owned + joined)
 *   Center — workspace detail (members, activity, live chat, invites)
 *
 * Real-time chat is powered by Socket.IO (collab-socket path). Presence uses
 * Firestore as a separate channel for lightweight "who's online" indicators.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, Plus, Trash2, LogOut, Mail, Check, X, Globe, Activity,
  UserPlus, Link2, RefreshCw, Loader2, MessageSquare, Send, Hash,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useUser, useAuth } from '@clerk/react';
import type { Socket } from 'socket.io-client';
import { getCollabSocket } from '@/lib/collabSocket';
import { collaborationApi } from './api';
import type { Workspace, WorkspaceDetail, WorkspaceInvite, WorkspaceActivity } from './types';
import { usePresence } from '@/hooks/usePresence';
import { toast } from 'sonner';

// ── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  userId: string;
  displayName: string;
  body: string;
  at: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

const ACTION_ICONS: Record<string, string> = {
  workspace_created: '🏗️',
  member_joined: '👋',
  member_left: '💨',
  member_invited: '📬',
  invite_accepted: '✅',
  member_role_changed: '🔄',
  file_created: '📄',
  file_edited: '✏️',
  file_deleted: '🗑️',
  comment_added: '💬',
};

function activityLabel(action: string, contextJson: string | null): string {
  const ctx = contextJson
    ? (() => { try { return JSON.parse(contextJson) as Record<string, unknown>; } catch { return {}; } })()
    : {};
  switch (action) {
    case 'workspace_created': return 'created this workspace';
    case 'member_joined': return 'joined the workspace';
    case 'member_left': return 'left the workspace';
    case 'member_invited': return `invited ${ctx['email'] ?? 'someone'} as ${ctx['role'] ?? 'editor'}`;
    case 'invite_accepted': return 'accepted an invite';
    case 'member_role_changed': return `role changed to ${ctx['role'] ?? 'unknown'}`;
    case 'file_created': return `created ${ctx['fileName'] ?? 'a file'}`;
    case 'file_edited': return `edited ${ctx['fileName'] ?? 'a file'}`;
    case 'file_deleted': return `deleted ${ctx['fileName'] ?? 'a file'}`;
    case 'comment_added': return `commented on ${ctx['resourceType'] ?? 'a resource'}`;
    default: return action.replace(/_/g, ' ');
  }
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#3b82f6', '#f59e0b'];

function roleBadge(role: string) {
  const styles: Record<string, string> = {
    owner: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    admin: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    editor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    viewer: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  };
  return cn('text-xs px-2 py-0.5 rounded-full font-medium border', styles[role] ?? styles['viewer']);
}

// ── Online Badge ─────────────────────────────────────────────────────────────

function OnlineBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium border border-emerald-500/20"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      {count} online
    </motion.span>
  );
}

// ── Workspace Card ───────────────────────────────────────────────────────────

function WorkspaceCard({
  workspace,
  isSelected,
  isMine,
  onClick,
}: {
  workspace: Workspace;
  isSelected: boolean;
  isMine: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ x: 2 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'w-full text-left px-3 py-2.5 rounded-xl transition-all duration-150 border',
        isSelected
          ? 'bg-primary/15 border-primary/40 shadow-sm shadow-primary/20'
          : 'hover:bg-white/5 border-transparent hover:border-white/10',
      )}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-sm font-bold text-white shadow-sm"
          style={{ backgroundColor: workspace.color }}
        >
          {workspace.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground truncate">{workspace.name}</div>
          <div className="text-xs text-muted-foreground">{isMine ? 'Owner' : 'Member'}</div>
        </div>
        {isSelected && (
          <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
        )}
      </div>
    </motion.button>
  );
}

// ── Create Workspace Dialog ──────────────────────────────────────────────────

function CreateWorkspaceDialog({
  onCreated,
  onClose,
  displayName,
}: {
  onCreated: (ws: Workspace) => void;
  onClose: () => void;
  displayName: string;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLORS[0]!);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const ws = await collaborationApi.createWorkspace({ name: name.trim(), description, color, displayName });
      onCreated(ws);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create workspace');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 8 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="bg-zinc-900/95 backdrop-blur-xl border border-white/15 rounded-2xl p-6 w-[420px] shadow-2xl"
      >
        <h2 className="text-lg font-semibold text-white mb-5">New Workspace</h2>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Name</label>
            <input
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/60 focus:bg-white/8 transition-all"
              placeholder="My Workspace"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleCreate()}
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description (optional)</label>
            <textarea
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/60 transition-all resize-none"
              placeholder="What's this workspace for?"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Color</label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  className={cn(
                    'w-7 h-7 rounded-full border-2 transition-all duration-150',
                    color === c ? 'border-white scale-115 shadow-md' : 'border-transparent hover:scale-110',
                  )}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground border border-white/10 rounded-xl transition-colors hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleCreate()}
            disabled={!name.trim() || loading}
            className="flex-1 px-4 py-2.5 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-sm shadow-primary/30"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Create Workspace
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Invite Panel ─────────────────────────────────────────────────────────────

function InvitePanel({ workspaceId, inviterDisplayName }: { workspaceId: string; inviterDisplayName: string }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'editor' | 'viewer'>('editor');
  const [loading, setLoading] = useState(false);
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [token, setToken] = useState('');
  const [tokenLoading, setTokenLoading] = useState(false);

  useEffect(() => {
    collaborationApi.listInvites(workspaceId).then(setInvites).catch(() => {});
  }, [workspaceId]);

  const handleSend = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const invite = await collaborationApi.sendInvite(workspaceId, { email: email.trim(), role, inviterDisplayName });
      setInvites((prev) => [invite, ...prev]);
      setEmail('');
      toast.success(`Invite sent to ${email.trim()}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptToken = async () => {
    if (!token.trim()) return;
    setTokenLoading(true);
    try {
      await collaborationApi.acceptInvite({ token: token.trim(), displayName: inviterDisplayName });
      setToken('');
      toast.success('Joined workspace!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to accept invite');
    } finally {
      setTokenLoading(false);
    }
  };

  const handleRevoke = async (invite: WorkspaceInvite) => {
    try {
      await collaborationApi.revokeInvite(workspaceId, invite.id);
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
      toast.success('Invite revoked');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke');
    }
  };

  return (
    <div className="p-4 space-y-6">
      {/* Send invite */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-primary" /> Invite by Email
        </h3>
        <div className="space-y-2">
          <input
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/60 transition-all"
            placeholder="collaborator@example.com"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleSend()}
          />
          <div className="flex gap-2">
            <select
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/60 transition-all"
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'editor' | 'viewer')}
            >
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              onClick={() => void handleSend()}
              disabled={!email.trim() || loading}
              className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 shadow-sm shadow-primary/20"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Accept via token */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Link2 className="w-4 h-4 text-amber-400" /> Accept by Token
        </h3>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/50 font-mono text-xs transition-all"
            placeholder="Paste invite token…"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleAcceptToken()}
          />
          <button
            onClick={() => void handleAcceptToken()}
            disabled={!token.trim() || tokenLoading}
            className="px-3 py-2 text-sm font-medium bg-amber-500/20 text-amber-400 rounded-xl hover:bg-amber-500/30 disabled:opacity-40 transition-all border border-amber-500/20"
          >
            {tokenLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Pending ({invites.length})</h3>
          <div className="space-y-1.5">
            {invites.map((inv) => (
              <motion.div
                key={inv.id}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 bg-white/5 border border-white/8 rounded-xl px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white truncate">{inv.inviteeEmail}</div>
                  <div className="text-xs text-muted-foreground">{inv.role} · {timeAgo(inv.createdAt)}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded-md text-xs bg-amber-500/15 text-amber-400 border border-amber-500/20">pending</span>
                  <button onClick={() => void handleRevoke(inv)} className="p-1 text-muted-foreground hover:text-red-400 transition-colors rounded">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Live Chat Panel ──────────────────────────────────────────────────────────

function ChatPanel({
  messages,
  userId,
  onSend,
}: {
  messages: ChatMessage[];
  userId: string | null;
  onSend: (body: string) => void;
}) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <Hash className="w-8 h-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Say hello to your team!</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => {
              const isMe = msg.userId === userId;
              return (
                <motion.div
                  key={`${msg.at}-${i}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={cn('flex gap-2.5', isMe ? 'flex-row-reverse' : 'flex-row')}
                >
                  <div
                    className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                    style={{
                      backgroundColor: `hsl(${Math.abs([...msg.userId].reduce((a, c) => a + c.charCodeAt(0), 0)) % 360}, 60%, 50%)`,
                    }}
                  >
                    {msg.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className={cn('flex flex-col gap-0.5 max-w-[70%]', isMe ? 'items-end' : 'items-start')}>
                    <span className="text-xs text-muted-foreground">{isMe ? 'You' : msg.displayName}</span>
                    <div
                      className={cn(
                        'px-3 py-2 rounded-2xl text-sm leading-relaxed break-words',
                        isMe
                          ? 'bg-primary text-white rounded-tr-sm'
                          : 'bg-white/8 text-white border border-white/10 rounded-tl-sm',
                      )}
                    >
                      {msg.body}
                    </div>
                    <span className="text-[10px] text-muted-foreground/50">{timeAgo(msg.at)}</span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 p-3 border-t border-white/8">
        <input
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/60 transition-all"
          placeholder="Send a message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          maxLength={2000}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="p-2 text-primary hover:bg-primary/20 rounded-xl transition-colors disabled:opacity-30 border border-primary/20 hover:border-primary/40"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

type Tab = 'members' | 'activity' | 'chat' | 'invites';

export default function CollaborationHubApp() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const userId = user?.id ?? null;
  const displayName = user?.fullName ?? user?.username ?? user?.primaryEmailAddress?.emailAddress ?? 'User';

  const [workspaces, setWorkspaces] = useState<{ owned: Workspace[]; member: Workspace[] }>({ owned: [], member: [] });
  const [loading, setLoading] = useState(true);
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceDetail | null>(null);
  const [activity, setActivity] = useState<WorkspaceActivity[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('members');

  // Live chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const joinedWorkspaceRef = useRef<string | null>(null);

  const { onlineUsers } = usePresence(
    selectedWorkspace?.id ?? null,
    userId,
    displayName,
    selectedWorkspace ? `workspace:${selectedWorkspace.id}` : undefined,
  );

  // ── Socket.IO realtime connection ──────────────────────────────────────────
  useEffect(() => {
    if (!selectedWorkspace || !userId) return;

    const wsId = selectedWorkspace.id;
    const socket = getCollabSocket(() => getToken(), displayName);
    socketRef.current = socket;

    const onChatMessage = (msg: ChatMessage) => {
      setChatMessages((prev) => [...prev.slice(-200), msg]);
    };
    const onPresenceJoined = (payload: { userId: string; displayName: string }) => {
      if (payload.userId !== userId) {
        toast(`${payload.displayName} joined`, { duration: 2000 });
      }
    };
    const onPresenceLeft = (payload: { userId: string }) => {
      if (payload.userId !== userId) {
        // Silently update — no toast for leaves to reduce noise
      }
    };

    socket.on('chat:message', onChatMessage);
    socket.on('presence:joined', onPresenceJoined);
    socket.on('presence:left', onPresenceLeft);

    // Join the workspace room (idempotent — server is safe to call again)
    socket.emit('join-workspace', { workspaceId: wsId }, (res: { ok: boolean; error?: string }) => {
      if (res && !res.ok) {
        socketRef.current = null;
      }
    });
    joinedWorkspaceRef.current = wsId;

    // Reset chat when switching workspace
    setChatMessages([]);

    return () => {
      socket.off('chat:message', onChatMessage);
      socket.off('presence:joined', onPresenceJoined);
      socket.off('presence:left', onPresenceLeft);
      socket.emit('leave-workspace', { workspaceId: wsId });
      joinedWorkspaceRef.current = null;
    };
  }, [selectedWorkspace?.id, userId, displayName, getToken]);

  const handleSendChat = useCallback((body: string) => {
    if (!selectedWorkspace || !socketRef.current) return;
    socketRef.current.emit('chat:message', { workspaceId: selectedWorkspace.id, body });
  }, [selectedWorkspace]);

  // ── Workspace loading ──────────────────────────────────────────────────────
  const loadWorkspaces = useCallback(async () => {
    try {
      const data = await collaborationApi.listWorkspaces();
      setWorkspaces(data);
    } catch {
      toast.error('Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadWorkspaces(); }, [loadWorkspaces]);

  const selectWorkspace = async (ws: Workspace) => {
    setLoadingDetail(true);
    setActiveTab('members');
    try {
      const [detail, acts] = await Promise.all([
        collaborationApi.getWorkspace(ws.id),
        collaborationApi.getActivity(ws.id, 30),
      ]);
      setSelectedWorkspace(detail);
      setActivity(acts);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load workspace');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedWorkspace) return;
    if (!confirm(`Delete workspace "${selectedWorkspace.name}"? This cannot be undone.`)) return;
    try {
      await collaborationApi.deleteWorkspace(selectedWorkspace.id);
      setSelectedWorkspace(null);
      await loadWorkspaces();
      toast.success('Workspace deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete workspace');
    }
  };

  const handleLeave = async () => {
    if (!selectedWorkspace || !userId) return;
    const me = selectedWorkspace.members.find((m) => m.userId === userId);
    if (!me) return;
    if (!confirm(`Leave workspace "${selectedWorkspace.name}"?`)) return;
    try {
      await collaborationApi.removeMember(selectedWorkspace.id, me.id);
      setSelectedWorkspace(null);
      await loadWorkspaces();
      toast.success('Left workspace');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to leave workspace');
    }
  };

  const isOwner = selectedWorkspace?.ownerUserId === userId;
  const myRole = selectedWorkspace?.members.find((m) => m.userId === userId)?.role;
  const isAdminOrOwner = isOwner || myRole === 'admin';
  const allWorkspaces = [...workspaces.owned, ...workspaces.member];

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'members', label: 'Members', icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'activity', label: 'Activity', icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'chat', label: 'Chat', icon: <MessageSquare className="w-3.5 h-3.5" /> },
    ...(isAdminOrOwner ? [{ id: 'invites' as Tab, label: 'Invites', icon: <Mail className="w-3.5 h-3.5" /> }] : []),
  ];

  return (
    <div className="flex h-full overflow-hidden bg-zinc-950 text-foreground font-sans">
      <AnimatePresence>
        {showCreate && (
          <CreateWorkspaceDialog
            displayName={displayName}
            onCreated={async (ws) => {
              setShowCreate(false);
              await loadWorkspaces();
              await selectWorkspace(ws);
            }}
            onClose={() => setShowCreate(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Left sidebar ─────────────────────────────────────────────────── */}
      <div className="w-56 border-r border-white/8 flex flex-col bg-black/20 backdrop-blur-sm flex-shrink-0">
        <div className="px-3 py-4 border-b border-white/8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-white">Workspaces</span>
            </div>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowCreate(true)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
              title="New workspace"
            >
              <Plus className="w-3.5 h-3.5" />
            </motion.button>
          </div>
        </div>

        <ScrollArea className="flex-1 px-2 py-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : allWorkspaces.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8 px-3"
            >
              <Globe className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No workspaces yet</p>
              <button onClick={() => setShowCreate(true)} className="mt-2 text-xs text-primary hover:underline">
                Create one
              </button>
            </motion.div>
          ) : (
            <div className="space-y-0.5">
              {workspaces.owned.length > 0 && (
                <>
                  <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest px-2 pt-2 pb-1">Mine</p>
                  {workspaces.owned.map((ws) => (
                    <WorkspaceCard key={ws.id} workspace={ws} isSelected={selectedWorkspace?.id === ws.id} isMine onClick={() => void selectWorkspace(ws)} />
                  ))}
                </>
              )}
              {workspaces.member.length > 0 && (
                <>
                  <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest px-2 pt-3 pb-1">Joined</p>
                  {workspaces.member.map((ws) => (
                    <WorkspaceCard key={ws.id} workspace={ws} isSelected={selectedWorkspace?.id === ws.id} isMine={false} onClick={() => void selectWorkspace(ws)} />
                  ))}
                </>
              )}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* ── Center panel ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!selectedWorkspace ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex items-center justify-center"
          >
            <div className="text-center px-8">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                <Users className="w-8 h-8 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-white mb-1">No workspace selected</p>
              <p className="text-xs text-muted-foreground">Pick one from the sidebar or create a new one</p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-4 px-4 py-2 text-sm font-medium bg-primary/20 text-primary border border-primary/30 rounded-xl hover:bg-primary/30 transition-colors"
              >
                <Plus className="w-3.5 h-3.5 inline mr-1.5" />
                New Workspace
              </button>
            </div>
          </motion.div>
        ) : loadingDetail ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <motion.div
            key={selectedWorkspace.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col h-full overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-white/8 flex items-center gap-3 bg-white/3 backdrop-blur-sm flex-shrink-0">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-base font-bold text-white flex-shrink-0 shadow-sm"
                style={{ backgroundColor: selectedWorkspace.color }}
              >
                {selectedWorkspace.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-semibold text-white truncate">{selectedWorkspace.name}</h2>
                  <OnlineBadge count={onlineUsers.length} />
                </div>
                {selectedWorkspace.description && (
                  <p className="text-xs text-muted-foreground truncate">{selectedWorkspace.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => void selectWorkspace(selectedWorkspace)}
                  className="p-1.5 text-muted-foreground hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                {isOwner ? (
                  <button
                    onClick={() => void handleDelete()}
                    className="p-1.5 text-muted-foreground hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                    title="Delete workspace"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => void handleLeave()}
                    className="p-1.5 text-muted-foreground hover:text-amber-400 rounded-lg hover:bg-amber-500/10 transition-colors"
                    title="Leave workspace"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/8 flex-shrink-0 bg-white/2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-all border-b-2',
                    activeTab === tab.id
                      ? 'text-primary border-primary bg-primary/5'
                      : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-white/3',
                  )}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.id === 'chat' && chatMessages.length > 0 && (
                    <span className="ml-0.5 min-w-[16px] h-4 px-1 bg-primary/30 text-primary rounded-full text-[9px] flex items-center justify-center">
                      {chatMessages.length > 99 ? '99+' : chatMessages.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="h-full overflow-hidden"
                >
                  {/* Members tab */}
                  {activeTab === 'members' && (
                    <ScrollArea className="h-full">
                      <div className="p-4 space-y-3">
                        {/* Online now */}
                        {onlineUsers.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-2">Online Now</p>
                            <div className="flex flex-wrap gap-2">
                              {onlineUsers.map((u) => (
                                <motion.div
                                  key={u.userId}
                                  initial={{ scale: 0.8, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 rounded-full px-3 py-1 text-xs border border-emerald-500/20"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  {u.displayName}
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        )}

                        <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
                          All Members ({selectedWorkspace.members.length})
                        </p>
                        {selectedWorkspace.members.map((member) => (
                          <motion.div
                            key={member.id}
                            layout
                            className="flex items-center gap-3 bg-white/4 border border-white/8 rounded-xl px-3 py-2.5 backdrop-blur-sm"
                          >
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                              style={{ backgroundColor: selectedWorkspace.color + 'aa' }}
                            >
                              {member.displayName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-white truncate">
                                {member.displayName}
                                {member.userId === userId && <span className="text-muted-foreground text-xs ml-1.5">(you)</span>}
                              </div>
                              <div className="text-xs text-muted-foreground">Joined {timeAgo(member.joinedAt)}</div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {isOwner && member.role !== 'owner' ? (
                                <select
                                  value={member.role}
                                  onChange={async (e) => {
                                    const nextRole = e.target.value as 'admin' | 'editor' | 'viewer';
                                    try {
                                      await collaborationApi.updateMemberRole(selectedWorkspace.id, member.id, nextRole);
                                      setSelectedWorkspace((prev) =>
                                        prev
                                          ? { ...prev, members: prev.members.map((m) => (m.id === member.id ? { ...m, role: nextRole } : m)) }
                                          : prev,
                                      );
                                      toast.success(`${member.displayName} is now ${nextRole}`);
                                    } catch (err) {
                                      toast.error(err instanceof Error ? err.message : 'Failed to change role');
                                    }
                                  }}
                                  className="text-xs px-2 py-0.5 rounded-lg font-medium bg-white/10 text-white border border-white/20 focus:outline-none"
                                >
                                  <option value="admin">admin</option>
                                  <option value="editor">editor</option>
                                  <option value="viewer">viewer</option>
                                </select>
                              ) : (
                                <span className={roleBadge(member.role)}>{member.role}</span>
                              )}
                              {isAdminOrOwner && member.userId !== userId && member.role !== 'owner' && !(myRole === 'admin' && member.role === 'admin') && (
                                <button
                                  onClick={async () => {
                                    try {
                                      await collaborationApi.removeMember(selectedWorkspace.id, member.id);
                                      setSelectedWorkspace((prev) =>
                                        prev ? { ...prev, members: prev.members.filter((m) => m.id !== member.id) } : prev,
                                      );
                                      toast.success('Member removed');
                                    } catch (err) {
                                      toast.error(err instanceof Error ? err.message : 'Failed to remove member');
                                    }
                                  }}
                                  className="p-1 text-muted-foreground hover:text-red-400 transition-colors rounded"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}

                  {/* Activity tab */}
                  {activeTab === 'activity' && (
                    <ScrollArea className="h-full">
                      <div className="p-4 space-y-2">
                        {activity.length === 0 ? (
                          <div className="text-center py-12">
                            <Activity className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">No activity yet</p>
                          </div>
                        ) : (
                          activity.map((item) => (
                            <motion.div
                              key={item.id}
                              initial={{ opacity: 0, x: -4 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/3 transition-colors"
                            >
                              <span className="text-base flex-shrink-0 mt-0.5">
                                {ACTION_ICONS[item.action] ?? '📌'}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-white">
                                  <span className="font-medium">{item.actorDisplayName}</span>
                                  {' '}
                                  <span className="text-muted-foreground">{activityLabel(item.action, item.contextJson)}</span>
                                </div>
                                <div className="text-xs text-muted-foreground/60 mt-0.5">{timeAgo(item.createdAt)}</div>
                              </div>
                            </motion.div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  )}

                  {/* Chat tab */}
                  {activeTab === 'chat' && (
                    <ChatPanel
                      messages={chatMessages}
                      userId={userId}
                      onSend={handleSendChat}
                    />
                  )}

                  {/* Invites tab */}
                  {activeTab === 'invites' && isAdminOrOwner && (
                    <ScrollArea className="h-full">
                      <InvitePanel workspaceId={selectedWorkspace.id} inviterDisplayName={displayName} />
                    </ScrollArea>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
