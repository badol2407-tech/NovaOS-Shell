import React, { useEffect, useState } from "react";
import { Loader2, Puzzle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listMarketplace, listInstalled, getPlugin, installPlugin, uninstallPlugin } from "./api";
import { PermissionConsentDialog } from "./PermissionConsentDialog";
import type { PluginManifest, PluginPermission, PluginRecord } from "./types";

export function MarketplaceTab() {
  const [plugins, setPlugins] = useState<PluginRecord[]>([]);
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [pendingInstall, setPendingInstall] = useState<{
    plugin: PluginRecord;
    manifest: PluginManifest;
  } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const [marketplace, installed] = await Promise.all([listMarketplace(), listInstalled()]);
      setPlugins(marketplace);
      setInstalledIds(new Set(installed.filter((i) => i.enabled).map((i) => i.pluginId)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function openInstallDialog(plugin: PluginRecord) {
    setError(null);
    try {
      const { version } = await getPlugin(plugin.id);
      if (!version) {
        setError("This plugin has no published version yet.");
        return;
      }
      const manifest: PluginManifest = JSON.parse(version.manifestJson);
      setPendingInstall({ plugin, manifest });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function confirmInstall(granted: PluginPermission[]) {
    if (!pendingInstall) return;
    setBusyId(pendingInstall.plugin.id);
    try {
      await installPlugin(pendingInstall.plugin.id, granted);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
      setPendingInstall(null);
    }
  }

  async function handleUninstall(id: string) {
    setBusyId(id);
    try {
      await uninstallPlugin(id);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3 overflow-y-auto h-full">
      {error && <div className="text-sm text-red-500">{error}</div>}
      {plugins.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-12 flex flex-col items-center gap-2">
          <Puzzle className="w-8 h-8 opacity-40" />
          No plugins published yet. Build one in "My Plugins".
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {plugins.map((plugin) => {
          const isInstalled = installedIds.has(plugin.id);
          return (
            <div key={plugin.id} className="rounded-xl border bg-card p-4 flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <span className="text-2xl leading-none">{plugin.icon}</span>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{plugin.name}</div>
                  <div className="text-xs text-muted-foreground">v{plugin.latestVersion} · {plugin.category}</div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">{plugin.description}</p>
              <div className="flex items-center justify-between mt-auto pt-2">
                <Badge variant="secondary" className="gap-1">
                  <ShieldCheck className="w-3 h-3" /> Sandboxed
                </Badge>
                {isInstalled ? (
                  <Button size="sm" variant="outline" disabled={busyId === plugin.id} onClick={() => handleUninstall(plugin.id)}>
                    Uninstall
                  </Button>
                ) : (
                  <Button size="sm" disabled={busyId === plugin.id} onClick={() => openInstallDialog(plugin)}>
                    Install
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {pendingInstall && (
        <PermissionConsentDialog
          pluginName={pendingInstall.plugin.name}
          permissions={pendingInstall.manifest.permissions}
          open={!!pendingInstall}
          onCancel={() => setPendingInstall(null)}
          onConfirm={confirmInstall}
        />
      )}
    </div>
  );
}
