import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, Search as SearchIcon } from 'lucide-react';
import { useFileManager } from '../FileManagerProvider';
import { FileItem } from './FileItem';
import { VFSNode, SortKey } from '../types';
import { getChildren, searchNodes } from '../vfs';
import { cn } from '@/lib/utils';

function sortNodes(nodes: VFSNode[], by: SortKey, dir: 'asc' | 'desc'): VFSNode[] {
  const folders = nodes.filter(n => n.type === 'folder');
  const files = nodes.filter(n => n.type === 'file');

  function compare(a: VFSNode, b: VFSNode): number {
    let result = 0;
    switch (by) {
      case 'name':  result = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }); break;
      case 'date':  result = b.modifiedAt - a.modifiedAt; break;
      case 'size':  result = b.size - a.size; break;
      case 'type':  result = a.mimeCategory.localeCompare(b.mimeCategory); break;
    }
    return dir === 'asc' ? result : -result;
  }

  return [...folders.sort(compare), ...files.sort(compare)];
}

export function FileExplorer() {
  const { state, clearSelection, setContextMenu, setDragOver, endDrag, moveItems } = useFileManager();
  const { nodes, currentFolderId, viewMode, sortBy, sortDir, searchQuery } = state;

  const displayNodes = useMemo(() => {
    if (searchQuery.trim()) {
      return sortNodes(searchNodes(nodes, searchQuery), sortBy, sortDir);
    }
    return sortNodes(getChildren(nodes, currentFolderId), sortBy, sortDir);
  }, [nodes, currentFolderId, searchQuery, sortBy, sortDir]);

  const isSearching = !!searchQuery.trim();

  function handleBgClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) clearSelection();
  }

  function handleBgContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, targetId: null });
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(currentFolderId);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const ids = e.dataTransfer.getData('application/nova-fm-ids').split(',').filter(Boolean);
    if (ids.length) moveItems(ids, currentFolderId);
    endDrag();
    setDragOver(null);
  }

  return (
    <div
      className="flex-1 overflow-y-auto min-h-0 relative"
      onClick={handleBgClick}
      onContextMenu={handleBgContextMenu}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(null)}
      onDrop={handleDrop}
    >
      {/* Search header */}
      {isSearching && (
        <div className="sticky top-0 z-10 px-4 pt-3 pb-1 bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <SearchIcon size={12} />
            <span>Search results for <strong className="text-foreground">"{searchQuery}"</strong> — {displayNodes.length} items</span>
          </div>
        </div>
      )}

      {displayNodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
            {isSearching ? (
              <SearchIcon size={28} className="opacity-40" />
            ) : (
              <FolderOpen size={28} className="opacity-40" />
            )}
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">{isSearching ? 'No results found' : 'This folder is empty'}</p>
            <p className="text-xs mt-0.5 opacity-60">
              {isSearching ? 'Try a different search term' : 'Right-click to create a new item'}
            </p>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="p-4">
          <AnimatePresence mode="popLayout">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-1">
              {displayNodes.map(node => (
                <FileItem key={node.id} node={node} viewMode="grid" />
              ))}
            </div>
          </AnimatePresence>
        </div>
      ) : (
        <div className="p-3">
          {/* List header */}
          <div className="flex items-center gap-3 px-3 py-1 mb-1">
            <div className="w-[18px] flex-shrink-0" />
            <span className="flex-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Name</span>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-24 text-right hidden sm:block">Modified</span>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-16 text-right">Size</span>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-20 text-right hidden md:block">Kind</span>
          </div>
          <AnimatePresence mode="popLayout">
            <div className="space-y-0.5">
              {displayNodes.map(node => (
                <FileItem key={node.id} node={node} viewMode="list" />
              ))}
            </div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
