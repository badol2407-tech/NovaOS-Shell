import React, { useState, useEffect } from 'react';
import type { TerminalTheme } from './themes';
import { getVFSSnapshot } from '../FileManager/storage/vfsStore';
import type { ShellSession } from './shell/types';

interface Props {
  session: ShellSession;
  theme: TerminalTheme;
  fontSize: number;
}

interface PkgJson {
  name?: string;
  version?: string;
  description?: string;
  main?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  keywords?: string[];
  author?: string;
  license?: string;
}

export default function PackageJsonViewer({ session, theme, fontSize }: Props) {
  const [pkg, setPkg] = useState<PkgJson | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'deps' | 'scripts' | 'raw'>('overview');

  useEffect(() => {
    const { nodes } = getVFSSnapshot();
    const cwd = nodes[session.cwdId];
    if (!cwd || cwd.type !== 'folder') { setPkg(null); return; }
    const pkgFile = cwd.children.map((id) => nodes[id]).find((n) => n?.name === 'package.json');
    if (!pkgFile || pkgFile.type !== 'file') { setPkg(null); return; }
    try {
      setPkg(JSON.parse(pkgFile.content ?? '{}'));
    } catch {
      setPkg(null);
    }
  }, [session.cwdId]);

  if (!pkg) {
    return (
      <div style={{ padding: 24, color: theme.textDim, fontFamily: '"JetBrains Mono", monospace', fontSize, textAlign: 'center' }}>
        <div style={{ marginBottom: 8 }}>No package.json in current directory.</div>
        <div style={{ color: theme.info, fontSize: 11 }}>Run <span style={{ color: theme.colorGreen }}>npm init</span> to create one.</div>
      </div>
    );
  }

  const allDeps = Object.entries({ ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) });

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    background: active ? theme.surface : 'transparent',
    border: `1px solid ${active ? theme.border : 'transparent'}`,
    borderRadius: 4,
    color: active ? theme.text : theme.textDim,
    cursor: 'pointer',
    padding: '2px 10px',
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: fontSize - 1,
  });

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', fontFamily: '"JetBrains Mono", monospace', fontSize, color: theme.text }}>
      {/* Header */}
      <div style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.border}`, flexShrink: 0 }}>
        <div style={{ color: theme.info, fontWeight: 700, fontSize: fontSize + 1, marginBottom: 4 }}>
          {pkg.name ?? 'Unnamed Package'}
          <span style={{ color: theme.textDim, fontWeight: 400, marginLeft: 8 }}>v{pkg.version ?? '1.0.0'}</span>
        </div>
        {pkg.description && <div style={{ color: theme.textDim, fontSize: 11 }}>{pkg.description}</div>}
        <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
          {(['overview', 'deps', 'scripts', 'raw'] as const).map((t) => (
            <button key={t} style={tabBtnStyle(activeTab === t)} onClick={() => setActiveTab(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="terminal-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Field label="Name" value={pkg.name ?? '-'} theme={theme} />
            <Field label="Version" value={pkg.version ?? '-'} theme={theme} />
            <Field label="Description" value={pkg.description ?? '-'} theme={theme} />
            <Field label="Main" value={pkg.main ?? 'index.js'} theme={theme} />
            <Field label="Author" value={pkg.author ?? '-'} theme={theme} />
            <Field label="License" value={pkg.license ?? 'ISC'} theme={theme} />
            <Field label="Dependencies" value={`${Object.keys(pkg.dependencies ?? {}).length}`} theme={theme} />
            <Field label="Dev Dependencies" value={`${Object.keys(pkg.devDependencies ?? {}).length}`} theme={theme} />
          </div>
        )}

        {activeTab === 'deps' && (
          <div>
            {Object.keys(pkg.dependencies ?? {}).length > 0 && (
              <>
                <div style={{ color: theme.info, fontWeight: 600, marginBottom: 8 }}>Dependencies</div>
                {Object.entries(pkg.dependencies ?? {}).map(([k, v]) => (
                  <DepRow key={k} name={k} version={v} theme={theme} isDev={false} />
                ))}
              </>
            )}
            {Object.keys(pkg.devDependencies ?? {}).length > 0 && (
              <>
                <div style={{ color: theme.warning, fontWeight: 600, marginTop: 12, marginBottom: 8 }}>devDependencies</div>
                {Object.entries(pkg.devDependencies ?? {}).map(([k, v]) => (
                  <DepRow key={k} name={k} version={v} theme={theme} isDev />
                ))}
              </>
            )}
            {allDeps.length === 0 && <div style={{ color: theme.textDim }}>No dependencies.</div>}
          </div>
        )}

        {activeTab === 'scripts' && (
          <div>
            {Object.entries(pkg.scripts ?? {}).length === 0 ? (
              <div style={{ color: theme.textDim }}>No scripts defined.</div>
            ) : (
              Object.entries(pkg.scripts ?? {}).map(([k, v]) => (
                <div key={k} style={{ marginBottom: 8, padding: 8, background: theme.surface, borderRadius: 4, border: `1px solid ${theme.border}` }}>
                  <div style={{ color: theme.colorGreen, fontWeight: 600 }}>{k}</div>
                  <div style={{ color: theme.textDim, fontSize: fontSize - 1, marginTop: 2 }}>{v}</div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'raw' && (
          <pre style={{ color: theme.text, margin: 0, fontSize: fontSize - 1, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {JSON.stringify(pkg, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, theme }: { label: string; value: string; theme: TerminalTheme }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <span style={{ color: theme.textDim, minWidth: 100, flexShrink: 0 }}>{label}</span>
      <span style={{ color: theme.text }}>{value}</span>
    </div>
  );
}

function DepRow({ name, version, theme, isDev }: { name: string; version: string; theme: TerminalTheme; isDev: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', borderBottom: `1px solid ${theme.border}20` }}>
      <span style={{ flex: 1, color: isDev ? theme.warning : theme.text }}>{name}</span>
      <span style={{ color: theme.textDim, fontSize: 11 }}>{version}</span>
    </div>
  );
}
