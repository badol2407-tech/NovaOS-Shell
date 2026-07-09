/**
 * ComponentRenderer — renders a ComponentNode tree as actual HTML/React elements.
 * Used by both the BuilderCanvas (with selection overlays) and LivePreview (clean render).
 */
import React, { useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ComponentNode, ComponentStyle } from "../types";
import { cn } from "@/lib/utils";

// ── Style conversion ─────────────────────────────────────────────────────────

function styleToReact(s: ComponentStyle): React.CSSProperties {
  const css: React.CSSProperties = {};
  if (s.width) css.width = s.width;
  if (s.height) css.height = s.height;
  if (s.minHeight) css.minHeight = s.minHeight;
  if (s.maxWidth) css.maxWidth = s.maxWidth;
  if (s.padding) css.padding = s.padding;
  if (s.paddingX) { css.paddingLeft = s.paddingX; css.paddingRight = s.paddingX; }
  if (s.paddingY) { css.paddingTop = s.paddingY; css.paddingBottom = s.paddingY; }
  if (s.margin) css.margin = s.margin;
  if (s.backgroundColor) css.backgroundColor = s.backgroundColor;
  if (s.textColor) css.color = s.textColor;
  if (s.borderRadius) css.borderRadius = s.borderRadius;
  if (s.borderWidth) css.borderWidth = s.borderWidth;
  if (s.borderColor) css.borderColor = s.borderColor;
  if (s.borderWidth || s.borderColor) css.borderStyle = "solid";
  if (s.fontSize) css.fontSize = s.fontSize;
  if (s.fontWeight) css.fontWeight = s.fontWeight;
  if (s.textAlign) css.textAlign = s.textAlign as React.CSSProperties["textAlign"];
  if (s.opacity !== undefined) css.opacity = s.opacity;
  if (s.flexDirection) css.flexDirection = s.flexDirection as React.CSSProperties["flexDirection"];
  if (s.alignItems) css.alignItems = s.alignItems;
  if (s.justifyContent) css.justifyContent = s.justifyContent;
  if (s.gap) css.gap = s.gap;
  if (s.shadow === "sm") css.boxShadow = "0 1px 2px rgba(0,0,0,.1)";
  if (s.shadow === "md") css.boxShadow = "0 4px 6px rgba(0,0,0,.1)";
  if (s.shadow === "lg") css.boxShadow = "0 10px 15px rgba(0,0,0,.15)";
  return css;
}

// ── Sample chart data ────────────────────────────────────────────────────────

const CHART_DATA = [
  { name: "Jan", value: 400 },
  { name: "Feb", value: 300 },
  { name: "Mar", value: 600 },
  { name: "Apr", value: 800 },
  { name: "May", value: 500 },
  { name: "Jun", value: 900 },
];

const PIE_DATA = [
  { name: "A", value: 400 },
  { name: "B", value: 300 },
  { name: "C", value: 200 },
  { name: "D", value: 100 },
];

const PIE_COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd"];

// ── Stateful sub-components (must be proper React components to obey hook rules) ─

interface SwitchProps { text?: string; style?: React.CSSProperties }
function SwitchRenderer({ text, style }: SwitchProps) {
  const [on, setOn] = React.useState(false);
  return (
    <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", ...style }}>
      <div
        onClick={() => setOn(!on)}
        style={{
          width: "44px", height: "24px", borderRadius: "9999px",
          background: on ? "#6366f1" : "#e2e8f0",
          position: "relative", transition: "background 0.2s", flexShrink: 0,
        }}
      >
        <div style={{
          position: "absolute", top: "2px", left: on ? "22px" : "2px",
          width: "20px", height: "20px", borderRadius: "9999px",
          background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.2)", transition: "left 0.2s",
        }} />
      </div>
      <span style={{ fontSize: "0.875rem" }}>{text ?? "Toggle"}</span>
    </label>
  );
}

interface TabsProps {
  tabs: { label: string; content: string }[];
  style?: React.CSSProperties;
}
function TabsRenderer({ tabs, style }: TabsProps) {
  const [active, setActive] = React.useState(0);
  return (
    <div style={style}>
      <div style={{ display: "flex", borderBottom: "2px solid #e2e8f0" }}>
        {tabs.map((tab, i) => (
          <button key={i} onClick={() => setActive(i)} style={{
            padding: "8px 16px", fontSize: "0.875rem", fontWeight: "500",
            border: "none", background: "transparent", cursor: "pointer",
            borderBottom: active === i ? "2px solid #6366f1" : "2px solid transparent",
            color: active === i ? "#6366f1" : "#64748b", marginBottom: "-2px",
          }}>{tab.label}</button>
        ))}
      </div>
      <div style={{ padding: "16px", fontSize: "0.875rem", color: "#334155" }}>
        {tabs[active]?.content ?? ""}
      </div>
    </div>
  );
}

interface AccordionProps {
  items: { title: string; content: string }[];
  style?: React.CSSProperties;
}
function AccordionRenderer({ items, style }: AccordionProps) {
  const [open, setOpen] = React.useState<number | null>(null);
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", ...style }}>
      {items.map((item, i) => (
        <div key={i}>
          <button onClick={() => setOpen(open === i ? null : i)} style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 16px", background: open === i ? "#f8fafc" : "#fff",
            border: "none", borderTop: i > 0 ? "1px solid #e2e8f0" : "none",
            cursor: "pointer", fontSize: "0.875rem", fontWeight: "500", textAlign: "left" as const,
          }}>
            {item.title}
            <span style={{ transform: open === i ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
          </button>
          {open === i && (
            <div style={{ padding: "12px 16px", fontSize: "0.875rem", color: "#64748b", borderTop: "1px solid #e2e8f0" }}>
              {item.content}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Badge colors ─────────────────────────────────────────────────────────────

const BADGE_COLORS: Record<string, string> = {
  blue: "background:#dbeafe;color:#1e40af",
  green: "background:#dcfce7;color:#166534",
  red: "background:#fee2e2;color:#991b1b",
  yellow: "background:#fef9c3;color:#854d0e",
  purple: "background:#ede9fe;color:#5b21b6",
  default: "background:#f1f5f9;color:#475569",
};

// ── Individual component renderers ────────────────────────────────────────────

interface RendererProps {
  node: ComponentNode;
  renderChildren: (children: ComponentNode[]) => React.ReactNode;
  isBuilder?: boolean;
}

function renderNodeContent({ node, renderChildren, isBuilder }: RendererProps): React.ReactNode {
  const { type, props, style } = node;
  const css = styleToReact(style);

  switch (type) {
    case "container":
      return (
        <div
          style={{ minHeight: "40px", ...css }}
          className="relative box-border"
        >
          {renderChildren(node.children)}
          {node.children.length === 0 && isBuilder && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-xs text-gray-400 border border-dashed border-gray-300 rounded px-2 py-1">
                Drop here
              </span>
            </div>
          )}
        </div>
      );

    case "section":
      return (
        <section style={{ padding: "32px", ...css }} className="w-full box-border">
          {renderChildren(node.children)}
          {node.children.length === 0 && isBuilder && (
            <div className="flex items-center justify-center min-h-[80px]">
              <span className="text-xs text-gray-400 border border-dashed border-gray-300 rounded px-2 py-1">
                Drop here
              </span>
            </div>
          )}
        </section>
      );

    case "grid": {
      const cols = props.cols ?? style.gridCols ?? 2;
      return (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gap: style.gap ?? "16px",
            ...css,
          }}
          className="box-border"
        >
          {renderChildren(node.children)}
          {node.children.length === 0 && isBuilder && (
            <div
              style={{ gridColumn: `span ${cols}` }}
              className="flex items-center justify-center min-h-[60px]"
            >
              <span className="text-xs text-gray-400 border border-dashed border-gray-300 rounded px-2 py-1">
                Drop here
              </span>
            </div>
          )}
        </div>
      );
    }

    case "flex":
      return (
        <div
          style={{
            display: "flex",
            flexDirection: style.flexDirection as React.CSSProperties["flexDirection"] ?? "row",
            gap: style.gap ?? "8px",
            alignItems: style.alignItems ?? "flex-start",
            flexWrap: "wrap",
            ...css,
          }}
          className="box-border"
        >
          {renderChildren(node.children)}
          {node.children.length === 0 && isBuilder && (
            <span className="text-xs text-gray-400 border border-dashed border-gray-300 rounded px-2 py-1">
              Drop here
            </span>
          )}
        </div>
      );

    case "heading": {
      const Tag = `h${props.level ?? 2}` as keyof React.JSX.IntrinsicElements;
      const sizes = {
        1: "2rem", 2: "1.5rem", 3: "1.25rem",
        4: "1.1rem", 5: "1rem", 6: "0.875rem",
      };
      return (
        <Tag
          style={{
            fontWeight: "700",
            fontSize: sizes[props.level ?? 2],
            lineHeight: 1.2,
            ...css,
          }}
        >
          {props.text ?? "Heading"}
        </Tag>
      );
    }

    case "text":
      return (
        <p style={{ lineHeight: 1.6, ...css }}>
          {props.text ?? "Text paragraph"}
        </p>
      );

    case "label":
      return (
        <label style={{ fontSize: "0.875rem", fontWeight: "500", ...css }}>
          {props.text ?? "Label"}
        </label>
      );

    case "badge": {
      const badgeCssStr = BADGE_COLORS[props.color ?? "default"] ?? BADGE_COLORS.default;
      const badgeCssParsed = Object.fromEntries(
        badgeCssStr.split(";").filter(Boolean).map((p) => {
          const [k, v] = p.split(":");
          const key = k.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          return [key, v.trim()];
        }),
      );
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "2px 10px",
            borderRadius: "9999px",
            fontSize: "0.75rem",
            fontWeight: "500",
            ...badgeCssParsed,
            ...css,
          }}
        >
          {props.text ?? "Badge"}
        </span>
      );
    }

    case "link":
      return (
        <a
          href={props.url ?? "#"}
          style={{ color: "#6366f1", textDecoration: "underline", ...css }}
          onClick={(e) => isBuilder && e.preventDefault()}
        >
          {props.text ?? "Link"}
        </a>
      );

    case "button": {
      const variantStyles: Record<string, React.CSSProperties> = {
        default: { background: "#6366f1", color: "#fff" },
        outline: { background: "transparent", color: "#6366f1", border: "1px solid #6366f1" },
        ghost: { background: "transparent", color: "#6366f1" },
        destructive: { background: "#ef4444", color: "#fff" },
        secondary: { background: "#f1f5f9", color: "#334155" },
      };
      const sizeStyles: Record<string, React.CSSProperties> = {
        sm: { padding: "4px 12px", fontSize: "0.75rem" },
        md: { padding: "8px 16px", fontSize: "0.875rem" },
        lg: { padding: "12px 24px", fontSize: "1rem" },
      };
      return (
        <button
          style={{
            borderRadius: "6px",
            fontWeight: "500",
            cursor: "pointer",
            border: "none",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            ...variantStyles[props.variant ?? "default"],
            ...sizeStyles[props.size ?? "md"],
            ...css,
          }}
          disabled={props.disabled}
        >
          {props.text ?? "Button"}
        </button>
      );
    }

    case "input":
      return (
        <input
          type="text"
          placeholder={props.placeholder ?? "Enter text..."}
          disabled={props.disabled}
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid #e2e8f0",
            borderRadius: "6px",
            fontSize: "0.875rem",
            outline: "none",
            boxSizing: "border-box",
            ...css,
          }}
          readOnly={isBuilder}
        />
      );

    case "textarea":
      return (
        <textarea
          placeholder={props.placeholder ?? "Enter text..."}
          rows={(props as any).rows ?? 3}
          disabled={props.disabled}
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid #e2e8f0",
            borderRadius: "6px",
            fontSize: "0.875rem",
            resize: "vertical",
            outline: "none",
            boxSizing: "border-box",
            ...css,
          }}
          readOnly={isBuilder}
        />
      );

    case "select":
      return (
        <select
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid #e2e8f0",
            borderRadius: "6px",
            fontSize: "0.875rem",
            background: "#fff",
            cursor: "pointer",
            boxSizing: "border-box",
            ...css,
          }}
          disabled={props.disabled || isBuilder}
        >
          <option>{props.placeholder ?? "Select..."}</option>
        </select>
      );

    case "checkbox":
      return (
        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", ...css }}>
          <input type="checkbox" style={{ width: "16px", height: "16px" }} readOnly />
          <span style={{ fontSize: "0.875rem" }}>{props.text ?? "Check me"}</span>
        </label>
      );

    case "switch":
      return <SwitchRenderer text={props.text} style={css} />;

    case "slider":
      return (
        <div style={{ ...css }}>
          {props.text && <label style={{ display: "block", fontSize: "0.875rem", marginBottom: "8px", fontWeight: "500" }}>{props.text}</label>}
          <input
            type="range"
            style={{ width: "100%", accentColor: "#6366f1" }}
            readOnly={isBuilder}
          />
        </div>
      );

    case "radio":
      return (
        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", ...css }}>
          <input type="radio" style={{ width: "16px", height: "16px", accentColor: "#6366f1" }} readOnly />
          <span style={{ fontSize: "0.875rem" }}>{props.text ?? "Option"}</span>
        </label>
      );

    case "form":
      return (
        <form
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            padding: "24px",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            ...css,
          }}
          onSubmit={(e) => e.preventDefault()}
        >
          {renderChildren(node.children)}
          {node.children.length === 0 && isBuilder && (
            <div className="flex items-center justify-center min-h-[60px]">
              <span className="text-xs text-gray-400 border border-dashed border-gray-300 rounded px-2 py-1">
                Drop inputs here
              </span>
            </div>
          )}
        </form>
      );

    case "card":
      return (
        <div
          style={{
            padding: "24px",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,.1)",
            background: "#fff",
            ...css,
          }}
        >
          {renderChildren(node.children)}
          {node.children.length === 0 && isBuilder && (
            <div className="flex items-center justify-center min-h-[60px]">
              <span className="text-xs text-gray-400 border border-dashed border-gray-300 rounded px-2 py-1">
                Drop here
              </span>
            </div>
          )}
        </div>
      );

    case "image":
      return (
        <img
          src={props.src ?? "https://picsum.photos/400/200"}
          alt={props.alt ?? "Image"}
          style={{
            display: "block",
            maxWidth: "100%",
            borderRadius: "8px",
            objectFit: "cover",
            ...css,
          }}
        />
      );

    case "avatar": {
      const initials = props.initials ?? "?";
      return (
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "9999px",
            background: "#6366f1",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.875rem",
            fontWeight: "600",
            flexShrink: 0,
            ...css,
          }}
        >
          {initials}
        </div>
      );
    }

    case "icon":
      return (
        <div style={{ display: "inline-flex", alignItems: "center", ...css }}>
          <span style={{ fontSize: "1.25rem" }}>⭐</span>
        </div>
      );

    case "navbar":
      return (
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            height: "56px",
            background: "#1e1b4b",
            color: "#fff",
            ...css,
          }}
        >
          <span style={{ fontWeight: "700", fontSize: "1rem" }}>
            {props.brand ?? "Brand"}
          </span>
          <div style={{ display: "flex", gap: "24px" }}>
            {(props.navLinks ?? [{ label: "Home", url: "#" }]).map(
              (link: { label: string; url: string }, i: number) => (
                <a
                  key={i}
                  href={link.url}
                  style={{ color: "rgba(255,255,255,0.8)", textDecoration: "none", fontSize: "0.875rem" }}
                  onClick={(e) => isBuilder && e.preventDefault()}
                >
                  {link.label}
                </a>
              ),
            )}
          </div>
        </nav>
      );

    case "sidebar":
      return (
        <aside
          style={{
            width: "240px",
            minHeight: "400px",
            padding: "16px",
            background: "#f8fafc",
            borderRight: "1px solid #e2e8f0",
            ...css,
          }}
        >
          {renderChildren(node.children)}
          {node.children.length === 0 && isBuilder && (
            <div className="flex items-center justify-center min-h-[80px]">
              <span className="text-xs text-gray-400 border border-dashed border-gray-300 rounded px-2 py-1">
                Drop here
              </span>
            </div>
          )}
        </aside>
      );

    case "footer":
      return (
        <footer
          style={{
            padding: "32px",
            background: "#1e293b",
            color: "#94a3b8",
            textAlign: "center",
            ...css,
          }}
        >
          {renderChildren(node.children)}
          {node.children.length === 0 && (
            <p style={{ fontSize: "0.875rem" }}>
              {(node.children[0] as any)?.props?.text ?? "© 2025 MyApp. All rights reserved."}
            </p>
          )}
        </footer>
      );

    case "tabs": {
      const tabList = props.tabs ?? [
        { label: "Tab 1", content: "Content 1" },
        { label: "Tab 2", content: "Content 2" },
      ];
      return <TabsRenderer tabs={tabList} style={css} />;
    }

    case "breadcrumb":
      return (
        <nav style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.875rem", ...css }}>
          <a href="#" style={{ color: "#6366f1" }} onClick={(e) => isBuilder && e.preventDefault()}>Home</a>
          <span style={{ color: "#94a3b8" }}>/</span>
          <a href="#" style={{ color: "#6366f1" }} onClick={(e) => isBuilder && e.preventDefault()}>Category</a>
          <span style={{ color: "#94a3b8" }}>/</span>
          <span style={{ color: "#334155" }}>Page</span>
        </nav>
      );

    case "modal":
    case "dialog":
      return (
        <div
          style={{
            position: "relative",
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "24px",
            boxShadow: "0 20px 25px rgba(0,0,0,.15)",
            maxWidth: "480px",
            ...css,
          }}
        >
          <div style={{ fontWeight: "600", marginBottom: "8px" }}>Dialog Title</div>
          <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "16px" }}>
            Dialog content goes here.
          </div>
          {renderChildren(node.children)}
        </div>
      );

    case "tooltip":
    case "popover":
      return (
        <div style={{ display: "inline-block", position: "relative", ...css }}>
          <button
            style={{
              padding: "6px 12px",
              background: "#f1f5f9",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Hover me
          </button>
          {isBuilder && (
            <div
              style={{
                position: "absolute",
                bottom: "calc(100% + 8px)",
                left: "50%",
                transform: "translateX(-50%)",
                background: "#1e293b",
                color: "#fff",
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "0.75rem",
                whiteSpace: "nowrap",
              }}
            >
              Tooltip content
            </div>
          )}
        </div>
      );

    case "table": {
      const columns = props.columns ?? [
        { key: "name", label: "Name" },
        { key: "value", label: "Value" },
      ];
      const rows = props.tableRows ?? [
        { name: "Row 1", value: "Data 1" },
        { name: "Row 2", value: "Data 2" },
      ];
      return (
        <div style={{ overflowX: "auto", ...css }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                {columns.map((col: { key: string; label: string }) => (
                  <th
                    key={col.key}
                    style={{ padding: "10px 14px", textAlign: "left", fontWeight: "600", color: "#475569" }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row: Record<string, string>, i: number) => (
                <tr
                  key={i}
                  style={{ borderBottom: "1px solid #f1f5f9" }}
                >
                  {columns.map((col: { key: string; label: string }) => (
                    <td
                      key={col.key}
                      style={{ padding: "10px 14px", color: "#334155" }}
                    >
                      {row[col.key] ?? "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case "list": {
      const items = props.listItems ?? ["Item 1", "Item 2", "Item 3"];
      return (
        <ul style={{ listStyle: "disc", paddingLeft: "24px", fontSize: "0.875rem", ...css }}>
          {items.map((item: string, i: number) => (
            <li key={i} style={{ padding: "4px 0", color: "#334155" }}>
              {item}
            </li>
          ))}
        </ul>
      );
    }

    case "accordion": {
      const items = props.items ?? [
        { title: "Item 1", content: "Content 1" },
        { title: "Item 2", content: "Content 2" },
      ];
      return <AccordionRenderer items={items} style={css} />;
    }

    case "divider":
      return (
        <hr
          style={{
            border: "none",
            borderTop: `${style.borderWidth ?? "1px"} solid ${style.borderColor ?? "#e2e8f0"}`,
            margin: "8px 0",
            ...css,
          }}
        />
      );

    case "spacer":
      return <div style={{ height: style.height ?? "32px", ...css }} />;

    case "chart-bar":
      return (
        <div style={{ height: style.height ?? "240px", ...css }}>
          {props.text && <p style={{ fontWeight: "600", marginBottom: "8px", fontSize: "0.875rem" }}>{props.text}</p>}
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={CHART_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );

    case "chart-line":
      return (
        <div style={{ height: style.height ?? "240px", ...css }}>
          {props.text && <p style={{ fontWeight: "600", marginBottom: "8px", fontSize: "0.875rem" }}>{props.text}</p>}
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={CHART_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={{ fill: "#6366f1" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );

    case "chart-pie":
      return (
        <div style={{ height: style.height ?? "240px", ...css }}>
          {props.text && <p style={{ fontWeight: "600", marginBottom: "8px", fontSize: "0.875rem" }}>{props.text}</p>}
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={PIE_DATA} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {PIE_DATA.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      );

    case "chart-area":
      return (
        <div style={{ height: style.height ?? "240px", ...css }}>
          {props.text && <p style={{ fontWeight: "600", marginBottom: "8px", fontSize: "0.875rem" }}>{props.text}</p>}
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={CHART_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Area type="monotone" dataKey="value" stroke="#6366f1" fill="#e0e7ff" fillOpacity={0.8} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      );

    default:
      return (
        <div style={{ padding: "12px", background: "#f1f5f9", borderRadius: "6px", fontSize: "0.875rem", color: "#64748b", ...css }}>
          [{type}]
        </div>
      );
  }
}

// ── Public component for the live preview (no selection chrome) ──────────────

export function NodePreview({ nodes }: { nodes: ComponentNode[] }) {
  function renderNode(node: ComponentNode): React.ReactNode {
    return (
      <div key={node.id}>
        {renderNodeContent({
          node,
          isBuilder: false,
          renderChildren: (children) => children.map(renderNode),
        })}
      </div>
    );
  }
  return <>{nodes.map(renderNode)}</>;
}

// ── Builder node (with selection chrome) ─────────────────────────────────────

interface BuilderNodeProps {
  node: ComponentNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDrop: (nodeId: string, targetId: string, position: "before" | "after" | "inside") => void;
  depth?: number;
}

export function BuilderNode({
  node,
  selectedId,
  onSelect,
  onDrop,
  depth = 0,
}: BuilderNodeProps) {
  const [dragOver, setDragOver] = useState<"before" | "after" | "inside" | null>(null);
  const isSelected = selectedId === node.id;

  const isContainer = [
    "container", "grid", "flex", "section", "form", "card",
    "sidebar", "footer", "navbar", "modal", "dialog",
  ].includes(node.type);

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.setData("application/nova-node-id", node.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const nodeType = e.dataTransfer.getData("application/nova-component-type");
    const movingId = e.dataTransfer.getData("application/nova-node-id");
    if (movingId === node.id) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const relH = rect.height;

    if (isContainer && nodeType) {
      setDragOver("inside");
    } else if (relY < relH * 0.25) {
      setDragOver("before");
    } else if (relY > relH * 0.75) {
      setDragOver("after");
    } else if (isContainer) {
      setDragOver("inside");
    } else {
      setDragOver("after");
    }
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    setDragOver(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const position = dragOver ?? "after";
    setDragOver(null);

    const movingNodeId = e.dataTransfer.getData("application/nova-node-id");
    if (movingNodeId) {
      onDrop(movingNodeId, node.id, position);
    }
  };

  const renderChildren = (children: ComponentNode[]) =>
    children.map((child) => (
      <BuilderNode
        key={child.id}
        node={child}
        selectedId={selectedId}
        onSelect={onSelect}
        onDrop={onDrop}
        depth={depth + 1}
      />
    ));

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node.id);
      }}
      style={{ position: "relative" }}
      className={cn(
        "outline-none transition-all",
        isSelected && "ring-2 ring-indigo-500 ring-offset-1",
        dragOver === "before" && "border-t-2 border-indigo-400",
        dragOver === "after" && "border-b-2 border-indigo-400",
        dragOver === "inside" && "ring-2 ring-indigo-300 ring-offset-1 ring-dashed",
        !isSelected && "hover:outline hover:outline-1 hover:outline-indigo-300/50",
      )}
    >
      {/* Label tooltip on select */}
      {isSelected && (
        <div
          style={{
            position: "absolute",
            top: "-20px",
            left: "0",
            background: "#6366f1",
            color: "#fff",
            fontSize: "10px",
            padding: "1px 6px",
            borderRadius: "4px",
            zIndex: 50,
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          {node.label}
        </div>
      )}

      {renderNodeContent({ node, isBuilder: true, renderChildren })}
    </div>
  );
}
