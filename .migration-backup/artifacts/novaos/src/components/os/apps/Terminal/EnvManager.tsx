import React, { useState } from 'react';
import type { TerminalTheme } from './themes';
import type { ShellSession } from './shell/types';

interface Props {
  session: ShellSession;
  theme: TerminalTheme;
  fontSize: number;
  onUpdate: (patch: Partial<ShellSession>) => void;
}

export default function EnvManager({ session, theme, fontSize, onUpdate }: Props) {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const entries = Object.entries(session.env).sort(([a], [b]) => a.localeCompare(b));

  function handleAdd() {
    if (!newKey.trim()) return;
    const key = newKey.trim().toUpperCase();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return;
    onUpdate({ env: { ...session.env, [key]: newValue } });
    setNewKey('');
    setNewValue('');
  }

  function handleDelete(key: string) {
    const newEnv = { ...session.env };
    delete newEnv[key];
    onUpdate({ env: newEnv });
  }

  function handleEdit(key: string) {
    setEditKey(key);
    setEditValue(session.env[key] ?? '');
  }

  function handleSaveEdit() {
    if (!editKey) return;
    onUpdate({ env: { ...session.env, [editKey]: editValue } });
    setEditKey(null);
    setEditValue('');
  }

  const inputStyle: React.CSSProperties = {
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    borderRadius: 4,
    color: theme.text,
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: fontSize - 1,
    padding: '2px 6px',
    outline: 'none',
  };

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        padding: 12,
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: fontSize - 1,
        color: theme.text,
      }}
      className="terminal-scrollbar"
    >
      <div style={{ color: theme.info, fontWeight: 700, marginBottom: 12, fontSize: fontSize + 1 }}>
        Environment Variables
      </div>

      {/* Add new */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          style={{ ...inputStyle, flex: '1 1 80px', minWidth: 80 }}
          placeholder="KEY"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <span style={{ color: theme.promptSymbol, alignSelf: 'center' }}>=</span>
        <input
          style={{ ...inputStyle, flex: '2 1 120px', minWidth: 80 }}
          placeholder="value"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button
          onClick={handleAdd}
          style={{
            background: theme.info,
            color: theme.bg,
            border: 'none',
            borderRadius: 4,
            padding: '2px 10px',
            cursor: 'pointer',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: fontSize - 1,
            fontWeight: 600,
          }}
        >
          + Add
        </button>
      </div>

      {/* Variable list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {entries.map(([key, value]) => (
          <div
            key={key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 8px',
              background: theme.surface,
              borderRadius: 4,
              border: `1px solid ${theme.border}`,
            }}
          >
            <span style={{ color: theme.promptPath, minWidth: 80, fontWeight: 600, flexShrink: 0 }}>{key}</span>
            <span style={{ color: theme.textDim }}>=</span>
            {editKey === key ? (
              <input
                autoFocus
                style={{ ...inputStyle, flex: 1 }}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit();
                  if (e.key === 'Escape') setEditKey(null);
                }}
              />
            ) : (
              <span
                style={{ flex: 1, color: theme.text, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                onClick={() => handleEdit(key)}
                title={value}
              >
                {value || <span style={{ color: theme.textDim, fontStyle: 'italic' }}>(empty)</span>}
              </span>
            )}
            {editKey === key ? (
              <button onClick={handleSaveEdit} style={{ ...btnStyle(theme), color: theme.success }}>✓</button>
            ) : (
              <button onClick={() => handleEdit(key)} style={btnStyle(theme)}>✏</button>
            )}
            <button onClick={() => handleDelete(key)} style={{ ...btnStyle(theme), color: theme.error }}>✕</button>
          </div>
        ))}
        {entries.length === 0 && (
          <div style={{ color: theme.textDim, textAlign: 'center', padding: 24 }}>No variables. Add one above.</div>
        )}
      </div>
    </div>
  );
}

function btnStyle(theme: TerminalTheme): React.CSSProperties {
  return {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: theme.textDim,
    padding: '0 4px',
    fontSize: 13,
  };
}
