import React, { useEffect, useMemo } from 'react';
import { OSProvider, useOS } from '@/components/os/OSProvider';
import { Dock } from '@/components/os/Dock';
import { StartMenu } from '@/components/os/StartMenu';
import { NotificationCenter } from '@/components/os/NotificationCenter';
import { Window } from '@/components/os/Window';
import { useGetMySettings, useListWallpapers, useListApps, App } from '@workspace/api-client-react';
import { Loader2 } from 'lucide-react';
import SettingsApp from '@/components/os/apps/SettingsApp';
import PlaceholderApp from '@/components/os/apps/PlaceholderApp';
import { useTheme } from 'next-themes';

function DesktopContent() {
  const { data: settings, isLoading: isLoadingSettings } = useGetMySettings();
  const { data: wallpapers = [] } = useListWallpapers();
  const { data: apps = [] } = useListApps();
  const { windows } = useOS();
  const { setTheme } = useTheme();

  // Apply OS settings to HTML element
  useEffect(() => {
    if (settings) {
      if (settings.theme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setTheme(isDark ? 'dark' : 'light');
      } else {
        setTheme(settings.theme);
      }
      
      if (settings.accentColor) {
        // Here we could inject a style tag to override the primary HSL
        // For simplicity we will rely on default styles, or we can update document style
        const root = document.documentElement;
        // The API might return hex, so we'd need to convert to HSL to strictly follow the theme config,
        // but for now we won't fully mutate CSS vars if we don't have a color parser.
        // Assuming the UI just works with the default blue accent.
      }
    }
  }, [settings, setTheme]);

  const currentWallpaper = useMemo(() => {
    if (!settings?.wallpaperId) return wallpapers[0]?.imageUrl || '';
    return wallpapers.find(w => w.id === settings.wallpaperId)?.imageUrl || wallpapers[0]?.imageUrl || '';
  }, [settings, wallpapers]);

  if (isLoadingSettings) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-black select-none font-sans text-foreground">
      {/* Wallpaper */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-700"
        style={{ backgroundImage: `url(${currentWallpaper})` }}
      />
      
      {/* Windows */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <div className="w-full h-full pointer-events-auto">
          {windows.map(win => {
            const appData = apps.find(a => a.id === win.appId);
            return (
              <Window key={win.id} window={win}>
                {win.appId === 'settings' ? (
                  <SettingsApp />
                ) : (
                  <PlaceholderApp app={appData} windowTitle={win.title} />
                )}
              </Window>
            );
          })}
        </div>
      </div>

      {/* Chrome (Dock, Menus) */}
      <StartMenu />
      <NotificationCenter />
      <Dock 
        position={settings?.dockPosition || 'bottom'} 
        autoHide={settings?.dockAutoHide || false} 
        pinnedAppIds={settings?.dockPinnedAppIds || []} 
      />
    </div>
  );
}

export default function Desktop() {
  return (
    <div className="fixed inset-0 w-full h-[100dvh]">
      <OSProvider>
        <DesktopContent />
      </OSProvider>
    </div>
  );
}
