import React from "react";
import { Sliders, Trash2, Copy, ChevronDown } from "lucide-react";
import { useBuilder } from "../BuilderProvider";
import type { ComponentStyle } from "../types";
import { cn } from "@/lib/utils";

// ── Reusable field components ─────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white/80 placeholder:text-white/25 focus:outline-none focus:border-primary/40"
    />
  );
}

function SelectInput({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white/80 focus:outline-none focus:border-primary/40 pr-6"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
    </div>
  );
}

function ColorInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value || "#6366f1"}
        onChange={(e) => onChange(e.target.value)}
        className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent p-0"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#..."
        className="flex-1 px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white/80 placeholder:text-white/25 focus:outline-none focus:border-primary/40"
      />
    </div>
  );
}

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="border-b border-white/10">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
          {title}
        </span>
        <ChevronDown
          className={cn(
            "w-3 h-3 text-white/30 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  );
}

// ── Properties panel ─────────────────────────────────────────────────────────

export function PropertiesPanel() {
  const {
    state,
    dispatch,
    getSelectedNode,
    deleteSelected,
    duplicateSelected,
    updateProps,
    updateStyle,
  } = useBuilder();

  const node = getSelectedNode();

  if (!node) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3 px-4">
        <Sliders className="w-8 h-8 text-white/15" />
        <p className="text-xs text-white/30 text-center">
          Select a component to edit its properties
        </p>
      </div>
    );
  }

  const { type, props, style, label } = node;

  // Update label
  const setLabel = (v: string) =>
    dispatch({ type: "UPDATE_NODE", id: node.id, updates: { label: v } });

  const setStyle = (s: Partial<ComponentStyle>) => updateStyle(node.id, s);
  const setProp = (key: string, value: unknown) =>
    updateProps(node.id, { [key]: value });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-white/10">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">
            Properties
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={duplicateSelected}
              className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
              title="Duplicate (⌘D)"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={deleteSelected}
              className="p-1 rounded hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
              title="Delete (⌫)"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div>
          <Label>Label</Label>
          <TextInput value={label} onChange={setLabel} placeholder="Component label" />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* ── Type-specific props ── */}
        <Section title="Content">
          {/* Heading */}
          {type === "heading" && (
            <>
              <div>
                <Label>Text</Label>
                <TextInput
                  value={props.text ?? ""}
                  onChange={(v) => setProp("text", v)}
                  placeholder="Heading text"
                />
              </div>
              <div>
                <Label>Level</Label>
                <SelectInput
                  value={String(props.level ?? 2)}
                  onChange={(v) => setProp("level", parseInt(v))}
                  options={[1, 2, 3, 4, 5, 6].map((n) => ({
                    label: `H${n}`,
                    value: String(n),
                  }))}
                />
              </div>
            </>
          )}

          {/* Text, label, badge, link */}
          {["text", "label", "badge", "link"].includes(type) && (
            <div>
              <Label>Text</Label>
              <TextInput
                value={props.text ?? ""}
                onChange={(v) => setProp("text", v)}
                placeholder="Text content"
              />
            </div>
          )}

          {/* Link url */}
          {type === "link" && (
            <div>
              <Label>URL</Label>
              <TextInput
                value={props.url ?? ""}
                onChange={(v) => setProp("url", v)}
                placeholder="https://..."
              />
            </div>
          )}

          {/* Badge color */}
          {type === "badge" && (
            <div>
              <Label>Color</Label>
              <SelectInput
                value={props.color ?? "default"}
                onChange={(v) => setProp("color", v)}
                options={["default", "blue", "green", "red", "yellow", "purple"].map((c) => ({
                  label: c.charAt(0).toUpperCase() + c.slice(1),
                  value: c,
                }))}
              />
            </div>
          )}

          {/* Button */}
          {type === "button" && (
            <>
              <div>
                <Label>Text</Label>
                <TextInput
                  value={props.text ?? ""}
                  onChange={(v) => setProp("text", v)}
                  placeholder="Button text"
                />
              </div>
              <div>
                <Label>Variant</Label>
                <SelectInput
                  value={props.variant ?? "default"}
                  onChange={(v) => setProp("variant", v)}
                  options={[
                    { label: "Default", value: "default" },
                    { label: "Outline", value: "outline" },
                    { label: "Ghost", value: "ghost" },
                    { label: "Destructive", value: "destructive" },
                    { label: "Secondary", value: "secondary" },
                  ]}
                />
              </div>
              <div>
                <Label>Size</Label>
                <SelectInput
                  value={props.size ?? "md"}
                  onChange={(v) => setProp("size", v)}
                  options={[
                    { label: "Small", value: "sm" },
                    { label: "Medium", value: "md" },
                    { label: "Large", value: "lg" },
                  ]}
                />
              </div>
            </>
          )}

          {/* Input/Textarea */}
          {["input", "textarea", "select"].includes(type) && (
            <div>
              <Label>Placeholder</Label>
              <TextInput
                value={props.placeholder ?? ""}
                onChange={(v) => setProp("placeholder", v)}
                placeholder="Placeholder text"
              />
            </div>
          )}

          {/* Checkbox/Switch/Radio */}
          {["checkbox", "switch", "radio", "slider"].includes(type) && (
            <div>
              <Label>Label</Label>
              <TextInput
                value={props.text ?? ""}
                onChange={(v) => setProp("text", v)}
                placeholder="Label text"
              />
            </div>
          )}

          {/* Image */}
          {type === "image" && (
            <>
              <div>
                <Label>Image URL</Label>
                <TextInput
                  value={props.src ?? ""}
                  onChange={(v) => setProp("src", v)}
                  placeholder="https://..."
                />
              </div>
              <div>
                <Label>Alt text</Label>
                <TextInput
                  value={props.alt ?? ""}
                  onChange={(v) => setProp("alt", v)}
                  placeholder="Image description"
                />
              </div>
            </>
          )}

          {/* Avatar */}
          {type === "avatar" && (
            <div>
              <Label>Initials</Label>
              <TextInput
                value={props.initials ?? ""}
                onChange={(v) => setProp("initials", v)}
                placeholder="JD"
              />
            </div>
          )}

          {/* Navbar */}
          {type === "navbar" && (
            <div>
              <Label>Brand name</Label>
              <TextInput
                value={props.brand ?? ""}
                onChange={(v) => setProp("brand", v)}
                placeholder="MyApp"
              />
            </div>
          )}

          {/* Grid */}
          {type === "grid" && (
            <div>
              <Label>Columns</Label>
              <SelectInput
                value={String(props.cols ?? 2)}
                onChange={(v) => setProp("cols", parseInt(v))}
                options={[1, 2, 3, 4, 5, 6].map((n) => ({
                  label: `${n} column${n > 1 ? "s" : ""}`,
                  value: String(n),
                }))}
              />
            </div>
          )}

          {/* Chart title */}
          {type.startsWith("chart-") && (
            <div>
              <Label>Title</Label>
              <TextInput
                value={props.text ?? ""}
                onChange={(v) => setProp("text", v)}
                placeholder="Chart title"
              />
            </div>
          )}
        </Section>

        {/* ── Style section ── */}
        <Section title="Layout">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Width</Label>
              <TextInput
                value={style.width ?? ""}
                onChange={(v) => setStyle({ width: v })}
                placeholder="auto"
              />
            </div>
            <div>
              <Label>Height</Label>
              <TextInput
                value={style.height ?? ""}
                onChange={(v) => setStyle({ height: v })}
                placeholder="auto"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Min height</Label>
              <TextInput
                value={style.minHeight ?? ""}
                onChange={(v) => setStyle({ minHeight: v })}
                placeholder="auto"
              />
            </div>
            <div>
              <Label>Max width</Label>
              <TextInput
                value={style.maxWidth ?? ""}
                onChange={(v) => setStyle({ maxWidth: v })}
                placeholder="none"
              />
            </div>
          </div>
          <div>
            <Label>Padding</Label>
            <TextInput
              value={style.padding ?? ""}
              onChange={(v) => setStyle({ padding: v })}
              placeholder="16px"
            />
          </div>
          <div>
            <Label>Margin</Label>
            <TextInput
              value={style.margin ?? ""}
              onChange={(v) => setStyle({ margin: v })}
              placeholder="0"
            />
          </div>
          <div>
            <Label>Gap</Label>
            <TextInput
              value={style.gap ?? ""}
              onChange={(v) => setStyle({ gap: v })}
              placeholder="8px"
            />
          </div>
        </Section>

        <Section title="Appearance">
          <div>
            <Label>Background</Label>
            <ColorInput
              value={style.backgroundColor ?? ""}
              onChange={(v) => setStyle({ backgroundColor: v })}
            />
          </div>
          <div>
            <Label>Text color</Label>
            <ColorInput
              value={style.textColor ?? ""}
              onChange={(v) => setStyle({ textColor: v })}
            />
          </div>
          <div>
            <Label>Border radius</Label>
            <TextInput
              value={style.borderRadius ?? ""}
              onChange={(v) => setStyle({ borderRadius: v })}
              placeholder="8px"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Border width</Label>
              <TextInput
                value={style.borderWidth ?? ""}
                onChange={(v) => setStyle({ borderWidth: v })}
                placeholder="1px"
              />
            </div>
            <div>
              <Label>Border color</Label>
              <ColorInput
                value={style.borderColor ?? ""}
                onChange={(v) => setStyle({ borderColor: v })}
              />
            </div>
          </div>
          <div>
            <Label>Shadow</Label>
            <SelectInput
              value={style.shadow ?? ""}
              onChange={(v) => setStyle({ shadow: v })}
              options={[
                { label: "None", value: "" },
                { label: "Small", value: "sm" },
                { label: "Medium", value: "md" },
                { label: "Large", value: "lg" },
              ]}
            />
          </div>
        </Section>

        <Section title="Typography">
          <div>
            <Label>Font size</Label>
            <TextInput
              value={style.fontSize ?? ""}
              onChange={(v) => setStyle({ fontSize: v })}
              placeholder="1rem"
            />
          </div>
          <div>
            <Label>Font weight</Label>
            <SelectInput
              value={style.fontWeight ?? ""}
              onChange={(v) => setStyle({ fontWeight: v })}
              options={[
                { label: "Normal (400)", value: "400" },
                { label: "Medium (500)", value: "500" },
                { label: "Semi-bold (600)", value: "600" },
                { label: "Bold (700)", value: "700" },
                { label: "Extra-bold (800)", value: "800" },
              ]}
            />
          </div>
          <div>
            <Label>Text align</Label>
            <SelectInput
              value={style.textAlign ?? ""}
              onChange={(v) => setStyle({ textAlign: v })}
              options={[
                { label: "Left", value: "left" },
                { label: "Center", value: "center" },
                { label: "Right", value: "right" },
                { label: "Justify", value: "justify" },
              ]}
            />
          </div>
        </Section>

        {/* Flex settings */}
        {["flex", "container", "section"].includes(type) && (
          <Section title="Flex">
            <div>
              <Label>Direction</Label>
              <SelectInput
                value={style.flexDirection ?? "row"}
                onChange={(v) => setStyle({ flexDirection: v })}
                options={[
                  { label: "Row", value: "row" },
                  { label: "Column", value: "column" },
                  { label: "Row reverse", value: "row-reverse" },
                  { label: "Column reverse", value: "column-reverse" },
                ]}
              />
            </div>
            <div>
              <Label>Align items</Label>
              <SelectInput
                value={style.alignItems ?? "flex-start"}
                onChange={(v) => setStyle({ alignItems: v })}
                options={[
                  { label: "Start", value: "flex-start" },
                  { label: "Center", value: "center" },
                  { label: "End", value: "flex-end" },
                  { label: "Stretch", value: "stretch" },
                  { label: "Baseline", value: "baseline" },
                ]}
              />
            </div>
            <div>
              <Label>Justify content</Label>
              <SelectInput
                value={style.justifyContent ?? "flex-start"}
                onChange={(v) => setStyle({ justifyContent: v })}
                options={[
                  { label: "Start", value: "flex-start" },
                  { label: "Center", value: "center" },
                  { label: "End", value: "flex-end" },
                  { label: "Space between", value: "space-between" },
                  { label: "Space around", value: "space-around" },
                  { label: "Space evenly", value: "space-evenly" },
                ]}
              />
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
