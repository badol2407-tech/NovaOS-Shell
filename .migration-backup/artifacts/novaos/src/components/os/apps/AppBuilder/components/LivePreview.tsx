import React, { useRef, useEffect } from "react";
import {
  Monitor,
  Tablet,
  Smartphone,
  X,
  Moon,
  Sun,
  RefreshCw,
} from "lucide-react";
import { motion } from "framer-motion";
import { useBuilder } from "../BuilderProvider";
import { NodePreview } from "./ComponentRenderer";
import type { PreviewMode } from "../types";
import { cn } from "@/lib/utils";

// ── Viewport sizes ────────────────────────────────────────────────────────────

const VIEWPORT: Record<
  PreviewMode,
  { width: number | string; label: string }
> = {
  desktop: { width: "100%", label: "Desktop (full)" },
  tablet: { width: 768, label: "Tablet (768px)" },
  mobile: { width: 390, label: "Mobile (390px)" },
};

// ── Live Preview panel ────────────────────────────────────────────────────────

export function LivePreview() {
  const { state, dispatch } = useBuilder();
  const { project, previewMode } = state;
  const [darkMode, setDarkMode] = React.useState(false);
  const [key, setKey] = React.useState(0); // force re-render

  const viewport = VIEWPORT[previewMode];
  const previewWidth =
    typeof viewport.width === "number" ? `${viewport.width}px` : viewport.width;

  const modes: { mode: PreviewMode; Icon: React.ComponentType<{ className?: string }>; label: string }[] = [
    { mode: "desktop", Icon: Monitor, label: "Desktop" },
    { mode: "tablet", Icon: Tablet, label: "Tablet" },
    { mode: "mobile", Icon: Smartphone, label: "Mobile" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="flex flex-col h-full overflow-hidden"
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-black/20 border-b border-white/10 shrink-0">
        <span className="text-xs font-semibold text-white/60">Preview</span>
        <div className="flex-1" />

        {/* Viewport toggle */}
        <div className="flex items-center bg-white/5 rounded-md p-0.5">
          {modes.map(({ mode, Icon, label }) => (
            <button
              key={mode}
              onClick={() => dispatch({ type: "SET_PREVIEW_MODE", mode })}
              title={label}
              className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors",
                previewMode === mode
                  ? "bg-primary/30 text-primary"
                  : "text-white/40 hover:text-white/70",
              )}
            >
              <Icon className="w-3 h-3" />
              <span className="hidden sm:inline">{label.split(" ")[0]}</span>
            </button>
          ))}
        </div>

        {/* Dark mode toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          title={darkMode ? "Light mode" : "Dark mode"}
          className={cn(
            "p-1.5 rounded transition-colors",
            darkMode
              ? "bg-primary/20 text-primary"
              : "text-white/40 hover:text-white/70 hover:bg-white/10",
          )}
        >
          {darkMode ? (
            <Sun className="w-3.5 h-3.5" />
          ) : (
            <Moon className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Refresh */}
        <button
          onClick={() => setKey((k) => k + 1)}
          title="Refresh preview"
          className="p-1.5 rounded text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        {/* Close */}
        <button
          onClick={() => dispatch({ type: "TOGGLE_PREVIEW" })}
          className="p-1.5 rounded text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-auto bg-gray-200 flex justify-center py-6 px-4">
        <div
          key={key}
          style={{
            width: previewWidth,
            maxWidth: "100%",
            transition: "width 0.3s ease",
          }}
          className={cn(
            "bg-white shadow-xl rounded-lg overflow-hidden min-h-[400px]",
            darkMode && "bg-zinc-950",
          )}
        >
          {project.nodes.length === 0 ? (
            <div className="flex items-center justify-center h-full min-h-[400px]">
              <p className="text-sm text-gray-400">
                Add components to see a preview
              </p>
            </div>
          ) : (
            <div className={darkMode ? "dark" : ""}>
              <NodePreview nodes={project.nodes} />
            </div>
          )}
        </div>
      </div>

      {/* Info bar */}
      <div className="px-4 py-1.5 bg-black/20 border-t border-white/10 flex items-center gap-2 shrink-0">
        <span className="text-[10px] text-white/30">
          {viewport.label}
        </span>
        <span className="text-[10px] text-white/20">·</span>
        <span className="text-[10px] text-white/30">
          {project.nodes.length} root component
          {project.nodes.length !== 1 ? "s" : ""}
        </span>
        {darkMode && (
          <>
            <span className="text-[10px] text-white/20">·</span>
            <span className="text-[10px] text-white/30">Dark mode</span>
          </>
        )}
      </div>
    </motion.div>
  );
}
