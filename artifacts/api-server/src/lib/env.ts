/**
 * Startup environment validation.
 *
 * Fails fast with a clear error instead of letting the server boot into a
 * half-configured state (e.g. missing Firebase Admin credentials causing
 * confusing runtime errors on the first Firestore call).
 *
 * `optional` groups are validated as all-or-nothing: if any variable in the
 * group is set, the rest of the group is required too.
 */

interface EnvGroup {
  name: string;
  keys: string[];
}

const REQUIRED_ALWAYS: string[] = ["DATABASE_URL"];

// Firebase Admin is additive — only required if the operator opts in by
// setting any one of its variables (see lib/firebaseAdmin.ts).
// Accepts either FIREBASE_ADMIN_KEY (full service-account JSON) or the
// three individual FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY vars.
const OPTIONAL_GROUPS: EnvGroup[] = [
  {
    name: "Firebase Admin (individual vars)",
    keys: ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"],
  },
];

export function validateEnv(): void {
  const missing = REQUIRED_ALWAYS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}`,
    );
  }

  // If using the single-JSON key, skip the all-or-nothing group check.
  if (process.env.FIREBASE_ADMIN_KEY) return;

  for (const group of OPTIONAL_GROUPS) {
    const present = group.keys.filter((key) => Boolean(process.env[key]));
    if (present.length === 0) continue;

    const groupMissing = group.keys.filter((key) => !process.env[key]);
    if (groupMissing.length > 0) {
      throw new Error(
        `Partial "${group.name}" configuration detected. Set all of [${group.keys.join(", ")}] or none of them (or use FIREBASE_ADMIN_KEY instead). Missing: ${groupMissing.join(", ")}`,
      );
    }
  }
}

export function isFirebaseAdminConfigured(): boolean {
  // Accept FIREBASE_ADMIN_KEY (full service-account JSON) …
  if (process.env.FIREBASE_ADMIN_KEY) return true;
  // … or the three individual vars.
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY,
  );
}
