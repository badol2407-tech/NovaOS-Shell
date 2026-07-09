import type { CommandContext, CommandResult } from '../types';
import { fsCommands } from './fs';
import { basicCommands } from './basic';
import { npmCommands } from './npm';
import { gitCommands } from './git';
import { nodeCommands } from './node';
import { envCommands } from './env';
import { aiCommands } from './ai';

export type CommandHandler = (ctx: CommandContext) => CommandResult | Promise<CommandResult>;

export const COMMANDS: Record<string, CommandHandler> = {
  // Filesystem
  ls: fsCommands.ls,
  dir: fsCommands.ls,
  cd: fsCommands.cd,
  pwd: fsCommands.pwd,
  mkdir: fsCommands.mkdir,
  touch: fsCommands.touch,
  rm: fsCommands.rm,
  mv: fsCommands.mv,
  cp: fsCommands.cp,
  cat: fsCommands.cat,
  tree: fsCommands.tree,
  find: fsCommands.find,
  // Basic
  clear: basicCommands.clear,
  cls: basicCommands.clear,
  echo: basicCommands.echo,
  history: basicCommands.history,
  help: basicCommands.help,
  date: basicCommands.date,
  whoami: basicCommands.whoami,
  uname: basicCommands.uname,
  // npm
  npm: npmCommands.npm,
  // git
  git: gitCommands.git,
  // node
  node: nodeCommands.node,
  // env
  env: envCommands.env,
  export: envCommands.exportVar,
  unset: envCommands.unset,
  printenv: envCommands.printenv,
  // Nova AI
  nova: aiCommands.nova,
};

export async function dispatch(input: string, ctx: CommandContext): Promise<CommandResult> {
  const trimmed = input.trim();
  if (!trimmed) return { output: [] };

  // Handle && chaining — each subcommand applies session/VFS mutations sequentially
  if (trimmed.includes(' && ')) {
    const parts = trimmed.split(' && ');
    const combined: CommandResult = { output: [] };
    // Work on a mutable copy of session and nodes so each part sees prior mutations
    const mutableCtx: CommandContext = { ...ctx, session: { ...ctx.session }, nodes: { ...ctx.nodes } };

    for (const part of parts) {
      const res = await dispatch(part.trim(), mutableCtx);
      combined.output.push(...res.output);
      if (res.clear) { combined.clear = true; combined.output = []; }
      if (res.session) {
        Object.assign(mutableCtx.session, res.session);
        combined.session = { ...(combined.session ?? {}), ...res.session };
      }
      if (res.vfsMutation) {
        mutableCtx.nodes = res.vfsMutation(mutableCtx.nodes);
        // Compose mutations: apply previous then this one
        const prevMut = combined.vfsMutation;
        const thisMut = res.vfsMutation;
        combined.vfsMutation = prevMut
          ? (nodes) => thisMut(prevMut(nodes))
          : thisMut;
      }
      if (res.asyncEffect) {
        // Chain async effects — they'll be run by the engine after return
        const prevEffect = combined.asyncEffect;
        const thisEffect = res.asyncEffect;
        combined.asyncEffect = prevEffect
          ? async (emit) => { await prevEffect(emit); await thisEffect(emit); }
          : thisEffect;
      }
    }
    return combined;
  }

  // Parse command and args (handle quoted strings)
  const tokens = parseTokens(trimmed);
  if (tokens.length === 0) return { output: [] };

  const [cmd, ...args] = tokens;
  const commandName = cmd.toLowerCase();
  const handler = COMMANDS[commandName];

  if (!handler) {
    return {
      output: [
        {
          type: 'stderr',
          content: `nova: command not found: ${cmd}. Type 'help' for available commands.`,
        },
      ],
    };
  }

  return handler({ ...ctx, args, rawInput: trimmed });
}

function parseTokens(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    // Backslash escape: consume next char literally (outside single quotes)
    if (ch === '\\' && !inSingle && i + 1 < input.length) {
      current += input[++i];
    } else if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (ch === ' ' && !inSingle && !inDouble) {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);
  return tokens;
}
