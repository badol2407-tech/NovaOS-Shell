import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy,
  Scissors,
  Clipboard,
  Trash2,
  Edit2,
  Star,
  StarOff,
  FolderPlus,
  FilePlus,
  FolderOpen,
  Info,
  Download,
} from 'lucide-react';
import { useFileManager } from '../FileManagerProvider';
import { cn } from '@/lib/utils';

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  shortcut?: string;
}

function MenuItem({ icon, label, onClick, danger, disabled, shortcut }: MenuItemProps) {
  return (
    <motion.button
      whileHover={!disabled ? { backgroundColor: danger ? 'hsl(var(--destructive) / 0.15)' : 'hsl(var(--muted))' } : {}}
      onClick={() => { if (!disabled) onClick(); }}
      disabled={disabled}
      className={cn(
        'flex items-center gap-2.5 w-full px-3 py-1.5 text-xs rounded-md transition-colors text-left',
        danger ? 'text-destructive' : 'text-foreground',
        disabled && 'opacity-40 cursor-not-allowed pointer-events-none'
      )}
    >
      <span className={cn('w-4 h-4 flex items-center justify-center flex-shrink-0', danger ? 'text-destructive' : 'text-muted-foreground')}>
        {icon}
      </span>
      <span className="flex-1 font-medium">{label}</span>
      {shortcut && <span className="text-muted-foreground/60 font-mono">{shortcut}</span>}
    </motion.button>
  );
}

function Divider() {
  return <div className="my-1 border-t border-border/60 mx-2" />;
}

export function FileContextMenu() {
  const { state, setContextMenu, openItem, copyItems, cutItems, pasteItems, deleteItems, startRename, toggleFavorite, openNewItemDialog } = useFileManager();
  const { contextMenu, selectedIds, clipboard, nodes } = state;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setContextMenu(null);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [contextMenu, setContextMenu]);

  if (!contextMenu) return null;

  const targetId = contextMenu.targetId;
  const targetNode = targetId ? nodes[targetId] : null;
  const isBackground = !targetId;

  // If there's a selection and target is in selection, act on selection; else just target
  const actionIds = targetId && selectedIds.includes(targetId)
    ? selectedIds
    : targetId ? [targetId] : [];

  const isFavorite = targetNode?.isFavorite ?? false;
  const isSingle = actionIds.length === 1;
  const isFolder = targetNode?.type === 'folder';

  function close() { setContextMenu(null); }

  // Smart viewport positioning
  const menuWidth = 200;
  const menuHeight = 280;
  const vpW = window.innerWidth;
  const vpH = window.innerHeight;
  let x = contextMenu.x;
  let y = contextMenu.y;
  if (x + menuWidth > vpW - 8) x = vpW - menuWidth - 8;
  if (y + menuHeight > vpH - 8) y = vpH - menuHeight - 8;

  return (
    <AnimatePresence>
      <motion.div
        ref={ref}
        initial={{ opacity: 0, scale: 0.94, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: -4 }}
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        style={{ position: 'fixed', left: x, top: y, zIndex: 9999 }}
        className="w-[200px] bg-card/95 backdrop-blur-md border border-border rounded-xl shadow-2xl p-1.5 select-none"
        onContextMenu={e => e.preventDefault()}
      >
        {isBackground ? (
          <>
            <MenuItem icon={<FolderPlus size={13} />} label="New Folder" onClick={() => { openNewItemDialog('folder'); close(); }} />
            <MenuItem icon={<FilePlus size={13} />} label="New File" onClick={() => { openNewItemDialog('file'); close(); }} />
            {clipboard && (
              <>
                <Divider />
                <MenuItem icon={<Clipboard size={13} />} label="Paste" onClick={() => { pasteItems(); close(); }} shortcut="⌘V" />
              </>
            )}
          </>
        ) : (
          <>
            {isFolder && isSingle && (
              <MenuItem
                icon={<FolderOpen size={13} />}
                label="Open"
                onClick={() => { openItem(actionIds[0]); close(); }}
              />
            )}
            {isSingle && (
              <MenuItem
                icon={<Edit2 size={13} />}
                label="Rename"
                onClick={() => { startRename(actionIds[0]); close(); }}
                shortcut="↩"
              />
            )}
            <Divider />
            <MenuItem
              icon={<Copy size={13} />}
              label={actionIds.length > 1 ? `Copy ${actionIds.length} items` : 'Copy'}
              onClick={() => { copyItems(actionIds); close(); }}
              shortcut="⌘C"
            />
            <MenuItem
              icon={<Scissors size={13} />}
              label={actionIds.length > 1 ? `Cut ${actionIds.length} items` : 'Cut'}
              onClick={() => { cutItems(actionIds); close(); }}
              shortcut="⌘X"
            />
            {clipboard && (
              <MenuItem
                icon={<Clipboard size={13} />}
                label="Paste"
                onClick={() => { pasteItems(targetNode?.type === 'folder' ? targetId! : undefined); close(); }}
                shortcut="⌘V"
              />
            )}
            <Divider />
            <MenuItem
              icon={isFavorite ? <StarOff size={13} /> : <Star size={13} />}
              label={isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
              onClick={() => { if (targetId) toggleFavorite(targetId); close(); }}
            />
            <Divider />
            <MenuItem
              icon={<Trash2 size={13} />}
              label={actionIds.length > 1 ? `Delete ${actionIds.length} items` : 'Delete'}
              onClick={() => { deleteItems(actionIds); close(); }}
              danger
              shortcut="⌫"
            />
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
