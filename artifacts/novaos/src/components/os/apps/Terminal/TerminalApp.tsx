import React, { useCallback } from 'react';
import { useTerminal } from './TerminalProvider';
import TerminalPane from './TerminalPane';
import EnvManager from './EnvManager';
import LogViewer from './LogViewer';
import PackageJsonViewer from './PackageJsonViewer';
import { getTheme, THEMES } from './themes';
import type { TerminalThemeId, SplitDirection, ShellSession } from './shell/types';

// Icons (inline SVG for zero-dep)
const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="7" y1="2" x2="7" y2="12"/><line x1="2" y1="7" x2="12" y2="7"/>
  </svg>
);
const XIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/>
  </svg>
);
const SplitHIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <rect x="1" y="1" width="12" height="12" rx="1"/>
    <line x1="7" y1="1" x2="7" y2="13"/>
  </svg>
);
const SplitVIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <rect x="1" y="1" width="12" height="12" rx="1"/>
    <line x1="1" y1="7" x2="13" y2="7"/>
  </svg>
);
const MaxIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <polyline points="9,1 13,1 13,5"/><line x1="13" y1="1" x2="8" y2="6"/>
    <polyline points="5,13 1,13 1,9"/><line x1="1" y1="13" x2="6" y2="8"/>
  </svg>
);
const EnvIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="7" cy="7" r="5"/><line x1="7" y1="2" x2="7" y2="12"/><line x1="2" y1="7" x2="12" y2="7"/>
  </svg>
);
const LogIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <rect x="1" y="2" width="12" height="10" rx="1"/>
    <line x1="3" y1="5" x2="11" y2="5"/><line x1="3" y1="7" x2="11" y2="7"/><line x1="3" y1="9" x2="8" y2="9"/>
  </svg>
);
const PkgIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <rect x="1" y="5" width="12" height="8" rx="1"/>
    <path d="M4 5V3a3 3 0 016 0v2"/>
  </svg>
);

export default function TerminalApp() {
  const { state, dispatch, activeTab } = useTerminal();
  const theme = getTheme(state.theme);

  const handleUpdateSession = useCallback((tabId: string, pane: 'main' | 'split') => (patch: Partial<ShellSession>) => {
    dispatch({ type: 'UPDATE_SESSION', tabId, patch, pane });
  }, [dispatch]);

  if (!activeTab) return null;

  const hasSplit = !!activeTab.split;
  const activeSplitPane = activeTab.activeSplitPane ?? 'main';

  // Which session to show in side panels
  const panelSession = activeSplitPane === 'split' && activeTab.splitSession
    ? activeTab.splitSession
    : activeTab.session;

  const btnStyle = (active = false): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: '3px 8px',
    background: active ? theme.surface : 'transparent',
    border: `1px solid ${active ? theme.border : 'transparent'}`,
    borderRadius: 4,
    color: active ? theme.text : theme.textDim,
    cursor: 'pointer',
    fontSize: 11,
    fontFamily: '"JetBrains Mono", monospace',
    transition: 'all 0.15s',
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: theme.bg,
        overflow: 'hidden',
      }}
    >
      {/* ─── Top toolbar ─────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: theme.surface,
          borderBottom: `1px solid ${theme.border}`,
          height: 36,
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        {/* Tab strip */}
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, overflow: 'hidden', height: '100%' }}>
          {state.tabs.map((tab) => {
            const isActive = tab.id === state.activeTabId;
            return (
              <div
                key={tab.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: '100%',
                  padding: '0 10px',
                  background: isActive ? theme.tabActiveBg : theme.tabBg,
                  color: isActive ? theme.tabActiveText : theme.tabText,
                  borderRight: `1px solid ${theme.border}`,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontFamily: '"JetBrains Mono", monospace',
                  userSelect: 'none',
                  maxWidth: 160,
                  minWidth: 80,
                  flexShrink: 0,
                  gap: 6,
                  boxShadow: isActive ? `inset 0 -2px 0 ${theme.prompt}` : 'none',
                }}
                onClick={() => dispatch({ type: 'ACTIVATE_TAB', id: tab.id })}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {tab.title}
                </span>
                {tab.isRunning && (
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: theme.warning, flexShrink: 0 }} />
                )}
                {state.tabs.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); dispatch({ type: 'CLOSE_TAB', id: tab.id }); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textDim, display: 'flex', padding: 1, borderRadius: 2, flexShrink: 0 }}
                  >
                    <XIcon />
                  </button>
                )}
              </div>
            );
          })}

          {/* Add tab */}
          <button
            onClick={() => dispatch({ type: 'ADD_TAB' })}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textDim, padding: '0 10px', height: '100%', display: 'flex', alignItems: 'center' }}
            title="New tab"
          >
            <PlusIcon />
          </button>
        </div>

        {/* Right-side toolbar buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '0 8px', flexShrink: 0, borderLeft: `1px solid ${theme.border}` }}>
          {/* Split horizontal */}
          <button
            onClick={() => hasSplit ? dispatch({ type: 'UNSPLIT_TAB', id: activeTab.id }) : dispatch({ type: 'SPLIT_TAB', id: activeTab.id, direction: 'horizontal' as SplitDirection })}
            style={btnStyle(hasSplit && activeTab.split === 'horizontal')}
            title={hasSplit ? 'Close split' : 'Split vertical (side by side)'}
          >
            <SplitHIcon />
          </button>
          {/* Split vertical */}
          <button
            onClick={() => hasSplit ? dispatch({ type: 'UNSPLIT_TAB', id: activeTab.id }) : dispatch({ type: 'SPLIT_TAB', id: activeTab.id, direction: 'vertical' as SplitDirection })}
            style={btnStyle(hasSplit && activeTab.split === 'vertical')}
            title={hasSplit ? 'Close split' : 'Split horizontal (top/bottom)'}
          >
            <SplitVIcon />
          </button>

          <div style={{ width: 1, height: 16, background: theme.border, margin: '0 4px' }} />

          {/* Theme selector */}
          <select
            value={state.theme}
            onChange={(e) => dispatch({ type: 'SET_THEME', theme: e.target.value as TerminalThemeId })}
            style={{
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              color: theme.textDim,
              borderRadius: 4,
              fontSize: 11,
              padding: '1px 4px',
              fontFamily: '"JetBrains Mono", monospace',
              cursor: 'pointer',
            }}
          >
            {Object.values(THEMES).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          {/* Font size */}
          <button onClick={() => dispatch({ type: 'SET_FONT_SIZE', size: state.fontSize - 1 })} style={btnStyle()} title="Decrease font size">A-</button>
          <span style={{ color: theme.textDim, fontSize: 10, minWidth: 20, textAlign: 'center' }}>{state.fontSize}</span>
          <button onClick={() => dispatch({ type: 'SET_FONT_SIZE', size: state.fontSize + 1 })} style={btnStyle()} title="Increase font size">A+</button>

          <div style={{ width: 1, height: 16, background: theme.border, margin: '0 4px' }} />

          {/* Side panels */}
          <button onClick={() => dispatch({ type: 'SET_SIDE_PANEL', panel: 'env' })} style={btnStyle(state.sidePanel === 'env')} title="Environment variables">
            <EnvIcon /> <span style={{ fontSize: 10 }}>ENV</span>
          </button>
          <button onClick={() => dispatch({ type: 'SET_SIDE_PANEL', panel: 'logs' })} style={btnStyle(state.sidePanel === 'logs')} title="Log viewer">
            <LogIcon /> <span style={{ fontSize: 10 }}>LOGS</span>
          </button>
          <button onClick={() => dispatch({ type: 'SET_SIDE_PANEL', panel: 'packages' })} style={btnStyle(state.sidePanel === 'packages')} title="Package.json viewer">
            <PkgIcon /> <span style={{ fontSize: 10 }}>PKG</span>
          </button>

          <div style={{ width: 1, height: 16, background: theme.border, margin: '0 4px' }} />

          {/* Fullscreen */}
          <button onClick={() => dispatch({ type: 'TOGGLE_FULLSCREEN' })} style={btnStyle(state.isFullscreen)} title="Toggle fullscreen">
            <MaxIcon />
          </button>
        </div>
      </div>

      {/* ─── Main area ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Terminal panes */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: activeTab.split === 'vertical' ? 'column' : 'row',
            overflow: 'hidden',
            minWidth: 0,
          }}
        >
          {/* Main pane */}
          <div style={{ flex: 1, overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
            <TerminalPane
              tab={activeTab}
              pane="main"
              theme={theme}
              fontSize={state.fontSize}
              isActive={!hasSplit || activeSplitPane === 'main'}
              onActivate={() => hasSplit && dispatch({ type: 'SET_ACTIVE_SPLIT_PANE', tabId: activeTab.id, pane: 'main' })}
            />
          </div>

          {/* Split pane */}
          {hasSplit && (
            <>
              {/* Resize handle */}
              <div
                style={{
                  flexShrink: 0,
                  background: theme.border,
                  cursor: activeTab.split === 'vertical' ? 'row-resize' : 'col-resize',
                  width: activeTab.split === 'vertical' ? '100%' : 4,
                  height: activeTab.split === 'vertical' ? 4 : '100%',
                }}
              />
              <div style={{ flex: 1, overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
                <TerminalPane
                  tab={activeTab}
                  pane="split"
                  theme={theme}
                  fontSize={state.fontSize}
                  isActive={activeSplitPane === 'split'}
                  onActivate={() => dispatch({ type: 'SET_ACTIVE_SPLIT_PANE', tabId: activeTab.id, pane: 'split' })}
                />
              </div>
            </>
          )}
        </div>

        {/* ─── Side panel ──────────────────────────────────────────── */}
        {state.sidePanel && (
          <div
            style={{
              width: 300,
              flexShrink: 0,
              background: theme.surface,
              borderLeft: `1px solid ${theme.border}`,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Side panel header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 8px',
              borderBottom: `1px solid ${theme.border}`,
              background: theme.bg,
              flexShrink: 0,
            }}>
              <span style={{ color: theme.info, fontSize: 11, fontFamily: '"JetBrains Mono", monospace', fontWeight: 600 }}>
                {state.sidePanel === 'env' ? 'ENV VARS' : state.sidePanel === 'logs' ? 'LOGS' : 'PACKAGE.JSON'}
              </span>
              <button
                onClick={() => dispatch({ type: 'SET_SIDE_PANEL', panel: state.sidePanel })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textDim, display: 'flex' }}
              >
                <XIcon />
              </button>
            </div>

            {/* Panel content */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {state.sidePanel === 'env' && (
                <EnvManager
                  session={panelSession}
                  theme={theme}
                  fontSize={state.fontSize}
                  onUpdate={handleUpdateSession(activeTab.id, activeSplitPane)}
                />
              )}
              {state.sidePanel === 'logs' && (
                <LogViewer
                  allTabs={state.tabs.map((t) => ({ title: t.title, output: t.output }))}
                  theme={theme}
                  fontSize={state.fontSize}
                />
              )}
              {state.sidePanel === 'packages' && (
                <PackageJsonViewer
                  session={panelSession}
                  theme={theme}
                  fontSize={state.fontSize}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
