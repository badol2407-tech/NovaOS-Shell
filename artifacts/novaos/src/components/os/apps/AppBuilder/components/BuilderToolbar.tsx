import React, { useState } from "react";
import {
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Grid,
  Eye,
  Code2,
  Sparkles,
  Save,
  Loader2,
  Monitor,
  Tablet,
  Smartphone,
  ChevronDown,
  FolderOpen,
  Plus,
  X,
  Check,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useBuilder } from "../BuilderProvider";
import { cn } from "@/lib/utils";

// ── Zoom control ─────────────────────────────────────────────────────────────

function ZoomControl() {
  const { state, dispatch } = useBuilder();
  const { zoom } = state;
  const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2];

  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="relative flex items-center gap-1">
      <button
        onClick={() => dispatch({ type: "SET_ZOOM", zoom: zoom - 0.1 })}
        className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white/90 transition-colors"
        title="Zoom out"
      >
        <ZoomOut className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="px-2 py-0.5 text-xs text-white/60 hover:text-white/90 hover:bg-white/10 rounded transition-colors min-w-[48px] text-center"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        onClick={() => dispatch({ type: "SET_ZOOM", zoom: zoom + 0.1 })}
        className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white/90 transition-colors"
        title="Zoom in"
      >
        <ZoomIn className="w-3.5 h-3.5" />
      </button>

      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full left-0 mt-1 bg-zinc-900 border border-white/15 rounded-lg overflow-hidden z-50 shadow-xl"
          >
            {ZOOMS.map((z) => (
              <button
                key={z}
                onClick={() => {
                  dispatch({ type: "SET_ZOOM", zoom: z });
                  setShowMenu(false);
                }}
                className={cn(
                  "w-full px-4 py-1.5 text-xs text-left transition-colors",
                  zoom === z
                    ? "bg-primary/20 text-primary"
                    : "text-white/60 hover:bg-white/10 hover:text-white/90",
                )}
              >
                {Math.round(z * 100)}%
              </button>
            ))}
            <button
              onClick={() => {
                dispatch({ type: "SET_ZOOM", zoom: 1 });
                setShowMenu(false);
              }}
              className="w-full px-4 py-1.5 text-xs text-left text-white/40 hover:bg-white/10 hover:text-white/60 border-t border-white/10 transition-colors"
            >
              Reset
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Preview mode toggle ───────────────────────────────────────────────────────

function PreviewModeToggle() {
  const { state, dispatch } = useBuilder();
  const { previewMode } = state;

  const modes = [
    { mode: "desktop" as const, Icon: Monitor, label: "Desktop" },
    { mode: "tablet" as const, Icon: Tablet, label: "Tablet" },
    { mode: "mobile" as const, Icon: Smartphone, label: "Mobile" },
  ];

  return (
    <div className="flex items-center bg-white/5 rounded-md p-0.5">
      {modes.map(({ mode, Icon, label }) => (
        <button
          key={mode}
          onClick={() => dispatch({ type: "SET_PREVIEW_MODE", mode })}
          title={label}
          className={cn(
            "p-1 rounded transition-colors",
            previewMode === mode
              ? "bg-primary/30 text-primary"
              : "text-white/40 hover:text-white/70",
          )}
        >
          <Icon className="w-3.5 h-3.5" />
        </button>
      ))}
    </div>
  );
}

// ── Project name editor ───────────────────────────────────────────────────────

function ProjectNameEditor() {
  const { state, dispatch } = useBuilder();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(state.project.name);

  const commit = () => {
    if (draft.trim()) {
      dispatch({
        type: "UPDATE_PROJECT_META",
        meta: { name: draft.trim() },
      });
    } else {
      setDraft(state.project.name);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(state.project.name);
            setEditing(false);
          }
        }}
        className="px-2 py-0.5 bg-white/10 border border-primary/30 rounded text-sm text-white font-semibold focus:outline-none"
        style={{ width: `${Math.max(draft.length, 10) + 4}ch` }}
      />
    );
  }

  return (
    <button
      onClick={() => {
        setDraft(state.project.name);
        setEditing(true);
      }}
      className="text-sm font-semibold text-white/80 hover:text-white transition-colors px-1 py-0.5 rounded hover:bg-white/10"
      title="Click to rename"
    >
      {state.project.name}
    </button>
  );
}

// ── Save button ───────────────────────────────────────────────────────────────

function SaveButton({ onSave }: { onSave: () => void }) {
  const { state } = useBuilder();
  return (
    <button
      onClick={onSave}
      disabled={state.isSaving}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all",
        state.isSaving
          ? "bg-white/10 text-white/40 cursor-not-allowed"
          : "bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30",
      )}
    >
      {state.isSaving ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Save className="w-3 h-3" />
      )}
      {state.isSaving ? "Saving…" : "Save"}
    </button>
  );
}

// ── Toolbar separator ─────────────────────────────────────────────────────────

function Sep() {
  return <div className="w-px h-4 bg-white/15 mx-1" />;
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

interface BuilderToolbarProps {
  onSave: () => void;
}

export function BuilderToolbar({ onSave }: BuilderToolbarProps) {
  const { state, dispatch, undo, redo, canUndo, canRedo } = useBuilder();

  const toolBtn = (
    active: boolean,
    onClick: () => void,
    Icon: React.ComponentType<{ className?: string }>,
    label: string,
  ) => (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "p-1.5 rounded transition-colors",
        active
          ? "bg-primary/20 text-primary"
          : "text-white/50 hover:text-white/90 hover:bg-white/10",
      )}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 bg-black/30 border-b border-white/10 backdrop-blur-sm">
      {/* Project name */}
      <ProjectNameEditor />

      <Sep />

      {/* Undo / Redo */}
      <button
        onClick={undo}
        disabled={!canUndo}
        title="Undo (⌘Z)"
        className={cn(
          "p-1.5 rounded transition-colors",
          canUndo
            ? "text-white/50 hover:text-white/90 hover:bg-white/10"
            : "text-white/20 cursor-not-allowed",
        )}
      >
        <Undo2 className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={redo}
        disabled={!canRedo}
        title="Redo (⌘⇧Z)"
        className={cn(
          "p-1.5 rounded transition-colors",
          canRedo
            ? "text-white/50 hover:text-white/90 hover:bg-white/10"
            : "text-white/20 cursor-not-allowed",
        )}
      >
        <Redo2 className="w-3.5 h-3.5" />
      </button>

      <Sep />

      {/* Grid toggle */}
      {toolBtn(
        state.showGrid,
        () => dispatch({ type: "TOGGLE_GRID" }),
        Grid,
        "Toggle grid",
      )}

      <Sep />

      {/* Zoom */}
      <ZoomControl />

      <Sep />

      {/* Preview mode */}
      <PreviewModeToggle />

      <div className="flex-1" />

      {/* AI panel */}
      <button
        onClick={() => dispatch({ type: "TOGGLE_AI_PANEL" })}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all",
          state.showAIPanel
            ? "bg-violet-500/20 border border-violet-500/30 text-violet-300"
            : "bg-white/5 border border-white/10 text-white/50 hover:text-white/90 hover:bg-white/10",
        )}
      >
        <Sparkles className="w-3 h-3" />
        AI Builder
      </button>

      <Sep />

      {/* Preview */}
      {toolBtn(
        state.showPreview,
        () => dispatch({ type: "TOGGLE_PREVIEW" }),
        Eye,
        "Preview",
      )}

      {/* Code */}
      {toolBtn(
        state.showCode,
        () => dispatch({ type: "TOGGLE_CODE" }),
        Code2,
        "Code",
      )}

      <Sep />

      {/* Save */}
      <SaveButton onSave={onSave} />
    </div>
  );
}
