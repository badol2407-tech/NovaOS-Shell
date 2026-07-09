/**
 * Phase 11 — Workspace Presence
 *
 * Tracks who is currently online in a workspace using Firebase Firestore.
 * Each user writes their presence document on mount and removes it on unmount.
 * Other users subscribe to the presence collection for real-time indicators.
 *
 * Falls back gracefully when Firebase is not configured.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import { isFirebaseConfigured, getFirebaseDb } from '@/lib/firebase';

export interface PresenceUser {
  userId: string;
  displayName: string;
  /** ISO string or null when timestamp hasn't synced yet */
  lastSeen: string | null;
  /** What the user is currently viewing, e.g. "file:src/index.ts" */
  focus?: string;
}

interface PresenceDoc {
  userId: string;
  displayName: string;
  lastSeen: Timestamp | null;
  focus?: string;
}

const PRESENCE_ROOT = 'nova_presence';

export function usePresence(
  workspaceId: string | null,
  currentUserId: string | null,
  currentDisplayName: string,
  focus?: string,
): { onlineUsers: PresenceUser[]; isSupported: boolean } {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const cleanupRef = useRef<(() => void) | null>(null);

  const publish = useCallback(
    async (wsId: string, uid: string, focus?: string) => {
      if (!isFirebaseConfigured) return;
      try {
        const db = getFirebaseDb();
        const docRef = doc(db, PRESENCE_ROOT, wsId, 'users', uid);
        await setDoc(docRef, {
          userId: uid,
          displayName: currentDisplayName,
          lastSeen: serverTimestamp(),
          focus: focus ?? undefined,
        } satisfies Omit<PresenceDoc, 'lastSeen'> & { lastSeen: ReturnType<typeof serverTimestamp> });
      } catch {
        // Non-fatal — presence is best-effort
      }
    },
    [currentDisplayName],
  );

  const unpublish = useCallback(async (wsId: string, uid: string) => {
    if (!isFirebaseConfigured) return;
    try {
      const db = getFirebaseDb();
      const docRef = doc(db, PRESENCE_ROOT, wsId, 'users', uid);
      await deleteDoc(docRef);
    } catch {
      // Non-fatal
    }
  }, []);

  useEffect(() => {
    if (!workspaceId || !currentUserId || !isFirebaseConfigured) return;

    let alive = true;

    // Write own presence
    void publish(workspaceId, currentUserId, focus);

    // Heartbeat every 60s to update lastSeen (Firestore TTL alternative)
    const heartbeat = setInterval(() => {
      if (alive) void publish(workspaceId, currentUserId, focus);
    }, 60_000);

    // Subscribe to all presence in the workspace
    const db = getFirebaseDb();
    const colRef = collection(db, PRESENCE_ROOT, workspaceId, 'users');
    const unsub = onSnapshot(colRef, (snapshot) => {
      const users: PresenceUser[] = snapshot.docs.map((d) => {
        const data = d.data() as PresenceDoc;
        const ts = data.lastSeen as Timestamp | null;
        return {
          userId: data.userId,
          displayName: data.displayName,
          lastSeen: ts ? ts.toDate().toISOString() : null,
          focus: data.focus,
        };
      });
      setOnlineUsers(users);
    });

    cleanupRef.current = () => {
      alive = false;
      clearInterval(heartbeat);
      unsub();
      void unpublish(workspaceId, currentUserId);
    };

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [workspaceId, currentUserId, publish, unpublish, focus]);

  // Update focus in Firestore when it changes (without re-subscribing)
  useEffect(() => {
    if (!workspaceId || !currentUserId || !isFirebaseConfigured) return;
    void publish(workspaceId, currentUserId, focus);
  }, [focus, workspaceId, currentUserId, publish]);

  return { onlineUsers, isSupported: isFirebaseConfigured };
}
