// ── Component Tree Types for NovaOS Visual App Builder ─────────────────────

export type ComponentType =
  // Layout
  | "container"
  | "grid"
  | "flex"
  | "section"
  | "divider"
  | "spacer"
  // Typography
  | "heading"
  | "text"
  | "label"
  | "badge"
  | "link"
  // Inputs
  | "button"
  | "input"
  | "textarea"
  | "select"
  | "checkbox"
  | "switch"
  | "slider"
  | "radio"
  | "form"
  // Display
  | "card"
  | "image"
  | "avatar"
  | "icon"
  // Navigation
  | "navbar"
  | "sidebar"
  | "footer"
  | "tabs"
  | "breadcrumb"
  // Overlay
  | "modal"
  | "dialog"
  | "tooltip"
  | "popover"
  // Data
  | "table"
  | "list"
  | "accordion"
  // Charts
  | "chart-bar"
  | "chart-line"
  | "chart-pie"
  | "chart-area";

export interface ComponentStyle {
  width?: string;
  height?: string;
  minHeight?: string;
  maxWidth?: string;
  padding?: string;
  paddingX?: string;
  paddingY?: string;
  margin?: string;
  backgroundColor?: string;
  textColor?: string;
  borderRadius?: string;
  borderWidth?: string;
  borderColor?: string;
  fontSize?: string;
  fontWeight?: string;
  textAlign?: string;
  gap?: string;
  gridCols?: number;
  opacity?: number;
  shadow?: string;
  flexDirection?: string;
  alignItems?: string;
  justifyContent?: string;
}

export interface ComponentProps {
  // Generic
  text?: string;
  placeholder?: string;
  variant?: string;
  size?: string;
  disabled?: boolean;
  // Heading
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  // Image
  src?: string;
  alt?: string;
  // Button
  href?: string;
  // Grid
  cols?: number;
  // Badge / button color
  color?: string;
  // Tabs
  tabs?: { label: string; content: string }[];
  // Accordion
  items?: { title: string; content: string }[];
  // Table
  columns?: { key: string; label: string }[];
  tableRows?: Record<string, string>[];
  // List
  listItems?: string[];
  // Form
  action?: string;
  method?: string;
  // Avatar
  initials?: string;
  // Icon
  iconName?: string;
  // Link
  url?: string;
  // Navbar
  brand?: string;
  navLinks?: { label: string; url: string }[];
}

export interface ComponentNode {
  id: string;
  type: ComponentType;
  label: string;
  props: ComponentProps;
  style: ComponentStyle;
  children: ComponentNode[];
}

export interface BuilderProject {
  id?: number;
  name: string;
  description?: string;
  framework: "react" | "nextjs" | "vite";
  nodes: ComponentNode[];
  theme: {
    primary?: string;
    darkMode?: boolean;
    fontFamily?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export type PreviewMode = "desktop" | "tablet" | "mobile";

export interface BuilderState {
  project: BuilderProject;
  selectedId: string | null;
  history: ComponentNode[][];
  historyIndex: number;
  previewMode: PreviewMode;
  zoom: number;
  showGrid: boolean;
  showAIPanel: boolean;
  showPreview: boolean;
  showCode: boolean;
  isSaving: boolean;
  savedProjectId: number | null;
}

export type BuilderAction =
  | { type: "SET_NODES"; nodes: ComponentNode[] }
  | {
      type: "ADD_NODE";
      node: ComponentNode;
      parentId?: string;
      index?: number;
    }
  | { type: "UPDATE_NODE"; id: string; updates: Partial<ComponentNode> }
  | {
      type: "UPDATE_PROPS";
      id: string;
      props: Partial<ComponentProps>;
    }
  | {
      type: "UPDATE_STYLE";
      id: string;
      style: Partial<ComponentStyle>;
    }
  | { type: "DELETE_NODE"; id: string }
  | {
      type: "MOVE_NODE";
      id: string;
      targetId: string;
      position: "before" | "after" | "inside";
    }
  | { type: "DUPLICATE_NODE"; id: string }
  | { type: "SELECT"; id: string | null }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "SET_PREVIEW_MODE"; mode: PreviewMode }
  | { type: "SET_ZOOM"; zoom: number }
  | { type: "TOGGLE_GRID" }
  | { type: "TOGGLE_AI_PANEL" }
  | { type: "TOGGLE_PREVIEW" }
  | { type: "TOGGLE_CODE" }
  | { type: "LOAD_PROJECT"; project: BuilderProject }
  | { type: "UPDATE_PROJECT_META"; meta: Partial<BuilderProject> }
  | { type: "SET_SAVING"; isSaving: boolean }
  | { type: "SET_SAVED_ID"; id: number };

// ── Component Palette Definition ────────────────────────────────────────────

export interface PaletteItem {
  type: ComponentType;
  label: string;
  icon: string;
  category: PaletteCategory;
  defaultProps?: ComponentProps;
  defaultStyle?: ComponentStyle;
  defaultChildren?: ComponentNode[];
}

export type PaletteCategory =
  | "Layout"
  | "Typography"
  | "Inputs"
  | "Display"
  | "Navigation"
  | "Data"
  | "Charts";

// ── Property Definition for Properties Panel ────────────────────────────────

export interface PropDefinition {
  key: string;
  label: string;
  type:
    | "text"
    | "number"
    | "boolean"
    | "select"
    | "color"
    | "size"
    | "url"
    | "textarea";
  options?: { label: string; value: string }[];
  section: "props" | "style";
}
