import { VFSNode } from '../../FileManager/types';

// ─── Output line types ────────────────────────────────────────────────────────

export type OutputLineType =
  | 'stdout'
  | 'stderr'
  | 'info'
  | 'success'
  | 'warning'
  | 'prompt'
  | 'command'
  | 'system';

export interface OutputLine {
  id: string;
  type: OutputLineType;
  content: string;
  /** Whether content contains ANSI-style color tokens */
  isRich?: boolean;
  timestamp: number;
}

// ─── Shell session state ───────────────────────────────────────────────────────

export interface ShellEnvVars {
  [key: string]: string;
}

export interface GitRepoState {
  initialized: boolean;
  branch: string;
  staged: string[];
  commits: Array<{ hash: string; message: string; author: string; date: string }>;
}

export interface NpmPackageState {
  name: string;
  version: string;
  description: string;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

export interface ShellSession {
  /** ID of the current working directory VFS node */
  cwdId: string;
  /** Command history (oldest first) */
  history: string[];
  /** History navigation index (-1 = not navigating) */
  historyIndex: number;
  /** Environment variables */
  env: ShellEnvVars;
  /** Git state per directory (keyed by VFS node ID) */
  gitRepos: Record<string, GitRepoState>;
  /** npm package state per directory (keyed by VFS node ID) */
  npmPackages: Record<string, NpmPackageState>;
  /** Running process label (null = idle) */
  runningProcess: string | null;
  /** npm install progress 0-100 */
  installProgress: number | null;
}

// ─── Command execution context ────────────────────────────────────────────────

export interface CommandContext {
  session: ShellSession;
  nodes: Record<string, VFSNode>;
  args: string[];
  rawInput: string;
}

export type CommandOutput = Array<{ type: OutputLineType; content: string }>;

export interface CommandResult {
  output: CommandOutput;
  /** Updated session state (if changed) */
  session?: Partial<ShellSession>;
  /** VFS mutations to apply after this command */
  vfsMutation?: (prev: Record<string, VFSNode>) => Record<string, VFSNode>;
  /** Whether to clear terminal output */
  clear?: boolean;
  /** Async side-effect to run (e.g. simulated npm install) */
  asyncEffect?: (emit: (line: { type: OutputLineType; content: string }) => void) => Promise<void>;
}

// ─── Tab / pane types ─────────────────────────────────────────────────────────

export type SplitDirection = 'horizontal' | 'vertical';

export interface TerminalTab {
  id: string;
  title: string;
  session: ShellSession;
  output: OutputLine[];
  inputBuffer: string;
  /** Partial input saved for history navigation */
  savedInput: string;
  isRunning: boolean;
  /** Split: null = no split, 'horizontal' = side by side, 'vertical' = top/bottom */
  split: SplitDirection | null;
  splitSession?: ShellSession;
  splitOutput?: OutputLine[];
  splitInputBuffer?: string;
  splitSavedInput?: string;
  splitIsRunning?: boolean;
  /** Active pane in split: 'main' | 'split' */
  activeSplitPane?: 'main' | 'split';
}

// ─── Terminal global state ─────────────────────────────────────────────────────

export type TerminalThemeId = 'nova' | 'dracula' | 'monokai' | 'solarized' | 'github-dark' | 'one-dark';

export interface TerminalState {
  tabs: TerminalTab[];
  activeTabId: string;
  theme: TerminalThemeId;
  fontSize: number;
  isFullscreen: boolean;
  /** Side panel: null = closed */
  sidePanel: 'env' | 'logs' | 'packages' | null;
}
