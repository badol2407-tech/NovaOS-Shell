import React, { useMemo } from 'react';
import { useOS } from './OSProvider';
import { cn } from '@/lib/utils';
import { useListApps, App } from '@workspace/api-client-react';

interface DockItem {
  app?: App;
  /** All windows open for this appId */
  windows: Array<{ id: string; isActive: boolean; isMinimized: boolean }>;
  isPinned: boolean;
}

export function Dock({
  position = 'bottom',
  autoHide = false,
  pinnedAppIds = [],
}: {
  position?: 'bottom' | 'left' | 'right';
  autoHide?: boolean;
  pinnedAppIds?: string[];
}) {
  const { windows, activeWindowId, openWindow, minimizeWindow, restoreWindow, focusWindow } = useOS();
  const { data: apps = [] } = useListApps();

  /**
   * Build dock entries.
   *
   * Rules:
   * - Pinned apps appear first in pin order, whether open or not.
   * - Open unpinned apps appear after pinned.
   * - Apps that allow multiple windows (e.g. Files) show a single icon but
   *   their indicator dot scales with the number of open windows.
   */
  const dockItems = useMemo((): DockItem[] => {
    const items = new Map<string, DockItem>();

    // 1. Pinned apps
    for (const appId of pinnedAppIds) {
      const app = apps.find(a => a.id === appId);
      if (app) {
        items.set(appId, { app, windows: [], isPinned: true });
      }
    }

    // 2. Open windows — group by appId
    for (const win of windows) {
      const existing = items.get(win.appId);
      const winEntry = {
        id: win.id,
        isActive: activeWindowId === win.id,
        isMinimized: win.isMinimized,
      };
      if (existing) {
        existing.windows.push(winEntry);
      } else {
        const app = apps.find(a => a.id === win.appId) ?? {
          id: win.appId,
          name: win.title,
          icon: win.icon,
          category: 'App',
        };
        items.set(win.appId, { app, windows: [winEntry], isPinned: false });
      }
    }

    return Array.from(items.values());
  }, [windows, activeWindowId, pinnedAppIds, apps]);

  function handleAppClick(item: DockItem) {
    const openWins = item.windows.filter(w => !w.isMinimized);
    const activeWin = item.windows.find(w => w.isActive);

    if (item.windows.length === 0) {
      // App not open — launch it
      if (item.app) openWindow(item.app.id, item.app.name, item.app.icon);
    } else if (activeWin) {
      // Active window clicked — minimize it
      minimizeWindow(activeWin.id);
    } else if (item.windows.every(w => w.isMinimized)) {
      // All minimized — restore the most recent
      restoreWindow(item.windows[item.windows.length - 1].id);
    } else {
      // Bring most recently used non-minimized window to front
      const target = openWins[openWins.length - 1];
      if (target) focusWindow(target.id);
    }
  }

  const isVertical = position === 'left' || position === 'right';
  const isAnyActive = (item: DockItem) => item.windows.some(w => w.isActive);
  const openCount = (item: DockItem) => item.windows.length;

  return (
    <div
      className={cn(
        'fixed z-[100] flex items-center justify-center p-2',
        position === 'bottom' ? 'bottom-2 left-0 w-full' :
        position === 'left' ? 'left-2 top-0 h-full' :
        'right-2 top-0 h-full',
        autoHide && 'opacity-0 hover:opacity-100 transition-opacity duration-300'
      )}
    >
      <div
        className={cn(
          'glass-panel-heavy flex items-center gap-2 rounded-2xl p-2',
          isVertical ? 'flex-col' : 'flex-row'
        )}
      >
        {dockItems.map(item => (
          <button
            key={item.app?.id}
            onClick={() => handleAppClick(item)}
            className={cn(
              'relative group flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200',
              'hover:bg-white/10 dark:hover:bg-white/5',
              isAnyActive(item) && 'bg-white/10 dark:bg-white/10'
            )}
            title={item.app?.name}
          >
            {item.app?.icon ? (
              <img
                src={item.app.icon}
                alt={item.app.name}
                className={cn(
                  'w-8 h-8 object-cover rounded-lg transition-transform duration-200 group-hover:scale-110',
                  item.windows.length > 0 && item.windows.every(w => w.isMinimized) && 'opacity-60'
                )}
              />
            ) : (
              <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
                <div className="w-4 h-4 bg-primary rounded-sm" />
              </div>
            )}

            {/* Open indicator dots — one per window, up to 3 */}
            {openCount(item) > 0 && (
              <div
                className={cn(
                  'absolute flex gap-[2px] items-center',
                  isVertical
                    ? 'right-0 top-1/2 -translate-y-1/2 flex-col'
                    : 'bottom-0.5 left-1/2 -translate-x-1/2'
                )}
              >
                {Array.from({ length: Math.min(openCount(item), 3) }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'rounded-full transition-all duration-200',
                      isVertical ? 'w-1 h-1' : 'h-1 w-1',
                      isAnyActive(item) ? 'bg-primary' : 'bg-muted-foreground'
                    )}
                  />
                ))}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
