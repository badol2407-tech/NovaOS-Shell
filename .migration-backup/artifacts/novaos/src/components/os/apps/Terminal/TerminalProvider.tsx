import React, {
  createContext,
  useCallback,
  useContext,
  useReducer,
  useRef,
  ReactNode,
} from 'react';
import type { TerminalState, TerminalTab, ShellSession, OutputLine, TerminalThemeId, SplitDirection } from './shell/types';
import { createDefaultSession, makeOutputLine } from './shell/engine';

// ─── Actions ──────────────────────────────────────────────────────────────────

type Action =
  | { type: 'ADD_TAB' }
  | { type: 'CLOSE_TAB'; id: string }
  | { type: 'ACTIVATE_TAB'; id: string }
  | { type: 'RENAME_TAB'; id: string; title: string }
  | { type: 'APPEND_OUTPUT'; tabId: string; line: OutputLine; pane: 'main' | 'split' }
  | { type: 'CLEAR_OUTPUT'; tabId: string; pane: 'main' | 'split' }
  | { type: 'SET_INPUT'; tabId: string; value: string; pane: 'main' | 'split' }
  | { type: 'SET_SAVED_INPUT'; tabId: string; value: string; pane: 'main' | 'split' }
  | { type: 'UPDATE_SESSION'; tabId: string; patch: Partial<ShellSession>; pane: 'main' | 'split' }
  | { type: 'SET_RUNNING'; tabId: string; running: boolean; pane: 'main' | 'split' }
  | { type: 'SPLIT_TAB'; id: string; direction: SplitDirection }
  | { type: 'UNSPLIT_TAB'; id: string }
  | { type: 'SET_ACTIVE_SPLIT_PANE'; tabId: string; pane: 'main' | 'split' }
  | { type: 'SET_THEME'; theme: TerminalThemeId }
  | { type: 'SET_FONT_SIZE'; size: number }
  | { type: 'TOGGLE_FULLSCREEN' }
  | { type: 'SET_SIDE_PANEL'; panel: TerminalState['sidePanel'] };

let _tabCounter = 1;

function makeTab(title?: string): TerminalTab {
  const id = `tab_${Date.now()}_${_tabCounter++}`;
  const welcomeLines: OutputLine[] = [
    makeOutputLine('system', ''),
    makeOutputLine('system', '\x1b[hdr]NovaOS Developer Terminal v4.0\x1b[/]'),
    makeOutputLine('system', "Type \x1b[cmd]help\x1b[/] to see available commands. Use Tab to autocomplete."),
    makeOutputLine('system', ''),
  ];
  return {
    id,
    title: title ?? `Terminal ${_tabCounter - 1}`,
    session: createDefaultSession(),
    output: welcomeLines,
    inputBuffer: '',
    savedInput: '',
    isRunning: false,
    split: null,
    activeSplitPane: 'main',
  };
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

function updateTab(tabs: TerminalTab[], id: string, fn: (t: TerminalTab) => TerminalTab): TerminalTab[] {
  return tabs.map((t) => (t.id === id ? fn(t) : t));
}

function reducer(state: TerminalState, action: Action): TerminalState {
  switch (action.type) {
    case 'ADD_TAB': {
      const tab = makeTab();
      return { ...state, tabs: [...state.tabs, tab], activeTabId: tab.id };
    }

    case 'CLOSE_TAB': {
      if (state.tabs.length <= 1) return state;
      const remaining = state.tabs.filter((t) => t.id !== action.id);
      const activeTabId = state.activeTabId === action.id
        ? remaining[remaining.length - 1].id
        : state.activeTabId;
      return { ...state, tabs: remaining, activeTabId };
    }

    case 'ACTIVATE_TAB':
      return { ...state, activeTabId: action.id };

    case 'RENAME_TAB':
      return { ...state, tabs: updateTab(state.tabs, action.id, (t) => ({ ...t, title: action.title })) };

    case 'APPEND_OUTPUT':
      return {
        ...state,
        tabs: updateTab(state.tabs, action.tabId, (t) => {
          if (action.pane === 'split') {
            return { ...t, splitOutput: [...(t.splitOutput ?? []), action.line] };
          }
          return { ...t, output: [...t.output, action.line] };
        }),
      };

    case 'CLEAR_OUTPUT':
      return {
        ...state,
        tabs: updateTab(state.tabs, action.tabId, (t) => {
          if (action.pane === 'split') return { ...t, splitOutput: [] };
          return { ...t, output: [] };
        }),
      };

    case 'SET_INPUT':
      return {
        ...state,
        tabs: updateTab(state.tabs, action.tabId, (t) => {
          if (action.pane === 'split') return { ...t, splitInputBuffer: action.value };
          return { ...t, inputBuffer: action.value };
        }),
      };

    case 'SET_SAVED_INPUT':
      return {
        ...state,
        tabs: updateTab(state.tabs, action.tabId, (t) => {
          if (action.pane === 'split') return { ...t, splitSavedInput: action.value };
          return { ...t, savedInput: action.value };
        }),
      };

    case 'UPDATE_SESSION':
      return {
        ...state,
        tabs: updateTab(state.tabs, action.tabId, (t) => {
          if (action.pane === 'split') {
            return { ...t, splitSession: { ...(t.splitSession ?? t.session), ...action.patch } };
          }
          return { ...t, session: { ...t.session, ...action.patch } };
        }),
      };

    case 'SET_RUNNING':
      return {
        ...state,
        tabs: updateTab(state.tabs, action.tabId, (t) => {
          if (action.pane === 'split') return { ...t, splitIsRunning: action.running };
          return { ...t, isRunning: action.running };
        }),
      };

    case 'SPLIT_TAB':
      return {
        ...state,
        tabs: updateTab(state.tabs, action.id, (t) => ({
          ...t,
          split: action.direction,
          splitSession: createDefaultSession(),
          splitOutput: [
            makeOutputLine('system', '\x1b[hdr]NovaOS Developer Terminal — Split Pane\x1b[/]'),
            makeOutputLine('system', ''),
          ],
          splitInputBuffer: '',
          splitSavedInput: '',
          splitIsRunning: false,
          activeSplitPane: 'main',
        })),
      };

    case 'UNSPLIT_TAB':
      return {
        ...state,
        tabs: updateTab(state.tabs, action.id, (t) => ({
          ...t,
          split: null,
          splitSession: undefined,
          splitOutput: undefined,
          splitInputBuffer: undefined,
          splitSavedInput: undefined,
          splitIsRunning: undefined,
          activeSplitPane: 'main',
        })),
      };

    case 'SET_ACTIVE_SPLIT_PANE':
      return {
        ...state,
        tabs: updateTab(state.tabs, action.tabId, (t) => ({ ...t, activeSplitPane: action.pane })),
      };

    case 'SET_THEME':
      return { ...state, theme: action.theme };

    case 'SET_FONT_SIZE':
      return { ...state, fontSize: Math.max(10, Math.min(20, action.size)) };

    case 'TOGGLE_FULLSCREEN':
      return { ...state, isFullscreen: !state.isFullscreen };

    case 'SET_SIDE_PANEL':
      return { ...state, sidePanel: state.sidePanel === action.panel ? null : action.panel };

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface TerminalContextType {
  state: TerminalState;
  dispatch: React.Dispatch<Action>;
  activeTab: TerminalTab | undefined;
}

const TerminalContext = createContext<TerminalContextType | undefined>(undefined);

export function TerminalProvider({ children }: { children: ReactNode }) {
  const initialTab = makeTab('Terminal 1');
  const [state, dispatch] = useReducer(reducer, {
    tabs: [initialTab],
    activeTabId: initialTab.id,
    theme: 'nova',
    fontSize: 13,
    isFullscreen: false,
    sidePanel: null,
  } as TerminalState);

  const activeTab = state.tabs.find((t) => t.id === state.activeTabId);

  return (
    <TerminalContext.Provider value={{ state, dispatch, activeTab }}>
      {children}
    </TerminalContext.Provider>
  );
}

export function useTerminal() {
  const ctx = useContext(TerminalContext);
  if (!ctx) throw new Error('useTerminal must be used within TerminalProvider');
  return ctx;
}
