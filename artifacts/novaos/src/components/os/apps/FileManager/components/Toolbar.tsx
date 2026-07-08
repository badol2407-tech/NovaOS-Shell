import React from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  FolderPlus,
  FilePlus,
  Copy,
  Scissors,
  Clipboard,
  Trash2,
  Search,
  SortAsc,
  SortDesc,
  ArrowUpDown,
  PanelRight,
} from 'lucide-react';
import { useFileManager } from '../FileManagerProvider';
import { BreadcrumbNav } from './BreadcrumbNav';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SortKey } from '../types';

function ToolbarBtn({
  onClick,
  disabled,
  title,
  children,
  active,
}: {
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <motion.button
      whileHover={!disabled ? { backgroundColor: 'hsl(var(--muted))' } : {}}
      whileTap={!disabled ? { scale: 0.92 } : {}}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'flex items-center justify-center w-7 h-7 rounded-lg transition-colors text-muted-foreground hover:text-foreground',
        active && 'bg-muted text-foreground',
        disabled && 'opacity-30 cursor-not-allowed pointer-events-none'
      )}
    >
      {children}
    </motion.button>
  );
}

const SORT_LABELS: Record<SortKey, string> = {
  name: 'Name',
  date: 'Date Modified',
  size: 'Size',
  type: 'Type',
};

export function Toolbar() {
  const {
    state,
    navBack,
    navForward,
    setViewMode,
    setSort,
    openNewItemDialog,
    copyItems,
    cutItems,
    pasteItems,
    deleteItems,
    setSearch,
    togglePreview,
  } = useFileManager();

  const { viewMode, sortBy, sortDir, selectedIds, clipboard, historyIndex, history, searchQuery, previewOpen } = state;
  const hasSelection = selectedIds.length > 0;
  const canBack = historyIndex > 0;
  const canForward = historyIndex < history.length - 1;

  function toggleSort(key: SortKey) {
    if (sortBy === key) {
      setSort(key, sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(key, 'asc');
    }
  }

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-card/50 backdrop-blur-sm flex-shrink-0">
      {/* Nav */}
      <ToolbarBtn onClick={navBack} disabled={!canBack} title="Back (Alt+←)">
        <ChevronLeft size={15} />
      </ToolbarBtn>
      <ToolbarBtn onClick={navForward} disabled={!canForward} title="Forward (Alt+→)">
        <ChevronRight size={15} />
      </ToolbarBtn>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Breadcrumb */}
      <div className="flex-1 min-w-0">
        <BreadcrumbNav />
      </div>

      {/* Search */}
      <div className="relative flex items-center">
        <Search size={13} className="absolute left-2.5 text-muted-foreground pointer-events-none" />
        <input
          value={searchQuery}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search…"
          className="w-36 pl-7 pr-3 py-1 text-xs rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary transition-all"
        />
      </div>

      <div className="w-px h-5 bg-border mx-1" />

      {/* New folder/file */}
      <ToolbarBtn onClick={() => openNewItemDialog('folder')} title="New Folder (⌘N)">
        <FolderPlus size={15} />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => openNewItemDialog('file')} title="New File">
        <FilePlus size={15} />
      </ToolbarBtn>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Clipboard actions */}
      <ToolbarBtn
        onClick={() => copyItems(selectedIds)}
        disabled={!hasSelection}
        title="Copy (⌘C)"
      >
        <Copy size={14} />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => cutItems(selectedIds)}
        disabled={!hasSelection}
        title="Cut (⌘X)"
      >
        <Scissors size={14} />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => pasteItems()}
        disabled={!clipboard}
        title="Paste (⌘V)"
      >
        <Clipboard size={14} />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => deleteItems(selectedIds)}
        disabled={!hasSelection}
        title="Delete"
      >
        <Trash2 size={14} className={hasSelection ? 'text-destructive' : ''} />
      </ToolbarBtn>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Sort */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <motion.button
            whileHover={{ backgroundColor: 'hsl(var(--muted))' }}
            whileTap={{ scale: 0.92 }}
            className="flex items-center gap-1 px-2 h-7 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors"
            title="Sort"
          >
            <ArrowUpDown size={13} />
            <span className="hidden sm:inline">{SORT_LABELS[sortBy]}</span>
          </motion.button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          {(Object.keys(SORT_LABELS) as SortKey[]).map(key => (
            <DropdownMenuItem key={key} onClick={() => toggleSort(key)} className="flex items-center justify-between">
              <span>{SORT_LABELS[key]}</span>
              {sortBy === key && (
                sortDir === 'asc' ? <SortAsc size={13} /> : <SortDesc size={13} />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* View mode */}
      <ToolbarBtn
        onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
        title={viewMode === 'grid' ? 'Switch to list' : 'Switch to grid'}
      >
        {viewMode === 'grid' ? <List size={15} /> : <LayoutGrid size={15} />}
      </ToolbarBtn>

      {/* Preview panel toggle */}
      <ToolbarBtn
        onClick={togglePreview}
        title={previewOpen ? 'Hide preview' : 'Show preview (⌘P)'}
        active={previewOpen}
      >
        <PanelRight size={15} />
      </ToolbarBtn>
    </div>
  );
}
