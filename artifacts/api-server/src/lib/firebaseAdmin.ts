/**
 * Firebase Admin SDK (server-side) — additive capability alongside the
 * existing Clerk auth + Postgres/Drizzle stack.
 *
 * This does NOT replace Clerk. It exists so routes can optionally read/write
 * Firestore or verify Firebase ID tokens if a feature needs it. It only
 * initializes when all three FIREBASE_* variables are present, so deployments
 * that don't use Firebase are completely unaffected.
 */

import { isFirebaseAdminConfigured } from "./env";

let appPromise: Promise<import("firebase-admin/app").App> | null = null;

async function initApp(): Promise<import("firebase-admin/app").App> {
  const { initializeApp, getApps, cert } = await import("firebase-admin/app");

  const existing = getApps();
  if (existing.length > 0) {
    return existing[0]!;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Private keys are often stored with literal "\n" sequences in env vars;
  // normalize them back into real newlines.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.",
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

/** Lazily initializes (once) and returns the Firebase Admin app. */
export function getFirebaseAdminApp(): Promise<import("firebase-admin/app").App> {
  if (!isFirebaseAdminConfigured()) {
    throw new Error(
      "Firebase Admin is not configured on this deployment. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY to enable it.",
    );
  }
  if (!appPromise) {
    appPromise = initApp();
  }
  return appPromise;
}

/** Firestore handle, only usable when Firebase Admin is configured. */
export async function getFirestoreDb(): Promise<
  import("firebase-admin/firestore").Firestore
> {
  const { getFirestore } = await import("firebase-admin/firestore");
  const app = await getFirebaseAdminApp();
  return getFirestore(app);
}

/** Verifies a Firebase Auth ID token sent from the client (e.g. in an Authorization header). */
export async function verifyFirebaseIdToken(
  idToken: string,
): Promise<import("firebase-admin/auth").DecodedIdToken> {
  const { getAuth } = await import("firebase-admin/auth");
  const app = await getFirebaseAdminApp();
  return getAuth(app).verifyIdToken(idToken);
}
