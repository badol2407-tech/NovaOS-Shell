import React from 'react';
import { GitCommit, ExternalLink, Loader2, ArrowLeft, GitBranch, ChevronDown } from 'lucide-react';
import {
  useListGitHubCommits,
  useListGitHubBranches,
  getListGitHubBranchesQueryKey,
  getListGitHubCommitsQueryKey,
} from '@workspace/api-client-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { useGitHub } from './GitHubProvider';

export default function CommitList() {
  const { selectedRepo, selectedBranch, setSelectedBranch, clearRepo } = useGitHub();

  const { data: branches = [] } = useListGitHubBranches(
    selectedRepo?.owner ?? '',
    selectedRepo?.repo ?? '',
    {
      query: {
        enabled: !!selectedRepo,
        queryKey: getListGitHubBranchesQueryKey(selectedRepo?.owner ?? '', selectedRepo?.repo ?? ''),
      },
    },
  );

  const commitsParams = { branch: selectedBranch || undefined, per_page: 30 };
  const { data: commits = [], isLoading } = useListGitHubCommits(
    selectedRepo?.owner ?? '',
    selectedRepo?.repo ?? '',
    commitsParams,
    {
      query: {
        enabled: !!selectedRepo,
        queryKey: getListGitHubCommitsQueryKey(selectedRepo?.owner ?? '', selectedRepo?.repo ?? '', commitsParams),
      },
    },
  );

  if (!selectedRepo) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-muted/20">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearRepo}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">
            {selectedRepo.owner}/{selectedRepo.repo}
          </div>
          <div className="text-xs text-muted-foreground">Commit history</div>
        </div>

        {/* Branch selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs shrink-0">
              <GitBranch className="w-3.5 h-3.5" />
              <span className="max-w-[120px] truncate">{selectedBranch}</span>
              <ChevronDown className="w-3 h-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
            {branches.map(b => (
              <DropdownMenuItem
                key={b.name}
                onClick={() => setSelectedBranch(b.name)}
                className="text-xs"
              >
                <GitBranch className="w-3.5 h-3.5 mr-2 opacity-50" />
                {b.name}
                {b.protected && (
                  <span className="ml-auto text-muted-foreground text-[10px]">protected</span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Commits */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : commits.length === 0 ? (
          <div className="py-20 text-center text-sm text-muted-foreground">No commits found.</div>
        ) : (
          <div className="divide-y divide-border/30">
            {commits.map(commit => (
              <div key={commit.sha} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                <Avatar className="w-8 h-8 shrink-0 mt-0.5">
                  <AvatarImage src={commit.authorAvatarUrl ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {(commit.author ?? 'U').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium line-clamp-2 mb-1">{commit.message}</div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span className="font-medium text-foreground/70">{commit.author}</span>
                    <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px]">
                      {commit.sha}
                    </span>
                    <span>{formatDistanceToNow(new Date(commit.date), { addSuffix: true })}</span>
                  </div>
                </div>

                <a
                  href={commit.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="px-4 py-2 border-t border-border/30 text-xs text-muted-foreground">
        {commits.length} commits on <span className="font-mono">{selectedBranch}</span>
      </div>
    </div>
  );
}
