import React, { useState, useEffect } from "react";
import {
  FolderOpen,
  Plus,
  Trash2,
  X,
  Loader2,
  Calendar,
  Code2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useBuilder } from "../BuilderProvider";
import type { BuilderProject, ComponentNode } from "../types";
import { cn } from "@/lib/utils";

interface ProjectRecord {
  id: number;
  name: string;
  description: string | null;
  framework: "react" | "nextjs" | "vite";
  nodesJson: string;
  themeJson: string;
  createdAt: string;
  updatedAt: string;
}

function useApiBase() {
  return import.meta.env.BASE_URL.replace(/\/$/, "");
}

export function ProjectsModal({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useBuilder();
  const apiBase = useApiBase();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/app-builder/projects`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load projects");
      const data: ProjectRecord[] = await res.json();
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openProject = (p: ProjectRecord) => {
    try {
      const nodes: ComponentNode[] = JSON.parse(p.nodesJson || "[]");
      const theme = JSON.parse(p.themeJson || "{}");
      const project: BuilderProject = {
        id: p.id,
        name: p.name,
        description: p.description ?? undefined,
        framework: p.framework,
        nodes,
        theme,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };
      dispatch({ type: "LOAD_PROJECT", project });
      onClose();
    } catch {
      setError("Failed to load project");
    }
  };

  const createProject = async () => {
    if (!newName.trim()) return;
    setIsCreating(true);
    try {
      const res = await fetch(`${apiBase}/api/app-builder/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newName.trim(),
          nodesJson: "[]",
          themeJson: "{}",
        }),
      });
      if (!res.ok) throw new Error("Failed to create");
      const p: ProjectRecord = await res.json();
      openProject(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
      setIsCreating(false);
    }
  };

  const deleteProject = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this project?")) return;
    try {
      await fetch(`${apiBase}/api/app-builder/projects/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      setProjects((p) => p.filter((proj) => proj.id !== id));
    } catch {
      setError("Failed to delete");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-zinc-900 border border-white/15 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-primary" />
            <span className="font-semibold text-white">Projects</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Create new */}
        <div className="px-5 py-3 border-b border-white/10">
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createProject()}
              placeholder="New project name..."
              className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white/80 placeholder:text-white/30 focus:outline-none focus:border-primary/40"
            />
            <button
              onClick={createProject}
              disabled={!newName.trim() || isCreating}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                newName.trim() && !isCreating
                  ? "bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30"
                  : "bg-white/5 text-white/30 cursor-not-allowed",
              )}
            >
              {isCreating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              Create
            </button>
          </div>
        </div>

        {/* Project list */}
        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-white/30" />
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <FolderOpen className="w-8 h-8 text-white/15" />
              <p className="text-sm text-white/30">No saved projects yet</p>
            </div>
          ) : (
            projects.map((p) => (
              <button
                key={p.id}
                onClick={() => openProject(p)}
                className={cn(
                  "w-full flex items-center gap-3 px-5 py-3 border-b border-white/5 hover:bg-white/5 transition-colors text-left",
                  state.savedProjectId === p.id && "bg-primary/10",
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white/80 truncate">
                    {p.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Code2 className="w-3 h-3 text-white/25" />
                    <span className="text-[10px] text-white/35">
                      {p.framework}
                    </span>
                    <span className="text-[10px] text-white/25">·</span>
                    <Calendar className="w-3 h-3 text-white/25" />
                    <span className="text-[10px] text-white/35">
                      {new Date(p.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => deleteProject(p.id, e)}
                  className="p-1 rounded hover:bg-red-500/20 text-white/20 hover:text-red-400 transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </button>
            ))
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-5 py-3 border-t border-white/10">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
