import React, { memo } from 'react';
import type { OutputLine } from './shell/types';
import type { TerminalTheme } from './themes';

interface Props {
  line: OutputLine;
  theme: TerminalTheme;
  fontSize: number;
}

/** Parse our custom \x1b[token] markup into styled spans */
function renderRich(content: string, theme: TerminalTheme): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /\x1b\[([^\]]+)\]|\x1b\[\/\]/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let currentStyle: React.CSSProperties = {};

  while ((match = regex.exec(content)) !== null) {
    // Text before this token
    if (match.index > lastIdx) {
      parts.push(
        <span key={lastIdx} style={currentStyle}>
          {content.slice(lastIdx, match.index)}
        </span>
      );
    }

    const token = match[0];
    if (token === '\x1b[/]') {
      currentStyle = {};
    } else {
      const tag = match[1];
      currentStyle = tokenToStyle(tag, theme);
    }
    lastIdx = match.index + token.length;
  }

  if (lastIdx < content.length) {
    parts.push(
      <span key={lastIdx} style={currentStyle}>
        {content.slice(lastIdx)}
      </span>
    );
  }

  return parts.length ? parts : [content];
}

function tokenToStyle(token: string, theme: TerminalTheme): React.CSSProperties {
  switch (token) {
    case 'hdr':
      return { color: theme.info, fontWeight: 700 };
    case 'sec':
      return { color: theme.prompt, fontWeight: 600 };
    case 'cmd':
      return { color: theme.colorGreen };
    case 'dir':
      return { color: theme.colorBlue, fontWeight: 600 };
    case 'code':
      return { color: theme.colorCyan };
    case 'img':
      return { color: theme.colorMagenta };
    case 'yellow':
      return { color: theme.colorYellow };
    case 'green':
      return { color: theme.colorGreen };
    case 'red':
      return { color: theme.colorRed };
    case 'blue':
      return { color: theme.colorBlue };
    case 'cyan':
      return { color: theme.colorCyan };
    case 'magenta':
      return { color: theme.colorMagenta };
    case 'dim':
      return { color: theme.textDim };
    case 'bold':
      return { fontWeight: 700 };
    default:
      return {};
  }
}

function lineColor(line: OutputLine, theme: TerminalTheme): string {
  switch (line.type) {
    case 'stderr':
      return theme.error;
    case 'success':
      return theme.success;
    case 'warning':
      return theme.warning;
    case 'info':
      return theme.info;
    case 'system':
      return theme.textDim;
    case 'prompt':
      return theme.textDim;
    case 'command':
      return theme.text;
    default:
      return theme.text;
  }
}

const TerminalOutputLine = memo(function TerminalOutputLine({ line, theme, fontSize }: Props) {
  const color = lineColor(line, theme);
  const isRich = line.content.includes('\x1b[');

  return (
    <div
      style={{
        fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
        fontSize: fontSize,
        lineHeight: '1.6',
        color,
        minHeight: '1.6em',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        padding: '0 4px',
        userSelect: 'text',
      }}
    >
      {isRich ? renderRich(line.content, theme) : line.content}
    </div>
  );
});

export default TerminalOutputLine;
