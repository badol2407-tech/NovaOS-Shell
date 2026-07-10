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

/**
 * Validates that FIREBASE_ADMIN_KEY, when present, is parseable JSON and
 * contains all three required service-account fields. Logs a warning at
 * startup instead of throwing so the server can still serve non-Firebase
 * routes; the actual error surfaces when Firebase Admin is first accessed.
 */
function validateFirebaseAdminKey(): void {
  const raw = process.env.FIREBASE_ADMIN_KEY;
  if (!raw) return;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    console.warn(
      '[env] WARNING: FIREBASE_ADMIN_KEY is set but is not valid JSON. ' +
      'Firebase Admin features will be disabled until a valid service-account JSON is supplied.',
    );
    return;
  }
  const required = ['project_id', 'client_email', 'private_key'] as const;
  const missing = required.filter((k) => !parsed[k]);
  if (missing.length > 0) {
    console.warn(
      `[env] WARNING: FIREBASE_ADMIN_KEY JSON is missing field(s): ${missing.join(', ')}. ` +
      'Firebase Admin features will be disabled.',
    );
  }
}

export function validateEnv(): void {
  const missing = REQUIRED_ALWAYS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}`,
    );
  }

  // If using the single-JSON key, validate its shape then skip group checks.
  if (process.env.FIREBASE_ADMIN_KEY) {
    validateFirebaseAdminKey();
    return;
  }

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
  // Accept FIREBASE_ADMIN_KEY only if it contains the required fields.
  if (process.env.FIREBASE_ADMIN_KEY) {
    try {
      const p = JSON.parse(process.env.FIREBASE_ADMIN_KEY) as Record<string, unknown>;
      return Boolean(p.project_id && p.client_email && p.private_key);
    } catch {
      return false;
    }
  }
  // Fall back to individual vars.
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY,
  );
}
