import type { CommandContext, CommandResult, NpmPackageState } from '../types';
import { genId } from '../../../FileManager/vfs';
import type { VFSNode } from '../../../FileManager/types';
import { resolvePath } from './fs';

function getPackageJson(nodes: Record<string, VFSNode>, cwdId: string): NpmPackageState | null {
  const cwd = nodes[cwdId];
  if (!cwd || cwd.type !== 'folder') return null;
  const pkgFile = cwd.children.map((id) => nodes[id]).find((n) => n?.name === 'package.json');
  if (!pkgFile || pkgFile.type !== 'file') return null;
  try {
    return JSON.parse(pkgFile.content ?? '{}');
  } catch {
    return null;
  }
}

export const npmCommands = {
  npm(ctx: CommandContext): CommandResult {
    const { session, nodes, args } = ctx;
    const sub = args[0];

    switch (sub) {
      case 'init':
      case 'init -y': {
        const name = nodes[session.cwdId]?.name ?? 'my-project';
        const pkg: NpmPackageState = {
          name, version: '1.0.0', description: '',
          scripts: { test: 'echo "Error: no test specified" && exit 1', start: 'node index.js' },
          dependencies: {}, devDependencies: {},
        };
        const content = JSON.stringify(pkg, null, 2);
        const cwd = nodes[session.cwdId];
        const existing = cwd?.children.map((id) => nodes[id]).find((n) => n?.name === 'package.json');

        if (existing) {
          return { output: [{ type: 'info', content: 'package.json already exists.' }] };
        }

        const newId = genId();
        const newFile: VFSNode = {
          id: newId, name: 'package.json', type: 'file',
          parentId: session.cwdId,
          children: [], size: content.length,
          mimeType: 'application/json', mimeCategory: 'code',
          createdAt: Date.now(), modifiedAt: Date.now(),
          isFavorite: false, content,
        };
        const newNodeModulesId = genId();
        const nodeModules: VFSNode = {
          id: newNodeModulesId, name: 'node_modules', type: 'folder',
          parentId: session.cwdId, children: [], size: 0,
          mimeType: 'inode/directory', mimeCategory: 'other',
          createdAt: Date.now(), modifiedAt: Date.now(), isFavorite: false,
        };
        const finalNodes = {
          ...nodes,
          [newId]: newFile,
          [newNodeModulesId]: nodeModules,
          [session.cwdId]: {
            ...nodes[session.cwdId],
            children: [...(nodes[session.cwdId]?.children ?? []), newId, newNodeModulesId],
            modifiedAt: Date.now(),
          },
        };

        return {
          output: [
            { type: 'success', content: `Wrote to ${nodes[session.cwdId]?.name ?? '.'}/package.json` },
            { type: 'info', content: '' },
            ...content.split('\n').map((line) => ({ type: 'stdout' as const, content: line })),
          ],
          vfsMutation: () => finalNodes,
        };
      }

      case 'install':
      case 'i': {
        const pkg = getPackageJson(nodes, session.cwdId);
        if (!pkg) {
          return {
            output: [
              { type: 'warning', content: 'npm warn saveError ENOENT: no such file or directory, open package.json' },
              { type: 'info', content: 'Run `npm init` to initialize a package.json' },
            ],
          };
        }

        const packages = args.slice(1).filter((a) => !a.startsWith('-'));
        const isDev = args.includes('--save-dev') || args.includes('-D');
        const isSave = args.includes('--save') || args.includes('-S') || (!args.includes('--no-save') && !isDev);

        if (packages.length === 0) {
          // Install all deps from package.json
          const allDeps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
          if (allDeps.length === 0) {
            return { output: [{ type: 'success', content: 'up to date, audited 0 packages in 0s' }] };
          }

          return {
            output: [{ type: 'info', content: `added ${allDeps.length} packages` }],
            asyncEffect: async (emit) => {
              emit({ type: 'info', content: '' });
              for (let i = 0; i <= allDeps.length; i++) {
                await new Promise((r) => setTimeout(r, 120));
                emit({ type: 'stdout', content: `  ${i}/${allDeps.length} packages installed` });
              }
              emit({ type: 'success', content: `✓ added ${allDeps.length} packages in ${(allDeps.length * 0.12).toFixed(1)}s` });
            },
          };
        }

        // Install specific packages
        return {
          output: [{ type: 'info', content: `npm: installing ${packages.join(', ')}...` }],
          asyncEffect: async (emit) => {
            for (const pkgName of packages) {
              await new Promise((r) => setTimeout(r, 400 + Math.random() * 300));
              const version = `^${Math.floor(Math.random() * 5 + 1)}.${Math.floor(Math.random() * 20)}.${Math.floor(Math.random() * 10)}`;
              emit({ type: 'stdout', content: `  + ${pkgName}@${version}` });
            }
            await new Promise((r) => setTimeout(r, 300));
            emit({ type: 'success', content: `✓ added ${packages.length} package${packages.length > 1 ? 's' : ''} in ${((packages.length * 0.7) + 0.3).toFixed(1)}s` });
          },
        };
      }

      case 'run': {
        const scriptName = args[1];
        const pkg = getPackageJson(nodes, session.cwdId);
        if (!pkg) {
          return { output: [{ type: 'stderr', content: 'npm error: missing package.json' }] };
        }
        if (!scriptName) {
          const scripts = Object.entries(pkg.scripts ?? {});
          if (scripts.length === 0) return { output: [{ type: 'info', content: 'No scripts defined.' }] };
          return {
            output: [
              { type: 'info', content: 'Available scripts:' },
              ...scripts.map(([k, v]) => ({ type: 'stdout' as const, content: `  ${k}: ${v}` })),
            ],
          };
        }
        const script = pkg.scripts?.[scriptName];
        if (!script) {
          return { output: [{ type: 'stderr', content: `npm error: missing script: ${scriptName}` }] };
        }
        return {
          output: [{ type: 'info', content: `> ${pkg.name}@${pkg.version} ${scriptName}` }, { type: 'info', content: `> ${script}` }, { type: 'stdout', content: '' }],
          asyncEffect: async (emit) => {
            await new Promise((r) => setTimeout(r, 800));
            if (scriptName === 'test') {
              emit({ type: 'stderr', content: 'Error: no test specified' });
            } else if (scriptName === 'start') {
              emit({ type: 'success', content: `Server running on port 3000` });
              await new Promise((r) => setTimeout(r, 200));
              emit({ type: 'info', content: `Press Ctrl+C to stop.` });
            } else if (scriptName === 'build') {
              emit({ type: 'info', content: 'Building...' });
              await new Promise((r) => setTimeout(r, 600));
              emit({ type: 'success', content: '✓ Build complete' });
            } else {
              emit({ type: 'stdout', content: `Executed: ${script}` });
            }
          },
        };
      }

      case 'list':
      case 'ls': {
        const pkg = getPackageJson(nodes, session.cwdId);
        if (!pkg) return { output: [{ type: 'stderr', content: 'npm error: missing package.json' }] };
        const deps = Object.entries(pkg.dependencies ?? {});
        const devDeps = Object.entries(pkg.devDependencies ?? {});
        const lines: Array<{ type: 'stdout' | 'info'; content: string }> = [
          { type: 'info', content: `${pkg.name}@${pkg.version}` },
        ];
        if (deps.length > 0) {
          lines.push({ type: 'info', content: 'dependencies:' });
          deps.forEach(([k, v]) => lines.push({ type: 'stdout', content: `  ${k}@${v}` }));
        }
        if (devDeps.length > 0) {
          lines.push({ type: 'info', content: 'devDependencies:' });
          devDeps.forEach(([k, v]) => lines.push({ type: 'stdout', content: `  ${k}@${v}` }));
        }
        return { output: lines };
      }

      case 'version':
      case '-v':
      case '--version':
        return { output: [{ type: 'stdout', content: '10.9.0' }] };

      case 'help':
      case undefined:
        return {
          output: [
            { type: 'info', content: 'npm <command>' },
            { type: 'stdout', content: '' },
            { type: 'info', content: 'Usage:' },
            { type: 'stdout', content: '  npm init [-y]         Initialize package.json' },
            { type: 'stdout', content: '  npm install [pkg]     Install dependencies' },
            { type: 'stdout', content: '  npm run [script]      Run a script' },
            { type: 'stdout', content: '  npm list              List installed packages' },
            { type: 'stdout', content: '  npm -v                Show npm version' },
          ],
        };

      default:
        return { output: [{ type: 'stderr', content: `npm: unknown command: ${sub}` }] };
    }
  },
};
