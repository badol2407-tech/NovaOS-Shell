/**
 * Firebase client SDK (browser) — additive capability alongside the
 * existing Clerk auth flow. Nothing in the app is wired to this yet; it
 * exists so a feature can opt into Firebase Authentication (email/password,
 * Google) or Firestore without touching the current Clerk-based sign-in.
 *
 * Only initializes when the VITE_FIREBASE_* env vars are present.
 */
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  type Auth,
  type UserCredential,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
const appId = import.meta.env.VITE_FIREBASE_APP_ID;
// Firestore/Auth REST calls to the *default* database need the project ID;
// Firebase derives it from authDomain in most cases, but we pass it
// explicitly since it's cheap and avoids relying on that convention.
const projectId = authDomain?.replace(/\.firebaseapp\.com$/, '');

export const isFirebaseConfigured = Boolean(apiKey && authDomain && appId);

let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;

function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured) {
    throw new Error(
      'Firebase is not configured. Set VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, and VITE_FIREBASE_APP_ID.',
    );
  }
  if (!app) {
    const existing = getApps();
    app =
      existing[0] ??
      initializeApp({ apiKey, authDomain, appId, projectId });
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!authInstance) {
    authInstance = getAuth(getFirebaseApp());
  }
  return authInstance;
}

export function getFirebaseDb(): Firestore {
  if (!dbInstance) {
    dbInstance = getFirestore(getFirebaseApp());
  }
  return dbInstance;
}

export function signInWithGoogle(): Promise<UserCredential> {
  return signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
}

export function signInWithEmail(
  email: string,
  password: string,
): Promise<UserCredential> {
  return signInWithEmailAndPassword(getFirebaseAuth(), email, password);
}

export function signUpWithEmail(
  email: string,
  password: string,
): Promise<UserCredential> {
  return createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
}

export function signOutFirebase(): Promise<void> {
  return signOut(getFirebaseAuth());
}
