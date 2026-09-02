import { firebaseApp } from "@/services/firebase";
import type { Firestore } from "firebase/firestore/lite";

let dbPromise: Promise<Firestore> | null = null;

export function getPromptDb(): Promise<Firestore> {
  if (!dbPromise) {
    dbPromise = import("firebase/firestore/lite").then(
      ({ getFirestore }) => getFirestore(firebaseApp)
    );
  }

  return dbPromise;
}