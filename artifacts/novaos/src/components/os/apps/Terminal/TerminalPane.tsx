import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
  KeyboardEvent,
} from 'react';
import type { TerminalTab, ShellSession, OutputLine } from './shell/types';
import type { TerminalTheme } from './themes';
import { executeCommand, makeOutputLine } from './shell/engine';
import { getVFSSnapshot } from '../FileManager/storage/vfsStore';
import { getDisplayPath, resolvePath } from './shell/commands/fs';
import { COMMANDS } from './shell/commands/index';
import TerminalOutputLine from './TerminalOutput';
import { useTerminal } from './TerminalProvider';

interface Props {
  tab: TerminalTab;
  pane: 'main' | 'split';
  theme: TerminalTheme;
  fontSize: number;
  isActive: boolean;
  onActivate: () => void;
}

export default function TerminalPane({ tab, pane, theme, fontSize, isActive, onActivate }: Props) {
  const { dispatch } = useTerminal();
  const outputEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [historySearchMode, setHistorySearchMode] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  const session: ShellSession = pane === 'split' ? (tab.splitSession ?? tab.session) : tab.session;
  const output: OutputLine[] = pane === 'split' ? (tab.splitOutput ?? []) : tab.output;
  const inputBuffer: string = pane === 'split' ? (tab.splitInputBuffer ?? '') : tab.inputBuffer;
  const savedInput: string = pane === 'split' ? (tab.splitSavedInput ?? '') : tab.savedInput;
  const isRunning: boolean = pane === 'split' ? (tab.splitIsRunning ?? false) : tab.isRunning;

  const setInput = useCallback((value: string) => {
    dispatch({ type: 'SET_INPUT', tabId: tab.id, value, pane });
  }, [dispatch, tab.id, pane]);

  const setSavedInput = useCallback((value: string) => {
    dispatch({ type: 'SET_SAVED_INPUT', tabId: tab.id, value, pane });
  }, [dispatch, tab.id, pane]);

  const appendLine = useCallback((line: OutputLine) => {
    dispatch({ type: 'APPEND_OUTPUT', tabId: tab.id, line, pane });
  }, [dispatch, tab.id, pane]);

  const clearOutput = useCallback(() => {
    dispatch({ type: 'CLEAR_OUTPUT', tabId: tab.id, pane });
  }, [dispatch, tab.id, pane]);

  const updateSession = useCallback((patch: Partial<ShellSession>) => {
    dispatch({ type: 'UPDATE_SESSION', tabId: tab.id, patch, pane });
  }, [dispatch, tab.id, pane]);

  const setRunning = useCallback((running: boolean) => {
    dispatch({ type: 'SET_RUNNING', tabId: tab.id, running, pane });
  }, [dispatch, tab.id, pane]);

  // Auto-scroll to bottom
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output.length]);

  // Focus input when pane becomes active
  useEffect(() => {
    if (isActive) {
      inputRef.current?.focus();
    }
  }, [isActive]);

  // Autocomplete
  const handleTabComplete = useCallback(() => {
    const input = inputBuffer.trim();
    const parts = input.split(' ');

    if (parts.length === 1) {
      // Command completion
      const prefix = parts[0].toLowerCase();
      const matches = Object.keys(COMMANDS).filter((cmd) => cmd.startsWith(prefix));
      if (matches.length === 1) {
        setInput(matches[0] + ' ');
      } else if (matches.length > 1) {
        appendLine(makeOutputLine('info', matches.join('  ')));
      }
      return;
    }

    // Path completion
    const { nodes } = getVFSSnapshot();
    const lastArg = parts[parts.length - 1];
    const lastSlash = lastArg.lastIndexOf('/');
    const dirPart = lastSlash > 0 ? lastArg.slice(0, lastSlash) : null;
    const prefix = lastSlash >= 0 ? lastArg.slice(lastSlash + 1) : lastArg;

    let parentId = session.cwdId;
    if (dirPart) {
      parentId = resolvePath(nodes, session.cwdId, dirPart) ?? session.cwdId;
    }

    const parent = nodes[parentId];
    if (!parent || parent.type !== 'folder') return;

    const matches = parent.children
      .map((id) => nodes[id])
      .filter((n) => n && n.name.toLowerCase().startsWith(prefix.toLowerCase()))
      .map((n) => n!.name + (n!.type === 'folder' ? '/' : ''));

    if (matches.length === 1) {
      const newParts = [...parts.slice(0, -1), (dirPart ? dirPart + '/' : '') + matches[0]];
      setInput(newParts.join(' '));
    } else if (matches.length > 1) {
      appendLine(makeOutputLine('info', matches.join('  ')));
    }
  }, [inputBuffer, session.cwdId, appendLine, setInput]);

  const handleSubmit = useCallback(async () => {
    if (!inputBuffer.trim() || isRunning) return;
    const cmd = inputBuffer;
    setInput('');
    setSavedInput('');
    setHistorySearchMode(false);
    setHistorySearchQuery('');
    setRunning(true);

    await executeCommand(
      cmd,
      session,
      appendLine,
      updateSession,
      clearOutput,
    );

    setRunning(false);
    inputRef.current?.focus();
  }, [inputBuffer, isRunning, session, appendLine, updateSession, clearOutput, setInput, setSavedInput, setRunning]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    // Ctrl+C — cancel
    if (e.ctrlKey && e.key === 'c') {
      e.preventDefault();
      appendLine(makeOutputLine('stderr', '^C'));
      setInput('');
      setSavedInput('');
      setRunning(false);
      setHistorySearchMode(false);
      return;
    }

    // Ctrl+L — clear
    if (e.ctrlKey && e.key === 'l') {
      e.preventDefault();
      clearOutput();
      return;
    }

    // Ctrl+R — history search
    if (e.ctrlKey && e.key === 'r') {
      e.preventDefault();
      setHistorySearchMode(true);
      setHistorySearchQuery('');
      return;
    }

    // Escape — cancel history search
    if (e.key === 'Escape' && historySearchMode) {
      setHistorySearchMode(false);
      setHistorySearchQuery('');
      return;
    }

    // Ctrl+A — start of line
    if (e.ctrlKey && e.key === 'a') {
      e.preventDefault();
      const input = inputRef.current;
      if (input) { input.selectionStart = 0; input.selectionEnd = 0; }
      return;
    }

    // Ctrl+E — end of line
    if (e.ctrlKey && e.key === 'e') {
      e.preventDefault();
      const input = inputRef.current;
      if (input) { input.selectionStart = input.value.length; input.selectionEnd = input.value.length; }
      return;
    }

    // Ctrl+U — clear line
    if (e.ctrlKey && e.key === 'u') {
      e.preventDefault();
      setInput('');
      return;
    }

    // Ctrl+K — kill to end
    if (e.ctrlKey && e.key === 'k') {
      e.preventDefault();
      const pos = inputRef.current?.selectionStart ?? inputBuffer.length;
      setInput(inputBuffer.slice(0, pos));
      return;
    }

    // Tab — autocomplete
    if (e.key === 'Tab') {
      e.preventDefault();
      handleTabComplete();
      return;
    }

    // Enter — submit
    if (e.key === 'Enter') {
      e.preventDefault();
      if (historySearchMode) {
        setHistorySearchMode(false);
        setHistorySearchQuery('');
        handleSubmit();
        return;
      }
      handleSubmit();
      return;
    }

    // Arrow Up — history back
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const hist = session.history;
      if (hist.length === 0) return;
      const currentIdx = session.historyIndex;

      if (currentIdx === -1) {
        // Save current input
        setSavedInput(inputBuffer);
        const newIdx = hist.length - 1;
        setInput(hist[newIdx]);
        updateSession({ historyIndex: newIdx });
      } else if (currentIdx > 0) {
        const newIdx = currentIdx - 1;
        setInput(hist[newIdx]);
        updateSession({ historyIndex: newIdx });
      }
      return;
    }

    // Arrow Down — history forward
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const hist = session.history;
      const currentIdx = session.historyIndex;

      if (currentIdx === -1) return;

      if (currentIdx >= hist.length - 1) {
        setInput(savedInput);
        updateSession({ historyIndex: -1 });
      } else {
        const newIdx = currentIdx + 1;
        setInput(hist[newIdx]);
        updateSession({ historyIndex: newIdx });
      }
      return;
    }
  }, [inputBuffer, savedInput, session, historySearchMode, historySearchQuery, appendLine, clearOutput, handleTabComplete, handleSubmit, setInput, setSavedInput, updateSession, setRunning]);

  const { nodes } = getVFSSnapshot();
  const promptPath = getDisplayPath(nodes, session.cwdId);

  const promptElement = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
        fontSize,
        lineHeight: '1.6',
        flexShrink: 0,
      }}
    >
      <span style={{ color: theme.promptUser, fontWeight: 600 }}>nova</span>
      <span style={{ color: theme.promptAt }}>@</span>
      <span style={{ color: theme.promptUser }}>novaos</span>
      <span style={{ color: theme.promptAt }}>:</span>
      <span style={{ color: theme.promptPath }}>{promptPath}</span>
      <span style={{ color: theme.promptSymbol, marginRight: 8 }}>{session.runningProcess ? ' ›' : ' $'}</span>
    </div>
  );

  return (
    <div
      style={{ background: theme.bg, height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', cursor: 'text' }}
      onClick={() => {
        onActivate();
        inputRef.current?.focus();
      }}
    >
      {/* Active pane indicator */}
      {isActive && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: theme.prompt, opacity: 0.8 }} />
      )}

      {/* Output area */}
      <div
        className="terminal-scrollbar"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 4px 4px 4px',
        }}
      >
        {output.map((line) => (
          <TerminalOutputLine key={line.id} line={line} theme={theme} fontSize={fontSize} />
        ))}
        <div ref={outputEndRef} />
      </div>

      {/* History search bar */}
      {historySearchMode && (
        <div
          style={{
            padding: '4px 12px',
            background: theme.surface,
            borderTop: `1px solid ${theme.border}`,
            fontFamily: '"JetBrains Mono", monospace',
            fontSize,
            color: theme.info,
          }}
        >
          <span>{'(reverse-i-search)`'}</span>
          <span style={{ color: theme.text }}>{historySearchQuery}</span>
          <span>{"':"}</span>
          <span style={{ color: theme.promptPath }}>
            {session.history.slice().reverse().find((h) => h.includes(historySearchQuery)) ?? ''}
          </span>
        </div>
      )}

      {/* Input line */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '4px 8px',
          borderTop: `1px solid ${theme.border}20`,
          background: theme.surface + '80',
          flexShrink: 0,
        }}
      >
        {promptElement}
        <input
          ref={inputRef}
          value={historySearchMode
            ? session.history.slice().reverse().find((h) => h.includes(historySearchQuery)) ?? historySearchQuery
            : inputBuffer}
          onChange={(e) => {
            if (historySearchMode) {
              setHistorySearchQuery(e.target.value);
            } else {
              setInput(e.target.value);
              updateSession({ historyIndex: -1 });
            }
          }}
          onKeyDown={handleKeyDown}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
            fontSize,
            lineHeight: '1.6',
            color: theme.text,
            caretColor: theme.cursor,
          }}
          disabled={isRunning}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        {isRunning && (
          <span style={{ color: theme.warning, fontSize: 11, marginLeft: 8 }}>running…</span>
        )}
      </div>
    </div>
  );
}
