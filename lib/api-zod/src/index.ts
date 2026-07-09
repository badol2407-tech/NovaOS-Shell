export * from "./generated/api";

// "./generated/types" re-exports react-query-oriented param types that can
// collide in name with the zod path-param schemas from "./generated/api"
// (an operation with both path and query params produces a zod
// `{Op}Params` for the path params, while the plain TS types module
// produces a same-named `{Op}Params` for the query params). This type is
// not consumed from this package (it exists for @workspace/api-client-react),
// so we deliberately exclude the colliding name here rather than editing
// generated output.
export type {
  App,
  ErrorResponse,
  GitHubBranch,
  GitHubCommit,
  GitHubRepo,
  GitHubStatus,
  GitHubTokenInput,
  HealthStatus,
  Notification,
  NotificationsSummary,
  NotificationType,
  ListGitHubReposParams,
  ListGitHubReposSort,
  Project,
  ProjectInput,
  ProjectStats,
  ProjectStatus,
  ProjectUpdate,
  ProjectUpdateStatus,
  ProjectWithTasks,
  ProjectWithTasksStatus,
  Task,
  TaskInput,
  TaskInputPriority,
  TaskInputStatus,
  TaskPriority,
  TaskStatus,
  TaskUpdate,
  TaskUpdatePriority,
  TaskUpdateStatus,
  UserSettings,
  UserSettingsDockPosition,
  UserSettingsTheme,
  UserSettingsUpdate,
  UserSettingsUpdateDockPosition,
  UserSettingsUpdateTheme,
  Wallpaper,
} from "./generated/types";
