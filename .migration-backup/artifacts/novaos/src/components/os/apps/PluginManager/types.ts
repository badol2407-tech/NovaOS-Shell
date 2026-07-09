export const PLUGIN_PERMISSIONS = [
  "storage",
  "notifications",
  "ai",
  "clipboard",
  "windows",
] as const;

export type PluginPermission = (typeof PLUGIN_PERMISSIONS)[number];

export const PERMISSION_DESCRIPTIONS: Record<PluginPermission, string> = {
  storage: "Save and read its own private data in your NovaOS account.",
  notifications: "Send notifications to your NovaOS Notification Center.",
  ai: "Send prompts to NovaOS's AI assistant on your behalf (rate-limited).",
  clipboard: "Read text you copy and write text to your clipboard.",
  windows: "Open other NovaOS apps on your behalf.",
};

export interface PluginManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  icon: string;
  category: string;
  permissions: PluginPermission[];
}

export interface PluginRecord {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  authorUserId: string;
  status: "draft" | "published";
  latestVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface PluginVersionRecord {
  id: number;
  pluginId: string;
  version: string;
  code: string;
  manifestJson: string;
  aiGenerated: boolean;
  aiReviewJson: string | null;
  createdAt: string;
}

export interface PluginInstallationRecord {
  id: number;
  userId: string;
  pluginId: string;
  versionId: number;
  enabled: boolean;
  grantedPermissions: PluginPermission[];
  installedAt: string;
  updatedAt: string;
  plugin: PluginRecord;
}

export interface PluginReview {
  risk: "low" | "medium" | "high";
  summary: string;
  issues: string[];
}
