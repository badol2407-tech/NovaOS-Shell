import React, { useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Layers, Sparkles } from "lucide-react";
import { useBuilder, makeDefaultNode } from "../BuilderProvider";
import { BuilderNode } from "./ComponentRenderer";
import type { ComponentType } from "../types";
import { cn } from "@/lib/utils";

// ── Canvas drop zone (when empty) ────────────────────────────────────────────

function EmptyCanvas({
  onDrop,
}: {
  onDrop: (type: ComponentType) => void;
}) {
  const [dragOver, setDragOver] = React.useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    const type = e.dataTransfer.types.includes("application/nova-component-type");
    if (type) {
      e.preventDefault();
      setDragOver(true);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const type = e.dataTransfer.getData(
      "application/nova-component-type",
    ) as ComponentType;
    if (type) onDrop(type);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        "flex flex-col items-center justify-center min-h-[400px] rounded-xl border-2 border-dashed transition-all",
        dragOver
          ? "border-indigo-400 bg-indigo-50"
          : "border-gray-200 bg-gray-50",
      )}
    >
      <motion.div
        animate={{ scale: dragOver ? 1.05 : 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="flex flex-col items-center gap-3 text-center p-8"
      >
        <div
          className={cn(
            "w-16 h-16 rounded-2xl flex items-center justify-center transition-colors",
            dragOver ? "bg-indigo-100" : "bg-gray-100",
          )}
        >
          {dragOver ? (
            <Sparkles className="w-8 h-8 text-indigo-500" />
          ) : (
            <Layers className="w-8 h-8 text-gray-400" />
          )}
        </div>
        <div>
          <p className="text-base font-semibold text-gray-700">
            {dragOver ? "Release to add component" : "Start building"}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Drag components from the palette, or use Nova AI to generate a layout
          </p>
        </div>
      </motion.div>
    </div>
  );
}

// ── Canvas grid overlay ──────────────────────────────────────────────────────

function GridOverlay() {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage:
          "radial-gradient(circle, #cbd5e1 1px, transparent 1px)",
        backgroundSize: "20px 20px",
        opacity: 0.4,
      }}
    />
  );
}

// ── Main canvas ──────────────────────────────────────────────────────────────

export function BuilderCanvas() {
  const { state, dispatch, addNode, selectNode } = useBuilder();
  const { project, selectedId, zoom, showGrid } = state;

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId) {
          e.preventDefault();
          dispatch({ type: "DELETE_NODE", id: selectedId });
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: "UNDO" });
      }
      if (
        (e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey ||
        (e.metaKey || e.ctrlKey) && e.key === "y"
      ) {
        e.preventDefault();
        dispatch({ type: "REDO" });
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        e.preventDefault();
        if (selectedId) dispatch({ type: "DUPLICATE_NODE", id: selectedId });
      }
      if (e.key === "Escape") {
        selectNode(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId, dispatch, selectNode]);

  // Handle drop from palette onto the canvas root
  const handleRootDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const componentType = e.dataTransfer.getData(
        "application/nova-component-type",
      ) as ComponentType;
      if (componentType) {
        addNode(componentType);
        return;
      }
      // Moving an existing node to root
      const nodeId = e.dataTransfer.getData("application/nova-node-id");
      if (nodeId) {
        // Just leave it — if it's already root level, no-op
      }
    },
    [addNode],
  );

  const handleRootDragOver = useCallback((e: React.DragEvent) => {
    const hasType =
      e.dataTransfer.types.includes("application/nova-component-type") ||
      e.dataTransfer.types.includes("application/nova-node-id");
    if (hasType) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  // Handle node drop within canvas (reordering)
  const handleNodeDrop = useCallback(
    (
      movingId: string,
      targetId: string,
      position: "before" | "after" | "inside",
    ) => {
      dispatch({ type: "MOVE_NODE", id: movingId, targetId, position });
    },
    [dispatch],
  );

  // Handle drop from palette into a child slot
  // (BuilderNode only fires for node-to-node moves; palette drops on empty containers
  // are handled in ComponentRenderer via the node's own drop handler)

  const isEmpty = project.nodes.length === 0;

  return (
    <div
      className="relative flex-1 overflow-auto bg-gray-100"
      onClick={() => selectNode(null)}
    >
      {showGrid && <GridOverlay />}

      <div
        className="relative min-h-full p-8"
        style={{
          transformOrigin: "top center",
          transform: `scale(${zoom})`,
          transition: "transform 0.15s ease",
        }}
      >
        {isEmpty ? (
          <EmptyCanvas onDrop={(type) => addNode(type)} />
        ) : (
          <div
            className="bg-white shadow-sm rounded-lg min-h-[600px] overflow-hidden"
            onDrop={handleRootDrop}
            onDragOver={handleRootDragOver}
          >
            {project.nodes.map((node) => (
              <BuilderNode
                key={node.id}
                node={node}
                selectedId={selectedId}
                onSelect={selectNode}
                onDrop={(movingId, targetId, pos) => {
                  // Check if it's from palette (component type) or node move
                  handleNodeDrop(movingId, targetId, pos);
                }}
              />
            ))}

            {/* Drop zone at the bottom for adding to root */}
            <div
              className="min-h-[60px] flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity border-2 border-dashed border-transparent hover:border-indigo-200 rounded-b-lg mx-4 mb-4"
              onDragOver={(e) => {
                if (
                  e.dataTransfer.types.includes("application/nova-component-type")
                ) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const type = e.dataTransfer.getData(
                  "application/nova-component-type",
                ) as ComponentType;
                if (type) addNode(type);
              }}
            >
              <span className="text-xs text-indigo-300">Drop here to add</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Layer tree (mini outline panel) ──────────────────────────────────────────

export function LayerTree() {
  const { state, selectNode } = useBuilder();
  const { project, selectedId } = state;

  function renderLayer(
    nodes: typeof project.nodes,
    depth = 0,
  ): React.ReactNode {
    return nodes.map((node) => (
      <div key={node.id}>
        <button
          onClick={() => selectNode(node.id)}
          className={cn(
            "w-full flex items-center gap-1 px-2 py-0.5 text-left rounded transition-colors text-xs",
            selectedId === node.id
              ? "bg-indigo-100 text-indigo-700"
              : "text-white/60 hover:bg-white/5 hover:text-white/90",
          )}
          style={{ paddingLeft: `${8 + depth * 12}px` }}
        >
          <span className="text-white/30">›</span>
          <span className="truncate">{node.label}</span>
        </button>
        {node.children.length > 0 &&
          renderLayer(node.children, depth + 1)}
      </div>
    ));
  }

  if (project.nodes.length === 0) {
    return (
      <p className="text-xs text-white/25 px-3 py-2 text-center">
        No layers yet
      </p>
    );
  }

  return (
    <div className="py-1">{renderLayer(project.nodes)}</div>
  );
}
