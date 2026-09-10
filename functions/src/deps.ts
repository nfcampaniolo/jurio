import * as admin from "firebase-admin";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

// Variabile per memorizzare l'istanza ed evitare di riconfigurare settings()
let db: Firestore;

export function getDb(): Firestore {
  // 1. Inizializza l'app se necessario
  if (!getApps().length) {
    initializeApp();
  }
  // 2. Inizializza Firestore e applica le impostazioni solo la prima volta
  if (!db) {
    db = getFirestore();
    db.settings({ 
      ignoreUndefinedProperties: true // 🛡️ Rende il DB immune agli 'undefined'
    });
  }
  return db;
}

export function getAdminAuth() {
  if (!getApps().length) initializeApp();
  return getAuth();
}

export function getAdminStorage() {
  if (!getApps().length) initializeApp();
  return getStorage();
}

export function getAdmin() {
  return admin;
}

export function sanitize<T>(obj: T): T {
  if (obj === undefined) return null as T;

  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (
    obj instanceof Date ||
    obj instanceof admin.firestore.Timestamp ||
    obj instanceof admin.firestore.FieldValue
  ) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => sanitize(item)) as unknown as T;
  }
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>)
      .filter(([_, v]) => v !== undefined)
      .map(([k, v]) => [k, sanitize(v)])
  ) as T;
}