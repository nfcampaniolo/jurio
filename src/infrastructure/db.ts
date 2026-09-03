import type { Firestore } from 'firebase/firestore';
import { firebaseApp } from './firebase';

let dbPromise: Promise<Firestore> | null = null;

export function getDb(): Promise<Firestore> {
  if (!dbPromise) {
    dbPromise = import("firebase/firestore").then(
      ({ initializeFirestore, persistentLocalCache, persistentMultipleTabManager }) => {
        return initializeFirestore(firebaseApp, {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
        });
      }
    );
  }

  return dbPromise;
}