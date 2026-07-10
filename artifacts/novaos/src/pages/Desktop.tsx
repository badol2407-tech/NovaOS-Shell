import React, { useEffect, useMemo } from 'react';
import { OSProvider, useOS } from '@/components/os/OSProvider';
import { Dock } from '@/components/os/Dock';
import { StartMenu } from '@/components/os/StartMenu';
import { NotificationCenter } from '@/components/os/NotificationCenter';
import { Window } from '@/components/os/Window';
import { useGetMySettings, useListWallpapers, useListApps } from '@workspace/api-client-react';
import { Loader2 } from 'lucide-react';
import SettingsApp from '@/components/os/apps/SettingsApp';
import PlaceholderApp from '@/components/os/apps/PlaceholderApp';
import FileManagerApp from '@/components/os/apps/FileManager';
import TerminalApp from '@/components/os/apps/Terminal';
import GitHubApp from '@/components/os/apps/GitHubApp';
import ProjectManagerApp from '@/components/os/apps/ProjectManager';
import NovaAIApp from '@/components/os/apps/NovaAI';
import AppBuilderApp from '@/components/os/apps/AppBuilder';
import PluginManagerApp from '@/components/os/apps/PluginManager';
import CollaborationHubApp from '@/components/os/apps/CollaborationHub';
import CloudEditorApp from '@/components/os/apps/CloudEditor';
import { useTheme } from 'next-themes';

/** Maps an appId to the React component that renders its UI. */
function renderApp(appId: string, appData: { id: string; name: string; icon: string; category: string; description?: string | null } | undefined, windowTitle: string) {
  if (appId === 'settings') return <SettingsApp />;
  // File Manager: all windows whose appId is 'files' get a fresh instance.
  // Each window gets its own FileManagerProvider so state is per-window.
  if (appId === 'files') return <FileManagerApp />;
  if (appId === 'terminal') return <TerminalApp />;
  if (appId === 'github') return <GitHubApp />;
  if (appId === 'projects') return <ProjectManagerApp />;
  if (appId === 'nova') return <NovaAIApp />;
  if (appId === 'app-builder') return <AppBuilderApp />;
  if (appId === 'plugins') return <PluginManagerApp />;
  if (appId === 'collab-hub') return <CollaborationHubApp />;
  if (appId === 'cloud-editor') return <CloudEditorApp />;
  return <PlaceholderApp app={appData} windowTitle={windowTitle} />;
}

function DesktopContent() {
  const { data: settings, isLoading: isLoadingSettings } = useGetMySettings();
  const { data: wallpapers = [] } = useListWallpapers();
  const { data: apps = [] } = useListApps();
  const { windows, openWindow } = useOS();
  const { setTheme } = useTheme();

  // Wire the plugin openApp bridge: a running plugin may request to open a
  // native NovaOS app via the NovaSDK.  The PluginRunner validates the
  // permission server-side and then dispatches this event on window so the
  // OS shell can act on it — closing the gap between granted permission and
  // visible action.
  useEffect(() => {
    function handlePluginOpenApp(e: Event) {
      const detail = (e as CustomEvent<{ appId?: string }>).detail;
      if (!detail?.appId) return;
      const appId = detail.appId;
      const appData = apps.find(a => a.id === appId);
      if (!appData) return; // unknown/unregistered app — silently ignore
      openWindow(appId, appData.name, appData.icon);
    }
    window.addEventListener("novaos:plugin-open-app", handlePluginOpenApp);
    return () => window.removeEventListener("novaos:plugin-open-app", handlePluginOpenApp);
  }, [apps, openWindow]);

  // Apply OS settings to HTML element
  useEffect(() => {
    if (settings) {
      if (settings.theme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setTheme(isDark ? 'dark' : 'light');
      } else {
        setTheme(settings.theme);
      }
    }
  }, [settings, setTheme]);

  const currentWallpaper = useMemo(() => {
    // Default to the 'welcome-badol' wallpaper; fall back to first available.
    const wallpaperId = settings?.wallpaperId || 'welcome-badol';
    const found = wallpapers.find(w => w.id === wallpaperId);
    const raw = found?.imageUrl || wallpapers[0]?.imageUrl || '';
    // Resolve relative paths against Vite's BASE_URL so wallpapers work
    // on both Replit (sub-path) and Vercel (root).
    if (!raw || raw.startsWith('http') || raw.startsWith('data:')) return raw;
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    return `${base}/${raw.replace(/^\//, '')}`;
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
                {renderApp(win.appId, appData, win.title)}
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
