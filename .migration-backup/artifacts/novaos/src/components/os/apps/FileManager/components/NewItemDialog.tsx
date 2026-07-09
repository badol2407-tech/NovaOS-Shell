import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderPlus, FilePlus, X } from 'lucide-react';
import { useFileManager } from '../FileManagerProvider';

export function NewItemDialog() {
  const { state, createItem, dispatch } = useFileManager();
  const dialog = state.newItemDialog;
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (dialog?.open) {
      setName(dialog.type === 'folder' ? 'New Folder' : 'Untitled.txt');
      setTimeout(() => {
        inputRef.current?.select();
      }, 50);
    }
  }, [dialog?.open, dialog?.type]);

  if (!dialog?.open) return null;

  function commit() {
    const trimmed = name.trim();
    if (!trimmed || !dialog) return;
    createItem(dialog.type, trimmed, dialog.parentId);
    dispatch({ type: 'CLOSE_NEW_ITEM_DIALOG' });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    e.stopPropagation();
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') dispatch({ type: 'CLOSE_NEW_ITEM_DIALOG' });
  }

  const Icon = dialog.type === 'folder' ? FolderPlus : FilePlus;
  const label = dialog.type === 'folder' ? 'New Folder' : 'New File';

  return (
    <AnimatePresence>
      <div
        className="absolute inset-0 z-[200] flex items-center justify-center"
        onClick={() => dispatch({ type: 'CLOSE_NEW_ITEM_DIALOG' })}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 8 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 8 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          onClick={e => e.stopPropagation()}
          className="relative z-10 w-80 bg-card border border-border rounded-2xl shadow-2xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon size={16} className="text-primary" />
              </div>
              <h3 className="font-semibold text-sm text-foreground">{label}</h3>
            </div>
            <button
              onClick={() => dispatch({ type: 'CLOSE_NEW_ITEM_DIALOG' })}
              className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center transition-colors"
            >
              <X size={14} className="text-muted-foreground" />
            </button>
          </div>
          <input
            ref={inputRef}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={label}
            className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          />
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => dispatch({ type: 'CLOSE_NEW_ITEM_DIALOG' })}
              className="flex-1 px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium text-muted-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={commit}
              disabled={!name.trim()}
              className="flex-1 px-3 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition-colors disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
