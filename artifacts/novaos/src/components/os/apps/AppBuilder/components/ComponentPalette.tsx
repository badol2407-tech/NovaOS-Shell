import React, { useState } from "react";
import {
  LayoutTemplate,
  Grid3X3,
  AlignHorizontalJustifyStart,
  Square,
  Minus,
  AlignVerticalJustifyStart,
  Heading1,
  Type,
  Tag,
  Badge,
  Link,
  MousePointer,
  TextCursorInput,
  AlignLeft,
  ChevronDown,
  CheckSquare,
  ToggleLeft,
  SlidersHorizontal,
  Circle,
  ClipboardList,
  CreditCard,
  Image,
  UserCircle,
  Star,
  NavigationIcon,
  PanelLeft,
  PanelBottom,
  Tabs,
  List,
  TableIcon,
  Accordion,
  BarChart2,
  LineChart,
  PieChart,
  AreaChart,
  ChevronRight,
  Search,
} from "lucide-react";
import { useBuilder } from "../BuilderProvider";
import type { ComponentType, PaletteCategory } from "../types";
import { cn } from "@/lib/utils";

// ── Palette items definition ─────────────────────────────────────────────────

interface PaletteEntry {
  type: ComponentType;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  category: PaletteCategory;
}

const PALETTE_ITEMS: PaletteEntry[] = [
  // Layout
  { type: "container", label: "Container", Icon: Square, category: "Layout" },
  { type: "grid", label: "Grid", Icon: Grid3X3, category: "Layout" },
  { type: "flex", label: "Flex Row", Icon: AlignHorizontalJustifyStart, category: "Layout" },
  { type: "section", label: "Section", Icon: LayoutTemplate, category: "Layout" },
  { type: "divider", label: "Divider", Icon: Minus, category: "Layout" },
  { type: "spacer", label: "Spacer", Icon: AlignVerticalJustifyStart, category: "Layout" },
  // Typography
  { type: "heading", label: "Heading", Icon: Heading1, category: "Typography" },
  { type: "text", label: "Text", Icon: Type, category: "Typography" },
  { type: "label", label: "Label", Icon: Tag, category: "Typography" },
  { type: "badge", label: "Badge", Icon: Badge, category: "Typography" },
  { type: "link", label: "Link", Icon: Link, category: "Typography" },
  // Inputs
  { type: "button", label: "Button", Icon: MousePointer, category: "Inputs" },
  { type: "input", label: "Input", Icon: TextCursorInput, category: "Inputs" },
  { type: "textarea", label: "Textarea", Icon: AlignLeft, category: "Inputs" },
  { type: "select", label: "Select", Icon: ChevronDown, category: "Inputs" },
  { type: "checkbox", label: "Checkbox", Icon: CheckSquare, category: "Inputs" },
  { type: "switch", label: "Switch", Icon: ToggleLeft, category: "Inputs" },
  { type: "slider", label: "Slider", Icon: SlidersHorizontal, category: "Inputs" },
  { type: "radio", label: "Radio", Icon: Circle, category: "Inputs" },
  { type: "form", label: "Form", Icon: ClipboardList, category: "Inputs" },
  // Display
  { type: "card", label: "Card", Icon: CreditCard, category: "Display" },
  { type: "image", label: "Image", Icon: Image, category: "Display" },
  { type: "avatar", label: "Avatar", Icon: UserCircle, category: "Display" },
  { type: "icon", label: "Icon", Icon: Star, category: "Display" },
  // Navigation
  { type: "navbar", label: "Navbar", Icon: NavigationIcon, category: "Navigation" },
  { type: "sidebar", label: "Sidebar", Icon: PanelLeft, category: "Navigation" },
  { type: "footer", label: "Footer", Icon: PanelBottom, category: "Navigation" },
  { type: "tabs", label: "Tabs", Icon: Tabs, category: "Navigation" },
  { type: "breadcrumb", label: "Breadcrumb", Icon: ChevronRight, category: "Navigation" },
  // Data
  { type: "table", label: "Table", Icon: TableIcon, category: "Data" },
  { type: "list", label: "List", Icon: List, category: "Data" },
  { type: "accordion", label: "Accordion", Icon: Accordion, category: "Data" },
  // Charts
  { type: "chart-bar", label: "Bar Chart", Icon: BarChart2, category: "Charts" },
  { type: "chart-line", label: "Line Chart", Icon: LineChart, category: "Charts" },
  { type: "chart-pie", label: "Pie Chart", Icon: PieChart, category: "Charts" },
  { type: "chart-area", label: "Area Chart", Icon: AreaChart, category: "Charts" },
];

const CATEGORIES: PaletteCategory[] = [
  "Layout",
  "Typography",
  "Inputs",
  "Display",
  "Navigation",
  "Data",
  "Charts",
];

const CATEGORY_COLORS: Record<PaletteCategory, string> = {
  Layout: "text-blue-400",
  Typography: "text-purple-400",
  Inputs: "text-emerald-400",
  Display: "text-amber-400",
  Navigation: "text-cyan-400",
  Data: "text-rose-400",
  Charts: "text-orange-400",
};

// ── Draggable palette item ────────────────────────────────────────────────────

function PaletteItemCard({
  item,
}: {
  item: PaletteEntry;
}) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/nova-component-type", item.type);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/8 cursor-grab active:cursor-grabbing group transition-colors select-none"
      title={`Drag to add ${item.label}`}
    >
      <item.Icon className="w-3.5 h-3.5 text-white/40 group-hover:text-white/70 shrink-0 transition-colors" />
      <span className="text-xs text-white/60 group-hover:text-white/90 transition-colors truncate">
        {item.label}
      </span>
    </div>
  );
}

// ── Main palette component ────────────────────────────────────────────────────

export function ComponentPalette() {
  const { addNode } = useBuilder();
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<PaletteCategory, boolean>>(
    {} as Record<PaletteCategory, boolean>,
  );

  const filtered = search
    ? PALETTE_ITEMS.filter((item) =>
        item.label.toLowerCase().includes(search.toLowerCase()),
      )
    : null;

  const toggleCategory = (cat: PaletteCategory) => {
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-white/10">
        <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
          Components
        </p>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full pl-6 pr-2 py-1 bg-white/5 border border-white/10 rounded-md text-xs text-white/80 placeholder:text-white/30 focus:outline-none focus:border-primary/40"
          />
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto py-1">
        {filtered ? (
          // Search results (flat)
          <div className="px-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-white/30 text-center py-4">
                No components found
              </p>
            ) : (
              filtered.map((item) => (
                <PaletteItemCard key={item.type} item={item} />
              ))
            )}
          </div>
        ) : (
          // Categorized
          CATEGORIES.map((category) => {
            const items = PALETTE_ITEMS.filter(
              (i) => i.category === category,
            );
            const isCollapsed = collapsed[category];
            return (
              <div key={category} className="mb-1">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-white/5 transition-colors group"
                >
                  <span
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-wider",
                      CATEGORY_COLORS[category],
                    )}
                  >
                    {category}
                  </span>
                  <ChevronRight
                    className={cn(
                      "w-3 h-3 text-white/30 transition-transform",
                      !isCollapsed && "rotate-90",
                    )}
                  />
                </button>
                {!isCollapsed && (
                  <div className="px-1">
                    {items.map((item) => (
                      <PaletteItemCard key={item.type} item={item} />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer tip */}
      <div className="px-3 py-2 border-t border-white/10">
        <p className="text-[10px] text-white/25 leading-relaxed">
          Drag components onto the canvas, or double-click to add
        </p>
      </div>
    </div>
  );
}
