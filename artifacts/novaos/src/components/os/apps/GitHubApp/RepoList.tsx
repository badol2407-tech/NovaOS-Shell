import React, { useState } from 'react';
import { Search, Star, GitFork, Lock, Unlock, RefreshCw, Loader2 } from 'lucide-react';
import { useListGitHubRepos } from '@workspace/api-client-react';
import type { GitHubRepo } from '@workspace/api-client-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useGitHub } from './GitHubProvider';

const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Rust: '#dea584',
  Go: '#00ADD8',
  Java: '#b07219',
  CSS: '#563d7c',
  HTML: '#e34c26',
  Ruby: '#701516',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  'C++': '#f34b7d',
  C: '#555555',
  Dart: '#00B4AB',
};

function LanguageDot({ lang }: { lang: string | null }) {
  if (!lang) return null;
  const color = LANG_COLORS[lang] ?? '#8b949e';
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
      {lang}
    </span>
  );
}

export default function RepoList() {
  const [search, setSearch] = useState('');
  const { selectRepo } = useGitHub();
  const { data: repos = [], isLoading, refetch, isRefetching } = useListGitHubRepos();

  const filtered = repos.filter(r =>
    r.fullName.toLowerCase().includes(search.toLowerCase()) ||
    (r.description ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search repositories…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-8 text-sm bg-muted/30 border-transparent focus-visible:border-border"
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <RefreshCw className={cn("w-4 h-4", isRefetching && "animate-spin")} />
        </Button>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground text-sm">
            {search ? 'No repositories matched your search.' : 'No repositories found.'}
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {filtered.map(repo => (
              <RepoRow
                key={repo.id}
                repo={repo}
                onSelect={() => selectRepo(repo.fullName.split('/')[0], repo.fullName.split('/')[1], repo.defaultBranch)}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="px-4 py-2 border-t border-border/30 text-xs text-muted-foreground">
        {filtered.length} of {repos.length} repositories
      </div>
    </div>
  );
}

function RepoRow({ repo, onSelect }: { repo: GitHubRepo; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            {repo.private ? (
              <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            ) : (
              <Unlock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            )}
            <span className="font-medium text-sm text-primary group-hover:underline truncate">
              {repo.fullName}
            </span>
            {repo.private && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                Private
              </Badge>
            )}
          </div>
          {repo.description && (
            <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{repo.description}</p>
          )}
          <div className="flex items-center gap-4 flex-wrap">
            <LanguageDot lang={repo.language} />
            {repo.stargazersCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="w-3 h-3" />
                {repo.stargazersCount.toLocaleString()}
              </span>
            )}
            {repo.forksCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <GitFork className="w-3 h-3" />
                {repo.forksCount.toLocaleString()}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              Updated {formatDistanceToNow(new Date(repo.updatedAt), { addSuffix: true })}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
