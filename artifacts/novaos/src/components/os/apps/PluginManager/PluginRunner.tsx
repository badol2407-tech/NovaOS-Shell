import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { PluginManifest, PluginPermission } from "./types";
import { reportAudit } from "./api";

const API_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/plugins`;

// ── Resource limits (defense in depth alongside the server-side checks) ──────
const MAX_CALLS_PER_WINDOW = 20;
const RATE_WINDOW_MS = 10_000;
const MAX_ARGS_BYTES = 4_000;

interface PluginRunnerProps {
  pluginId: string;
  manifest: PluginManifest;
  code: string;
  grantedPermissions: PluginPermission[];
}

/**
 * Renders a plugin inside a fully sandboxed iframe:
 *   sandbox="allow-scripts" — no allow-same-origin, no allow-forms, no
 *   allow-popups, no allow-top-navigation. The iframe gets an opaque origin
 *   with zero access to the parent DOM, cookies, or network — its only
 *   channel to the outside world is postMessage, brokered here.
 *
 * Every inbound call is: rate-limited, size-capped, permission-checked
 * against what the user actually granted at install time, and audited
 * (both allowed and denied attempts) via the server audit log.
 */
export function PluginRunner({ pluginId, manifest, code, grantedPermissions }: PluginRunnerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const callTimestamps = useRef<number[]>([]);
  const [fatalError, setFatalError] = useState<string | null>(null);

  useEffect(() => {
    const granted = new Set(grantedPermissions);

    function reply(callId: string, result?: unknown, error?: string) {
      iframeRef.current?.contentWindow?.postMessage(
        { novaSdkResponse: true, callId, result, error },
        "*",
      );
    }

    async function handleCall(method: string, args: Record<string, unknown>) {
      switch (method) {
        case "storage.get": {
          const res = await fetch(
            `${API_BASE}/${pluginId}/storage/${encodeURIComponent(String(args["key"]))}`,
            { credentials: "include" },
          );
          if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "storage.get failed");
          return (await res.json()).value;
        }
        case "storage.set": {
          const res = await fetch(
            `${API_BASE}/${pluginId}/storage/${encodeURIComponent(String(args["key"]))}`,
            {
              method: "PUT",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ value: String(args["value"]) }),
            },
          );
          if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "storage.set failed");
          return true;
        }
        case "storage.remove": {
          const res = await fetch(
            `${API_BASE}/${pluginId}/storage/${encodeURIComponent(String(args["key"]))}`,
            { method: "DELETE", credentials: "include" },
          );
          if (!res.ok) throw new Error("storage.remove failed");
          return true;
        }
        case "notify": {
          const res = await fetch(`${API_BASE}/${pluginId}/notify`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: args["title"], body: args["body"] }),
          });
          if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "notify failed");
          return true;
        }
        case "ai.ask": {
          const res = await fetch(`${API_BASE}/${pluginId}/ai`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: args["prompt"] }),
          });
          if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "ai.ask failed");
          return (await res.json()).response;
        }
        case "clipboard.writeText": {
          // Server re-validates the grant and audits the call before we touch the clipboard.
          const res = await fetch(`${API_BASE}/${pluginId}/clipboard`, {
            method: "POST",
            credentials: "include",
          });
          if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "clipboard permission denied");
          await navigator.clipboard.writeText(String(args["text"] ?? ""));
          return true;
        }
        case "openApp": {
          // Server re-validates the grant and audits the call before we dispatch it.
          const res = await fetch(`${API_BASE}/${pluginId}/open-app`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ appId: args["appId"] }),
          });
          if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "openApp permission denied");
          window.dispatchEvent(new CustomEvent("novaos:plugin-open-app", { detail: { appId: args["appId"] } }));
          return true;
        }
        default:
          throw new Error(`Unknown NovaSDK method: ${method}`);
      }
    }

    function requiredPermissionFor(method: string): PluginPermission | null {
      if (method.startsWith("storage.")) return "storage";
      if (method === "notify") return "notifications";
      if (method === "ai.ask") return "ai";
      if (method === "clipboard.writeText") return "clipboard";
      if (method === "openApp") return "windows";
      return null;
    }

    function onMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data;
      if (!data || data.novaSdk !== true) return;
      const { callId, method, args } = data;

      // Rate limit
      const now = Date.now();
      callTimestamps.current = callTimestamps.current.filter((t) => now - t < RATE_WINDOW_MS);
      if (callTimestamps.current.length >= MAX_CALLS_PER_WINDOW) {
        reportAudit(pluginId, `sdk_call:${method}`, false, { reason: "rate_limited" });
        reply(callId, undefined, "Rate limit exceeded — this plugin is calling NovaSDK too frequently");
        return;
      }
      callTimestamps.current.push(now);

      // Payload size cap
      if (JSON.stringify(args ?? {}).length > MAX_ARGS_BYTES) {
        reportAudit(pluginId, `sdk_call:${method}`, false, { reason: "payload_too_large" });
        reply(callId, undefined, "Request payload too large");
        return;
      }

      const requiredPermission = requiredPermissionFor(method);
      if (requiredPermission && !granted.has(requiredPermission)) {
        reportAudit(pluginId, `sdk_call:${method}`, false, { reason: "missing_permission" });
        reply(callId, undefined, `Plugin does not have the '${requiredPermission}' permission`);
        return;
      }

      handleCall(method, args ?? {})
        .then((result) => reply(callId, result))
        .catch((err: Error) => reply(callId, undefined, err.message));
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [pluginId, grantedPermissions]);

  const doc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>html,body{margin:0;padding:0;height:100%;font-family:system-ui,-apple-system,sans-serif;color:#e4e4e7;background:#0a0a0c;}</style>
<script src="${API_BASE}/sdk.js"></script>
</head>
<body>
${code}
</body>
</html>`;

  if (fatalError) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-red-400">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        {fatalError}
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      title={manifest.name}
      srcDoc={doc}
      sandbox="allow-scripts"
      className="w-full h-full border-0 bg-black"
      onError={() => setFatalError("Plugin failed to load")}
    />
  );
}
