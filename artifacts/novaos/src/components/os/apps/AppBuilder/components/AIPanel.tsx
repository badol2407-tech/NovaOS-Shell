import React, { useState, useRef, useCallback } from "react";
import {
  Sparkles,
  Send,
  Loader2,
  X,
  Lightbulb,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useBuilder } from "../BuilderProvider";
import type { ComponentNode } from "../types";
import { cn } from "@/lib/utils";

// ── Prompt suggestions ────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "Create a hero section with a heading, subtitle, and CTA button",
  "Build a pricing cards layout with 3 tiers",
  "Generate a full landing page with navbar and footer",
  "Create a login form with email and password fields",
  "Build a dashboard with stats cards and a bar chart",
  "Generate a team members grid with avatars",
  "Create a features section with 6 icons and descriptions",
  "Build a contact form with name, email, and message",
  "Create a product card with image, title, and buy button",
  "Generate a navigation sidebar with icons and links",
];

// ── Generation history entry ──────────────────────────────────────────────────

interface HistoryEntry {
  prompt: string;
  nodeCount: number;
  timestamp: Date;
  provider?: string;
}

// ── AI Panel ─────────────────────────────────────────────────────────────────

export function AIPanel() {
  const { state, dispatch } = useBuilder();
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [replaceMode, setReplaceMode] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bufferRef = useRef("");

  const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");

  const generate = useCallback(
    async (promptText: string) => {
      if (!promptText.trim() || isGenerating) return;
      setIsGenerating(true);
      setError(null);
      bufferRef.current = "";

      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      const currentNodesJson = replaceMode
        ? undefined
        : JSON.stringify(state.project.nodes.slice(0, 5)); // send first 5 for context

      try {
        const res = await fetch(`${apiBase}/api/app-builder/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            prompt: promptText,
            context: currentNodesJson
              ? { currentNodes: currentNodesJson }
              : undefined,
          }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let provider = "";

        if (!reader) throw new Error("No response stream");

        let done = false;
        while (!done) {
          const { value, done: streamDone } = await reader.read();
          done = streamDone;
          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (!data) continue;
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) bufferRef.current += parsed.content;
                if (parsed.error) throw new Error(parsed.error);
                if (parsed.done) {
                  provider = parsed.provider ?? "";
                  done = true;
                }
              } catch (err) {
                if (err instanceof Error && err.message.startsWith("data:")) {
                  // not a JSON parse error
                }
              }
            }
          }
        }

        // Parse the accumulated JSON
        const raw = bufferRef.current.trim();

        // Extract JSON array from response (AI might include markdown)
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          throw new Error(
            "AI did not return valid JSON. Please try a more specific prompt.",
          );
        }

        const nodes: ComponentNode[] = JSON.parse(jsonMatch[0]);
        if (!Array.isArray(nodes)) throw new Error("Expected a JSON array");

        if (replaceMode) {
          dispatch({ type: "SET_NODES", nodes });
        } else {
          // Append to existing
          nodes.forEach((node) =>
            dispatch({ type: "ADD_NODE", node }),
          );
        }

        setHistory((h) => [
          { prompt: promptText, nodeCount: nodes.length, timestamp: new Date(), provider },
          ...h.slice(0, 9),
        ]);
        setPrompt("");
        setShowSuggestions(false);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Generation failed");
      } finally {
        setIsGenerating(false);
        bufferRef.current = "";
      }
    },
    [isGenerating, replaceMode, state.project.nodes, dispatch, apiBase],
  );

  const cancel = () => {
    abortRef.current?.abort();
    setIsGenerating(false);
  };

  return (
    <div className="flex flex-col h-full bg-black/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-white/80">
            Nova AI Builder
          </span>
        </div>
        <button
          onClick={() => dispatch({ type: "TOGGLE_AI_PANEL" })}
          className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Mode toggle */}
      <div className="px-3 py-2 border-b border-white/10 flex items-center gap-2">
        <span className="text-[10px] text-white/40 uppercase tracking-wider">
          Mode:
        </span>
        <div className="flex bg-white/5 rounded-md p-0.5">
          <button
            onClick={() => setReplaceMode(false)}
            className={cn(
              "px-2 py-0.5 rounded text-xs transition-colors",
              !replaceMode
                ? "bg-primary/30 text-primary"
                : "text-white/40 hover:text-white/70",
            )}
          >
            Append
          </button>
          <button
            onClick={() => setReplaceMode(true)}
            className={cn(
              "px-2 py-0.5 rounded text-xs transition-colors",
              replaceMode
                ? "bg-red-500/20 text-red-400"
                : "text-white/40 hover:text-white/70",
            )}
          >
            Replace
          </button>
        </div>
        {replaceMode && (
          <span className="text-[10px] text-red-400/70">
            Replaces canvas
          </span>
        )}
      </div>

      {/* Scrollable area */}
      <div className="flex-1 overflow-y-auto">
        {/* Suggestions */}
        {showSuggestions && (
          <div className="px-3 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Lightbulb className="w-3 h-3 text-amber-400" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  Suggestions
                </span>
              </div>
              <button
                onClick={() => setShowSuggestions(false)}
                className="text-[10px] text-white/25 hover:text-white/50"
              >
                Hide
              </button>
            </div>
            <div className="space-y-1">
              {SUGGESTIONS.slice(0, 5).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setPrompt(s);
                    generate(s);
                  }}
                  className="w-full text-left px-2 py-1.5 text-xs text-white/50 hover:text-white/80 hover:bg-white/8 rounded transition-colors leading-relaxed"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="px-3 py-2 border-t border-white/10">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-2">
              Recent
            </p>
            {history.map((entry, i) => (
              <button
                key={i}
                onClick={() => generate(entry.prompt)}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-white/8 transition-colors mb-1 group"
              >
                <p className="text-xs text-white/60 group-hover:text-white/80 leading-relaxed truncate">
                  {entry.prompt}
                </p>
                <p className="text-[10px] text-white/25 mt-0.5">
                  {entry.nodeCount} components
                  {entry.provider && ` · ${entry.provider}`}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mx-3 my-2 p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg"
            >
              <p className="text-xs text-red-400">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-[10px] text-red-400/60 hover:text-red-400 mt-1"
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Generating indicator */}
        <AnimatePresence>
          {isGenerating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mx-3 my-2 p-2.5 bg-violet-500/10 border border-violet-500/20 rounded-lg flex items-center gap-2"
            >
              <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin shrink-0" />
              <span className="text-xs text-violet-300">
                Nova is generating…
              </span>
              <button
                onClick={cancel}
                className="ml-auto text-[10px] text-violet-400/60 hover:text-violet-400"
              >
                Cancel
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/10">
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                generate(prompt);
              }
            }}
            disabled={isGenerating}
            placeholder="Describe what to build… (Enter to generate)"
            rows={3}
            className="w-full resize-none bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 placeholder:text-white/25 focus:outline-none focus:border-violet-500/40 transition-colors pr-10"
          />
          <button
            onClick={() =>
              isGenerating ? cancel() : generate(prompt)
            }
            disabled={!prompt.trim() && !isGenerating}
            className={cn(
              "absolute bottom-2 right-2 p-1.5 rounded-md transition-all",
              isGenerating
                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                : prompt.trim()
                ? "bg-violet-500/20 text-violet-300 hover:bg-violet-500/30"
                : "text-white/20 cursor-not-allowed",
            )}
          >
            {isGenerating ? (
              <X className="w-3.5 h-3.5" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-white/20 mt-1.5">
          Enter to generate · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}
