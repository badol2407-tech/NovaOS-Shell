import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Plus, Trash2, Send, ChevronRight, Loader2, Bot, User, AlertCircle, Cpu, Zap, Globe, Server, Settings2, X, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  useListNovaConversations,
  useCreateNovaConversation,
  useDeleteNovaConversation,
  useListNovaMessages,
  useGetNovaProviderStatus,
  useGetNovaPreferences,
  useUpdateNovaPreferences,
  getListNovaConversationsQueryKey,
  getListNovaMessagesQueryKey,
  getGetNovaPreferencesQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import type { NovaConversation, NovaMessage } from '@workspace/api-client-react';

// ── Simple inline markdown renderer ────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let codeBlock: string[] = [];
  let inCode = false;
  let codeLang = '';
  let key = 0;

  for (const line of lines) {
    const codeMatch = line.match(/^```(\w*)$/);
    if (codeMatch) {
      if (inCode) {
        elements.push(
          <pre key={key++} className="my-2 rounded-lg bg-black/40 border border-white/10 p-3 overflow-x-auto text-xs font-mono text-emerald-300 leading-relaxed">
            <div className="text-white/30 text-[10px] mb-1">{codeLang || 'code'}</div>
            <code>{codeBlock.join('\n')}</code>
          </pre>
        );
        codeBlock = [];
        inCode = false;
        codeLang = '';
      } else {
        inCode = true;
        codeLang = codeMatch[1] ?? '';
      }
      continue;
    }
    if (inCode) {
      codeBlock.push(line);
      continue;
    }

    // Inline code, bold
    const parts = line.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    const inline = parts.map((part, i) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} className="px-1 py-0.5 rounded bg-black/30 text-emerald-300 text-xs font-mono">{part.slice(1, -1)}</code>;
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
      }
      return part;
    });

    elements.push(
      <p key={key++} className={cn('leading-relaxed', line === '' && 'h-3')}>
        {inline}
      </p>
    );
  }

  return elements;
}

// ── Provider badge ──────────────────────────────────────────────────────────

const PROVIDER_CONFIG: Record<string, { label: string; color: string; Icon: React.ComponentType<{ className?: string }> }> = {
  gemini:      { label: 'Gemini',      color: 'text-blue-400',    Icon: Sparkles },
  openai:      { label: 'OpenAI',      color: 'text-emerald-400', Icon: Bot },
  anthropic:   { label: 'Anthropic',   color: 'text-amber-400',   Icon: Brain },
  groq:        { label: 'Groq',        color: 'text-orange-400',  Icon: Zap },
  openrouter:  { label: 'OpenRouter',  color: 'text-purple-400',  Icon: Globe },
  ollama:      { label: 'Ollama',      color: 'text-green-400',   Icon: Server },
};

function ProviderBadge({ provider }: { provider: string }) {
  const cfg = PROVIDER_CONFIG[provider] ?? { label: provider, color: 'text-white/40', Icon: Cpu };
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium', cfg.color)}>
      <cfg.Icon className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  );
}

// ── Message bubble ──────────────────────────────────────────────────────────

interface MessageBubbleProps {
  role: string;
  content: string;
  provider?: string | null;
  isStreaming?: boolean;
}

function MessageBubble({ role, content, provider, isStreaming }: MessageBubbleProps) {
  const isUser = role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      <div className={cn(
        'shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-1',
        isUser ? 'bg-primary/20 border border-primary/30' : 'bg-white/10 border border-white/10'
      )}>
        {isUser ? <User className="w-3.5 h-3.5 text-primary" /> : <Bot className="w-3.5 h-3.5 text-white/70" />}
      </div>

      <div className={cn('max-w-[80%] space-y-1', isUser ? 'items-end' : 'items-start', 'flex flex-col')}>
        <div className={cn(
          'rounded-2xl px-4 py-2.5 text-sm text-white/90 leading-relaxed',
          isUser
            ? 'bg-primary/20 border border-primary/20 rounded-tr-sm'
            : 'bg-white/8 border border-white/10 rounded-tl-sm'
        )}>
          {isUser ? <p className="leading-relaxed">{content}</p> : (
            <div className="prose-sm space-y-1">
              {renderMarkdown(content)}
              {isStreaming && (
                <span className="inline-block w-2 h-4 bg-primary/60 animate-pulse rounded-sm ml-0.5" />
              )}
            </div>
          )}
        </div>

        {!isUser && provider && !isStreaming && (
          <div className="px-1">
            <ProviderBadge provider={provider} />
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Conversation list item ──────────────────────────────────────────────────

interface ConvItemProps {
  conv: NovaConversation;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function ConvItem({ conv, active, onSelect, onDelete }: ConvItemProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      onClick={onSelect}
      className={cn(
        'group relative flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 text-sm',
        active
          ? 'bg-primary/15 border border-primary/20 text-white'
          : 'hover:bg-white/8 border border-transparent text-white/60 hover:text-white/80'
      )}
    >
      <Sparkles className={cn('shrink-0 w-3.5 h-3.5', active ? 'text-primary' : 'text-white/30')} />
      <span className="flex-1 truncate text-xs leading-tight">{conv.title}</span>
      {active && <ChevronRight className="shrink-0 w-3 h-3 text-primary/60" />}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 hover:text-red-400 transition-all"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </motion.div>
  );
}

// ── Welcome screen ─────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'Explain async/await with a practical example',
  'How do I use git rebase interactively?',
  'Write a TypeScript type for a deep partial',
  'What are the best practices for REST API design?',
  'Debug this: Cannot read properties of undefined',
];

function WelcomeScreen({ onSuggestion }: { onSuggestion: (s: string) => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-6">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center"
      >
        <Sparkles className="w-8 h-8 text-primary" />
      </motion.div>
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Hello, I'm Nova</h2>
        <p className="text-sm text-white/50">Your intelligent OS assistant. Ask me anything.</p>
      </div>
      <div className="w-full max-w-sm space-y-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSuggestion(s)}
            className="w-full text-left text-xs px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80 transition-all"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main app component ───────────────────────────────────────────────────────

interface StreamingMessage {
  content: string;
  provider: string;
}

export default function NovaAIApp() {
  const qc = useQueryClient();
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [streamingMsg, setStreamingMsg] = useState<StreamingMessage | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: conversations = [], isLoading: convsLoading } = useListNovaConversations();
  const { data: messages = [], isLoading: msgsLoading } = useListNovaMessages(
    activeConvId ?? '',
    { query: { enabled: Boolean(activeConvId), queryKey: getListNovaMessagesQueryKey(activeConvId ?? '') } }
  );
  const { data: providerStatus } = useGetNovaProviderStatus();
  const { data: preferences } = useGetNovaPreferences();
  const updatePreferences = useUpdateNovaPreferences({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetNovaPreferencesQueryKey() }),
    },
  });

  const createConv = useCreateNovaConversation({
    mutation: {
      onSuccess: (conv) => {
        qc.invalidateQueries({ queryKey: getListNovaConversationsQueryKey() });
        setActiveConvId(conv.id);
      },
    },
  });

  const deleteConv = useDeleteNovaConversation({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListNovaConversationsQueryKey() });
        if (conversations.length <= 1) setActiveConvId(null);
      },
    },
  });

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMsg]);

  // Auto-resize textarea
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  }, []);

  const handleNewConversation = useCallback(async () => {
    createConv.mutate({ data: { title: 'New Conversation', model: 'auto' } });
  }, [createConv]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isStreaming) return;

    let convId = activeConvId;

    // Create a conversation if none is active
    if (!convId) {
      try {
        const created = await new Promise<NovaConversation>((resolve, reject) => {
          createConv.mutate(
            { data: { title: content.slice(0, 60), model: 'auto' } },
            { onSuccess: resolve, onError: reject }
          );
        });
        convId = created.id;
        setActiveConvId(created.id);
        qc.invalidateQueries({ queryKey: getListNovaConversationsQueryKey() });
      } catch {
        setStreamError('Failed to create conversation');
        return;
      }
    }

    setInput('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
    setStreamError(null);
    setIsStreaming(true);
    setStreamingMsg({ content: '', provider: '' });

    try {
      const response = await fetch(`/api/nova/conversations/${convId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
        credentials: 'include',
      });

      if (!response.ok || !response.body) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6)) as {
              type: string;
              content?: string;
              provider?: string;
              error?: string;
            };
            if (evt.type === 'chunk' && evt.content) {
              setStreamingMsg((prev) => ({
                content: (prev?.content ?? '') + evt.content,
                provider: prev?.provider ?? '',
              }));
            } else if (evt.type === 'done') {
              setStreamingMsg((prev) => ({
                content: prev?.content ?? '',
                provider: evt.provider ?? 'unknown',
              }));
            } else if (evt.type === 'error') {
              setStreamError(evt.error ?? 'Unknown error from AI provider');
            }
          } catch {
            // Malformed SSE line — skip
          }
        }
      }
    } catch (err) {
      setStreamError(err instanceof Error ? err.message : 'Stream failed');
    } finally {
      setIsStreaming(false);
      setStreamingMsg(null);
      // Refresh messages + conversation list
      qc.invalidateQueries({ queryKey: getListNovaMessagesQueryKey(convId!) });
      qc.invalidateQueries({ queryKey: getListNovaConversationsQueryKey() });
      inputRef.current?.focus();
    }
  }, [activeConvId, isStreaming, createConv, qc]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }, [input, sendMessage]);

  // Combine persisted messages with the in-flight streaming one
  const allMessages: Array<{ id: string | number; role: string; content: string; provider?: string | null; isStreaming?: boolean }> = [
    ...messages.map((m: NovaMessage) => ({ id: m.id, role: m.role, content: m.content, provider: m.provider })),
    ...(isStreaming && streamingMsg
      ? [{ id: 'streaming', role: 'assistant', content: streamingMsg.content, provider: streamingMsg.provider || null, isStreaming: true }]
      : []),
  ];

  const availableProviders = providerStatus?.providers.filter((p) => p.available) ?? [];

  return (
    <div className="flex h-full w-full overflow-hidden bg-black/10">
      {/* ── Sidebar ── */}
      <div className="w-56 shrink-0 flex flex-col border-r border-white/10 bg-black/10">
        {/* Header */}
        <div className="p-3 border-b border-white/10 flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold text-white flex-1">Nova AI</span>
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className={cn(
              'p-1.5 rounded-lg transition-all',
              settingsOpen ? 'bg-primary/20 text-primary' : 'text-white/40 hover:text-white/70 hover:bg-white/10'
            )}
            title="Nova AI settings"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Provider status chips */}
        {availableProviders.length > 0 && (
          <div className="px-3 py-2 flex flex-wrap gap-1 border-b border-white/10">
            {availableProviders.map((p) => (
              <ProviderBadge key={p.name} provider={p.name} />
            ))}
          </div>
        )}

        {/* Settings panel */}
        <AnimatePresence>
          {settingsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-b border-white/10"
            >
              <div className="p-3 space-y-3 bg-black/10">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-white/60">Preferred provider</span>
                  <button onClick={() => setSettingsOpen(false)} className="text-white/30 hover:text-white/60">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <select
                  value={preferences?.preferredProvider ?? ''}
                  onChange={(e) =>
                    updatePreferences.mutate({
                      data: { preferredProvider: e.target.value || null },
                    })
                  }
                  className="w-full bg-white/8 border border-white/15 rounded-lg px-2 py-1.5 text-xs text-white/80 focus:outline-none focus:border-primary/40"
                >
                  <option value="">Auto (fallback chain)</option>
                  {(providerStatus?.providers ?? []).map((p) => (
                    <option key={p.name} value={p.name} disabled={!p.available}>
                      {(PROVIDER_CONFIG[p.name]?.label ?? p.name) + (p.available ? '' : ' (not configured)')}
                    </option>
                  ))}
                </select>

                <div>
                  <span className="text-[11px] font-medium text-white/60">Response style</span>
                  <div className="mt-1.5 flex gap-1.5">
                    {(['concise', 'balanced', 'detailed'] as const).map((style) => (
                      <button
                        key={style}
                        onClick={() => updatePreferences.mutate({ data: { responseStyle: style } })}
                        className={cn(
                          'flex-1 text-[11px] py-1 rounded-md border transition-all capitalize',
                          preferences?.responseStyle === style
                            ? 'bg-primary/20 border-primary/30 text-primary'
                            : 'bg-white/5 border-white/10 text-white/50 hover:text-white/70'
                        )}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* New chat button */}
        <div className="p-2 border-b border-white/10">
          <button
            onClick={handleNewConversation}
            disabled={createConv.isPending}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all text-xs text-primary font-medium"
          >
            {createConv.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            New Chat
          </button>
        </div>

        {/* Conversation list */}
        <ScrollArea className="flex-1 p-2">
          {convsLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-white/30" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-center text-xs text-white/30 py-6">No conversations yet</p>
          ) : (
            <AnimatePresence>
              {conversations.map((conv: NovaConversation) => (
                <ConvItem
                  key={conv.id}
                  conv={conv}
                  active={conv.id === activeConvId}
                  onSelect={() => setActiveConvId(conv.id)}
                  onDelete={() => deleteConv.mutate({ conversationId: conv.id })}
                />
              ))}
            </AnimatePresence>
          )}
        </ScrollArea>
      </div>

      {/* ── Chat area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        {activeConvId && (
          <div className="px-4 py-2.5 border-b border-white/10 flex items-center gap-2 bg-black/5">
            <Sparkles className="w-4 h-4 text-primary/60" />
            <span className="text-sm text-white/70 truncate">
              {conversations.find((c: NovaConversation) => c.id === activeConvId)?.title ?? 'Conversation'}
            </span>
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1 px-4 py-4">
          {!activeConvId ? (
            <WelcomeScreen onSuggestion={(s) => { setInput(s); inputRef.current?.focus(); }} />
          ) : msgsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-white/30" />
            </div>
          ) : (
            <div className="space-y-4 max-w-2xl mx-auto">
              {allMessages.length === 0 && !isStreaming ? (
                <WelcomeScreen onSuggestion={(s) => { setInput(s); inputRef.current?.focus(); }} />
              ) : (
                allMessages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    role={m.role}
                    content={m.content}
                    provider={m.provider}
                    isStreaming={m.isStreaming}
                  />
                ))
              )}

              {streamError && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs"
                >
                  <AlertCircle className="shrink-0 w-3.5 h-3.5 mt-0.5" />
                  <span>{streamError}</span>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input bar */}
        <div className="p-3 border-t border-white/10 bg-black/10">
          <div className="max-w-2xl mx-auto flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                disabled={isStreaming}
                placeholder={isStreaming ? 'Nova is responding…' : 'Ask Nova anything… (Shift+Enter for newline)'}
                rows={1}
                className="w-full resize-none bg-white/8 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:border-primary/40 focus:bg-white/10 transition-all leading-relaxed"
                style={{ minHeight: '40px', maxHeight: '120px' }}
              />
            </div>
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isStreaming}
              className="shrink-0 w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary hover:bg-primary/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              {isStreaming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
