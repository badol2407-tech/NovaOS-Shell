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
const OPTIONAL_GROUPS: EnvGroup[] = [
  {
    name: "Firebase Admin",
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

  for (const group of OPTIONAL_GROUPS) {
    const present = group.keys.filter((key) => Boolean(process.env[key]));
    if (present.length === 0) continue;

    const groupMissing = group.keys.filter((key) => !process.env[key]);
    if (groupMissing.length > 0) {
      throw new Error(
        `Partial "${group.name}" configuration detected. Set all of [${group.keys.join(", ")}] or none of them. Missing: ${groupMissing.join(", ")}`,
      );
    }
  }
}

export function isFirebaseAdminConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY,
  );
}
