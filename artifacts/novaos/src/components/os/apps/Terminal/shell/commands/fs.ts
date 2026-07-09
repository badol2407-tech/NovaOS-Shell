import type { CommandContext, CommandResult, OutputLine } from '../types';
import type { VFSNode } from '../../../FileManager/types';
import {
  genId,
  inferMimeType,
  getMimeCategory,
  HOME_ID,
  ROOT_ID,
} from '../../../FileManager/vfs';

// ─── Path utilities ───────────────────────────────────────────────────────────

/** Resolve a path string to a VFS node ID, or null if not found. */
export function resolvePath(
  nodes: Record<string, VFSNode>,
  cwdId: string,
  inputPath: string,
): string | null {
  if (!inputPath || inputPath === '.') return cwdId;
  if (inputPath === '~') return HOME_ID;
  if (inputPath === '/') return ROOT_ID;

  // Replace ~ with home
  const path = inputPath.startsWith('~/')
    ? inputPath.replace('~', getNodePath(nodes, HOME_ID))
    : inputPath;

  const parts = path.split('/').filter((p) => p !== '');
  let currentId = path.startsWith('/') ? ROOT_ID : cwdId;

  for (const part of parts) {
    if (part === '..') {
      const node = nodes[currentId];
      if (node?.parentId) currentId = node.parentId;
      continue;
    }
    if (part === '.') continue;

    const current = nodes[currentId];
    if (!current || current.type !== 'folder') return null;

    const child = current.children
      .map((id) => nodes[id])
      .find((n) => n?.name === part);
    if (!child) return null;
    currentId = child.id;
  }

  return currentId;
}

/** Get the display path string for a VFS node */
export function getNodePath(nodes: Record<string, VFSNode>, nodeId: string): string {
  if (nodeId === ROOT_ID) return '/';
  const parts: string[] = [];
  let current: VFSNode | undefined = nodes[nodeId];
  while (current && current.id !== ROOT_ID) {
    parts.unshift(current.name);
    current = current.parentId ? nodes[current.parentId] : undefined;
  }
  return '/' + parts.join('/');
}

/** Get home-relative path (replaces /home prefix with ~) */
export function getDisplayPath(nodes: Record<string, VFSNode>, nodeId: string): string {
  const full = getNodePath(nodes, nodeId);
  const homePath = getNodePath(nodes, HOME_ID);
  if (full === homePath) return '~';
  if (full.startsWith(homePath + '/')) return '~' + full.slice(homePath.length);
  return full;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0';
  if (bytes < 1024) return `${bytes}`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}

function colorName(node: VFSNode, name: string): string {
  if (node.type === 'folder') return `\x1b[dir]${name}/\x1b[/]`;
  if (node.mimeCategory === 'code') return `\x1b[code]${name}\x1b[/]`;
  if (node.mimeCategory === 'image') return `\x1b[img]${name}\x1b[/]`;
  return name;
}

// ─── Command implementations ──────────────────────────────────────────────────

export const fsCommands = {
  ls(ctx: CommandContext): CommandResult {
    const { session, nodes, args } = ctx;
    const showHidden = args.includes('-a') || args.includes('-la') || args.includes('-al');
    const longFormat = args.includes('-l') || args.includes('-la') || args.includes('-al') || args.includes('-lh');
    const targetArg = args.find((a) => !a.startsWith('-'));

    const targetId = targetArg
      ? resolvePath(nodes, session.cwdId, targetArg)
      : session.cwdId;

    if (!targetId) {
      return { output: [{ type: 'stderr', content: `ls: cannot access '${targetArg}': No such file or directory` }] };
    }

    const target = nodes[targetId];
    if (!target) {
      return { output: [{ type: 'stderr', content: `ls: cannot access '${targetArg}': No such file or directory` }] };
    }

    if (target.type === 'file') {
      return { output: [{ type: 'stdout', content: target.name }] };
    }

    const children = target.children
      .map((id) => nodes[id])
      .filter(Boolean)
      .filter((n) => showHidden || !n.name.startsWith('.'))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    if (children.length === 0) {
      return { output: [] };
    }

    if (longFormat) {
      const lines = children.map((n) => {
        const perm = n.type === 'folder' ? 'drwxr-xr-x' : '-rw-r--r--';
        const size = formatSize(n.size).padStart(6);
        const date = new Date(n.modifiedAt).toLocaleDateString('en-US', {
          month: 'short', day: '2-digit',
        });
        return { type: 'stdout' as const, content: `${perm}  1 user user ${size} ${date} ${colorName(n, n.name)}` };
      });
      return { output: [{ type: 'info', content: `total ${children.length}` }, ...lines] };
    }

    // Compact format — group into rows
    const names = children.map((n) => colorName(n, n.name));
    return { output: [{ type: 'stdout', content: names.join('  ') }] };
  },

  cd(ctx: CommandContext): CommandResult {
    const { session, nodes, args } = ctx;
    const target = args[0] ?? '~';
    const targetId = resolvePath(nodes, session.cwdId, target);

    if (!targetId) {
      return { output: [{ type: 'stderr', content: `cd: no such file or directory: ${target}` }] };
    }

    const node = nodes[targetId];
    if (!node || node.type !== 'folder') {
      return { output: [{ type: 'stderr', content: `cd: not a directory: ${target}` }] };
    }

    return { output: [], session: { cwdId: targetId, historyIndex: -1 } };
  },

  pwd(ctx: CommandContext): CommandResult {
    const { session, nodes } = ctx;
    return { output: [{ type: 'stdout', content: getNodePath(nodes, session.cwdId) }] };
  },

  mkdir(ctx: CommandContext): CommandResult {
    const { session, nodes, args } = ctx;
    const makeParents = args.includes('-p');
    const paths = args.filter((a) => !a.startsWith('-'));

    if (paths.length === 0) {
      return { output: [{ type: 'stderr', content: 'mkdir: missing operand' }] };
    }

    const allCreated: string[] = [];
    let currentNodes = { ...nodes };
    let err: string | null = null;

    for (const p of paths) {
      const parts = p.split('/').filter(Boolean);
      let parentId = p.startsWith('/') ? ROOT_ID : session.cwdId;

      for (let i = 0; i < parts.length; i++) {
        const name = parts[i];
        const parent = currentNodes[parentId];
        if (!parent || parent.type !== 'folder') {
          err = `mkdir: cannot create directory '${p}': Not a directory`;
          break;
        }
        const existing = parent.children.map((id) => currentNodes[id]).find((n) => n?.name === name);
        if (existing) {
          if (i < parts.length - 1 && makeParents) {
            parentId = existing.id;
            continue;
          }
          if (!makeParents) {
            err = `mkdir: cannot create directory '${name}': File exists`;
            break;
          }
          parentId = existing.id;
          continue;
        }

        const newId = genId();
        const newFolder: VFSNode = {
          id: newId, name, type: 'folder',
          parentId,
          children: [], size: 0,
          mimeType: 'inode/directory', mimeCategory: 'other',
          createdAt: Date.now(), modifiedAt: Date.now(),
          isFavorite: false,
        };
        currentNodes = {
          ...currentNodes,
          [newId]: newFolder,
          [parentId]: { ...currentNodes[parentId], children: [...currentNodes[parentId].children, newId], modifiedAt: Date.now() },
        };
        allCreated.push(name);
        parentId = newId;
      }
      if (err) break;
    }

    if (err) return { output: [{ type: 'stderr', content: err }] };

    const finalNodes = currentNodes;
    return {
      output: [],
      vfsMutation: () => finalNodes,
    };
  },

  touch(ctx: CommandContext): CommandResult {
    const { session, nodes, args } = ctx;
    const paths = args.filter((a) => !a.startsWith('-'));

    if (paths.length === 0) {
      return { output: [{ type: 'stderr', content: 'touch: missing file operand' }] };
    }

    let currentNodes = { ...nodes };
    let err: string | null = null;

    for (const p of paths) {
      const lastSlash = p.lastIndexOf('/');
      const dirPart = lastSlash > 0 ? p.slice(0, lastSlash) : null;
      const name = lastSlash >= 0 ? p.slice(lastSlash + 1) : p;

      const parentId = dirPart
        ? resolvePath(currentNodes, session.cwdId, dirPart)
        : session.cwdId;

      if (!parentId) { err = `touch: cannot touch '${p}': No such file or directory`; break; }

      const parent = currentNodes[parentId];
      if (!parent || parent.type !== 'folder') { err = `touch: cannot touch '${p}': Not a directory`; break; }

      const existing = parent.children.map((id) => currentNodes[id]).find((n) => n?.name === name);
      if (existing) {
        // Update timestamps only
        currentNodes = { ...currentNodes, [existing.id]: { ...existing, modifiedAt: Date.now() } };
        continue;
      }

      const mimeType = inferMimeType(name);
      const newId = genId();
      const newFile: VFSNode = {
        id: newId, name, type: 'file',
        parentId,
        children: [], size: 0,
        mimeType, mimeCategory: getMimeCategory(mimeType),
        createdAt: Date.now(), modifiedAt: Date.now(),
        isFavorite: false, content: '',
      };
      currentNodes = {
        ...currentNodes,
        [newId]: newFile,
        [parentId]: { ...parent, children: [...parent.children, newId], modifiedAt: Date.now() },
      };
    }

    if (err) return { output: [{ type: 'stderr', content: err }] };

    const finalNodes = currentNodes;
    return { output: [], vfsMutation: () => finalNodes };
  },

  rm(ctx: CommandContext): CommandResult {
    const { session, nodes, args } = ctx;
    const recursive = args.includes('-r') || args.includes('-rf') || args.includes('-fr') || args.includes('-R');
    const force = args.includes('-f') || args.includes('-rf') || args.includes('-fr');
    const paths = args.filter((a) => !a.startsWith('-'));

    if (paths.length === 0) {
      return { output: [{ type: 'stderr', content: 'rm: missing operand' }] };
    }

    let currentNodes = { ...nodes };
    let err: string | null = null;

    function deleteNode(id: string): void {
      const n = currentNodes[id];
      if (!n) return;
      if (n.type === 'folder') {
        for (const childId of n.children) deleteNode(childId);
      }
      delete currentNodes[id];
    }

    for (const p of paths) {
      const targetId = resolvePath(currentNodes, session.cwdId, p);
      if (!targetId) {
        if (!force) { err = `rm: cannot remove '${p}': No such file or directory`; break; }
        continue;
      }

      const target = currentNodes[targetId];
      if (!target) continue;

      if (target.type === 'folder' && !recursive) {
        err = `rm: cannot remove '${p}': Is a directory (use -r to remove directories)`;
        break;
      }

      if (target.parentId) {
        const parent = currentNodes[target.parentId];
        if (parent) {
          currentNodes = {
            ...currentNodes,
            [parent.id]: { ...parent, children: parent.children.filter((c) => c !== targetId), modifiedAt: Date.now() },
          };
        }
      }
      deleteNode(targetId);
    }

    if (err) return { output: [{ type: 'stderr', content: err }] };

    const finalNodes = currentNodes;
    return { output: [], vfsMutation: () => finalNodes };
  },

  mv(ctx: CommandContext): CommandResult {
    const { session, nodes, args } = ctx;
    const paths = args.filter((a) => !a.startsWith('-'));

    if (paths.length < 2) {
      return { output: [{ type: 'stderr', content: 'mv: missing destination file operand' }] };
    }

    const [src, dest] = paths;
    const srcId = resolvePath(nodes, session.cwdId, src);
    if (!srcId) return { output: [{ type: 'stderr', content: `mv: cannot stat '${src}': No such file or directory` }] };

    const srcNode = nodes[srcId];
    if (!srcNode) return { output: [{ type: 'stderr', content: `mv: source not found: ${src}` }] };

    let currentNodes = { ...nodes };

    // Determine destination
    const destId = resolvePath(currentNodes, session.cwdId, dest);
    let destParentId: string;
    let newName: string;

    if (destId && currentNodes[destId]?.type === 'folder') {
      // Moving into a folder
      destParentId = destId;
      newName = srcNode.name;
    } else {
      // Rename
      const lastSlash = dest.lastIndexOf('/');
      const dirPart = lastSlash > 0 ? dest.slice(0, lastSlash) : null;
      newName = lastSlash >= 0 ? dest.slice(lastSlash + 1) : dest;
      const resolvedParent = dirPart ? resolvePath(currentNodes, session.cwdId, dirPart) : session.cwdId;
      if (!resolvedParent) return { output: [{ type: 'stderr', content: `mv: cannot move to '${dest}': No such directory` }] };
      destParentId = resolvedParent;
    }

    // Remove from old parent
    if (srcNode.parentId && srcNode.parentId !== destParentId) {
      const oldParent = currentNodes[srcNode.parentId];
      if (oldParent) {
        currentNodes = {
          ...currentNodes,
          [oldParent.id]: { ...oldParent, children: oldParent.children.filter((c) => c !== srcId), modifiedAt: Date.now() },
        };
      }
    } else if (srcNode.parentId === destParentId) {
      const parent = currentNodes[srcNode.parentId];
      if (parent) {
        currentNodes = {
          ...currentNodes,
          [parent.id]: { ...parent, children: parent.children.filter((c) => c !== srcId), modifiedAt: Date.now() },
        };
      }
    }

    // Add to new parent
    const destParent = currentNodes[destParentId];
    currentNodes = {
      ...currentNodes,
      [srcId]: { ...srcNode, parentId: destParentId, name: newName, modifiedAt: Date.now() },
      [destParentId]: { ...destParent, children: [...destParent.children, srcId], modifiedAt: Date.now() },
    };

    const finalNodes = currentNodes;
    return { output: [], vfsMutation: () => finalNodes };
  },

  cp(ctx: CommandContext): CommandResult {
    const { session, nodes, args } = ctx;
    const recursive = args.includes('-r') || args.includes('-R');
    const paths = args.filter((a) => !a.startsWith('-'));

    if (paths.length < 2) {
      return { output: [{ type: 'stderr', content: 'cp: missing destination file operand' }] };
    }

    const [src, dest] = paths;
    const srcId = resolvePath(nodes, session.cwdId, src);
    if (!srcId) return { output: [{ type: 'stderr', content: `cp: cannot stat '${src}': No such file or directory` }] };

    const srcNode = nodes[srcId];
    if (!srcNode) return { output: [{ type: 'stderr', content: `cp: source not found: ${src}` }] };

    if (srcNode.type === 'folder' && !recursive) {
      return { output: [{ type: 'stderr', content: `cp: -r not specified; omitting directory '${src}'` }] };
    }

    let currentNodes = { ...nodes };

    function deepCopy(nodeId: string, newParentId: string, nameOverride?: string): string {
      const node = currentNodes[nodeId];
      if (!node) return nodeId;
      const newId = genId();
      const newNode: VFSNode = { ...node, id: newId, parentId: newParentId, name: nameOverride ?? node.name, createdAt: Date.now(), modifiedAt: Date.now(), children: [] };
      currentNodes[newId] = newNode;
      if (node.type === 'folder') {
        const childIds = node.children.map((cId) => deepCopy(cId, newId));
        currentNodes[newId] = { ...newNode, children: childIds };
      }
      return newId;
    }

    // Determine destination
    const destId = resolvePath(currentNodes, session.cwdId, dest);
    let destParentId: string;
    let newName: string;

    if (destId && currentNodes[destId]?.type === 'folder') {
      destParentId = destId;
      newName = srcNode.name;
    } else {
      const lastSlash = dest.lastIndexOf('/');
      newName = lastSlash >= 0 ? dest.slice(lastSlash + 1) : dest;
      const dirPart = lastSlash > 0 ? dest.slice(0, lastSlash) : null;
      const resolvedParent = dirPart ? resolvePath(currentNodes, session.cwdId, dirPart) : session.cwdId;
      if (!resolvedParent) return { output: [{ type: 'stderr', content: `cp: cannot create '${dest}': No such directory` }] };
      destParentId = resolvedParent;
    }

    const newNodeId = deepCopy(srcId, destParentId, newName);
    const destParent = currentNodes[destParentId];
    currentNodes = {
      ...currentNodes,
      [destParentId]: { ...destParent, children: [...destParent.children, newNodeId], modifiedAt: Date.now() },
    };

    const finalNodes = currentNodes;
    return { output: [], vfsMutation: () => finalNodes };
  },

  cat(ctx: CommandContext): CommandResult {
    const { session, nodes, args } = ctx;
    const paths = args.filter((a) => !a.startsWith('-'));

    if (paths.length === 0) {
      return { output: [{ type: 'stderr', content: 'cat: missing file operand' }] };
    }

    const output: Array<{ type: 'stdout' | 'stderr'; content: string }> = [];

    for (const p of paths) {
      const targetId = resolvePath(nodes, session.cwdId, p);
      if (!targetId) { output.push({ type: 'stderr', content: `cat: ${p}: No such file or directory` }); continue; }

      const node = nodes[targetId];
      if (!node) { output.push({ type: 'stderr', content: `cat: ${p}: No such file or directory` }); continue; }

      if (node.type === 'folder') { output.push({ type: 'stderr', content: `cat: ${p}: Is a directory` }); continue; }

      const content = node.content ?? '';
      if (!content) {
        output.push({ type: 'stdout', content: '' });
      } else {
        content.split('\n').forEach((line) => output.push({ type: 'stdout', content: line }));
      }
    }

    return { output };
  },

  tree(ctx: CommandContext): CommandResult {
    const { session, nodes, args } = ctx;
    const pathArg = args.find((a) => !a.startsWith('-'));
    const maxDepth = args.includes('-L') ? parseInt(args[args.indexOf('-L') + 1] ?? '3') : 3;

    const targetId = pathArg ? resolvePath(nodes, session.cwdId, pathArg) : session.cwdId;
    if (!targetId) return { output: [{ type: 'stderr', content: `tree: '${pathArg}': No such file or directory` }] };

    const lines: Array<{ type: 'stdout'; content: string }> = [];
    const target = nodes[targetId];
    lines.push({ type: 'stdout', content: target?.name ?? '.' });

    let fileCount = 0;
    let dirCount = 0;

    function walk(nodeId: string, prefix: string, depth: number): void {
      if (depth > maxDepth) return;
      const node = nodes[nodeId];
      if (!node || node.type !== 'folder') return;

      const children = node.children
        .map((id) => nodes[id])
        .filter(Boolean)
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

      children.forEach((child, i) => {
        const isLast = i === children.length - 1;
        const connector = isLast ? '└── ' : '├── ';
        const childPrefix = prefix + (isLast ? '    ' : '│   ');
        const name = child.type === 'folder' ? `\x1b[dir]${child.name}\x1b[/]` : child.name;
        lines.push({ type: 'stdout', content: `${prefix}${connector}${name}` });
        if (child.type === 'folder') {
          dirCount++;
          walk(child.id, childPrefix, depth + 1);
        } else {
          fileCount++;
        }
      });
    }

    walk(targetId, '', 1);
    lines.push({ type: 'stdout', content: '' });
    lines.push({ type: 'stdout', content: `${dirCount} director${dirCount === 1 ? 'y' : 'ies'}, ${fileCount} file${fileCount === 1 ? '' : 's'}` });
    return { output: lines };
  },

  find(ctx: CommandContext): CommandResult {
    const { session, nodes, args } = ctx;
    const nameIdx = args.indexOf('-name');
    const typeIdx = args.indexOf('-type');
    const namePattern = nameIdx >= 0 ? args[nameIdx + 1] : null;
    const typeFilter = typeIdx >= 0 ? args[typeIdx + 1] : null;

    const pathArg = args.find((a) => !a.startsWith('-') && args.indexOf(a) !== nameIdx + 1 && args.indexOf(a) !== typeIdx + 1);
    const rootId = pathArg ? resolvePath(nodes, session.cwdId, pathArg) : session.cwdId;
    if (!rootId) return { output: [{ type: 'stderr', content: `find: '${pathArg}': No such file or directory` }] };

    const results: string[] = [];

    function walk(nodeId: string, currentPath: string): void {
      const node = nodes[nodeId];
      if (!node) return;
      const nodePath = currentPath + '/' + node.name;

      let matches = true;
      if (namePattern) {
        const regex = new RegExp('^' + namePattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
        matches = regex.test(node.name);
      }
      if (typeFilter) {
        matches = matches && (typeFilter === 'f' ? node.type === 'file' : node.type === 'folder');
      }
      if (matches) results.push(nodePath);

      if (node.type === 'folder') {
        for (const childId of node.children) walk(childId, nodePath);
      }
    }

    const root = nodes[rootId];
    if (root?.type === 'folder') {
      for (const childId of root.children) walk(childId, getNodePath(nodes, rootId).replace(/\/$/, ''));
    }

    return { output: results.map((r) => ({ type: 'stdout' as const, content: r })) };
  },
};
