import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { motion } from 'framer-motion';
import { useFileManager } from '../FileManagerProvider';
import { getPath } from '../vfs';
import { cn } from '@/lib/utils';

export function BreadcrumbNav() {
  const { state, navigate } = useFileManager();
  const path = getPath(state.nodes, state.currentFolderId);

  return (
    <div className="flex items-center gap-0.5 min-w-0 overflow-hidden">
      {path.map((node, i) => {
        const isLast = i === path.length - 1;
        return (
          <React.Fragment key={node.id}>
            {i > 0 && (
              <ChevronRight size={13} className="text-muted-foreground/50 flex-shrink-0" />
            )}
            <motion.button
              whileHover={!isLast ? { backgroundColor: 'hsl(var(--muted))' } : {}}
              onClick={() => !isLast && navigate(node.id)}
              className={cn(
                'flex items-center gap-1.5 px-1.5 py-0.5 rounded-md text-xs font-medium transition-colors max-w-[140px] truncate flex-shrink-0',
                isLast
                  ? 'text-foreground cursor-default'
                  : 'text-muted-foreground hover:text-foreground cursor-pointer'
              )}
              title={node.name}
            >
              {i === 0 && <Home size={12} className="flex-shrink-0" />}
              <span className="truncate">{i === 0 ? node.name : node.name}</span>
            </motion.button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
