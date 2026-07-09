import type { CommandContext, CommandResult } from '../types';

// Very simple JS evaluator for common demo patterns
function safeEval(code: string): { output: string; isError: boolean } {
  // Intercept console.log
  const logs: string[] = [];
  const fakeConsole = { log: (...args: unknown[]) => logs.push(args.map(String).join(' ')), error: (...args: unknown[]) => logs.push(args.map(String).join(' ')), warn: (...args: unknown[]) => logs.push(args.map(String).join(' ')), info: (...args: unknown[]) => logs.push(args.map(String).join(' ')) };

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('console', 'Math', 'Date', 'JSON', 'Array', 'Object', 'String', 'Number', 'Boolean', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', code);
    const result = fn(fakeConsole, Math, Date, JSON, Array, Object, String, Number, Boolean, parseInt, parseFloat, isNaN, isFinite);
    if (logs.length > 0) return { output: logs.join('\n'), isError: false };
    if (result !== undefined) return { output: String(result), isError: false };
    return { output: '', isError: false };
  } catch (e) {
    return { output: e instanceof Error ? e.message : String(e), isError: true };
  }
}

export const nodeCommands = {
  node(ctx: CommandContext): CommandResult {
    const { args, nodes, session } = ctx;

    if (args.length === 0 || args[0] === 'repl') {
      return {
        output: [
          { type: 'info', content: 'Welcome to Node.js v20 REPL (simulated)' },
          { type: 'info', content: 'Type JavaScript expressions. Enter an empty line to exit.' },
          { type: 'stdout', content: '> ' },
        ],
      };
    }

    if (args[0] === '-e' || args[0] === '--eval') {
      const code = args.slice(1).join(' ');
      if (!code) return { output: [{ type: 'stderr', content: 'node: -e requires an argument' }] };
      const { output, isError } = safeEval(code);
      if (!output) return { output: [] };
      return {
        output: output.split('\n').map((line) => ({
          type: isError ? 'stderr' as const : 'stdout' as const,
          content: line,
        })),
      };
    }

    if (args[0] === '--version' || args[0] === '-v') {
      return { output: [{ type: 'stdout', content: 'v20.11.0' }] };
    }

    // Try to run a file
    const filename = args[0];
    const cwd = nodes[session.cwdId];
    const fileNode = cwd?.children.map((id) => nodes[id]).find((n) => n?.name === filename);

    if (!fileNode) {
      return { output: [{ type: 'stderr', content: `node: cannot open file '${filename}': No such file or directory` }] };
    }

    if (fileNode.type !== 'file') {
      return { output: [{ type: 'stderr', content: `node: '${filename}' is not a file` }] };
    }

    const code = fileNode.content ?? '';
    if (!code.trim()) return { output: [] };

    const { output, isError } = safeEval(code);
    if (!output) return { output: [] };

    return {
      output: output.split('\n').map((line) => ({
        type: isError ? 'stderr' as const : 'stdout' as const,
        content: line,
      })),
    };
  },
};
