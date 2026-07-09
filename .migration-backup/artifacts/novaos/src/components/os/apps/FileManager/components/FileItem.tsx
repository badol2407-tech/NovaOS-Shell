import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { useFileManager } from '../FileManagerProvider';
import { FileIcon } from './FileIcon';
import { RenameInput } from './RenameInput';
import { VFSNode } from '../types';
import { formatSize, formatDate } from '../vfs';
import { cn } from '@/lib/utils';

interface FileItemProps {
  node: VFSNode;
  viewMode: 'grid' | 'list';
}

export function FileItem({ node, viewMode }: FileItemProps) {
  const { state, openItem, select, startDrag, setDragOver, endDrag, moveItems, setContextMenu, startRename } =
    useFileManager();
  const { selectedIds, renamingId, drag } = state;
  const isSelected = selectedIds.includes(node.id);
  const isRenaming = renamingId === node.id;
  const isDragging = drag.draggingIds.includes(node.id);
  const isDragOver = drag.overFolderId === node.id && node.type === 'folder';

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (isRenaming) return;
    if (e.metaKey || e.ctrlKey) {
      select([node.id], 'toggle');
    } else if (e.shiftKey) {
      select([node.id], 'add');
    } else {
      select([node.id], 'replace');
    }
  }

  function handleDoubleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (isRenaming) return;
    openItem(node.id);
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!isSelected) select([node.id], 'replace');
    setContextMenu({ x: e.clientX, y: e.clientY, targetId: node.id });
  }

  // Native HTML5 drag events — must be on a plain element, not motion.div
  function onDragStart(e: React.DragEvent) {
    const ids = isSelected ? state.selectedIds : [node.id];
    e.dataTransfer.setData('application/nova-fm-ids', ids.join(','));
    e.dataTransfer.effectAllowed = 'move';
    startDrag(ids);
    const ghost = document.createElement('div');
    ghost.style.cssText =
      'position:fixed;top:-200px;left:-200px;background:hsl(221 83% 53% / 0.2);border-radius:8px;padding:8px 12px;font-size:12px;color:hsl(221 83% 53%);font-weight:500;white-space:nowrap;backdrop-filter:blur(8px);border:1px solid hsl(221 83% 53% / 0.3)';
    ghost.textContent = ids.length > 1 ? `${ids.length} items` : node.name;
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 60, 20);
    setTimeout(() => document.body.removeChild(ghost), 0);
  }

  function onDragOver(e: React.DragEvent) {
    if (node.type !== 'folder') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(node.id);
  }

  function onDragLeave() {
    setDragOver(null);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (node.type !== 'folder') return;
    const ids = e.dataTransfer.getData('application/nova-fm-ids').split(',').filter(Boolean);
    if (ids.length) moveItems(ids, node.id);
    endDrag();
    setDragOver(null);
  }

  function onDragEnd() {
    endDrag();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (isRenaming) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openItem(node.id);
    }
    if (e.key === 'F2') {
      e.preventDefault();
      startRename(node.id);
    }
  }

  const nativeDragProps = { draggable: !isRenaming, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd };
  const interactionProps = {
    onClick: handleClick,
    onDoubleClick: handleDoubleClick,
    onContextMenu: handleContextMenu,
    onKeyDown: handleKeyDown,
    tabIndex: 0,
    role: node.type === 'folder' ? 'button' : 'option',
    'aria-label': node.name,
    'aria-selected': isSelected,
  };

  if (viewMode === 'grid') {
    return (
      <div {...nativeDragProps} {...interactionProps} className="outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-xl">
        <motion.div
          layout
          initial={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: isDragging ? 0.4 : 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.88 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30, opacity: { duration: 0.15 } }}
          className={cn(
            'relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl cursor-pointer select-none transition-all duration-150',
            isSelected
              ? 'bg-primary/15 ring-1 ring-primary/40'
              : 'hover:bg-muted/60',
            isDragOver && 'bg-primary/20 ring-2 ring-primary/60 scale-[1.02]'
          )}
        >
          {/* Favorite indicator */}
          {node.isFavorite && (
            <span className="absolute top-1.5 right-1.5 z-10">
              <Star size={9} className="text-amber-400 fill-amber-400" />
            </span>
          )}

          {/* Icon */}
          <div className="w-14 h-14 flex items-center justify-center">
            <FileIcon node={node} size={node.type === 'folder' ? 48 : 40} isOpen={isDragOver} />
          </div>

          {/* Name */}
          {isRenaming ? (
            <RenameInput id={node.id} initialName={node.name} className="text-center" />
          ) : (
            <span className="text-[11px] font-medium text-foreground text-center leading-tight max-w-full w-full px-0.5 line-clamp-2 break-words">
              {node.name}
            </span>
          )}
        </motion.div>
      </div>
    );
  }

  // List view
  return (
    <div {...nativeDragProps} {...interactionProps} className="outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-lg">
      <motion.div
        layout
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: isDragging ? 0.4 : 1, x: 0 }}
        exit={{ opacity: 0, x: -8 }}
        transition={{ duration: 0.15 }}
        className={cn(
          'flex items-center gap-3 px-3 py-1.5 rounded-lg cursor-pointer select-none transition-colors',
          isSelected
            ? 'bg-primary/15 ring-1 ring-primary/30'
            : 'hover:bg-muted/60',
          isDragOver && 'bg-primary/20 ring-2 ring-primary/60'
        )}
      >
        <FileIcon node={node} size={18} isOpen={isDragOver} className="flex-shrink-0" />

        {isRenaming ? (
          <div className="flex-1 min-w-0">
            <RenameInput id={node.id} initialName={node.name} />
          </div>
        ) : (
          <span className="flex-1 min-w-0 text-xs font-medium text-foreground truncate">
            {node.name}
          </span>
        )}

        {node.isFavorite && (
          <Star size={10} className="text-amber-400 fill-amber-400 flex-shrink-0" />
        )}

        <span className="text-[10px] text-muted-foreground w-24 text-right flex-shrink-0 hidden sm:block">
          {formatDate(node.modifiedAt)}
        </span>
        <span className="text-[10px] text-muted-foreground w-16 text-right flex-shrink-0">
          {node.type === 'file' ? formatSize(node.size) : '—'}
        </span>
        <span className="text-[10px] text-muted-foreground w-20 text-right flex-shrink-0 capitalize hidden md:block">
          {node.type === 'folder' ? 'Folder' : node.mimeCategory}
        </span>
      </motion.div>
    </div>
  );
}
