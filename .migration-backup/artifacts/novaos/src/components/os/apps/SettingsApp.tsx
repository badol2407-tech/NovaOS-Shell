import React, { useState } from 'react';
import { useGetMySettings, useUpdateMySettings, useListWallpapers, UserSettingsUpdate, UserSettingsTheme, UserSettingsDockPosition, getGetMySettingsQueryKey } from '@workspace/api-client-react';
import { Paintbrush, Monitor, LayoutTemplate, Palette, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQueryClient } from '@tanstack/react-query';

export default function SettingsApp() {
  const { data: settings } = useGetMySettings();
  const updateSettings = useUpdateMySettings();
  const { data: wallpapers = [] } = useListWallpapers();
  const [activeTab, setActiveTab] = useState('appearance');
  const queryClient = useQueryClient();

  if (!settings) return null;

  const handleUpdate = (updates: UserSettingsUpdate) => {
    updateSettings.mutate({ data: updates }, {
      onSuccess: (newData) => {
        queryClient.setQueryData(getGetMySettingsQueryKey(), newData);
      }
    });
  };

  return (
    <div className="flex h-full w-full bg-background text-foreground">
      {/* Sidebar */}
      <div className="w-48 shrink-0 border-r border-border/50 bg-muted/20 p-2 flex flex-col gap-1">
        <div className="px-3 py-2 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Settings
        </div>
        <button 
          onClick={() => setActiveTab('appearance')}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
            activeTab === 'appearance' ? "bg-primary text-primary-foreground" : "hover:bg-muted"
          )}
        >
          <Paintbrush className="w-4 h-4" />
          Appearance
        </button>
        <button 
          onClick={() => setActiveTab('desktop')}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
            activeTab === 'desktop' ? "bg-primary text-primary-foreground" : "hover:bg-muted"
          )}
        >
          <Monitor className="w-4 h-4" />
          Desktop & Dock
        </button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 p-6">
        <div className="max-w-2xl mx-auto space-y-8 pb-10">
          
          {activeTab === 'appearance' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div>
                <h2 className="text-xl font-bold mb-4">Theme</h2>
                <div className="grid grid-cols-3 gap-4">
                  {(['light', 'dark', 'system'] as const).map(theme => (
                    <button
                      key={theme}
                      onClick={() => handleUpdate({ theme: theme as UserSettingsTheme })}
                      className={cn(
                        "flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all",
                        settings.theme === theme ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className={cn(
                        "w-full aspect-[4/3] rounded-md border flex items-center justify-center",
                        theme === 'light' ? "bg-white border-zinc-200" : 
                        theme === 'dark' ? "bg-zinc-950 border-zinc-800" :
                        "bg-gradient-to-br from-white to-zinc-950 border-zinc-500"
                      )}>
                        <LayoutTemplate className={cn(
                          "w-6 h-6",
                          theme === 'light' ? "text-zinc-900" : 
                          theme === 'dark' ? "text-zinc-100" :
                          "text-zinc-500"
                        )} />
                      </div>
                      <span className="text-sm font-medium capitalize">{theme}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-xl font-bold mb-4">Wallpaper</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {wallpapers.map(wp => (
                    <button
                      key={wp.id}
                      onClick={() => handleUpdate({ wallpaperId: wp.id })}
                      className={cn(
                        "group relative aspect-video rounded-xl overflow-hidden border-2 transition-all",
                        settings.wallpaperId === wp.id ? "border-primary ring-2 ring-primary/20 ring-offset-2 ring-offset-background" : "border-transparent hover:border-primary/50"
                      )}
                    >
                      <img src={wp.thumbnailUrl} alt={wp.name} className="w-full h-full object-cover" />
                      <div className={cn(
                        "absolute inset-0 bg-black/20 flex items-center justify-center transition-opacity",
                        settings.wallpaperId === wp.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      )}>
                        {settings.wallpaperId === wp.id && (
                          <CheckCircle2 className="w-8 h-8 text-white drop-shadow-md" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'desktop' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div>
                <h2 className="text-xl font-bold mb-4">Dock Configuration</h2>
                
                <div className="space-y-6 bg-card border rounded-xl p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">Dock Position</h3>
                      <p className="text-sm text-muted-foreground">Where the dock appears on screen</p>
                    </div>
                    <Select 
                      value={settings.dockPosition} 
                      onValueChange={(val: UserSettingsDockPosition) => handleUpdate({ dockPosition: val })}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select position" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bottom">Bottom</SelectItem>
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="right">Right</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="h-px bg-border/50" />

                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">Auto-hide Dock</h3>
                      <p className="text-sm text-muted-foreground">Hide the dock when not in use</p>
                    </div>
                    <Switch 
                      checked={settings.dockAutoHide} 
                      onCheckedChange={(checked) => handleUpdate({ dockAutoHide: checked })}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </ScrollArea>
    </div>
  );
}
