import React, { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Layers, FolderOpen, Cpu, Hammer } from "lucide-react";
import { BuilderProvider, useBuilder } from "./BuilderProvider";
import { ComponentPalette } from "./components/ComponentPalette";
import { BuilderCanvas, LayerTree } from "./components/BuilderCanvas";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { BuilderToolbar } from "./components/BuilderToolbar";
import { AIPanel } from "./components/AIPanel";
import { LivePreview } from "./components/LivePreview";
import { CodeExport } from "./components/CodeExport";
import { ProjectsModal } from "./components/ProjectsModal";
import { cn } from "@/lib/utils";

// ── Tab for left panel (Palette vs Layers) ────────────────────────────────────

type LeftTab = "palette" | "layers";

function LeftPanel() {
  const [activeTab, setActiveTab] = useState<LeftTab>("palette");

  return (
    <div className="flex flex-col h-full w-56 border-r border-white/10 bg-black/20 shrink-0">
      {/* Tab switcher */}
      <div className="flex border-b border-white/10">
        {(["palette", "layers"] as LeftTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors",
              activeTab === tab
                ? "text-white/80 border-b-2 border-primary"
                : "text-white/30 hover:text-white/60",
            )}
          >
            {tab === "palette" ? (
              <Hammer className="w-3 h-3" />
            ) : (
              <Layers className="w-3 h-3" />
            )}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "palette" ? <ComponentPalette /> : <LayerTree />}
      </div>
    </div>
  );
}

// ── Inner app content (uses BuilderProvider context) ──────────────────────────

function AppBuilderContent() {
  const { state, dispatch } = useBuilder();
  const [showProjects, setShowProjects] = useState(false);

  const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");

  const saveProject = useCallback(async () => {
    const { project, savedProjectId } = state;
    dispatch({ type: "SET_SAVING", isSaving: true });
    try {
      const body = {
        name: project.name,
        description: project.description,
        framework: project.framework,
        nodesJson: JSON.stringify(project.nodes),
        themeJson: JSON.stringify(project.theme),
      };

      if (savedProjectId) {
        // Update existing
        await fetch(`${apiBase}/api/app-builder/projects/${savedProjectId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
      } else {
        // Create new
        const res = await fetch(`${apiBase}/api/app-builder/projects`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const created = await res.json();
          dispatch({ type: "SET_SAVED_ID", id: created.id });
        }
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      dispatch({ type: "SET_SAVING", isSaving: false });
    }
  }, [state, dispatch, apiBase]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-zinc-950">
      {/* Top bar with project actions */}
      <div className="flex items-center gap-2 px-3 py-1 border-b border-white/10 bg-black/30 shrink-0">
        <div className="flex items-center gap-1.5">
          <Cpu className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-white/70 tracking-wide">
            App Builder
          </span>
        </div>
        <div className="w-px h-3 bg-white/20 mx-1" />
        <button
          onClick={() => setShowProjects(true)}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
        >
          <FolderOpen className="w-3 h-3" />
          Projects
        </button>
      </div>

      {/* Toolbar */}
      <BuilderToolbar onSave={saveProject} />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Palette / Layers */}
        <LeftPanel />

        {/* Center: Canvas or Preview/Code */}
        <div className="flex-1 overflow-hidden flex flex-col min-w-0">
          <AnimatePresence mode="wait">
            {state.showPreview ? (
              <motion.div
                key="preview"
                className="flex-1 overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <LivePreview />
              </motion.div>
            ) : state.showCode ? (
              <motion.div
                key="code"
                className="flex-1 overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <CodeExport />
              </motion.div>
            ) : (
              <motion.div
                key="canvas"
                className="flex-1 overflow-hidden flex"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <BuilderCanvas />

                {/* AI Panel (slides in alongside canvas) */}
                <AnimatePresence>
                  {state.showAIPanel && (
                    <motion.div
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: 280, opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      className="border-l border-white/10 overflow-hidden shrink-0"
                    >
                      <div className="w-[280px] h-full">
                        <AIPanel />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right: Properties */}
        <div className="w-56 border-l border-white/10 bg-black/20 shrink-0 overflow-hidden">
          <PropertiesPanel />
        </div>
      </div>

      {/* Projects modal */}
      <AnimatePresence>
        {showProjects && (
          <ProjectsModal onClose={() => setShowProjects(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function AppBuilderApp() {
  return (
    <BuilderProvider>
      <AppBuilderContent />
    </BuilderProvider>
  );
}
