import React, { useState, useMemo } from 'react';
import type { TerminalTheme } from './themes';
import type { OutputLine } from './shell/types';

interface Props {
  allTabs: Array<{ title: string; output: OutputLine[] }>;
  theme: TerminalTheme;
  fontSize: number;
}

export default function LogViewer({ allTabs, theme, fontSize }: Props) {
  const [filter, setFilter] = useState('');
  const [selectedTab, setSelectedTab] = useState<number | 'all'>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');

  const allLogs = useMemo(() => {
    const tabs = selectedTab === 'all' ? allTabs : [allTabs[selectedTab as number]].filter(Boolean);
    return tabs.flatMap((tab, ti) =>
      tab.output.map((line, li) => ({
        ...line,
        tabName: tab.title,
        tabIndex: ti,
      }))
    );
  }, [allTabs, selectedTab]);

  const filteredLogs = useMemo(() => {
    return allLogs
      .filter((l) => {
        if (levelFilter !== 'all' && l.type !== levelFilter) return false;
        if (filter && !l.content.toLowerCase().includes(filter.toLowerCase())) return false;
        return true;
      })
      .slice(-500); // cap at 500 for performance
  }, [allLogs, filter, levelFilter]);

  function colorForType(type: string): string {
    switch (type) {
      case 'stderr': return theme.error;
      case 'success': return theme.success;
      case 'warning': return theme.warning;
      case 'info': return theme.info;
      case 'system': return theme.textDim;
      default: return theme.text;
    }
  }

  const inputStyle: React.CSSProperties = {
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    borderRadius: 4,
    color: theme.text,
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: fontSize - 1,
    padding: '3px 8px',
    outline: 'none',
  };

  const LEVELS = ['all', 'stdout', 'stderr', 'info', 'success', 'warning', 'system'];

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: fontSize - 1,
        color: theme.text,
      }}
    >
      {/* Header */}
      <div style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.border}`, flexShrink: 0 }}>
        <div style={{ color: theme.info, fontWeight: 700, marginBottom: 8, fontSize: fontSize + 1 }}>Log Viewer</div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <input
            style={{ ...inputStyle, flex: 1, minWidth: 80 }}
            placeholder="Filter logs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <select
            value={selectedTab}
            onChange={(e) => setSelectedTab(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
            style={inputStyle}
          >
            <option value="all">All tabs</option>
            {allTabs.map((t, i) => <option key={i} value={i}>{t.title}</option>)}
          </select>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            style={inputStyle}
          >
            {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      {/* Logs */}
      <div
        className="terminal-scrollbar"
        style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}
      >
        {filteredLogs.length === 0 ? (
          <div style={{ color: theme.textDim, padding: 24, textAlign: 'center' }}>No logs match the filter.</div>
        ) : (
          filteredLogs.map((line) => (
            <div
              key={line.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '1px 8px',
                fontSize,
              }}
            >
              <span style={{ color: theme.textDim, flexShrink: 0, fontSize: 10, marginTop: 2 }}>
                {new Date(line.timestamp).toLocaleTimeString()}
              </span>
              <span
                style={{
                  color: colorForType(line.type),
                  flexShrink: 0,
                  fontSize: 10,
                  textTransform: 'uppercase',
                  minWidth: 48,
                  marginTop: 2,
                }}
              >
                {line.type}
              </span>
              <span style={{ color: theme.textDim, flexShrink: 0, fontSize: 10, marginTop: 2 }}>[{line.tabName}]</span>
              <span style={{ flex: 1, color: colorForType(line.type), wordBreak: 'break-all' }}>{line.content}</span>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '4px 12px', borderTop: `1px solid ${theme.border}`, color: theme.textDim, fontSize: 11, flexShrink: 0 }}>
        {filteredLogs.length} log entries
      </div>
    </div>
  );
}
