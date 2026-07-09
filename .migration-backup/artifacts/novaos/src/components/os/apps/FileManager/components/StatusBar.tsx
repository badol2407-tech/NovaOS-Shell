import React from 'react';
import { useFileManager } from '../FileManagerProvider';
import { formatSize, getChildren, getFolderSize } from '../vfs';

export function StatusBar() {
  const { state } = useFileManager();
  const { nodes, currentFolderId, selectedIds, searchQuery } = state;
  const children = getChildren(nodes, currentFolderId);
  const itemCount = searchQuery.trim() ? 0 : children.length;
  const folderCount = children.filter(n => n.type === 'folder').length;
  const fileCount = children.filter(n => n.type === 'file').length;
  const folderSize = getFolderSize(nodes, currentFolderId);

  const selectedNodes = selectedIds.map(id => nodes[id]).filter(Boolean);
  const selectedSize = selectedNodes.reduce((acc, n) => acc + (n?.size ?? 0), 0);

  return (
    <div className="flex items-center justify-between px-4 py-1.5 border-t border-border bg-card/30 text-[10px] text-muted-foreground flex-shrink-0 gap-4">
      <div className="flex items-center gap-3">
        {selectedIds.length > 0 ? (
          <span>
            <span className="text-foreground font-medium">{selectedIds.length}</span> item{selectedIds.length !== 1 ? 's' : ''} selected
            {selectedSize > 0 && <span> — {formatSize(selectedSize)}</span>}
          </span>
        ) : searchQuery.trim() ? (
          <span>Search results for "<span className="text-foreground">{searchQuery}</span>"</span>
        ) : (
          <span>
            {folderCount > 0 && <>{folderCount} folder{folderCount !== 1 ? 's' : ''}</>}
            {folderCount > 0 && fileCount > 0 && ', '}
            {fileCount > 0 && <>{fileCount} file{fileCount !== 1 ? 's' : ''}</>}
            {itemCount === 0 && 'Empty folder'}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {state.clipboard && (
          <span className="text-primary/70">
            {state.clipboard.operation === 'copy' ? '⊕' : '✂'} {state.clipboard.ids.length} item{state.clipboard.ids.length !== 1 ? 's' : ''} in clipboard
          </span>
        )}
        {!searchQuery.trim() && (
          <span>{formatSize(folderSize)}</span>
        )}
      </div>
    </div>
  );
}
