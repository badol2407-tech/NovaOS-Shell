/**
 * Phase 11 — Collaboration Hub
 *
 * Main app for managing collaborative workspaces. Three-panel layout:
 *   Left  — workspace list (owned + joined)
 *   Center — workspace detail (members, activity, online presence)
 *   Right  — invite / manage panel (owner)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Trash2, LogOut, Settings, Mail, Check, X, Globe, Lock, Activity, UserPlus, Link2, RefreshCw, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useUser } from '@clerk/react';
import { collaborationApi } from './api';
import type { Workspace, WorkspaceDetail, WorkspaceInvite, WorkspaceActivity } from './types';
import { usePresence } from '@/hooks/usePresence';
import { toast } from 'sonner';

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
  member_left: '👋',
  member_invited: '📬',
  invite_accepted: '✅',
  file_created: '📄',
  file_edited: '✏️',
  file_deleted: '🗑️',
};

function activityLabel(action: string, contextJson: string | null): string {
  const ctx = contextJson ? (() => { try { return JSON.parse(contextJson) as Record<string, unknown>; } catch { return {}; } })() : {};
  switch (action) {
    case 'workspace_created': return 'created this workspace';
    case 'member_joined': return 'joined the workspace';
    case 'member_left': return 'left the workspace';
    case 'member_invited': return `invited ${ctx['email'] ?? 'someone'} as ${ctx['role'] ?? 'editor'}`;
    case 'invite_accepted': return 'accepted an invite';
    case 'file_created': return `created ${ctx['fileName'] ?? 'a file'}`;
    case 'file_edited': return `edited ${ctx['fileName'] ?? 'a file'}`;
    case 'file_deleted': return `deleted ${ctx['fileName'] ?? 'a file'}`;
    default: return action;
  }
}

// ── Sub-components ──────────────────────────────────────────────────────────

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
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2.5 rounded-lg transition-all duration-150 group',
        isSelected
          ? 'bg-primary/20 border border-primary/30'
          : 'hover:bg-white/5 border border-transparent',
      )}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-sm font-bold text-white"
          style={{ backgroundColor: workspace.color }}
        >
          {workspace.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground truncate">{workspace.name}</div>
          <div className="text-xs text-muted-foreground">{isMine ? 'Owner' : 'Member'}</div>
        </div>
      </div>
    </button>
  );
}

function OnlineBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      {count} online
    </span>
  );
}

// ── Create Workspace Dialog ─────────────────────────────────────────────────

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#3b82f6', '#f59e0b'];

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-[420px] shadow-2xl"
      >
        <h2 className="text-lg font-semibold text-white mb-4">New Workspace</h2>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Workspace Name</label>
            <input
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50"
              placeholder="My Workspace"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description (optional)</label>
            <textarea
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 resize-none"
              placeholder="What is this workspace for?"
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
                    'w-7 h-7 rounded-full border-2 transition-all',
                    color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105',
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
            className="flex-1 px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-white/10 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || loading}
            className="flex-1 px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Create
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Invite Panel ────────────────────────────────────────────────────────────

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
      toast.success('Invite sent!');
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
    <div className="p-4 space-y-5">
      {/* Send invite */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-primary" /> Invite Member
        </h3>
        <div className="space-y-2">
          <input
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50"
            placeholder="collaborator@example.com"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <div className="flex gap-2">
            <select
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'editor' | 'viewer')}
            >
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              onClick={handleSend}
              disabled={!email.trim() || loading}
              className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
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
          <Link2 className="w-4 h-4 text-amber-400" /> Accept Invite by Token
        </h3>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/50 font-mono text-xs"
            placeholder="Paste invite token..."
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAcceptToken()}
          />
          <button
            onClick={handleAcceptToken}
            disabled={!token.trim() || tokenLoading}
            className="px-3 py-2 text-sm font-medium bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {tokenLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Pending Invites</h3>
          <div className="space-y-1.5">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white truncate">{inv.inviteeEmail}</div>
                  <div className="text-xs text-muted-foreground">{inv.role} · {timeAgo(inv.createdAt)}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded text-xs bg-amber-500/20 text-amber-400">pending</span>
                  <button
                    onClick={() => handleRevoke(inv)}
                    className="p-1 text-muted-foreground hover:text-red-400 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function CollaborationHubApp() {
  const { user } = useUser();
  const userId = user?.id ?? null;
  const displayName = user?.fullName ?? user?.username ?? user?.primaryEmailAddress?.emailAddress ?? 'User';

  const [workspaces, setWorkspaces] = useState<{ owned: Workspace[]; member: Workspace[] }>({ owned: [], member: [] });
  const [loading, setLoading] = useState(true);
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceDetail | null>(null);
  const [activity, setActivity] = useState<WorkspaceActivity[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState<'members' | 'activity' | 'invites'>('members');

  const { onlineUsers } = usePresence(
    selectedWorkspace?.id ?? null,
    userId,
    displayName,
    selectedWorkspace ? `workspace:${selectedWorkspace.id}` : undefined,
  );

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

  return (
    <div className="flex h-full bg-zinc-950 text-foreground font-sans overflow-hidden">
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

      {/* ── Left sidebar: workspace list ── */}
      <div className="w-56 border-r border-white/5 flex flex-col bg-zinc-900/50">
        <div className="px-3 py-4 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-white">Workspaces</span>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="p-1 rounded-md text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
              title="New workspace"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <ScrollArea className="flex-1 px-2 py-2">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : allWorkspaces.length === 0 ? (
            <div className="text-center py-8 px-3">
              <Globe className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No workspaces yet.</p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-2 text-xs text-primary hover:underline"
              >
                Create one
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {workspaces.owned.length > 0 && (
                <>
                  <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wide px-2 pt-1 pb-1">My Workspaces</p>
                  {workspaces.owned.map((ws) => (
                    <WorkspaceCard key={ws.id} workspace={ws} isSelected={selectedWorkspace?.id === ws.id} isMine onClick={() => selectWorkspace(ws)} />
                  ))}
                </>
              )}
              {workspaces.member.length > 0 && (
                <>
                  <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wide px-2 pt-2 pb-1">Joined</p>
                  {workspaces.member.map((ws) => (
                    <WorkspaceCard key={ws.id} workspace={ws} isSelected={selectedWorkspace?.id === ws.id} isMine={false} onClick={() => selectWorkspace(ws)} />
                  ))}
                </>
              )}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* ── Center panel ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedWorkspace ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Users className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Select or create a workspace</p>
            </div>
          </div>
        ) : loadingDetail ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Workspace header */}
            <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
                style={{ backgroundColor: selectedWorkspace.color }}
              >
                {selectedWorkspace.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-white truncate">{selectedWorkspace.name}</h2>
                  <OnlineBadge count={onlineUsers.length} />
                </div>
                {selectedWorkspace.description && (
                  <p className="text-xs text-muted-foreground truncate">{selectedWorkspace.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => selectWorkspace(selectedWorkspace)}
                  className="p-1.5 text-muted-foreground hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                {isOwner ? (
                  <button
                    onClick={handleDelete}
                    className="p-1.5 text-muted-foreground hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                    title="Delete workspace"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={handleLeave}
                    className="p-1.5 text-muted-foreground hover:text-amber-400 rounded-lg hover:bg-amber-500/10 transition-colors"
                    title="Leave workspace"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/5">
              {(['members', 'activity', ...(isAdminOrOwner ? ['invites' as const] : [])] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'px-5 py-2.5 text-sm font-medium transition-colors border-b-2',
                    activeTab === tab
                      ? 'text-primary border-primary'
                      : 'text-muted-foreground border-transparent hover:text-foreground',
                  )}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <ScrollArea className="flex-1">
              {/* Members tab */}
              {activeTab === 'members' && (
                <div className="p-4 space-y-2">
                  {/* Online users */}
                  {onlineUsers.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wide mb-2">Online Now</p>
                      <div className="flex flex-wrap gap-2">
                        {onlineUsers.map((u) => (
                          <div key={u.userId} className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 rounded-full px-3 py-1 text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            {u.displayName}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wide mb-2">All Members ({selectedWorkspace.members.length})</p>
                  {selectedWorkspace.members.map((member) => (
                    <div key={member.id} className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2.5">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: selectedWorkspace.color + '80' }}
                      >
                        {member.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {member.displayName}
                          {member.userId === userId && <span className="text-muted-foreground text-xs ml-1">(you)</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">Joined {timeAgo(member.joinedAt)}</div>
                      </div>
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
                          className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-500/20 text-blue-300 border-none focus:outline-none"
                        >
                          <option value="admin">admin</option>
                          <option value="editor">editor</option>
                          <option value="viewer">viewer</option>
                        </select>
                      ) : (
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full font-medium',
                          member.role === 'owner' ? 'bg-amber-500/20 text-amber-400' :
                          member.role === 'admin' ? 'bg-purple-500/20 text-purple-400' :
                          member.role === 'editor' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-zinc-500/20 text-zinc-400',
                        )}>
                          {member.role}
                        </span>
                      )}
                      {isAdminOrOwner && member.userId !== userId && member.role !== 'owner' && !(myRole === 'admin' && member.role === 'admin') && (
                        <button
                          onClick={async () => {
                            try {
                              await collaborationApi.removeMember(selectedWorkspace.id, member.id);
                              setSelectedWorkspace((prev) => prev ? { ...prev, members: prev.members.filter((m) => m.id !== member.id) } : prev);
                              toast.success('Member removed');
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : 'Failed to remove member');
                            }
                          }}
                          className="p-1 text-muted-foreground hover:text-red-400 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Activity tab */}
              {activeTab === 'activity' && (
                <div className="p-4">
                  {activity.length === 0 ? (
                    <div className="text-center py-8">
                      <Activity className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">No activity yet</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {activity.map((act) => (
                        <div key={act.id} className="flex items-start gap-3 py-2">
                          <span className="text-lg flex-shrink-0 mt-0.5">{ACTION_ICONS[act.action] ?? '📌'}</span>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-white font-medium">{act.actorDisplayName}</span>
                            <span className="text-sm text-muted-foreground"> {activityLabel(act.action, act.contextJson)}</span>
                            <div className="text-xs text-muted-foreground/60 mt-0.5">{timeAgo(act.createdAt)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Invites tab (admin or owner) */}
              {activeTab === 'invites' && isAdminOrOwner && (
                <InvitePanel workspaceId={selectedWorkspace.id} inviterDisplayName={displayName} />
              )}
            </ScrollArea>
          </>
        )}
      </div>
    </div>
  );
}
