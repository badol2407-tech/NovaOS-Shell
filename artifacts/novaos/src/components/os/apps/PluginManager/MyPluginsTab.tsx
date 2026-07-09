import React, { useEffect, useState } from "react";
import { Loader2, Sparkles, Save, Rocket, Trash2, ShieldQuestion, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  listMyPlugins,
  getPlugin,
  createPlugin,
  updatePlugin,
  publishPlugin,
  deletePlugin,
  generatePlugin,
  requestReview,
} from "./api";
import {
  PLUGIN_PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  type PluginManifest,
  type PluginPermission,
  type PluginRecord,
  type PluginReview,
} from "./types";

const EMPTY_MANIFEST: PluginManifest = {
  id: "",
  name: "",
  description: "",
  version: "1.0.0",
  icon: "🧩",
  category: "Utilities",
  permissions: [],
};

function riskColor(risk: PluginReview["risk"]) {
  if (risk === "low") return "bg-emerald-500/15 text-emerald-500";
  if (risk === "medium") return "bg-amber-500/15 text-amber-500";
  return "bg-red-500/15 text-red-500";
}

export function MyPluginsTab() {
  const [plugins, setPlugins] = useState<PluginRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | "new" | null>(null);
  const [manifest, setManifest] = useState<PluginManifest>(EMPTY_MANIFEST);
  const [code, setCode] = useState("");
  const [aiGenerated, setAiGenerated] = useState(false);
  const [review, setReview] = useState<PluginReview | null>(null);
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExisting, setIsExisting] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      setPlugins(await listMyPlugins());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function startNew() {
    setSelectedId("new");
    setManifest(EMPTY_MANIFEST);
    setCode("");
    setAiGenerated(false);
    setReview(null);
    setIsExisting(false);
    setError(null);
  }

  async function selectExisting(plugin: PluginRecord) {
    setError(null);
    setSelectedId(plugin.id);
    setIsExisting(true);
    try {
      const { version } = await getPlugin(plugin.id);
      if (version) {
        setManifest(JSON.parse(version.manifestJson));
        setCode(version.code);
        setAiGenerated(version.aiGenerated);
        setReview(version.aiReviewJson ? JSON.parse(version.aiReviewJson) : null);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setGenerating(true);
    setError(null);
    let acc = "";
    try {
      await generatePlugin(prompt, (chunk) => {
        acc += chunk;
      });
      const match = acc.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("AI response did not contain a JSON plugin definition");
      const parsed = JSON.parse(match[0]);
      setManifest({ ...EMPTY_MANIFEST, ...parsed.manifest });
      setCode(parsed.code ?? "");
      setAiGenerated(true);
      setReview(null);
    } catch (err) {
      setError(`Generation failed: ${(err as Error).message}`);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      if (isExisting) {
        await updatePlugin(manifest.id, manifest, code, aiGenerated);
      } else {
        await createPlugin(manifest, code, aiGenerated);
        setIsExisting(true);
      }
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handlePublish() {
    if (!isExisting) return;
    setBusy(true);
    try {
      await publishPlugin(manifest.id);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!isExisting) return;
    setBusy(true);
    try {
      await deletePlugin(manifest.id);
      startNew();
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleReview() {
    if (!isExisting) {
      setError("Save the plugin before requesting a review.");
      return;
    }
    setBusy(true);
    try {
      const { review: result } = await requestReview(manifest.id);
      setReview(result as PluginReview);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function togglePermission(perm: PluginPermission) {
    setManifest((m) => ({
      ...m,
      permissions: m.permissions.includes(perm)
        ? m.permissions.filter((p) => p !== perm)
        : [...m.permissions, perm],
    }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Sidebar: plugin list */}
      <div className="w-52 border-r overflow-y-auto shrink-0 p-2 space-y-1">
        <Button size="sm" variant="secondary" className="w-full justify-start mb-2" onClick={startNew}>
          <Plus className="w-3.5 h-3.5 mr-1" /> New plugin
        </Button>
        {plugins.map((p) => (
          <button
            key={p.id}
            onClick={() => selectExisting(p)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left hover:bg-accent ${selectedId === p.id ? "bg-accent" : ""}`}
          >
            <span>{p.icon}</span>
            <span className="truncate flex-1">{p.name}</span>
            <Badge variant={p.status === "published" ? "default" : "outline"} className="text-[10px] px-1 py-0">
              {p.status}
            </Badge>
          </button>
        ))}
      </div>

      {/* Editor */}
      <div className="flex-1 min-w-0 overflow-y-auto p-4 space-y-4">
        {selectedId === null ? (
          <div className="text-center text-sm text-muted-foreground py-12">
            Select a plugin or create a new one.
          </div>
        ) : (
          <>
            {error && <div className="text-sm text-red-500">{error}</div>}

            {/* AI generator */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <Sparkles className="w-4 h-4 text-primary" /> Generate with AI
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. a pomodoro timer that notifies me when a session ends"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={generating}
                />
                <Button onClick={handleGenerate} disabled={generating || !prompt.trim()}>
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generate"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Uses NovaOS's configured AI provider(s) with automatic fallback. Review permissions before saving.
              </p>
            </div>

            {/* Manifest fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Id (slug)</label>
                <Input
                  value={manifest.id}
                  disabled={isExisting}
                  onChange={(e) => setManifest((m) => ({ ...m, id: e.target.value }))}
                  placeholder="pomodoro-timer"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Name</label>
                <Input value={manifest.name} onChange={(e) => setManifest((m) => ({ ...m, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Icon (emoji)</label>
                <Input value={manifest.icon} onChange={(e) => setManifest((m) => ({ ...m, icon: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <Input value={manifest.category} onChange={(e) => setManifest((m) => ({ ...m, category: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Version</label>
                <Input value={manifest.version} onChange={(e) => setManifest((m) => ({ ...m, version: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <Input value={manifest.description} onChange={(e) => setManifest((m) => ({ ...m, description: e.target.value }))} />
              </div>
            </div>

            {/* Permissions */}
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1.5">Permissions requested</div>
              <div className="grid grid-cols-2 gap-2">
                {PLUGIN_PERMISSIONS.map((perm) => (
                  <label key={perm} className="flex items-start gap-2 text-sm">
                    <Checkbox checked={manifest.permissions.includes(perm)} onCheckedChange={() => togglePermission(perm)} />
                    <span>
                      <span className="font-medium capitalize">{perm}</span>
                      <div className="text-xs text-muted-foreground">{PERMISSION_DESCRIPTIONS[perm]}</div>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Code */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Plugin code (HTML/CSS/JS body, runs sandboxed — use window.NovaSDK)
              </label>
              <Textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                rows={12}
                className="font-mono text-xs"
                placeholder="<div>Hello from your plugin</div>"
              />
            </div>

            {/* Review */}
            {review && (
              <div className={`rounded-lg p-3 text-sm ${riskColor(review.risk)}`}>
                <div className="flex items-center gap-1.5 font-medium">
                  <ShieldQuestion className="w-4 h-4" /> AI review: {review.risk} risk
                </div>
                <p className="mt-1">{review.summary}</p>
                {review.issues.length > 0 && (
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    {review.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                  </ul>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleSave} disabled={busy || !manifest.id || !manifest.name || !code}>
                <Save className="w-3.5 h-3.5 mr-1" /> {isExisting ? "Save new version" : "Create plugin"}
              </Button>
              <Button variant="outline" onClick={handleReview} disabled={busy || !isExisting}>
                <ShieldQuestion className="w-3.5 h-3.5 mr-1" /> Request AI review
              </Button>
              <Button variant="outline" onClick={handlePublish} disabled={busy || !isExisting}>
                <Rocket className="w-3.5 h-3.5 mr-1" /> Publish
              </Button>
              <Button variant="ghost" onClick={handleDelete} disabled={busy || !isExisting}>
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
