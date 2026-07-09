import type { CommandContext, CommandResult } from '../types';

const NOVA_HELP = `nova — Nova AI assistant in your terminal

Usage:
  nova <question or request>
  nova help

Examples:
  nova explain how promises work in JavaScript
  nova how do I list all files recursively?
  nova debug: TypeError: cannot read property of undefined
  nova write a bash script to backup my files

Nova uses your configured AI providers (Gemini, Groq, OpenRouter, Ollama)
with automatic fallback. Responses stream to the terminal.`;

export const aiCommands = {
  nova: async (ctx: CommandContext): Promise<CommandResult> => {
    const query = ctx.args.join(' ').trim();

    if (!query || query === 'help') {
      return {
        output: [{ type: 'stdout', content: NOVA_HELP }],
      };
    }

    return {
      output: [
        { type: 'info', content: '\x1b[hdr]⟳ Nova is thinking...\x1b[/]' },
      ],
      asyncEffect: async (emit) => {
        try {
          const response = await fetch('/api/nova/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: query }),
            credentials: 'include',
          });

          if (!response.ok) {
            const err = await response.json().catch(() => ({ error: 'Request failed' }));
            emit({ type: 'stderr', content: `Nova error: ${(err as { error?: string }).error ?? 'Unknown error'}` });
            return;
          }

          const data = await response.json() as { response: string; provider: string };

          // Split response into lines and emit each
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
      },
    };
  },
};
