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

export function sanitize(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (obj !== null && typeof obj === 'object' && !(obj instanceof admin.firestore.FieldValue)) {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, sanitize(v)])
    );
  }
  return obj;
}