import type { CommandContext, CommandResult, GitRepoState } from '../types';
import { genId } from '../../../FileManager/vfs';
import type { VFSNode } from '../../../FileManager/types';

function randomHash(): string {
  return Math.random().toString(16).slice(2, 10);
}

function getOrCreateRepo(ctx: CommandContext): GitRepoState {
  return ctx.session.gitRepos[ctx.session.cwdId] ?? {
    initialized: false,
    branch: 'main',
    staged: [],
    commits: [],
  };
}

export const gitCommands = {
  git(ctx: CommandContext): CommandResult {
    const { session, nodes, args } = ctx;
    const sub = args[0];
    const repo = getOrCreateRepo(ctx);

    switch (sub) {
      case 'init': {
        if (repo.initialized) {
          return { output: [{ type: 'info', content: `Reinitialized existing Git repository in ${nodes[session.cwdId]?.name ?? '.'}/.git/` }] };
        }

        // Create .git folder in VFS
        const gitId = genId();
        const gitFolder: VFSNode = {
          id: gitId, name: '.git', type: 'folder',
          parentId: session.cwdId, children: [], size: 0,
          mimeType: 'inode/directory', mimeCategory: 'other',
          createdAt: Date.now(), modifiedAt: Date.now(), isFavorite: false,
        };

        const newRepo: GitRepoState = { initialized: true, branch: 'main', staged: [], commits: [] };
        const updatedRepos = { ...session.gitRepos, [session.cwdId]: newRepo };
        const dirName = nodes[session.cwdId]?.name ?? '.';

        return {
          output: [
            { type: 'success', content: `Initialized empty Git repository in ${dirName}/.git/` },
          ],
          session: { gitRepos: updatedRepos },
          vfsMutation: (prev) => ({
            ...prev,
            [gitId]: gitFolder,
            [session.cwdId]: {
              ...prev[session.cwdId],
              children: [...(prev[session.cwdId]?.children ?? []), gitId],
              modifiedAt: Date.now(),
            },
          }),
        };
      }

      case 'status': {
        if (!repo.initialized) {
          return { output: [{ type: 'stderr', content: 'fatal: not a git repository (or any of the parent directories): .git' }] };
        }

        const cwd = nodes[session.cwdId];
        const allFiles = cwd?.children
          .map((id) => nodes[id])
          .filter((n) => n && n.type === 'file' && n.name !== '.git')
          .map((n) => n!.name) ?? [];

        const untracked = allFiles.filter((f) => !repo.staged.includes(f) && !repo.commits.some((c) => c.message.includes(f)));

        const lines: Array<{ type: 'stdout' | 'info' | 'success' | 'warning'; content: string }> = [
          { type: 'info', content: `On branch ${repo.branch}` },
        ];

        if (repo.commits.length === 0) {
          lines.push({ type: 'info', content: 'No commits yet' });
        }

        if (repo.staged.length > 0) {
          lines.push({ type: 'stdout', content: '' });
          lines.push({ type: 'success', content: 'Changes to be committed:' });
          lines.push({ type: 'info', content: '  (use "git restore --staged <file>..." to unstage)' });
          repo.staged.forEach((f) => lines.push({ type: 'success', content: `\t\x1b[green]new file:   ${f}\x1b[/]` }));
        }

        if (untracked.length > 0) {
          lines.push({ type: 'stdout', content: '' });
          lines.push({ type: 'warning', content: 'Untracked files:' });
          lines.push({ type: 'info', content: '  (use "git add <file>..." to include in what will be committed)' });
          untracked.forEach((f) => lines.push({ type: 'warning', content: `\t${f}` }));
        }

        if (repo.staged.length === 0 && untracked.length === 0 && repo.commits.length > 0) {
          lines.push({ type: 'success', content: 'nothing to commit, working tree clean' });
        }

        return { output: lines };
      }

      case 'add': {
        if (!repo.initialized) {
          return { output: [{ type: 'stderr', content: 'fatal: not a git repository' }] };
        }

        const target = args[1];
        if (!target) return { output: [{ type: 'stderr', content: 'fatal: no files to add' }] };

        const cwd = nodes[session.cwdId];
        let toStage: string[];

        if (target === '.' || target === '-A' || target === '--all') {
          toStage = cwd?.children
            .map((id) => nodes[id])
            .filter((n) => n && n.type === 'file')
            .map((n) => n!.name) ?? [];
        } else {
          toStage = [target];
        }

        const newStaged = [...new Set([...repo.staged, ...toStage])];
        const updatedRepo: GitRepoState = { ...repo, staged: newStaged };
        return {
          output: [],
          session: { gitRepos: { ...session.gitRepos, [session.cwdId]: updatedRepo } },
        };
      }

      case 'commit': {
        if (!repo.initialized) {
          return { output: [{ type: 'stderr', content: 'fatal: not a git repository' }] };
        }

        const msgIdx = args.indexOf('-m');
        const message = msgIdx >= 0 ? args[msgIdx + 1] : null;

        if (!message) {
          return { output: [{ type: 'stderr', content: 'error: commit message is required (use -m "message")' }] };
        }

        if (repo.staged.length === 0) {
          return { output: [{ type: 'info', content: 'nothing to commit, working tree clean' }] };
        }

        const hash = randomHash();
        const newCommit = {
          hash,
          message,
          author: 'nova-user <user@novaos.dev>',
          date: new Date().toLocaleString(),
        };

        const updatedRepo: GitRepoState = {
          ...repo,
          staged: [],
          commits: [...repo.commits, newCommit],
        };

        return {
          output: [
            { type: 'success', content: `[${repo.branch} ${hash}] ${message}` },
            { type: 'info', content: ` ${repo.staged.length} file${repo.staged.length > 1 ? 's' : ''} changed` },
          ],
          session: { gitRepos: { ...session.gitRepos, [session.cwdId]: updatedRepo } },
        };
      }

      case 'log': {
        if (!repo.initialized) {
          return { output: [{ type: 'stderr', content: 'fatal: not a git repository' }] };
        }
        if (repo.commits.length === 0) {
          return { output: [{ type: 'info', content: "fatal: your current branch 'main' does not have any commits yet" }] };
        }

        const lines: Array<{ type: 'stdout' | 'info'; content: string }> = [];
        [...repo.commits].reverse().forEach((c) => {
          lines.push({ type: 'info', content: `\x1b[yellow]commit ${c.hash}\x1b[/]` });
          lines.push({ type: 'stdout', content: `Author: ${c.author}` });
          lines.push({ type: 'stdout', content: `Date:   ${c.date}` });
          lines.push({ type: 'stdout', content: '' });
          lines.push({ type: 'stdout', content: `    ${c.message}` });
          lines.push({ type: 'stdout', content: '' });
        });
        return { output: lines };
      }

      case 'branch': {
        if (!repo.initialized) {
          return { output: [{ type: 'stderr', content: 'fatal: not a git repository' }] };
        }
        const newBranch = args[1];
        if (!newBranch) {
          return { output: [{ type: 'success', content: `* ${repo.branch}` }] };
        }
        const updatedRepo: GitRepoState = { ...repo };
        return {
          output: [{ type: 'info', content: `Created branch '${newBranch}'` }],
        };
      }

      case 'checkout': {
        if (!repo.initialized) {
          return { output: [{ type: 'stderr', content: 'fatal: not a git repository' }] };
        }
        const branchName = args.includes('-b') ? args[args.indexOf('-b') + 1] : args[1];
        if (!branchName) return { output: [{ type: 'stderr', content: 'error: missing branch name' }] };

        const isNew = args.includes('-b');
        const updatedRepo: GitRepoState = { ...repo, branch: branchName };
        return {
          output: [
            isNew
              ? { type: 'success', content: `Switched to a new branch '${branchName}'` }
              : { type: 'success', content: `Switched to branch '${branchName}'` },
          ],
          session: { gitRepos: { ...session.gitRepos, [session.cwdId]: updatedRepo } },
        };
      }

      case 'diff': {
        if (!repo.initialized) {
          return { output: [{ type: 'stderr', content: 'fatal: not a git repository' }] };
        }
        if (repo.staged.length === 0) {
          return { output: [{ type: 'info', content: '(no changes)' }] };
        }
        return {
          output: [
            { type: 'info', content: `diff --git a/ b/` },
            ...repo.staged.map((f) => ({ type: 'success' as const, content: `+++ ${f} (modified)` })),
          ],
        };
      }

      case 'clone': {
        const url = args[1];
        if (!url) return { output: [{ type: 'stderr', content: 'fatal: url required' }] };
        return {
          output: [{ type: 'info', content: `Cloning into '${url.split('/').pop()?.replace('.git', '') ?? 'repo'}'...` }],
          asyncEffect: async (emit) => {
            await new Promise((r) => setTimeout(r, 600));
            emit({ type: 'stdout', content: 'remote: Enumerating objects...' });
            await new Promise((r) => setTimeout(r, 400));
            emit({ type: 'stdout', content: 'Receiving objects: 100% done.' });
            await new Promise((r) => setTimeout(r, 300));
            emit({ type: 'success', content: `✓ Cloned successfully.` });
          },
        };
      }

      case 'remote': {
        if (!repo.initialized) {
          return { output: [{ type: 'stderr', content: 'fatal: not a git repository' }] };
        }
        if (args[1] === 'add') {
          const remoteName = args[2] ?? 'origin';
          const remoteUrl = args[3] ?? '';
          return { output: [{ type: 'info', content: `Remote '${remoteName}' added: ${remoteUrl}` }] };
        }
        if (args[1] === '-v') {
          return { output: [{ type: 'info', content: '(no remotes configured)' }] };
        }
        return { output: [{ type: 'info', content: '(no remotes)' }] };
      }

      case 'push':
        return {
          output: [{ type: 'info', content: `Pushing to origin/${repo.branch}...` }],
          asyncEffect: async (emit) => {
            await new Promise((r) => setTimeout(r, 700));
            emit({ type: 'success', content: `✓ Branch '${repo.branch}' pushed to origin.` });
          },
        };

      case 'pull':
        return {
          output: [{ type: 'info', content: `Pulling from origin/${repo.branch}...` }],
          asyncEffect: async (emit) => {
            await new Promise((r) => setTimeout(r, 500));
            emit({ type: 'success', content: `Already up to date.` });
          },
        };

      case 'stash':
        return { output: [{ type: 'info', content: 'Saved working directory and index state WIP on main' }] };

      case 'help':
      case undefined:
        return {
          output: [
            { type: 'info', content: 'usage: git <command> [<args>]' },
            { type: 'stdout', content: '' },
            { type: 'info', content: 'Available commands:' },
            { type: 'stdout', content: '  init        Initialize a repository' },
            { type: 'stdout', content: '  status      Show working tree status' },
            { type: 'stdout', content: '  add         Stage changes' },
            { type: 'stdout', content: '  commit -m   Record staged changes' },
            { type: 'stdout', content: '  log         Show commit history' },
            { type: 'stdout', content: '  branch      List or create branches' },
            { type: 'stdout', content: '  checkout    Switch branches' },
            { type: 'stdout', content: '  diff        Show changes' },
            { type: 'stdout', content: '  clone       Clone a repository' },
            { type: 'stdout', content: '  push/pull   Sync with remote' },
          ],
        };

      default:
        return { output: [{ type: 'stderr', content: `git: '${sub}' is not a git command. See 'git help'.` }] };
    }
  },
};
