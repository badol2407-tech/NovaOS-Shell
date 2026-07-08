import React, { useMemo } from 'react';
import { useOS } from './OSProvider';
import { cn } from '@/lib/utils';
import { useListApps, App } from '@workspace/api-client-react';

export function Dock({ position = 'bottom', autoHide = false, pinnedAppIds = [] }: { position?: 'bottom' | 'left' | 'right', autoHide?: boolean, pinnedAppIds?: string[] }) {
  const { windows, activeWindowId, openWindow, minimizeWindow, restoreWindow, focusWindow } = useOS();
  const { data: apps = [] } = useListApps();

  // Combine pinned apps and currently open apps
  const dockApps = useMemo(() => {
    const items = new Map<string, { app?: App, isOpen: boolean, isActive: boolean, isMinimized: boolean, windowId?: string }>();
    
    // Add pinned apps first
    pinnedAppIds.forEach(id => {
      const app = apps.find(a => a.id === id);
      if (app) {
        items.set(id, { app, isOpen: false, isActive: false, isMinimized: false });
      }
    });

    // Add open windows, updating existing items or creating new ones
    windows.forEach(win => {
      const existing = items.get(win.appId);
      const isActive = activeWindowId === win.id;
      
      if (existing) {
        existing.isOpen = true;
        existing.isActive = isActive;
        existing.isMinimized = win.isMinimized;
        existing.windowId = win.id;
      } else {
        const app = apps.find(a => a.id === win.appId);
        if (app) {
          items.set(win.appId, { app, isOpen: true, isActive, isMinimized: win.isMinimized, windowId: win.id });
        } else {
          // Fallback if app not in registry but window exists
          items.set(win.appId, { 
            app: { id: win.appId, name: win.title, icon: win.icon, category: 'App' }, 
            isOpen: true, isActive, isMinimized: win.isMinimized, windowId: win.id 
          });
        }
      }
    });

    return Array.from(items.values());
  }, [windows, activeWindowId, pinnedAppIds, apps]);

  const handleAppClick = (item: typeof dockApps[0]) => {
    if (item.isOpen && item.windowId) {
      if (item.isActive) {
        minimizeWindow(item.windowId);
      } else if (item.isMinimized) {
        restoreWindow(item.windowId);
      } else {
        focusWindow(item.windowId);
      }
    } else if (item.app) {
      openWindow(item.app.id, item.app.name, item.app.icon);
    }
  };

  const isVertical = position === 'left' || position === 'right';

  return (
    <div 
      className={cn(
        "fixed z-[100] flex items-center justify-center p-2",
        position === 'bottom' ? "bottom-2 left-0 w-full" : 
        position === 'left' ? "left-2 top-0 h-full" : 
        "right-2 top-0 h-full",
        autoHide && "opacity-0 hover:opacity-100 transition-opacity duration-300"
      )}
    >
      <div 
        className={cn(
          "glass-panel-heavy flex items-center gap-2 rounded-2xl p-2",
          isVertical ? "flex-col" : "flex-row"
        )}
      >
        {dockApps.map((item) => (
          <button
            key={item.app?.id}
            onClick={() => handleAppClick(item)}
            className={cn(
              "relative group flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200",
              "hover:bg-white/10 dark:hover:bg-white/5",
              item.isActive && "bg-white/10 dark:bg-white/10"
            )}
            title={item.app?.name}
          >
            {item.app?.icon ? (
              <img 
                src={item.app.icon} 
                alt={item.app.name} 
                className={cn(
                  "w-8 h-8 object-cover rounded-lg transition-transform duration-200 group-hover:scale-110",
                  item.isMinimized && "opacity-60"
                )}
              />
            ) : (
              <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
                <div className="w-4 h-4 bg-primary rounded-sm" />
              </div>
            )}
            
            {/* Active/Open indicator */}
            {item.isOpen && (
              <div 
                className={cn(
                  "absolute rounded-full transition-all duration-200",
                  isVertical ? "right-0 top-1/2 -translate-y-1/2 w-1 h-1.5" : "bottom-0 left-1/2 -translate-x-1/2 h-1 w-1.5",
                  item.isActive ? "bg-primary w-2 h-2" : "bg-muted-foreground w-1 h-1"
                )}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
