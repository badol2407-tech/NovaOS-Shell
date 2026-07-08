import type { CommandContext, CommandResult } from '../types';

export const envCommands = {
  env(ctx: CommandContext): CommandResult {
    const { session } = ctx;
    const entries = Object.entries(session.env);
    if (entries.length === 0) {
      return { output: [{ type: 'info', content: '(no environment variables set)' }] };
    }
    return {
      output: entries
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => ({ type: 'stdout' as const, content: `${k}=${v}` })),
    };
  },

  exportVar(ctx: CommandContext): CommandResult {
    const { args, session } = ctx;
    if (args.length === 0) {
      // Print all as `export KEY=VALUE`
      return {
        output: Object.entries(session.env)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => ({ type: 'stdout' as const, content: `export ${k}="${v}"` })),
      };
    }

    const newEnv = { ...session.env };
    const errors: string[] = [];

    for (const arg of args) {
      if (arg.includes('=')) {
        const eqIdx = arg.indexOf('=');
        const key = arg.slice(0, eqIdx).trim();
        const value = arg.slice(eqIdx + 1).replace(/^["']|["']$/g, '');
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
          errors.push(`export: invalid identifier: ${key}`);
          continue;
        }
        newEnv[key] = value;
      } else {
        // Just mark as exported (already in env or no-op)
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(arg)) {
          errors.push(`export: invalid identifier: ${arg}`);
        }
      }
    }

    if (errors.length > 0) {
      return { output: errors.map((e) => ({ type: 'stderr' as const, content: e })) };
    }

    return { output: [], session: { env: newEnv } };
  },

  unset(ctx: CommandContext): CommandResult {
    const { args, session } = ctx;
    if (args.length === 0) {
      return { output: [{ type: 'stderr', content: 'unset: missing argument' }] };
    }

    const newEnv = { ...session.env };
    for (const key of args) {
      delete newEnv[key];
    }

    return { output: [], session: { env: newEnv } };
  },

  printenv(ctx: CommandContext): CommandResult {
    const { args, session } = ctx;
    if (args.length === 0) {
      return {
        output: Object.entries(session.env)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => ({ type: 'stdout' as const, content: `${k}=${v}` })),
      };
    }

    const lines: Array<{ type: 'stdout' | 'stderr'; content: string }> = [];
    for (const key of args) {
      const val = session.env[key];
      if (val !== undefined) {
        lines.push({ type: 'stdout', content: val });
      } else {
        lines.push({ type: 'stderr', content: `printenv: ${key}: not set` });
      }
    }
    return { output: lines };
  },
};
