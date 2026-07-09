import type {
  PluginInstallationRecord,
  PluginManifest,
  PluginPermission,
  PluginRecord,
  PluginVersionRecord,
} from "./types";

const API_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/plugins`;

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function listMarketplace(): Promise<PluginRecord[]> {
  return req("");
}

export function listMyPlugins(): Promise<PluginRecord[]> {
  return req("/mine");
}

export function listInstalled(): Promise<PluginInstallationRecord[]> {
  return req("/installed");
}

export function getPlugin(
  id: string,
): Promise<{ plugin: PluginRecord; version: PluginVersionRecord | null }> {
  return req(`/${id}`);
}

export function createPlugin(
  manifest: PluginManifest,
  code: string,
  aiGenerated = false,
): Promise<{ plugin: PluginRecord; version: PluginVersionRecord }> {
  return req("", {
    method: "POST",
    body: JSON.stringify({ manifest, code, aiGenerated }),
  });
}

export function updatePlugin(
  id: string,
  manifest: PluginManifest,
  code: string,
  aiGenerated = false,
): Promise<{ plugin: PluginRecord; version: PluginVersionRecord }> {
  return req(`/${id}`, {
    method: "PUT",
    body: JSON.stringify({ manifest, code, aiGenerated }),
  });
}

export function publishPlugin(id: string): Promise<PluginRecord> {
  return req(`/${id}/publish`, { method: "POST" });
}

export function deletePlugin(id: string): Promise<{ ok: true }> {
  return req(`/${id}`, { method: "DELETE" });
}

export function installPlugin(
  id: string,
  grantedPermissions: PluginPermission[],
): Promise<PluginInstallationRecord> {
  return req(`/${id}/install`, {
    method: "POST",
    body: JSON.stringify({ grantedPermissions }),
  });
}

export function uninstallPlugin(id: string): Promise<{ ok: true }> {
  return req(`/${id}/uninstall`, { method: "POST" });
}

export function setInstallationEnabled(
  installId: number,
  enabled: boolean,
): Promise<PluginInstallationRecord> {
  return req(`/installed/${installId}`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
}

export function requestReview(id: string): Promise<{ review: unknown }> {
  return req(`/${id}/review`, { method: "POST" });
}

/** Streams generated { manifest, code } via SSE, calling onChunk as text arrives. */
export async function generatePlugin(
  prompt: string,
  onChunk: (text: string) => void,
): Promise<void> {
  const res = await fetch(`${API_BASE}/generate`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Generation request failed: HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = JSON.parse(line.slice(6));
      if (payload.content) onChunk(payload.content);
      if (payload.error) throw new Error(payload.error);
    }
  }
}

export function reportAudit(
  pluginId: string,
  action: string,
  allowed: boolean,
  detail?: unknown,
): void {
  void req("/audit-log", {
    method: "POST",
    body: JSON.stringify({ pluginId, action, allowed, detail }),
  }).catch(() => {
    // Audit reporting is best-effort; never block the plugin on it.
  });
}
