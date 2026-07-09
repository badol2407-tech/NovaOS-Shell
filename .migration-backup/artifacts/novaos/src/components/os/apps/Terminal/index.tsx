import React from 'react';
import { TerminalProvider } from './TerminalProvider';
import TerminalApp from './TerminalApp';

export default function TerminalAppRoot() {
  return (
    <TerminalProvider>
      <TerminalApp />
    </TerminalProvider>
  );
}
