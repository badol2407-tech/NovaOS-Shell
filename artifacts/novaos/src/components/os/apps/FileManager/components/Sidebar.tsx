import React from 'react';
import { motion } from 'framer-motion';
import { Star, Clock, HardDrive, ChevronDown } from 'lucide-react';
import { useFileManager } from '../FileManagerProvider';
import { FolderTree } from './FolderTree';
import { FileIcon } from './FileIcon';
import { formatSize, getFolderSize, ROOT_ID } from '../vfs';
import { cn } from '@/lib/utils';

function SidebarSection({ title, icon, children, defaultOpen = true }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="mb-1">
      <button
        className="flex items-center gap-1.5 w-full px-3 py-1 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest hover:text-muted-foreground transition-colors"
        onClick={() => setOpen(p => !p)}
      >
        <span className="flex items-center gap-1 flex-1">
          {icon}
          {title}
        </span>
        <motion.span animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.15 }}>
          <ChevronDown size={11} />
        </motion.span>
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.18, ease: 'easeInOut' }}
        className="overflow-hidden"
      >
        {children}
      </motion.div>
    </div>
  );
}

function FavoriteItem({ id }: { id: string }) {
  const { state, navigate, openItem } = useFileManager();
  const node = state.nodes[id];
  if (!node) return null;

  return (
    <motion.button
      whileHover={{ backgroundColor: 'hsl(var(--muted)/0.6)' }}
      onClick={() => node.type === 'folder' ? navigate(id) : openItem(id)}
      className={cn(
        'flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-left transition-colors',
        state.currentFolderId === id && node.type === 'folder' && 'bg-primary/10 text-primary'
      )}
    >
      <FileIcon node={node} size={14} />
      <span className="text-xs font-medium text-foreground/80 truncate flex-1">{node.name}</span>
    </motion.button>
  );
}

function RecentItem({ id }: { id: string }) {
  const { state, openItem } = useFileManager();
  const node = state.nodes[id];
  if (!node) return null;

  return (
    <motion.button
      whileHover={{ backgroundColor: 'hsl(var(--muted)/0.6)' }}
      onClick={() => openItem(id)}
      className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-left"
    >
      <FileIcon node={node} size={14} />
      <span className="text-xs text-foreground/70 truncate flex-1">{node.name}</span>
    </motion.button>
  );
}

function StorageBar() {
  const { state } = useFileManager();
  const totalUsed = getFolderSize(state.nodes, ROOT_ID);
  const totalCapacity = 512 * 1024 * 1024 * 1024; // 512 GB simulated
  const pct = Math.min((totalUsed / totalCapacity) * 100, 100);
  const color = pct > 85 ? 'bg-red-500' : pct > 60 ? 'bg-amber-500' : 'bg-primary';

  return (
    <div className="px-3 py-3 border-t border-border/50">
      <div className="flex items-center gap-1.5 mb-2">
        <HardDrive size={12} className="text-muted-foreground" />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Storage</span>
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
          className={cn('h-full rounded-full', color)}
        />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] text-muted-foreground">{formatSize(totalUsed)} used</span>
        <span className="text-[10px] text-muted-foreground">{formatSize(totalCapacity - totalUsed)} free</span>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { state } = useFileManager();
  const favorites = Object.values(state.nodes).filter(n => n.isFavorite).map(n => n.id);
  const recents = state.recentIds.filter(id => state.nodes[id]).slice(0, 5);

  return (
    <div className="flex flex-col h-full border-r border-border bg-card/40 backdrop-blur-sm">
      <div className="flex-1 overflow-y-auto min-h-0 py-2">
        {/* Favorites */}
        {favorites.length > 0 && (
          <SidebarSection title="Favorites" icon={<Star size={10} />}>
            <div className="px-1 space-y-0.5">
              {favorites.map(id => <FavoriteItem key={id} id={id} />)}
            </div>
          </SidebarSection>
        )}

        {/* Recent */}
        {recents.length > 0 && (
          <SidebarSection title="Recent" icon={<Clock size={10} />} defaultOpen={false}>
            <div className="px-1 space-y-0.5">
              {recents.map(id => <RecentItem key={id} id={id} />)}
            </div>
          </SidebarSection>
        )}

        {/* Folders */}
        <SidebarSection title="Locations" icon={<HardDrive size={10} />}>
          <FolderTree />
        </SidebarSection>
      </div>

      <StorageBar />
    </div>
  );
}
