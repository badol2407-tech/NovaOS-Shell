import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useFileManager } from '../FileManagerProvider';
import { FileIcon } from './FileIcon';
import { VFSNode } from '../types';
import { cn } from '@/lib/utils';
import { ROOT_ID } from '../vfs';

interface TreeNodeProps {
  nodeId: string;
  depth: number;
}

function TreeNode({ nodeId, depth }: TreeNodeProps) {
  const { state, navigate, openItem, setDragOver, endDrag, moveItems } = useFileManager();
  const { nodes, currentFolderId, drag } = state;
  const node = nodes[nodeId];
  const [expanded, setExpanded] = useState(depth < 2);

  if (!node || node.type !== 'folder') return null;

  const isActive = currentFolderId === nodeId;
  const isDragOver = drag.overFolderId === nodeId;
  const folderChildren = node.children
    .map(id => nodes[id])
    .filter((n): n is VFSNode => !!n && n.type === 'folder');

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    setExpanded(prev => !prev);
  }

  return (
    <div>
      <motion.div
        layout
        className={cn(
          'group flex items-center gap-1 h-7 rounded-lg cursor-pointer select-none transition-colors',
          isActive ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
          isDragOver && !isActive && 'bg-primary/10 ring-1 ring-primary/40'
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px`, paddingRight: '6px' }}
        onClick={() => { navigate(nodeId); setExpanded(true); }}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(nodeId); setExpanded(true); }
          if (e.key === 'ArrowRight') { e.preventDefault(); setExpanded(true); }
          if (e.key === 'ArrowLeft') { e.preventDefault(); setExpanded(false); }
        }}
        onDragOver={e => { e.preventDefault(); setDragOver(nodeId); }}
        onDragLeave={() => setDragOver(null)}
        onDrop={e => {
          e.preventDefault();
          const ids = e.dataTransfer.getData('application/nova-fm-ids').split(',').filter(Boolean);
          if (ids.length) moveItems(ids, nodeId);
          endDrag();
          setDragOver(null);
        }}
        tabIndex={0}
        role="treeitem"
        aria-label={node.name}
        aria-expanded={expanded}
      >
        <button
          className={cn(
            'w-4 h-4 flex items-center justify-center rounded flex-shrink-0 transition-transform',
            folderChildren.length === 0 && 'opacity-0 pointer-events-none'
          )}
          onClick={toggle}
        >
          <motion.span
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.15 }}
            className="flex"
          >
            <ChevronRight size={12} />
          </motion.span>
        </button>
        <FileIcon node={node} size={14} isOpen={expanded && isActive} className="flex-shrink-0" />
        <span className="text-xs font-medium truncate flex-1">{node.name}</span>
      </motion.div>

      <AnimatePresence initial={false}>
        {expanded && folderChildren.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {folderChildren.map(child => (
              <TreeNode key={child.id} nodeId={child.id} depth={depth + 1} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FolderTree() {
  const { state } = useFileManager();
  const root = state.nodes[ROOT_ID];
  if (!root) return null;

  return (
    <div className="py-2 px-2 space-y-0.5">
      <TreeNode nodeId={ROOT_ID} depth={0} />
    </div>
  );
}
