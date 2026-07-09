import React from 'react';
import { GitHubProvider } from './GitHubProvider';
import GitHubAppContent from './GitHubAppContent';

export default function GitHubApp() {
  return (
    <GitHubProvider>
      <GitHubAppContent />
    </GitHubProvider>
  );
}
