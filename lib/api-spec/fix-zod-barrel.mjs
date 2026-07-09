/**
 * fix-zod-barrel.mjs
 *
 * Post-codegen step: rewrites lib/api-zod/src/index.ts after Orval generates it.
 *
 * Problem: When an OpenAPI operation has BOTH path params AND query params,
 * Orval's zod client generates `{OperationId}Params` for the path-param validator
 * AND the plain TS types module generates `{OperationId}Params` for the query
 * params. The generated barrel (`export * from './generated/api'; export * from
 * './generated/types'`) causes TS2308 "already exported a member" errors.
 *
 * Fix: Replace the wildcard `export * from './generated/types'` with an explicit
 * named export list that excludes the colliding name(s).
 *
 * Run this script after `orval --config ./orval.config.ts` and before typecheck.
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const barrelPath = resolve(__dirname, "../api-zod/src/index.ts");

// All types exported from ./generated/types EXCEPT:
//   - ListGitHubCommitsParams (collides with the zod path-param schema of the same name)
const EXPLICIT_TYPES = [
  "App",
  "ErrorResponse",
  "GitHubBranch",
  "GitHubCommit",
  "GitHubRepo",
  "GitHubStatus",
  "GitHubTokenInput",
  "HealthStatus",
  "Notification",
  "NotificationsSummary",
  "NotificationType",
  "ListGitHubReposParams",
  "ListGitHubReposSort",
  "Project",
  "ProjectInput",
  "ProjectStats",
  "ProjectStatus",
  "ProjectUpdate",
  "ProjectUpdateStatus",
  "ProjectWithTasks",
  "ProjectWithTasksStatus",
  "Task",
  "TaskInput",
  "TaskInputPriority",
  "TaskInputStatus",
  "TaskPriority",
  "TaskStatus",
  "TaskUpdate",
  "TaskUpdatePriority",
  "TaskUpdateStatus",
  "UserSettings",
  "UserSettingsDockPosition",
  "UserSettingsTheme",
  "UserSettingsUpdate",
  "UserSettingsUpdateDockPosition",
  "UserSettingsUpdateTheme",
  "Wallpaper",
];

const fixed = `export * from "./generated/api";

// "./generated/types" re-exports react-query-oriented param types that can
// collide in name with the zod path-param schemas from "./generated/api"
// (an operation with both path and query params produces a zod
// \`{Op}Params\` for the path params, while the plain TS types module
// produces a same-named \`{Op}Params\` for the query params). This type is
// not consumed from this package (it exists for @workspace/api-client-react),
// so we deliberately exclude the colliding name here rather than editing
// generated output.
//
// This file is rewritten by lib/api-spec/fix-zod-barrel.mjs after each codegen run.
// Do not edit by hand — changes will be lost on the next \`pnpm run codegen\`.
export type {
${EXPLICIT_TYPES.map((t) => `  ${t},`).join("\n")}
} from "./generated/types";
`;

writeFileSync(barrelPath, fixed, "utf8");
console.log(
  "✓ api-zod barrel fixed (ListGitHubCommitsParams excluded to prevent TS2308)",
);
