import React from 'react';
import { Github, LogOut, Loader2 } from 'lucide-react';
import {
  useGetGitHubStatus,
  useDeleteGitHubToken,
  getGetGitHubStatusQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ConnectView from './ConnectView';
import RepoList from './RepoList';
import CommitList from './CommitList';
import { useGitHub } from './GitHubProvider';

export default function GitHubAppContent() {
  const { data: status, isLoading } = useGetGitHubStatus();
  const queryClient = useQueryClient();
  const { selectedRepo, view } = useGitHub();

  const deleteToken = useDeleteGitHubToken({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetGitHubStatusQueryKey() });
      },
    },
  });

  const handleConnect = () => {
    queryClient.invalidateQueries({ queryKey: getGetGitHubStatusQueryKey() });
  };

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!status?.connected) {
    return <ConnectView onConnect={handleConnect} />;
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 bg-muted/20 shrink-0">
        <Github className="w-5 h-5 text-foreground/80 shrink-0" />
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Avatar className="w-6 h-6">
            <AvatarImage src={status.avatarUrl ?? undefined} />
            <AvatarFallback className="text-[10px]">
              {(status.login ?? 'GH').slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate leading-tight">{status.name || status.login}</div>
            {status.name && (
              <div className="text-xs text-muted-foreground leading-tight truncate">@{status.login}</div>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-destructive shrink-0"
          onClick={() => deleteToken.mutate()}
          disabled={deleteToken.isPending}
        >
          {deleteToken.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <LogOut className="w-3.5 h-3.5" />
          )}
          Disconnect
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {!selectedRepo || view === 'repos' ? <RepoList /> : <CommitList />}
      </div>
    </div>
  );
}
