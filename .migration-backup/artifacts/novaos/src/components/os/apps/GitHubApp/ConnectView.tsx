import React, { useState } from 'react';
import { Github, Key, ExternalLink, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useSaveGitHubToken } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface ConnectViewProps {
  onConnect: () => void;
}

export default function ConnectView({ onConnect }: ConnectViewProps) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const saveToken = useSaveGitHubToken();

  const handleConnect = () => {
    if (!token.trim()) {
      setError('Please enter your Personal Access Token');
      return;
    }
    setError('');
    saveToken.mutate(
      { data: { token: token.trim() } },
      {
        onSuccess: () => {
          setToken('');
          onConnect();
        },
        onError: () => {
          setError('Invalid token — could not authenticate with GitHub. Make sure it has the "repo" scope.');
        },
      },
    );
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-8 bg-background">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Github className="w-10 h-10 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Connect to GitHub</h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              Enter a Personal Access Token to browse your repositories, view commits, and explore branches — right inside NovaOS.
            </p>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3 text-sm">
          {[
            { step: '1', text: 'Go to GitHub → Settings → Developer settings → Personal access tokens' },
            { step: '2', text: 'Generate a new token (classic) with the "repo" scope' },
            { step: '3', text: 'Copy the token and paste it below' },
          ].map(({ step, text }) => (
            <div key={step} className="flex gap-3 p-3 rounded-lg bg-muted/50">
              <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {step}
              </span>
              <span className="text-muted-foreground">{text}</span>
            </div>
          ))}
        </div>

        <a
          href="https://github.com/settings/tokens/new?scopes=repo&description=NovaOS"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 text-sm text-primary hover:underline font-medium"
        >
          <ExternalLink className="w-4 h-4" />
          Create token on GitHub
        </a>

        {/* Input */}
        <div className="space-y-3">
          <div className="relative">
            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="password"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              value={token}
              onChange={e => setToken(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConnect()}
              className={cn("pl-10 font-mono text-sm", error && "border-destructive focus-visible:ring-destructive")}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <Button
            onClick={handleConnect}
            disabled={saveToken.isPending || !token.trim()}
            className="w-full"
          >
            {saveToken.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting…
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Connect GitHub Account
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Your token is stored securely on the server and is never shared.
        </p>
      </div>
    </div>
  );
}
