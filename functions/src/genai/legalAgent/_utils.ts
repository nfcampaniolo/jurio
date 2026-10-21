import { Response } from "express";
import * as admin from "firebase-admin";
import { getDb, sanitize } from "../../_deps";
import { FieldValue } from "firebase-admin/firestore";

const db = getDb();

/**
 * Configura gli header per Server-Sent Events (SSE).
 */
export function setupLegalAgentSse(res: Response): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
}

/**
 * Invia un payload JSON tramite SSE.
 */
export function sendLegalAgentSse(res: Response, payload: unknown): void {
  if (res.writableEnded) return;
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

/**
 * Invia una stringa raw tramite SSE.
 */
export function sendLegalAgentSseRaw(res: Response, payload: string): void {
  if (res.writableEnded) return;
  res.write(`data: ${payload}\n\n`);
}

/**
 * Persiste la conversazione dell'agente legale su Firestore.
 */
export async function persistLegalAgentConversation(args: {
  uid: string;
  prompt: string;
  result: any;
  messagesRef: admin.firestore.CollectionReference;
  parentId: string;
  isFascicolo: boolean;
  threadId: string | null;
  isFirstMessage: boolean;
  contextTitle?: string;
}): Promise<void> {
  const batch = db.batch();
  const FieldValue = admin.firestore.FieldValue;

  // Timestamp distinti: con lo stesso serverTimestamp l'ordinamento "desc" tra user e model è casuale
  const nowMs = Date.now();
  batch.set(args.messagesRef.doc(), {
    role: "user",
    content: args.prompt,
    timestamp: admin.firestore.Timestamp.fromMillis(nowMs),
  });

  batch.set(args.messagesRef.doc(), {
    role: "model",
    content: String(args.result?.risposta ?? ""),
    sources: Array.isArray(args.result?.fonti) ? args.result.fonti : [],
    timestamp: admin.firestore.Timestamp.fromMillis(nowMs + 1),
  });

  const parentCollection = args.isFascicolo ? "fascicoli" : "chats";
  const parentRef = db.collection(parentCollection).doc(args.parentId);
  const parentUpdate: Record<string, any> = {
    user: args.uid,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (args.isFirstMessage && args.result?.titoloGenerato) {
    if (args.isFascicolo && args.threadId) {
      const threadRef = db.collection("fascicoli").doc(args.parentId).collection("threads").doc(args.threadId);
      batch.set(threadRef, {
        title: String(args.result.titoloGenerato),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      if (typeof args.contextTitle === "string" && args.contextTitle.trim()) {
        parentUpdate.title = args.contextTitle.trim();
      }
    } else {
      parentUpdate.title = String(args.result.titoloGenerato);
    }
  }

  if (args.isFascicolo && args.threadId) {
    const threadRef = db.collection("fascicoli").doc(args.parentId).collection("threads").doc(args.threadId);
    batch.set(threadRef, { updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }

  batch.set(parentRef, parentUpdate, { merge: true });
  await batch.commit();
}

/**
 * Gestisce la migrazione di una chat all'interno di un fascicolo.
 */

export async function migrateChatToFascicolo(args: {
  uid: string;
  oldChatId: string;
  newFascicoloId: string;
  title?: string;
}): Promise<void> {
  const oldChatRef = db.collection("chats").doc(args.oldChatId);
  const newFascicoloRef = db.collection("fascicoli").doc(args.newFascicoloId);
  const FieldValue = admin.firestore.FieldValue;

  const [oldChatSnap, newFascicoloSnap] = await Promise.all([oldChatRef.get(), newFascicoloRef.get()]);

  if (!oldChatSnap.exists) throw new Error("Chat sorgente non trovata.");
  if (oldChatSnap.data()?.user && oldChatSnap.data()?.user !== args.uid) throw new Error("Accesso alla chat sorgente negato.");
  if (newFascicoloSnap.exists && newFascicoloSnap.data()?.user !== args.uid) throw new Error("Accesso al fascicolo destinazione negato.");

  const oldChatTitle = String(oldChatSnap.data()?.title ?? "Conversazione importata");
  const finalTitle = typeof args.title === "string" && args.title.trim() ? args.title.trim() : oldChatTitle;

  const oldMessagesSnap = await oldChatRef.collection("messages").get();
  const threadRef = newFascicoloRef.collection("threads").doc(args.oldChatId);
  const operations: Array<(batch: admin.firestore.WriteBatch) => void> = [];

  operations.push((batch) => {
    batch.set(newFascicoloRef, {
      user: args.uid,
      title: finalTitle,
      updatedAt: FieldValue.serverTimestamp(),
      ...(newFascicoloSnap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    }, { merge: true });
  });

  operations.push((batch) => {
    batch.set(threadRef, {
      title: oldChatTitle,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  for (const doc of oldMessagesSnap.docs) {
    const data = doc.data();
    const newMessageRef = threadRef.collection("messages").doc(doc.id);
    operations.push((batch) => {
      batch.set(newMessageRef, {
        ...sanitize(data),
        migrated: true,
        timestamp: data.timestamp ?? data.createdAt ?? FieldValue.serverTimestamp(),
      });
    });
    operations.push((batch) => batch.delete(doc.ref));
  }

  operations.push((batch) => batch.delete(oldChatRef));

  const BATCH_SIZE = 450;
  for (let i = 0; i < operations.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const operation of operations.slice(i, i + BATCH_SIZE)) operation(batch);
    await batch.commit();
  }
}

async function addFascicoloIdToDocAndChunks(
  docId: string,
  fascicoloId: string
): Promise<void> {
  const batch = db.batch();
  // 1. Referenza al documento principale
  const docRef = db.collection('documents').doc(docId);
  // Utilizziamo arrayUnion per appendere l'id all'array 'fascicoloIds'
  batch.update(docRef, { 
    fascicoloIds: FieldValue.arrayUnion(fascicoloId) 
  });
  // 2. Query per trovare i chunk correlati
  const chunksSnapshot = await db.collection('document_chunks')
    .where('parentId', '==', docId)
    .get();
  // 3. Aggiunta dell'ID all'array di ciascun chunk nel batch
  chunksSnapshot.forEach((chunkDoc) => {
    batch.update(chunkDoc.ref, { 
      fascicoloIds: FieldValue.arrayUnion(fascicoloId) 
    });
  });
  // 4. Commit atomico
  await batch.commit();
}

export async function processFascicoloDocs(
  fascicoloId: string,
  docs: string[],  
): Promise<void> {
  if (!fascicoloId || !Array.isArray(docs) || docs.length === 0) {
    console.log("Processo annullato: Fascicolo mancante o nessun documento fornito.");
    return;
  }
  try {
    const uniqueDocs = Array.from(new Set(docs));
    const refs = uniqueDocs.map((id) => db.collection("documents").doc(id));
    const snaps = await db.getAll(...refs);
    // Salta i documenti già collegati: evita query sui chunk e scritture ripetute a ogni messaggio.
    const pendingDocs = snaps
      .filter((snap) => snap.exists && !((snap.get("fascicoloIds") as string[] | undefined) ?? []).includes(fascicoloId))
      .map((snap) => snap.id);

    if (pendingDocs.length === 0) return;

    await Promise.all(pendingDocs.map((doc) => addFascicoloIdToDocAndChunks(doc, fascicoloId)));
    console.log(`[Successo] FascicoloId ${fascicoloId} associato a ${pendingDocs.length} documenti e relativi chunks.`);
  } catch (error) {
    console.error("Errore durante l'esecuzione di processFascicoloDocs:", error);
    throw error;
  }
}