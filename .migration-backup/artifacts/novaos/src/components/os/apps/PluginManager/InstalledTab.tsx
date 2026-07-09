import React, { useEffect, useState } from "react";
import { Loader2, Play, Power, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listInstalled, setInstallationEnabled, uninstallPlugin, getPlugin } from "./api";
import { PluginRunner } from "./PluginRunner";
import type { PluginInstallationRecord, PluginManifest, PluginVersionRecord } from "./types";

export function InstalledTab() {
  const [installs, setInstalls] = useState<PluginInstallationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<{
    manifest: PluginManifest;
    version: PluginVersionRecord;
    installation: PluginInstallationRecord;
  } | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setInstalls(await listInstalled());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function toggleEnabled(installation: PluginInstallationRecord) {
    try {
      await setInstallationEnabled(installation.id, !installation.enabled);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleUninstall(pluginId: string) {
    try {
      await uninstallPlugin(pluginId);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleRun(installation: PluginInstallationRecord) {
    setError(null);
    try {
      const { version } = await getPlugin(installation.pluginId);
      if (!version) {
        setError("This plugin has no code to run.");
        return;
      }
      const manifest: PluginManifest = JSON.parse(version.manifestJson);
      setRunning({ manifest, version, installation });
    } catch (err) {
      setError((err as Error).message);
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
      {installs.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-12">
          No plugins installed yet — browse the Marketplace tab.
        </div>
      )}
      {installs.map((install) => (
        <div key={install.id} className="rounded-xl border bg-card p-4 flex items-center gap-3">
          <span className="text-2xl">{install.plugin.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{install.plugin.name}</div>
            <div className="text-xs text-muted-foreground truncate">
              Permissions: {install.grantedPermissions.length > 0 ? install.grantedPermissions.join(", ") : "none"}
            </div>
          </div>
          <Button size="sm" variant="outline" disabled={!install.enabled} onClick={() => handleRun(install)}>
            <Play className="w-3.5 h-3.5 mr-1" /> Run
          </Button>
          <div className="flex items-center gap-1.5" title={install.enabled ? "Disable" : "Enable"}>
            <Power className="w-3.5 h-3.5 text-muted-foreground" />
            <Switch checked={install.enabled} onCheckedChange={() => toggleEnabled(install)} />
          </div>
          <Button size="icon" variant="ghost" onClick={() => handleUninstall(install.pluginId)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}

      {running && (
        <Dialog open={!!running} onOpenChange={(v) => !v && setRunning(null)}>
          <DialogContent className="max-w-2xl h-[70vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span>{running.manifest.icon}</span> {running.manifest.name}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 min-h-0 rounded-lg overflow-hidden border">
              <PluginRunner
                pluginId={running.installation.pluginId}
                manifest={running.manifest}
                code={running.version.code}
                grantedPermissions={running.installation.grantedPermissions}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
