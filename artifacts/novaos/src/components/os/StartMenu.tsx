import React, { useState, useMemo } from 'react';
import { useOS } from './OSProvider';
import { cn } from '@/lib/utils';
import { Search, Grid, Clock, Settings, Power } from 'lucide-react';
import { useListApps } from '@workspace/api-client-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useClerk } from '@clerk/react';
import { motion, AnimatePresence } from 'framer-motion';

export function StartMenu() {
  const { isStartMenuOpen, toggleStartMenu, closeStartMenu, openWindow } = useOS();
  const { data: apps = [] } = useListApps();
  const [search, setSearch] = useState('');
  const { signOut } = useClerk();

  const filteredApps = useMemo(() => {
    if (!search) return apps;
    const lower = search.toLowerCase();
    return apps.filter(a => a.name.toLowerCase().includes(lower) || (a.description && a.description.toLowerCase().includes(lower)));
  }, [apps, search]);

  const categories = useMemo(() => {
    const cats = new Set(filteredApps.map(a => a.category));
    return Array.from(cats).sort();
  }, [filteredApps]);

  const handleLaunch = (appId: string, name: string, icon: string) => {
    openWindow(appId, name, icon);
    closeStartMenu();
    setSearch('');
  };

  return (
    <>
      {/* Trigger Button (usually lives in taskbar or top bar, but we'll render it fixed top-left for now if no taskbar) */}
      <div className="fixed top-2 left-2 z-[101]">
        <button 
          onClick={toggleStartMenu}
          className={cn(
            "glass-panel flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200",
            isStartMenuOpen ? "bg-white/20 dark:bg-white/10" : "hover:bg-white/10 dark:hover:bg-white/5"
          )}
        >
          <Grid className="w-5 h-5 text-foreground" />
        </button>
      </div>

      <AnimatePresence>
        {isStartMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[90] bg-black/10" 
              onClick={closeStartMenu}
            />
            
            {/* Menu */}
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="fixed top-14 left-2 w-96 max-h-[80vh] flex flex-col z-[100] glass-panel-heavy rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="p-4 border-b border-border/30">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    autoFocus
                    placeholder="Search apps..." 
                    className="w-full pl-9 bg-black/5 dark:bg-white/5 border-transparent focus-visible:ring-1 focus-visible:ring-primary/50"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <ScrollArea className="flex-1 p-4">
                {categories.map(category => (
                  <div key={category} className="mb-6 last:mb-0">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 px-2">
                      {category}
                    </h3>
                    <div className="grid grid-cols-4 gap-2">
                      {filteredApps.filter(a => a.category === category).map(app => (
                        <button
                          key={app.id}
                          onClick={() => handleLaunch(app.id, app.name, app.icon)}
                          className="flex flex-col items-center gap-2 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
                        >
                          {app.icon ? (
                            <img src={app.icon} alt={app.name} className="w-12 h-12 rounded-xl object-cover shadow-sm group-hover:scale-105 transition-transform" />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                              <div className="w-6 h-6 bg-primary rounded-md" />
                            </div>
                          )}
                          <span className="text-xs text-center font-medium line-clamp-1 w-full text-foreground/80 group-hover:text-foreground">
                            {app.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                
                {filteredApps.length === 0 && (
                  <div className="py-10 text-center text-muted-foreground flex flex-col items-center gap-2">
                    <Search className="w-8 h-8 opacity-20" />
                    <p>No apps found.</p>
                  </div>
                )}
              </ScrollArea>

              <div className="p-3 border-t border-border/30 bg-black/5 dark:bg-white/5 flex items-center justify-between">
                <button 
                  onClick={() => { handleLaunch('settings', 'Settings', ''); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-sm font-medium"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
                <button 
                  onClick={() => signOut()}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors text-sm font-medium"
                >
                  <Power className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
