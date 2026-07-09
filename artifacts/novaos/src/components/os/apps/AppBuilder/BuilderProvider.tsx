import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  ReactNode,
} from "react";
import type {
  BuilderState,
  BuilderAction,
  ComponentNode,
  BuilderProject,
  ComponentType,
  ComponentProps,
  ComponentStyle,
} from "./types";

// ── Default project ──────────────────────────────────────────────────────────

const DEFAULT_PROJECT: BuilderProject = {
  name: "Untitled App",
  description: "",
  framework: "react",
  nodes: [],
  theme: { primary: "#6366f1", darkMode: false },
};

const INITIAL_STATE: BuilderState = {
  project: DEFAULT_PROJECT,
  selectedId: null,
  history: [[]],
  historyIndex: 0,
  previewMode: "desktop",
  zoom: 1,
  showGrid: true,
  showAIPanel: false,
  showPreview: false,
  showCode: false,
  isSaving: false,
  savedProjectId: null,
};

const MAX_HISTORY = 50;

// ── Helpers ──────────────────────────────────────────────────────────────────

export function generateId(prefix = "node"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function findNode(
  nodes: ComponentNode[],
  id: string,
): ComponentNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return undefined;
}

function updateNodeInTree(
  nodes: ComponentNode[],
  id: string,
  updater: (node: ComponentNode) => ComponentNode,
): ComponentNode[] {
  return nodes.map((node) => {
    if (node.id === id) return updater(node);
    return { ...node, children: updateNodeInTree(node.children, id, updater) };
  });
}

function deleteNodeFromTree(
  nodes: ComponentNode[],
  id: string,
): ComponentNode[] {
  return nodes
    .filter((n) => n.id !== id)
    .map((n) => ({ ...n, children: deleteNodeFromTree(n.children, id) }));
}

function duplicateNode(node: ComponentNode): ComponentNode {
  const newId = generateId(node.type);
  return {
    ...node,
    id: newId,
    label: `${node.label} (copy)`,
    children: node.children.map(duplicateNode),
  };
}

function insertAfterInTree(
  nodes: ComponentNode[],
  targetId: string,
  newNode: ComponentNode,
): ComponentNode[] {
  const result: ComponentNode[] = [];
  for (const node of nodes) {
    result.push({
      ...node,
      children: insertAfterInTree(node.children, targetId, newNode),
    });
    if (node.id === targetId) {
      result.push(newNode);
    }
  }
  return result;
}

function insertInsideInTree(
  nodes: ComponentNode[],
  parentId: string,
  newNode: ComponentNode,
): ComponentNode[] {
  return nodes.map((node) => {
    if (node.id === parentId) {
      return { ...node, children: [...node.children, newNode] };
    }
    return {
      ...node,
      children: insertInsideInTree(node.children, parentId, newNode),
    };
  });
}

function addToHistory(
  state: BuilderState,
  nodes: ComponentNode[],
): Pick<BuilderState, "history" | "historyIndex"> {
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push(JSON.parse(JSON.stringify(nodes)));
  if (newHistory.length > MAX_HISTORY) newHistory.shift();
  return {
    history: newHistory,
    historyIndex: newHistory.length - 1,
  };
}

// ── Reducer ──────────────────────────────────────────────────────────────────

function builderReducer(
  state: BuilderState,
  action: BuilderAction,
): BuilderState {
  switch (action.type) {
    case "SET_NODES": {
      return {
        ...state,
        project: { ...state.project, nodes: action.nodes },
        ...addToHistory(state, action.nodes),
      };
    }

    case "ADD_NODE": {
      let newNodes: ComponentNode[];
      if (action.parentId) {
        newNodes = insertInsideInTree(
          state.project.nodes,
          action.parentId,
          action.node,
        );
      } else {
        newNodes = [...state.project.nodes, action.node];
      }
      return {
        ...state,
        project: { ...state.project, nodes: newNodes },
        selectedId: action.node.id,
        ...addToHistory(state, newNodes),
      };
    }

    case "UPDATE_NODE": {
      const newNodes = updateNodeInTree(
        state.project.nodes,
        action.id,
        (node) => ({ ...node, ...action.updates }),
      );
      return {
        ...state,
        project: { ...state.project, nodes: newNodes },
        ...addToHistory(state, newNodes),
      };
    }

    case "UPDATE_PROPS": {
      const newNodes = updateNodeInTree(
        state.project.nodes,
        action.id,
        (node) => ({
          ...node,
          props: { ...node.props, ...action.props },
        }),
      );
      return {
        ...state,
        project: { ...state.project, nodes: newNodes },
        ...addToHistory(state, newNodes),
      };
    }

    case "UPDATE_STYLE": {
      const newNodes = updateNodeInTree(
        state.project.nodes,
        action.id,
        (node) => ({
          ...node,
          style: { ...node.style, ...action.style },
        }),
      );
      return {
        ...state,
        project: { ...state.project, nodes: newNodes },
        ...addToHistory(state, newNodes),
      };
    }

    case "DELETE_NODE": {
      const newNodes = deleteNodeFromTree(state.project.nodes, action.id);
      return {
        ...state,
        project: { ...state.project, nodes: newNodes },
        selectedId:
          state.selectedId === action.id ? null : state.selectedId,
        ...addToHistory(state, newNodes),
      };
    }

    case "DUPLICATE_NODE": {
      const target = findNode(state.project.nodes, action.id);
      if (!target) return state;
      const copy = duplicateNode(target);
      const newNodes = insertAfterInTree(state.project.nodes, action.id, copy);
      return {
        ...state,
        project: { ...state.project, nodes: newNodes },
        selectedId: copy.id,
        ...addToHistory(state, newNodes),
      };
    }

    case "MOVE_NODE": {
      // Remove the dragged node
      const moving = findNode(state.project.nodes, action.id);
      if (!moving) return state;
      let withoutMoving = deleteNodeFromTree(state.project.nodes, action.id);

      let newNodes: ComponentNode[];
      if (action.position === "inside") {
        newNodes = insertInsideInTree(withoutMoving, action.targetId, moving);
      } else {
        newNodes = insertAfterInTree(withoutMoving, action.targetId, moving);
      }
      return {
        ...state,
        project: { ...state.project, nodes: newNodes },
        ...addToHistory(state, newNodes),
      };
    }

    case "SELECT":
      return { ...state, selectedId: action.id };

    case "UNDO": {
      if (state.historyIndex <= 0) return state;
      const newIndex = state.historyIndex - 1;
      const nodes = JSON.parse(JSON.stringify(state.history[newIndex]));
      return {
        ...state,
        project: { ...state.project, nodes },
        historyIndex: newIndex,
        selectedId: null,
      };
    }

    case "REDO": {
      if (state.historyIndex >= state.history.length - 1) return state;
      const newIndex = state.historyIndex + 1;
      const nodes = JSON.parse(JSON.stringify(state.history[newIndex]));
      return {
        ...state,
        project: { ...state.project, nodes },
        historyIndex: newIndex,
        selectedId: null,
      };
    }

    case "SET_PREVIEW_MODE":
      return { ...state, previewMode: action.mode };

    case "SET_ZOOM":
      return { ...state, zoom: Math.max(0.25, Math.min(2, action.zoom)) };

    case "TOGGLE_GRID":
      return { ...state, showGrid: !state.showGrid };

    case "TOGGLE_AI_PANEL":
      return { ...state, showAIPanel: !state.showAIPanel };

    case "TOGGLE_PREVIEW":
      return {
        ...state,
        showPreview: !state.showPreview,
        showCode: false,
      };

    case "TOGGLE_CODE":
      return {
        ...state,
        showCode: !state.showCode,
        showPreview: false,
      };

    case "LOAD_PROJECT":
      return {
        ...INITIAL_STATE,
        project: action.project,
        history: [action.project.nodes],
        historyIndex: 0,
        savedProjectId: action.project.id ?? null,
      };

    case "UPDATE_PROJECT_META":
      return {
        ...state,
        project: { ...state.project, ...action.meta },
      };

    case "SET_SAVING":
      return { ...state, isSaving: action.isSaving };

    case "SET_SAVED_ID":
      return { ...state, savedProjectId: action.id };

    default:
      return state;
  }
}

// ── Context ──────────────────────────────────────────────────────────────────

interface BuilderContextType {
  state: BuilderState;
  dispatch: React.Dispatch<BuilderAction>;
  // Convenience actions
  addNode: (
    type: ComponentType,
    parentId?: string,
    overrides?: Partial<ComponentNode>,
  ) => void;
  selectNode: (id: string | null) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  updateProps: (id: string, props: Partial<ComponentProps>) => void;
  updateStyle: (id: string, style: Partial<ComponentStyle>) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  getSelectedNode: () => ComponentNode | undefined;
}

const BuilderContext = createContext<BuilderContextType | undefined>(undefined);

// ── Default nodes for each component type ───────────────────────────────────

export function makeDefaultNode(
  type: ComponentType,
  overrides?: Partial<ComponentNode>,
): ComponentNode {
  const id = generateId(type);
  const base: ComponentNode = {
    id,
    type,
    label: type.charAt(0).toUpperCase() + type.slice(1),
    props: {},
    style: {},
    children: [],
  };

  const defaults: Partial<ComponentNode> = (() => {
    switch (type) {
      case "container":
        return {
          label: "Container",
          style: {
            padding: "16px",
            minHeight: "80px",
            borderRadius: "8px",
            borderWidth: "1px",
            borderColor: "#e2e8f0",
          },
        };
      case "grid":
        return {
          label: "Grid",
          props: { cols: 2 },
          style: { gap: "16px", padding: "16px" },
          children: [
            makeDefaultNode("container"),
            makeDefaultNode("container"),
          ],
        };
      case "flex":
        return {
          label: "Flex Row",
          style: {
            flexDirection: "row",
            gap: "12px",
            padding: "16px",
            alignItems: "center",
          },
        };
      case "section":
        return {
          label: "Section",
          style: {
            padding: "48px",
            minHeight: "200px",
          },
        };
      case "heading":
        return {
          label: "Heading",
          props: { level: 2, text: "Section Heading" },
          style: { fontWeight: "700", fontSize: "1.5rem" },
        };
      case "text":
        return {
          label: "Text",
          props: { text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit." },
          style: { fontSize: "1rem" },
        };
      case "label":
        return {
          label: "Label",
          props: { text: "Label" },
          style: { fontSize: "0.875rem", fontWeight: "500" },
        };
      case "badge":
        return {
          label: "Badge",
          props: { text: "Badge", color: "blue" },
        };
      case "link":
        return {
          label: "Link",
          props: { text: "Click here", url: "#" },
          style: { textColor: "#6366f1" },
        };
      case "button":
        return {
          label: "Button",
          props: { text: "Button", variant: "default", size: "md" },
        };
      case "input":
        return {
          label: "Input",
          props: { placeholder: "Enter text..." },
        };
      case "textarea":
        return {
          label: "Textarea",
          props: { placeholder: "Enter text...", rows: 3 } as ComponentProps & {
            rows: number;
          },
        };
      case "select":
        return {
          label: "Select",
          props: { placeholder: "Select option..." },
        };
      case "checkbox":
        return {
          label: "Checkbox",
          props: { text: "Check me" },
        };
      case "switch":
        return {
          label: "Switch",
          props: { text: "Enable feature" },
        };
      case "slider":
        return {
          label: "Slider",
          props: { text: "Slider" },
        };
      case "radio":
        return {
          label: "Radio",
          props: { text: "Option 1" },
        };
      case "form":
        return {
          label: "Form",
          style: {
            padding: "24px",
            borderRadius: "8px",
            borderWidth: "1px",
            borderColor: "#e2e8f0",
          },
          children: [makeDefaultNode("input"), makeDefaultNode("button")],
        };
      case "card":
        return {
          label: "Card",
          style: {
            padding: "24px",
            borderRadius: "12px",
            borderWidth: "1px",
            borderColor: "#e2e8f0",
            shadow: "md",
          },
          children: [
            makeDefaultNode("heading"),
            makeDefaultNode("text"),
          ],
        };
      case "image":
        return {
          label: "Image",
          props: { src: "https://picsum.photos/400/200", alt: "Image" },
          style: { width: "100%", borderRadius: "8px" },
        };
      case "avatar":
        return {
          label: "Avatar",
          props: { initials: "JD" },
        };
      case "icon":
        return {
          label: "Icon",
          props: { iconName: "star" },
        };
      case "navbar":
        return {
          label: "Navbar",
          props: {
            brand: "MyApp",
            navLinks: [
              { label: "Home", url: "#" },
              { label: "About", url: "#" },
              { label: "Contact", url: "#" },
            ],
          },
          style: {
            padding: "16px",
            backgroundColor: "#1e1b4b",
            textColor: "#ffffff",
          },
        };
      case "sidebar":
        return {
          label: "Sidebar",
          style: {
            width: "240px",
            minHeight: "400px",
            padding: "16px",
            backgroundColor: "#f8fafc",
            borderWidth: "1px",
            borderColor: "#e2e8f0",
          },
        };
      case "footer":
        return {
          label: "Footer",
          style: {
            padding: "32px",
            backgroundColor: "#1e293b",
            textColor: "#94a3b8",
            textAlign: "center",
          },
          children: [
            {
              ...makeDefaultNode("text"),
              props: { text: "© 2025 MyApp. All rights reserved." },
            },
          ],
        };
      case "tabs":
        return {
          label: "Tabs",
          props: {
            tabs: [
              { label: "Tab 1", content: "Content for Tab 1" },
              { label: "Tab 2", content: "Content for Tab 2" },
            ],
          },
        };
      case "accordion":
        return {
          label: "Accordion",
          props: {
            items: [
              {
                title: "Item 1",
                content: "Content for item 1",
              },
              {
                title: "Item 2",
                content: "Content for item 2",
              },
            ],
          },
        };
      case "table":
        return {
          label: "Table",
          props: {
            columns: [
              { key: "name", label: "Name" },
              { key: "email", label: "Email" },
              { key: "status", label: "Status" },
            ],
            tableRows: [
              { name: "Alice", email: "alice@example.com", status: "Active" },
              { name: "Bob", email: "bob@example.com", status: "Inactive" },
            ],
          },
        };
      case "list":
        return {
          label: "List",
          props: { listItems: ["Item 1", "Item 2", "Item 3"] },
        };
      case "divider":
        return {
          label: "Divider",
          style: { borderColor: "#e2e8f0", borderWidth: "1px" },
        };
      case "spacer":
        return {
          label: "Spacer",
          style: { height: "32px" },
        };
      case "chart-bar":
        return {
          label: "Bar Chart",
          props: { text: "Sales by Month" },
          style: { height: "240px" },
        };
      case "chart-line":
        return {
          label: "Line Chart",
          props: { text: "Growth Trend" },
          style: { height: "240px" },
        };
      case "chart-pie":
        return {
          label: "Pie Chart",
          props: { text: "Distribution" },
          style: { height: "240px" },
        };
      case "chart-area":
        return {
          label: "Area Chart",
          props: { text: "Area Data" },
          style: { height: "240px" },
        };
      default:
        return {};
    }
  })();

  return { ...base, ...defaults, ...overrides, id };
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function BuilderProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(builderReducer, INITIAL_STATE);

  const addNode = useCallback(
    (
      type: ComponentType,
      parentId?: string,
      overrides?: Partial<ComponentNode>,
    ) => {
      const node = makeDefaultNode(type, overrides);
      dispatch({ type: "ADD_NODE", node, parentId });
    },
    [],
  );

  const selectNode = useCallback((id: string | null) => {
    dispatch({ type: "SELECT", id });
  }, []);

  const deleteSelected = useCallback(() => {
    if (state.selectedId) {
      dispatch({ type: "DELETE_NODE", id: state.selectedId });
    }
  }, [state.selectedId]);

  const duplicateSelected = useCallback(() => {
    if (state.selectedId) {
      dispatch({ type: "DUPLICATE_NODE", id: state.selectedId });
    }
  }, [state.selectedId]);

  const updateProps = useCallback(
    (id: string, props: Partial<ComponentProps>) => {
      dispatch({ type: "UPDATE_PROPS", id, props });
    },
    [],
  );

  const updateStyle = useCallback(
    (id: string, style: Partial<ComponentStyle>) => {
      dispatch({ type: "UPDATE_STYLE", id, style });
    },
    [],
  );

  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const redo = useCallback(() => dispatch({ type: "REDO" }), []);

  const canUndo = state.historyIndex > 0;
  const canRedo = state.historyIndex < state.history.length - 1;

  const getSelectedNode = useCallback(() => {
    if (!state.selectedId) return undefined;
    const findIn = (nodes: ComponentNode[]): ComponentNode | undefined => {
      for (const n of nodes) {
        if (n.id === state.selectedId) return n;
        const found = findIn(n.children);
        if (found) return found;
      }
      return undefined;
    };
    return findIn(state.project.nodes);
  }, [state.selectedId, state.project.nodes]);

  return (
    <BuilderContext.Provider
      value={{
        state,
        dispatch,
        addNode,
        selectNode,
        deleteSelected,
        duplicateSelected,
        updateProps,
        updateStyle,
        undo,
        redo,
        canUndo,
        canRedo,
        getSelectedNode,
      }}
    >
      {children}
    </BuilderContext.Provider>
  );
}

export function useBuilder() {
  const ctx = useContext(BuilderContext);
  if (!ctx) throw new Error("useBuilder must be used within BuilderProvider");
  return ctx;
}
