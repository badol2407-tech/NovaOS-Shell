import React, { useState, useMemo } from "react";
import {
  Code2,
  Copy,
  Check,
  Download,
  X,
  FileCode,
  FolderOpen,
} from "lucide-react";
import { motion } from "framer-motion";
import { useBuilder } from "../BuilderProvider";
import type { ComponentNode, ComponentStyle, ComponentProps } from "../types";
import { cn } from "@/lib/utils";

// ── Code generation ───────────────────────────────────────────────────────────

function styleToTailwind(style: ComponentStyle): string {
  const classes: string[] = [];

  // Width/Height
  if (style.width === "100%") classes.push("w-full");
  else if (style.width) classes.push(`w-[${style.width}]`);
  if (style.height) classes.push(`h-[${style.height}]`);
  if (style.minHeight) classes.push(`min-h-[${style.minHeight}]`);
  if (style.maxWidth) classes.push(`max-w-[${style.maxWidth}]`);

  // Padding
  if (style.padding) classes.push(`p-[${style.padding}]`);
  if (style.paddingX) classes.push(`px-[${style.paddingX}]`);
  if (style.paddingY) classes.push(`py-[${style.paddingY}]`);
  if (style.margin) classes.push(`m-[${style.margin}]`);

  // Gap
  if (style.gap) classes.push(`gap-[${style.gap}]`);

  // Text align
  if (style.textAlign === "center") classes.push("text-center");
  else if (style.textAlign === "right") classes.push("text-right");
  else if (style.textAlign === "justify") classes.push("text-justify");

  // Font
  if (style.fontWeight === "700" || style.fontWeight === "bold") classes.push("font-bold");
  else if (style.fontWeight === "600") classes.push("font-semibold");
  else if (style.fontWeight === "500") classes.push("font-medium");

  // Border radius
  if (style.borderRadius === "9999px") classes.push("rounded-full");
  else if (style.borderRadius === "12px") classes.push("rounded-xl");
  else if (style.borderRadius === "8px") classes.push("rounded-lg");
  else if (style.borderRadius === "6px") classes.push("rounded-md");
  else if (style.borderRadius === "4px") classes.push("rounded");
  else if (style.borderRadius) classes.push(`rounded-[${style.borderRadius}]`);

  // Shadow
  if (style.shadow === "sm") classes.push("shadow-sm");
  else if (style.shadow === "md") classes.push("shadow-md");
  else if (style.shadow === "lg") classes.push("shadow-lg");

  // Flex
  if (style.flexDirection === "column") classes.push("flex-col");
  if (style.alignItems === "center") classes.push("items-center");
  else if (style.alignItems === "flex-end") classes.push("items-end");
  if (style.justifyContent === "center") classes.push("justify-center");
  else if (style.justifyContent === "space-between") classes.push("justify-between");
  else if (style.justifyContent === "flex-end") classes.push("justify-end");

  return classes.join(" ");
}

function inlineStyleStr(style: ComponentStyle): string {
  const parts: string[] = [];
  if (style.backgroundColor) parts.push(`backgroundColor: '${style.backgroundColor}'`);
  if (style.textColor) parts.push(`color: '${style.textColor}'`);
  if (style.fontSize) parts.push(`fontSize: '${style.fontSize}'`);
  if (style.borderColor) parts.push(`borderColor: '${style.borderColor}'`);
  if (style.borderWidth) parts.push(`borderWidth: '${style.borderWidth}', borderStyle: 'solid'`);
  if (style.opacity !== undefined) parts.push(`opacity: ${style.opacity}`);
  return parts.length ? `{{ ${parts.join(", ")} }}` : "";
}

function indent(n: number): string {
  return "  ".repeat(n);
}

function generateNodeJSX(node: ComponentNode, depth: number): string {
  const { type, props, style, children } = node;
  const tailwind = styleToTailwind(style);
  const inlineStyle = inlineStyleStr(style);
  const ind = indent(depth);
  const childInd = indent(depth + 1);

  const classAttr = tailwind ? ` className="${tailwind}"` : "";
  const styleAttr = inlineStyle ? ` style=${inlineStyle}` : "";
  const childrenJSX = children
    .map((c) => generateNodeJSX(c, depth + 1))
    .join("\n");

  switch (type) {
    case "container":
    case "section":
      return children.length
        ? `${ind}<div${classAttr}${styleAttr}>\n${childrenJSX}\n${ind}</div>`
        : `${ind}<div${classAttr}${styleAttr} />`;

    case "grid": {
      const cols = props.cols ?? 2;
      const gridClass = `grid grid-cols-${cols} gap-4 ${tailwind}`.trim();
      return children.length
        ? `${ind}<div className="${gridClass}"${styleAttr}>\n${childrenJSX}\n${ind}</div>`
        : `${ind}<div className="${gridClass}"${styleAttr} />`;
    }

    case "flex": {
      const flexClass = `flex ${tailwind}`.trim();
      return children.length
        ? `${ind}<div className="${flexClass}"${styleAttr}>\n${childrenJSX}\n${ind}</div>`
        : `${ind}<div className="${flexClass}"${styleAttr} />`;
    }

    case "heading": {
      const level = props.level ?? 2;
      return `${ind}<h${level}${classAttr}${styleAttr}>${props.text ?? "Heading"}</h${level}>`;
    }

    case "text":
      return `${ind}<p${classAttr}${styleAttr}>${props.text ?? "Text"}</p>`;

    case "label":
      return `${ind}<label${classAttr}${styleAttr}>${props.text ?? "Label"}</label>`;

    case "badge":
      return `${ind}<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 ${tailwind}"${styleAttr}>${props.text ?? "Badge"}</span>`;

    case "link":
      return `${ind}<a href="${props.url ?? "#"}"${classAttr}${styleAttr}>${props.text ?? "Link"}</a>`;

    case "button": {
      const variantClass = {
        default: "bg-indigo-600 text-white hover:bg-indigo-700",
        outline: "border border-indigo-600 text-indigo-600 hover:bg-indigo-50",
        ghost: "text-indigo-600 hover:bg-indigo-50",
        destructive: "bg-red-600 text-white hover:bg-red-700",
        secondary: "bg-slate-100 text-slate-800 hover:bg-slate-200",
      }[props.variant ?? "default"] ?? "bg-indigo-600 text-white";
      const sizeClass = {
        sm: "px-3 py-1 text-sm",
        md: "px-4 py-2 text-sm",
        lg: "px-6 py-3 text-base",
      }[props.size ?? "md"] ?? "px-4 py-2";
      return `${ind}<button className="rounded-md font-medium transition-colors ${variantClass} ${sizeClass} ${tailwind}"${styleAttr}${props.disabled ? " disabled" : ""}>${props.text ?? "Button"}</button>`;
    }

    case "input":
      return `${ind}<input type="text" placeholder="${props.placeholder ?? ""}" className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${tailwind}"${styleAttr} />`;

    case "textarea":
      return `${ind}<textarea placeholder="${props.placeholder ?? ""}" rows={${(props as any).rows ?? 3}} className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-vertical ${tailwind}"${styleAttr} />`;

    case "select":
      return `${ind}<select className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none ${tailwind}"${styleAttr}>\n${childInd}<option>${props.placeholder ?? "Select..."}</option>\n${ind}</select>`;

    case "checkbox":
      return `${ind}<label className="flex items-center gap-2 cursor-pointer ${tailwind}"${styleAttr}>\n${childInd}<input type="checkbox" className="w-4 h-4" />\n${childInd}<span className="text-sm">${props.text ?? "Option"}</span>\n${ind}</label>`;

    case "switch":
      return `${ind}<label className="flex items-center gap-2 cursor-pointer ${tailwind}"${styleAttr}>\n${childInd}{/* Switch implementation */}\n${childInd}<span className="text-sm">${props.text ?? "Toggle"}</span>\n${ind}</label>`;

    case "slider":
      return `${ind}<div${classAttr}${styleAttr}>\n${childInd}${props.text ? `<label className="block text-sm font-medium mb-2">${props.text}</label>\n${childInd}` : ""}<input type="range" className="w-full accent-indigo-600" />\n${ind}</div>`;

    case "radio":
      return `${ind}<label className="flex items-center gap-2 cursor-pointer ${tailwind}"${styleAttr}>\n${childInd}<input type="radio" className="w-4 h-4 accent-indigo-600" />\n${childInd}<span className="text-sm">${props.text ?? "Option"}</span>\n${ind}</label>`;

    case "form":
      return `${ind}<form className="flex flex-col gap-3 ${tailwind}"${styleAttr} onSubmit={(e) => e.preventDefault()}>\n${childrenJSX || `${childInd}{/* form fields */}`}\n${ind}</form>`;

    case "card":
      return `${ind}<div className="p-6 rounded-xl border bg-white shadow-sm ${tailwind}"${styleAttr}>\n${childrenJSX || `${childInd}{/* card content */}`}\n${ind}</div>`;

    case "image":
      return `${ind}<img src="${props.src ?? "https://picsum.photos/400/200"}" alt="${props.alt ?? ""}" className="max-w-full rounded-lg ${tailwind}"${styleAttr} />`;

    case "avatar":
      return `${ind}<div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-semibold ${tailwind}"${styleAttr}>${props.initials ?? "?"}</div>`;

    case "navbar":
      return `${ind}<nav className="flex items-center justify-between px-6 h-14 ${tailwind}"${styleAttr}>\n${childInd}<span className="font-bold">${props.brand ?? "Brand"}</span>\n${childInd}<div className="flex gap-6">\n${indent(depth + 2)}{/* nav links */}\n${childInd}</div>\n${ind}</nav>`;

    case "footer":
      return `${ind}<footer className="py-8 text-center text-sm text-slate-500 ${tailwind}"${styleAttr}>\n${childrenJSX || `${childInd}<p>© 2025 MyApp. All rights reserved.</p>`}\n${ind}</footer>`;

    case "tabs":
      return `${ind}<div${classAttr}${styleAttr}>\n${childInd}{/* Tabs implementation */}\n${childInd}<div className="flex border-b">\n${indent(depth + 2)}<button className="px-4 py-2 text-sm border-b-2 border-indigo-600 text-indigo-600">Tab 1</button>\n${indent(depth + 2)}<button className="px-4 py-2 text-sm text-slate-500">Tab 2</button>\n${childInd}</div>\n${childInd}<div className="p-4 text-sm">Tab content</div>\n${ind}</div>`;

    case "accordion":
      return `${ind}<div className="border rounded-lg overflow-hidden ${tailwind}"${styleAttr}>\n${childInd}{/* Accordion items */}\n${childInd}<details className="border-b">\n${indent(depth + 2)}<summary className="px-4 py-3 cursor-pointer font-medium">Item 1</summary>\n${indent(depth + 2)}<div className="px-4 py-3 text-sm text-slate-600">Content</div>\n${childInd}</details>\n${ind}</div>`;

    case "table":
      return `${ind}<div className="overflow-x-auto ${tailwind}"${styleAttr}>\n${childInd}<table className="w-full text-sm border-collapse">\n${indent(depth + 2)}<thead><tr className="border-b bg-slate-50">${(props.columns ?? []).map((c: { key: string; label: string }) => `<th className="px-4 py-2 text-left font-semibold text-slate-600">${c.label}</th>`).join("")}</tr></thead>\n${indent(depth + 2)}<tbody>{/* rows */}</tbody>\n${childInd}</table>\n${ind}</div>`;

    case "list":
      return `${ind}<ul className="list-disc pl-6 space-y-1 text-sm ${tailwind}"${styleAttr}>\n${(props.listItems ?? []).map((item: string) => `${childInd}<li>${item}</li>`).join("\n")}\n${ind}</ul>`;

    case "divider":
      return `${ind}<hr className="border-slate-200 ${tailwind}"${styleAttr} />`;

    case "spacer":
      return `${ind}<div className="${tailwind || "h-8"}"${styleAttr} />`;

    case "chart-bar":
    case "chart-line":
    case "chart-pie":
    case "chart-area": {
      const chartType = type.replace("chart-", "");
      return `${ind}<div className="${tailwind || "h-60"}"${styleAttr}>\n${childInd}{/* ${chartType} chart — add recharts here */}\n${ind}</div>`;
    }

    default:
      return `${ind}<div${classAttr}${styleAttr}>{/* ${type} */}</div>`;
  }
}

function generateFullComponent(nodes: ComponentNode[], name: string): string {
  const jsx = nodes.map((n) => generateNodeJSX(n, 2)).join("\n");
  const componentName = name.replace(/[^a-zA-Z0-9]/g, "") || "MyApp";

  return `import React from 'react';

export default function ${componentName}() {
  return (
    <div className="min-h-screen">
${jsx}
    </div>
  );
}
`;
}

function generatePackageJson(name: string): string {
  const safe = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  return JSON.stringify(
    {
      name: safe || "my-app",
      version: "0.0.1",
      private: true,
      scripts: {
        dev: "vite",
        build: "vite build",
        preview: "vite preview",
      },
      dependencies: {
        react: "^19.0.0",
        "react-dom": "^19.0.0",
        recharts: "^2.15.0",
      },
      devDependencies: {
        "@vitejs/plugin-react": "^4.0.0",
        vite: "^6.0.0",
        tailwindcss: "^4.0.0",
        "@tailwindcss/vite": "^4.0.0",
        typescript: "^5.0.0",
      },
    },
    null,
    2,
  );
}

function generateIndexHtml(name: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
}

function generateMainTsx(componentName: string): string {
  const safe = componentName.replace(/[^a-zA-Z0-9]/g, "") || "MyApp";
  return `import React from 'react';
import ReactDOM from 'react-dom/client';
import ${safe} from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <${safe} />
  </React.StrictMode>,
);
`;
}

// ── File tabs ─────────────────────────────────────────────────────────────────

type FileTab = "component" | "package" | "html" | "main";

// ── Code Export panel ─────────────────────────────────────────────────────────

export function CodeExport() {
  const { state, dispatch } = useBuilder();
  const { project } = state;
  const [activeTab, setActiveTab] = useState<FileTab>("component");
  const [copied, setCopied] = useState(false);

  const files = useMemo<Record<FileTab, { name: string; content: string }>>(
    () => ({
      component: {
        name: "App.tsx",
        content: generateFullComponent(project.nodes, project.name),
      },
      package: {
        name: "package.json",
        content: generatePackageJson(project.name),
      },
      html: {
        name: "index.html",
        content: generateIndexHtml(project.name),
      },
      main: {
        name: "src/main.tsx",
        content: generateMainTsx(project.name),
      },
    }),
    [project],
  );

  const currentFile = files[activeTab];

  const copyCode = async () => {
    await navigator.clipboard.writeText(currentFile.content).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFile = () => {
    const blob = new Blob([currentFile.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = currentFile.name.split("/").pop() ?? currentFile.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAll = () => {
    // Download each file individually (browser limitation without JSZip)
    Object.values(files).forEach(({ name, content }) => {
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name.split("/").pop() ?? name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  };

  const TABS: { id: FileTab; label: string }[] = [
    { id: "component", label: "App.tsx" },
    { id: "package", label: "package.json" },
    { id: "html", label: "index.html" },
    { id: "main", label: "main.tsx" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="flex flex-col h-full overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 bg-black/20 border-b border-white/10 shrink-0">
        <Code2 className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-semibold text-white/70">Code Export</span>
        <span className="text-xs text-white/30 ml-1">
          {project.framework === "react"
            ? "React + Tailwind"
            : project.framework === "nextjs"
            ? "Next.js + Tailwind"
            : "Vite + Tailwind"}
        </span>
        <div className="flex-1" />
        <button
          onClick={downloadAll}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 rounded text-xs font-medium transition-colors"
          title="Download all files"
        >
          <Download className="w-3 h-3" />
          Download all
        </button>
        <button
          onClick={() => dispatch({ type: "TOGGLE_CODE" })}
          className="p-1.5 rounded text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* File tabs */}
      <div className="flex border-b border-white/10 bg-black/10 shrink-0">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs border-r border-white/10 transition-colors",
              activeTab === id
                ? "bg-white/5 text-white/80 border-b-2 border-b-emerald-400"
                : "text-white/40 hover:text-white/60 hover:bg-white/5",
            )}
          >
            <FileCode className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Code actions */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-black/20 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-1 text-[10px] text-white/30">
          <FolderOpen className="w-3 h-3" />
          <span>{currentFile.name}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={copyCode}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors",
              copied
                ? "text-emerald-400"
                : "text-white/40 hover:text-white/70 hover:bg-white/10",
            )}
          >
            {copied ? (
              <Check className="w-3 h-3" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={downloadFile}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
          >
            <Download className="w-3 h-3" />
            Download
          </button>
        </div>
      </div>

      {/* Code content */}
      <div className="flex-1 overflow-auto bg-zinc-950 p-4">
        <pre className="text-xs text-emerald-300 font-mono leading-relaxed whitespace-pre-wrap break-words">
          {currentFile.content}
        </pre>
      </div>
    </motion.div>
  );
}
