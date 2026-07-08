/**
 * PreviewPanel
 *
 * Right-side preview panel for the File Manager. Shows file metadata and
 * renders content based on MIME type:
 *  - Text / Markdown / CSV → styled text with basic formatting
 *  - JSON                  → pretty-printed with syntax coloring
 *  - Code (JS/TS/HTML/CSS) → keyword-highlighted source
 *  - Image / Video / Audio → icon + media metadata
 *  - Binary / Unknown      → icon + metadata only
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Info,
  FileText,
  Star,
  StarOff,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Tag,
  Calendar,
  HardDrive,
  Clock,
  FolderOpen,
} from 'lucide-react';
import { useFileManager } from '../FileManagerProvider';
import { FileIcon } from './FileIcon';
import { VFSNode } from '../types';
import { formatSize, formatDate, getPath } from '../vfs';
import { cn } from '@/lib/utils';

// ─── Syntax Highlighters ─────────────────────────────────────────────────────

/** Minimal JSON tokenizer — no external deps. */
function JsonHighlight({ source }: { source: string }) {
  let formatted = source;
  try {
    formatted = JSON.stringify(JSON.parse(source), null, 2);
  } catch {
    // show raw on parse failure
  }

  const tokens = formatted.split(
    /(\"(?:[^\"\\]|\\.)*\"(?=\s*:))|(\:\s*\"(?:[^\"\\]|\\.)*\")|(:\s*-?\d+\.?\d*)|(\btrue\b|\bfalse\b|\bnull\b)|(\"(?:[^\"\\]|\\.)*\")/g
  );

  return (
    <code className="text-[11px] leading-5 font-mono whitespace-pre-wrap break-all">
      {tokens.map((tok, i) => {
        if (!tok) return null;
        if (/^\"[^\"]*\"\s*$/.test(tok) && i > 0 && tokens[i - 2]?.endsWith(':')) {
          return <span key={i} className="text-emerald-400">{tok}</span>;
        }
        if (/^\"[^\"]*\"(?=\s*:)/.test(tok)) {
          return <span key={i} className="text-sky-400">{tok}</span>;
        }
        if (/^:\s*\"/.test(tok)) {
          return (
            <span key={i}>
              <span className="text-muted-foreground">: </span>
              <span className="text-emerald-400">{tok.slice(tok.indexOf('"'))}</span>
            </span>
          );
        }
        if (/^:\s*-?\d/.test(tok)) {
          return (
            <span key={i}>
              <span className="text-muted-foreground">: </span>
              <span className="text-amber-400">{tok.replace(/^:\s*/, '')}</span>
            </span>
          );
        }
        if (/^(true|false|null)$/.test(tok)) {
          return <span key={i} className="text-purple-400">{tok}</span>;
        }
        if (/^\"/.test(tok)) {
          return <span key={i} className="text-emerald-400">{tok}</span>;
        }
        return <span key={i} className="text-foreground/80">{tok}</span>;
      })}
    </code>
  );
}

const TS_KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
  'class', 'import', 'export', 'default', 'from', 'type', 'interface', 'extends',
  'implements', 'new', 'this', 'async', 'await', 'try', 'catch', 'throw',
  'true', 'false', 'null', 'undefined', 'void', 'string', 'number', 'boolean',
  'readonly', 'public', 'private', 'protected', 'static', 'abstract',
]);

function CodeHighlight({ source, lang }: { source: string; lang: string }) {
  const lines = source.split('\n');
  return (
    <code className="text-[11px] leading-5 font-mono">
      {lines.map((line, li) => (
        <div key={li} className="flex">
          <span className="select-none w-8 text-right pr-3 text-muted-foreground/40 flex-shrink-0 text-[10px]">
            {li + 1}
          </span>
          <span className="flex-1 whitespace-pre-wrap break-all">
            {tokenizeLine(line, lang)}
          </span>
        </div>
      ))}
    </code>
  );
}

function tokenizeLine(line: string, lang: string): React.ReactNode {
  // Strip trailing newline
  const parts: React.ReactNode[] = [];
  let remaining = line;
  let key = 0;

  // Single-line comments
  if (/^\s*(\/\/|#)/.test(remaining)) {
    return <span className="text-muted-foreground/60 italic">{remaining}</span>;
  }

  // Simple tokenizer: strings → keywords → numbers → rest
  const tokenRe = /(\"(?:[^\"\\]|\\.)*\"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\/\/.*$)|(#.*$)|(\b\d+\.?\d*\b)|(\b\w+\b)|(.)/g;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(remaining)) !== null) {
    const [full, str, lineComment, hash, num, word] = m;
    if (str) {
      parts.push(<span key={key++} className="text-emerald-400">{str}</span>);
    } else if (lineComment || hash) {
      parts.push(<span key={key++} className="text-muted-foreground/60 italic">{full}</span>);
    } else if (num) {
      parts.push(<span key={key++} className="text-amber-400">{num}</span>);
    } else if (word && TS_KEYWORDS.has(word)) {
      parts.push(<span key={key++} className="text-purple-400">{word}</span>);
    } else if (word && /^[A-Z]/.test(word)) {
      parts.push(<span key={key++} className="text-sky-400">{word}</span>);
    } else {
      parts.push(<span key={key++} className="text-foreground/80">{full}</span>);
    }
  }
  return <>{parts}</>;
}

/** Minimal Markdown renderer — headers, bold, italic, code blocks, lists */
function MarkdownPreview({ source }: { source: string }) {
  const blocks = source.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let listItems: React.ReactNode[] = [];
  let inCode = false;
  let codeLines: string[] = [];
  let codeLang = '';

  function flushList() {
    if (listItems.length) {
      elements.push(
        <ul key={`list-${i}`} className="list-disc pl-4 space-y-0.5 mb-2">
          {listItems}
        </ul>
      );
      listItems = [];
    }
  }

  while (i < blocks.length) {
    const line = blocks[i];

    // Code fence
    if (line.startsWith('```')) {
      if (!inCode) {
        flushList();
        inCode = true;
        codeLang = line.slice(3).trim();
        codeLines = [];
      } else {
        inCode = false;
        const codeContent = codeLines.join('\n');
        elements.push(
          <pre key={`code-${i}`} className="bg-muted/60 rounded-lg p-2 mb-2 overflow-x-auto">
            {codeLang === 'json'
              ? <JsonHighlight source={codeContent} />
              : <CodeHighlight source={codeContent} lang={codeLang || 'ts'} />}
          </pre>
        );
      }
      i++;
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      i++;
      continue;
    }

    // Headings
    const h3 = line.match(/^### (.+)/);
    const h2 = line.match(/^## (.+)/);
    const h1 = line.match(/^# (.+)/);
    if (h1) { flushList(); elements.push(<h1 key={i} className="text-base font-bold mb-1.5 text-foreground border-b border-border pb-1">{h1[1]}</h1>); i++; continue; }
    if (h2) { flushList(); elements.push(<h2 key={i} className="text-sm font-semibold mt-3 mb-1 text-foreground">{h2[1]}</h2>); i++; continue; }
    if (h3) { flushList(); elements.push(<h3 key={i} className="text-xs font-semibold mt-2 mb-0.5 text-foreground/80">{h3[1]}</h3>); i++; continue; }

    // Horizontal rule
    if (/^---+$/.test(line)) { flushList(); elements.push(<hr key={i} className="border-border my-2" />); i++; continue; }

    // List items
    const listMatch = line.match(/^[-*]\s+(.+)/);
    const taskMatch = line.match(/^[-*]\s+\[([ x])\]\s+(.+)/);
    if (taskMatch) {
      listItems.push(
        <li key={i} className="flex items-start gap-1.5 text-[11px]">
          <span className={cn('mt-0.5', taskMatch[1] === 'x' ? 'text-primary' : 'text-muted-foreground')}>
            {taskMatch[1] === 'x' ? '✓' : '○'}
          </span>
          <span className={taskMatch[1] === 'x' ? 'line-through text-muted-foreground' : ''}>{taskMatch[2]}</span>
        </li>
      );
      i++;
      continue;
    }
    if (listMatch) {
      listItems.push(
        <li key={i} className="text-[11px] text-foreground/80">{inlineFormat(listMatch[1])}</li>
      );
      i++;
      continue;
    }

    flushList();

    // Blockquote
    const bq = line.match(/^>\s*(.*)/);
    if (bq) {
      elements.push(
        <blockquote key={i} className="border-l-2 border-primary/40 pl-2 my-1 text-[11px] text-muted-foreground italic">
          {bq[1]}
        </blockquote>
      );
      i++;
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      elements.push(<div key={i} className="h-1.5" />);
      i++;
      continue;
    }

    // Paragraph
    elements.push(
      <p key={i} className="text-[11px] leading-5 text-foreground/80 mb-1">
        {inlineFormat(line)}
      </p>
    );
    i++;
  }

  flushList();
  return <div className="space-y-0.5">{elements}</div>;
}

function inlineFormat(text: string): React.ReactNode {
  // Bold, italic, inline code
  const parts: React.ReactNode[] = [];
  const re = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={k++}>{text.slice(last, m.index)}</span>);
    if (m[1]) parts.push(<strong key={k++} className="font-semibold text-foreground">{m[2]}</strong>);
    else if (m[3]) parts.push(<em key={k++} className="italic">{m[4]}</em>);
    else if (m[5]) parts.push(<code key={k++} className="bg-muted/60 px-1 rounded text-[10px] font-mono text-sky-400">{m[6]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(<span key={k++}>{text.slice(last)}</span>);
  return parts.length > 0 ? <>{parts}</> : text;
}

// ─── Metadata Row ─────────────────────────────────────────────────────────────

function MetaRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="text-muted-foreground flex-shrink-0 mt-px">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider leading-none mb-0.5">{label}</div>
        <div className="text-[11px] text-foreground/80 break-words leading-tight">{value}</div>
      </div>
    </div>
  );
}

// ─── Image Preview ────────────────────────────────────────────────────────────

function ImagePreview({ node }: { node: VFSNode }) {
  const [zoom, setZoom] = useState(1);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative bg-muted/30 rounded-xl overflow-hidden flex items-center justify-center h-44 group">
        {/* Simulated image — show large icon with a gradient bg since VFS has no real bytes */}
        <div
          className="flex flex-col items-center justify-center gap-2 transition-transform duration-200"
          style={{ transform: `scale(${zoom})` }}
        >
          <FileIcon node={node} size={64} />
          <span className="text-[10px] text-muted-foreground font-mono">{node.name}</span>
        </div>
        {/* Zoom controls */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))}
            className="w-6 h-6 rounded-md bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60"
          >
            <ZoomOut size={12} />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="px-1.5 h-6 rounded-md bg-black/40 backdrop-blur-sm flex items-center justify-center text-white text-[10px] hover:bg-black/60"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)))}
            className="w-6 h-6 rounded-md bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60"
          >
            <ZoomIn size={12} />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="w-6 h-6 rounded-md bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60"
          >
            <RotateCcw size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Media Preview ────────────────────────────────────────────────────────────

function MediaPreview({ node }: { node: VFSNode }) {
  const isAudio = node.mimeCategory === 'audio';
  return (
    <div className="bg-muted/30 rounded-xl flex flex-col items-center justify-center gap-3 py-8">
      <div className={cn(
        'w-16 h-16 rounded-2xl flex items-center justify-center',
        isAudio ? 'bg-emerald-500/10' : 'bg-purple-500/10'
      )}>
        <FileIcon node={node} size={36} />
      </div>
      <div className="text-center">
        <p className="text-xs font-medium text-foreground">{node.name}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {isAudio ? 'Audio file' : 'Video file'} · {formatSize(node.size)}
        </p>
      </div>
      <div className="text-[10px] text-muted-foreground/60 italic">
        Preview not available for virtual files
      </div>
    </div>
  );
}

// ─── Text / Code / Markdown preview ──────────────────────────────────────────

function ContentPreview({ node }: { node: VFSNode }) {
  const { content, mimeType, mimeCategory } = node;

  if (!content) {
    return (
      <div className="bg-muted/30 rounded-xl flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
        <FileIcon node={node} size={32} />
        <p className="text-[11px]">No preview available</p>
      </div>
    );
  }

  if (mimeType === 'application/json') {
    return (
      <pre className="bg-muted/40 rounded-xl p-3 overflow-auto max-h-64 text-left">
        <JsonHighlight source={content} />
      </pre>
    );
  }

  if (mimeType === 'text/markdown') {
    return (
      <div className="bg-muted/20 rounded-xl p-3 overflow-auto max-h-64">
        <MarkdownPreview source={content} />
      </div>
    );
  }

  if (mimeCategory === 'code' || mimeType.includes('typescript') || mimeType.includes('javascript')) {
    const lang = mimeType.includes('json') ? 'json'
      : mimeType.includes('html') ? 'html'
      : mimeType.includes('css') ? 'css'
      : mimeType.includes('python') ? 'python'
      : 'ts';
    return (
      <pre className="bg-muted/40 rounded-xl p-3 overflow-auto max-h-64 text-left">
        <CodeHighlight source={content} lang={lang} />
      </pre>
    );
  }

  // Plain text / CSV / etc.
  return (
    <pre className="bg-muted/30 rounded-xl p-3 overflow-auto max-h-64 text-[11px] font-mono text-foreground/80 whitespace-pre-wrap break-words">
      {content}
    </pre>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Tab = 'preview' | 'info';

export function PreviewPanel() {
  const { state, togglePreview, toggleFavorite } = useFileManager();
  const { selectedIds, nodes, previewOpen } = state;
  const [tab, setTab] = useState<Tab>('preview');

  const selectedNode = useMemo<VFSNode | null>(() => {
    if (selectedIds.length !== 1) return null;
    return nodes[selectedIds[0]] ?? null;
  }, [selectedIds, nodes]);

  const filePath = useMemo(() => {
    if (!selectedNode) return '';
    return getPath(nodes, selectedNode.id)
      .map(n => n.name)
      .join(' › ');
  }, [selectedNode, nodes]);

  const hasContent = selectedNode?.type === 'file' && !!(selectedNode.content);
  const isMedia = selectedNode?.mimeCategory === 'audio' || selectedNode?.mimeCategory === 'video';
  const isImage = selectedNode?.mimeCategory === 'image';

  return (
    <AnimatePresence>
      {previewOpen && (
        <motion.aside
          key="preview-panel"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 280, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 38, mass: 0.8 }}
          className="flex-shrink-0 overflow-hidden border-l border-border bg-card/40 backdrop-blur-sm flex flex-col"
          style={{ minWidth: 0 }}
        >
          <div className="w-[280px] flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 flex-shrink-0">
              <div className="flex rounded-lg bg-muted/60 p-0.5 gap-0.5">
                {(['preview', 'info'] as Tab[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-[11px] font-medium transition-all capitalize',
                      tab === t
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <button
                onClick={togglePreview}
                className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={13} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {!selectedNode ? (
                <EmptyState />
              ) : (
                <div className="p-3 space-y-3">
                  {/* File identity */}
                  <div className="flex flex-col items-center gap-2 py-2">
                    <div className="w-16 h-16 flex items-center justify-center">
                      <FileIcon
                        node={selectedNode}
                        size={selectedNode.type === 'folder' ? 52 : 44}
                      />
                    </div>
                    <div className="text-center w-full">
                      <p className="text-xs font-semibold text-foreground leading-tight break-words px-2">
                        {selectedNode.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">
                        {selectedNode.type === 'folder' ? 'Folder' : selectedNode.mimeCategory}
                        {selectedNode.type === 'file' && selectedNode.size > 0 && ` · ${formatSize(selectedNode.size)}`}
                      </p>
                    </div>

                    {/* Favorite toggle */}
                    <button
                      onClick={() => toggleFavorite(selectedNode.id)}
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors',
                        selectedNode.isFavorite
                          ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
                          : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'
                      )}
                    >
                      {selectedNode.isFavorite ? (
                        <><StarOff size={11} /> Remove from Favorites</>
                      ) : (
                        <><Star size={11} /> Add to Favorites</>
                      )}
                    </button>
                  </div>

                  {/* Preview tab content */}
                  {tab === 'preview' && (
                    <div className="space-y-2">
                      {isImage && <ImagePreview node={selectedNode} />}
                      {isMedia && <MediaPreview node={selectedNode} />}
                      {!isImage && !isMedia && selectedNode.type === 'file' && (
                        <ContentPreview node={selectedNode} />
                      )}
                      {selectedNode.type === 'folder' && (
                        <FolderPreview node={selectedNode} />
                      )}
                    </div>
                  )}

                  {/* Info tab content */}
                  {tab === 'info' && (
                    <div className="space-y-0.5 divide-y divide-border/30">
                      <MetaRow
                        icon={<HardDrive size={12} />}
                        label="Size"
                        value={selectedNode.type === 'file'
                          ? (selectedNode.size > 0 ? formatSize(selectedNode.size) : 'Empty')
                          : '—'}
                      />
                      <MetaRow
                        icon={<Info size={12} />}
                        label="Type"
                        value={
                          selectedNode.type === 'folder'
                            ? 'Folder'
                            : selectedNode.mimeType
                        }
                      />
                      <MetaRow
                        icon={<Calendar size={12} />}
                        label="Created"
                        value={formatDate(selectedNode.createdAt)}
                      />
                      <MetaRow
                        icon={<Clock size={12} />}
                        label="Modified"
                        value={formatDate(selectedNode.modifiedAt)}
                      />
                      <MetaRow
                        icon={<FolderOpen size={12} />}
                        label="Path"
                        value={filePath}
                      />
                      {selectedNode.tags && selectedNode.tags.length > 0 && (
                        <div className="py-1.5">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Tag size={12} className="text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Tags</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {selectedNode.tags.map(tag => (
                              <span
                                key={tag}
                                className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-medium"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center text-muted-foreground">
      <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center">
        <FileText size={24} className="opacity-30" />
      </div>
      <div>
        <p className="text-xs font-medium">No file selected</p>
        <p className="text-[10px] mt-0.5 opacity-60">Select a file to see its preview and info</p>
      </div>
    </div>
  );
}

function FolderPreview({ node }: { node: VFSNode }) {
  const { state } = useFileManager();
  const childCount = node.children.length;
  const children = node.children.map(id => state.nodes[id]).filter(Boolean);
  const folderCount = children.filter(n => n?.type === 'folder').length;
  const fileCount = children.filter(n => n?.type === 'file').length;

  return (
    <div className="bg-muted/30 rounded-xl p-3 space-y-2">
      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Contents</p>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Items', value: String(childCount) },
          { label: 'Folders', value: String(folderCount) },
          { label: 'Files', value: String(fileCount) },
          { label: 'Favorite', value: node.isFavorite ? 'Yes' : 'No' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-background/50 rounded-lg p-2 text-center">
            <p className="text-base font-bold text-foreground">{value}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
