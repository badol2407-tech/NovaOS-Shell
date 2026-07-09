import React, { createContext, useContext, useState, ReactNode } from 'react';

interface GitHubContextType {
  selectedRepo: { owner: string; repo: string; defaultBranch: string } | null;
  selectRepo: (owner: string, repo: string, defaultBranch: string) => void;
  clearRepo: () => void;
  selectedBranch: string;
  setSelectedBranch: (branch: string) => void;
  view: 'repos' | 'commits' | 'branches';
  setView: (v: 'repos' | 'commits' | 'branches') => void;
}

const GitHubContext = createContext<GitHubContextType | undefined>(undefined);

export function GitHubProvider({ children }: { children: ReactNode }) {
  const [selectedRepo, setSelectedRepo] = useState<{ owner: string; repo: string; defaultBranch: string } | null>(null);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [view, setView] = useState<'repos' | 'commits' | 'branches'>('repos');

  const selectRepo = (owner: string, repo: string, defaultBranch: string) => {
    setSelectedRepo({ owner, repo, defaultBranch });
    setSelectedBranch(defaultBranch);
    setView('commits');
  };

  const clearRepo = () => {
    setSelectedRepo(null);
    setSelectedBranch('');
    setView('repos');
  };

  return (
    <GitHubContext.Provider value={{
      selectedRepo, selectRepo, clearRepo,
      selectedBranch, setSelectedBranch,
      view, setView,
    }}>
      {children}
    </GitHubContext.Provider>
  );
}

export function useGitHub() {
  const ctx = useContext(GitHubContext);
  if (!ctx) throw new Error('useGitHub must be inside GitHubProvider');
  return ctx;
}
