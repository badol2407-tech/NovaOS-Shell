import React, { useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { FileManagerProvider, useFileManager } from './FileManagerProvider';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { FileExplorer } from './components/FileExplorer';
import { StatusBar } from './components/StatusBar';
import { FileContextMenu } from './components/FileContextMenu';
import { NewItemDialog } from './components/NewItemDialog';

function FileManagerInner() {
  const {
    state,
    copyItems,
    cutItems,
    pasteItems,
    deleteItems,
    openNewItemDialog,
    startRename,
    setContextMenu,
  } = useFileManager();

  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcuts scoped to this File Manager container
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Only handle when focus is within this File Manager instance
      if (!containerRef.current?.contains(document.activeElement)) return;

      const meta = e.metaKey || e.ctrlKey;
      const { selectedIds, contextMenu } = state;

      // Don't intercept when typing in an input or editable field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.isContentEditable) return;

      if (meta && e.key === 'c') { e.preventDefault(); if (selectedIds.length) copyItems(selectedIds); }
      if (meta && e.key === 'x') { e.preventDefault(); if (selectedIds.length) cutItems(selectedIds); }
      if (meta && e.key === 'v') { e.preventDefault(); pasteItems(); }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length) { e.preventDefault(); deleteItems(selectedIds); }
      }
      if (e.key === 'Enter' && selectedIds.length === 1 && !state.renamingId) {
        e.preventDefault(); startRename(selectedIds[0]);
      }
      if (meta && e.key === 'n') { e.preventDefault(); openNewItemDialog('folder'); }
      if (e.key === 'Escape') {
        if (contextMenu) setContextMenu(null);
      }
    },
    [state, copyItems, cutItems, pasteItems, deleteItems, startRename, openNewItemDialog, setContextMenu]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full bg-background text-foreground overflow-hidden relative"
    >
      {/* Toolbar */}
      <Toolbar />

      {/* Main area */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <div className="w-52 flex-shrink-0 overflow-hidden">
          <Sidebar />
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 min-w-0">
          <FileExplorer />
          <StatusBar />
        </div>
      </div>

      {/* Overlays */}
      <FileContextMenu />
      {state.newItemDialog?.open && <NewItemDialog />}
    </motion.div>
  );
}

export default function FileManagerApp() {
  return (
    <FileManagerProvider>
      <FileManagerInner />
    </FileManagerProvider>
  );
}
