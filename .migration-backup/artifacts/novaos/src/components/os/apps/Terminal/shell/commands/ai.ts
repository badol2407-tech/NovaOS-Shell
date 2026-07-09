import type { CommandContext, CommandResult } from '../types';
import { resolvePath, getNodePath } from './fs';

const NOVA_HELP = `nova — Nova AI assistant in your terminal

Usage:
  nova <question or request>          Ask Nova anything
  nova explain <path>                 Explain what a file does
  nova analyze [path]                 Analyze a project/folder structure
  nova debug <error text>             Get debugging help for an error
  nova help

Examples:
  nova explain how promises work in JavaScript
  nova explain src/index.ts
  nova analyze .
  nova debug: TypeError: cannot read property of undefined
  nova write a bash script to backup my files

Nova uses your configured AI providers (Gemini, OpenAI, Anthropic, Groq,
OpenRouter, Ollama) with automatic fallback. Responses stream to the terminal.`;

/** Ask Nova with an arbitrary prompt, streaming the result into the terminal. */
async function askNova(
  prompt: string,
  emit: (line: { type: 'stdout' | 'stderr' | 'info'; content: string }) => void,
): Promise<void> {
  try {
    const response = await fetch('/api/nova/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: prompt }),
      credentials: 'include',
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Request failed' }));
      emit({ type: 'stderr', content: `Nova error: ${(err as { error?: string }).error ?? 'Unknown error'}` });
      return;
    }

    const data = (await response.json()) as { response: string; provider: string };

    const lines = data.response.split('\n');
    for (const line of lines) {
      emit({ type: 'stdout', content: line });
    }
    emit({
      type: 'info',
      content: `\x1b[info]  ─── via ${data.provider} ───\x1b[/]`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    emit({ type: 'stderr', content: `Nova: ${message}` });
  }
}

/** Recursively summarize a folder's structure for project-analysis prompts. */
function summarizeTree(
  nodes: CommandContext['nodes'],
  nodeId: string,
  depth: number,
  maxDepth: number,
  lines: string[],
): void {
  if (depth > maxDepth) return;
  const node = nodes[nodeId];
  if (!node || node.type !== 'folder') return;
  for (const childId of node.children) {
    const child = nodes[childId];
    if (!child) continue;
    lines.push(`${'  '.repeat(depth)}${child.name}${child.type === 'folder' ? '/' : ''}`);
    if (child.type === 'folder') summarizeTree(nodes, childId, depth + 1, maxDepth, lines);
  }
}

export const aiCommands = {
  nova: async (ctx: CommandContext): Promise<CommandResult> => {
    const { args, session, nodes } = ctx;
    const sub = args[0];

    if (args.length === 0 || args.join(' ').trim() === 'help') {
      return { output: [{ type: 'stdout', content: NOVA_HELP }] };
    }

    // ── nova explain <path> — developer AI: code explanation ──────────────
    // Only treats the argument as a file path when it resolves to an actual
    // file in the VFS (e.g. a single relative/absolute path token). Anything
    // else (e.g. "nova explain how promises work") falls through to the
    // free-form question handler below, matching the documented examples.
    if (sub === 'explain' && args[1]) {
      const isPathLike = args.length === 2 && !args[1].includes(' ');
      const targetId = isPathLike ? resolvePath(nodes, session.cwdId, args[1]) : null;
      const node = targetId ? nodes[targetId] : null;

      if (node && node.type === 'file') {
        const path = getNodePath(nodes, targetId!);
        const content = node.content ?? '';
        const prompt = `Explain what this file does. Cover its purpose, key functions/exports, and anything a new contributor should know.\n\nFile: ${path}\n\n\`\`\`\n${content}\n\`\`\``;

        return {
          output: [{ type: 'info', content: `\x1b[hdr]⟳ Nova is reading ${path}...\x1b[/]` }],
          asyncEffect: (emit) => askNova(prompt, emit),
        };
      }
      // Fall through to free-form question handling below.
    }

    // ── nova analyze [path] — developer AI: project analysis ──────────────
    if (sub === 'analyze') {
      const targetArg = args[1];
      const targetId = targetArg ? resolvePath(nodes, session.cwdId, targetArg) : session.cwdId;
      const node = targetId ? nodes[targetId] : null;

      if (!node || node.type !== 'folder') {
        return { output: [{ type: 'stderr', content: `nova analyze: '${targetArg ?? '.'}': Not a directory` }] };
      }

      const path = getNodePath(nodes, targetId!);
      const lines: string[] = [];
      summarizeTree(nodes, targetId!, 0, 3, lines);
      const prompt = `Analyze this project/folder structure. Identify the likely purpose, tech stack, organization patterns, and suggest any improvements.\n\nFolder: ${path}\n\nStructure:\n${lines.join('\n') || '(empty)'}`;

      return {
        output: [{ type: 'info', content: `\x1b[hdr]⟳ Nova is analyzing ${path}...\x1b[/]` }],
        asyncEffect: (emit) => askNova(prompt, emit),
      };
    }

    // ── nova debug <error text> — developer AI: debugging assistance ──────
    if (sub === 'debug') {
      const errorText = args.slice(1).join(' ').trim();
      if (!errorText) {
        return { output: [{ type: 'stderr', content: 'nova debug: provide an error message or stack trace' }] };
      }
      const prompt = `Help debug this error. Explain the likely root cause and give concrete steps to fix it:\n\n${errorText}`;

      return {
        output: [{ type: 'info', content: '\x1b[hdr]⟳ Nova is debugging...\x1b[/]' }],
        asyncEffect: (emit) => askNova(prompt, emit),
      };
    }

    // ── nova <free-form question> ──────────────────────────────────────────
    const query = args.join(' ').trim();
    return {
      output: [{ type: 'info', content: '\x1b[hdr]⟳ Nova is thinking...\x1b[/]' }],
      asyncEffect: (emit) => askNova(query, emit),
    };
  },
};
