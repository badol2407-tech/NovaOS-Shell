import type { ShellSession, OutputLine, OutputLineType } from './types';
import type { VFSNode } from '../../FileManager/types';
import { dispatch } from './commands/index';
import { mutateVFS, getVFSSnapshot } from '../../FileManager/storage/vfsStore';
import { HOME_ID } from '../../FileManager/vfs';

let _lineIdCounter = 0;
function makeLineId(): string {
  return `line_${Date.now()}_${_lineIdCounter++}`;
}

export function createDefaultSession(): ShellSession {
  return {
    cwdId: HOME_ID,
    history: [],
    historyIndex: -1,
    env: {
      HOME: '/home',
      USER: 'nova-user',
      SHELL: '/bin/nova',
      TERM: 'nova-256color',
      PATH: '/usr/local/bin:/usr/bin:/bin',
      NODE_ENV: 'development',
    },
    gitRepos: {},
    npmPackages: {},
    runningProcess: null,
    installProgress: null,
  };
}

export function makeOutputLine(type: OutputLineType, content: string): OutputLine {
  return { id: makeLineId(), type, content, isRich: content.includes('\x1b['), timestamp: Date.now() };
}

export async function executeCommand(
  input: string,
  session: ShellSession,
  onLine: (line: OutputLine) => void,
  onSessionUpdate: (patch: Partial<ShellSession>) => void,
  onClear: () => void,
): Promise<void> {
  const trimmed = input.trim();
  if (!trimmed) return;

  // Add to history
  const newHistory = [...session.history.filter((h) => h !== trimmed), trimmed].slice(-500);
  onSessionUpdate({ history: newHistory, historyIndex: -1 });

  // Emit prompt line (what the user typed)
  onLine(makeOutputLine('prompt', trimmed));

  // Get current VFS snapshot
  const { nodes } = getVFSSnapshot();

  try {
    const result = await dispatch(trimmed, {
      session: { ...session, history: newHistory },
      nodes,
      args: [],
      rawInput: trimmed,
    });

    // Apply VFS mutation
    if (result.vfsMutation) {
      const mut = result.vfsMutation;
      mutateVFS((prev) => ({
        ...prev,
        nodes: mut(prev.nodes),
      }));
    }

    // Handle clear
    if (result.clear) {
      onClear();
      return;
    }

    // Apply session update
    if (result.session) {
      onSessionUpdate(result.session);
    }

    // Emit synchronous output
    for (const line of result.output) {
      onLine(makeOutputLine(line.type, line.content));
    }

    // Handle async effects (npm install simulation, etc.)
    if (result.asyncEffect) {
      onSessionUpdate({ runningProcess: 'running' });
      await result.asyncEffect((line) => {
        onLine(makeOutputLine(line.type, line.content));
      });
      onSessionUpdate({ runningProcess: null });
    }
  } catch (err) {
    onLine(makeOutputLine('stderr', `Error: ${err instanceof Error ? err.message : String(err)}`));
  }
}
