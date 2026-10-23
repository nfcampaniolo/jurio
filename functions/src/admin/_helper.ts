import { Timestamp, QueryDocumentSnapshot, DocumentReference, FieldValue } from "firebase-admin/firestore";
import { Response } from "express";
import { MaintenanceTaskBody, ProgressCallback, SentenceDoc } from "./_interfaces";
import { generateUrn, generateEcli, extractSubcats } from "./_utils";
import { getDb } from "../_deps";
import { validateUserPlanAndLimits } from "../_utils";
import { logSafeError } from "../_logging";

const db = getDb();
const QUERY_PAGE_SIZE = 200;

export async function requireAdminUser(
  uid: string,
  res: Response,
  context: string
): Promise<boolean> {
  const userSnap = await db.collection("register").doc(uid).get();
  if (!userSnap.exists) {
    res.status(404).json({ error: "Not Found" });
    return false;
  }

  if (String(userSnap.data()?.planId ?? "") !== "admin") {
    console.warn(`[${context}] Accesso negato a utente non admin`);
    res.status(403).json({ error: "Forbidden", details: "Privilegi insufficienti." });
    return false;
  }

  await validateUserPlanAndLimits(uid, "admin", userSnap);
  return true;
}

async function forEachTodaySentencePage(
  onPage: (docs: QueryDocumentSnapshot[], pageCount: number) => void | Promise<void>
): Promise<void> {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const midnightTs = Timestamp.fromDate(midnight);
  let lastDoc: QueryDocumentSnapshot | null = null;
  let pageCount = 0;

  while (true) {
    let query = db.collection("sentences")
      .where("createdAt", ">", midnightTs)
      .orderBy("createdAt", "asc")
      .limit(QUERY_PAGE_SIZE);

    if (lastDoc) query = query.startAfter(lastDoc);

    const snap = await query.get();
    if (snap.empty) break;
    pageCount++;
    lastDoc = snap.docs[snap.docs.length - 1];

    await onPage(snap.docs, pageCount);
    if (snap.size < QUERY_PAGE_SIZE) break;
  }
}

export async function runCleanupDuplicates(onProgress: ProgressCallback): Promise<{ deletedCount: number }> {
  let deletedCount = 0;

  // Memoria per tenere traccia di quelli già visti in questa sessione
  const seenUrns = new Set<string>();
  const seenEclis = new Set<string>();

  onProgress("Avvio pulizia duplicati (BulkWriter)...", { step: 2, action: "start" });

  const bulkWriter = db.bulkWriter();
  bulkWriter.onWriteError((error) => {
    logSafeError("ADMIN_BULK_DELETE_FAILED", error);
    return false;
  });

  await forEachTodaySentencePage((docs, pageCount) => {
    docs.forEach((d) => {
      const docData = d.data() as SentenceDoc;
      const urn = docData.urn ? String(docData.urn).trim() : "";
      const ecli = docData.ecli ? String(docData.ecli).trim() : "";

      // Se sono entrambi vuoti, lo ignoriamo (non lo consideriamo duplicato)
      if (urn === "" && ecli === "") {
        return; 
      }

      // Se abbiamo già visto l'URN o l'ECLI, è un duplicato! Coda per eliminazione
      if ((urn !== "" && seenUrns.has(urn)) || (ecli !== "" && seenEclis.has(ecli))) {
        void bulkWriter.delete(d.ref);
        deletedCount++;
      } else {
        // Altrimenti, è il documento "originale", lo salviamo nella memoria
        if (urn !== "") seenUrns.add(urn);
        if (ecli !== "") seenEclis.add(ecli);
      }
    });

    onProgress(`Scansionata pagina #${pageCount} (Pulizia)`, { 
      step: 2, 
      pagesScanned: pageCount, 
      queuedDeletionsSoFar: deletedCount 
    });
  });
  
  // Attendiamo che svuoti tutta la coda di eliminazioni
  await bulkWriter.close();
  
  onProgress("Pulizia duplicati completata.", { step: 2, action: "done", totalDeleted: deletedCount });
  return { deletedCount };
}

export async function runUpdateFonte(params: MaintenanceTaskBody, onProgress: ProgressCallback): Promise<{ updatedSentences: number; }> {
  const { newFonte, newFonteLogo, materia, sezione, organo_giudicante } = params;
  const baseUpdateData: Record<string, string> = {}; 
  if (newFonte?.trim()) baseUpdateData.fonte = newFonte.trim();
  if (newFonteLogo?.trim()) baseUpdateData.logo_fonte = newFonteLogo.trim();
  if (materia?.trim()) baseUpdateData.materia = materia.trim();
  if (sezione?.trim()) baseUpdateData.sezione = sezione.trim();
  if (organo_giudicante?.trim()) baseUpdateData.organo_giudicante = organo_giudicante.trim();

  let updatedCount = 0;

  onProgress("Avvio aggiornamento Fonte e URN/ECLI...", { step: 1, action: "start" });

  // 1. Inizializziamo il BulkWriter invece del Batch classico
  const bulkWriter = db.bulkWriter();

  // Opzionale: Gestione degli errori sui singoli documenti per evitare il blocco totale
  bulkWriter.onWriteError((error) => {
    logSafeError("ADMIN_BULK_WRITE_FAILED", error);
    return false; // Ritorna false per NON riprovare l'operazione se fallisce a livello di regole/validazione
  });

  await forEachTodaySentencePage((docs, pageCount) => {
    docs.forEach((d) => {
      const docData = d.data() as SentenceDoc;
      const docUpdateData: Record<string, string> = { ...baseUpdateData };
      let needsUpdate = Object.keys(docUpdateData).length > 0;
      const mergedData = { ...docData, ...docUpdateData };

      const newUrn = generateUrn(mergedData);
      if (docData.urn !== newUrn) { docUpdateData.urn = newUrn; needsUpdate = true; }

      const newEcli = generateEcli(mergedData); 
      if (!docData.ecli || !docData.ecli.startsWith("ECLI:")) {
        if (newEcli) { docUpdateData.ecli = newEcli; needsUpdate = true; }
      }
      
      if (needsUpdate) {
        // 2. Inviamo l'operazione al bulkWriter.
        // Pensa a questo come a una coda: bulkWriter accumula e invia pacchetti ottimizzati a Firestore.
        void bulkWriter.update(d.ref, docUpdateData);
        updatedCount++;
      }
    });

    // Aggiorna il progresso basandosi sui blocchi letti e messi in coda
    onProgress(`Scansionata pagina #${pageCount}`, { 
      step: 1, 
      pagesScanned: pageCount, 
      queuedUpdatesSoFar: updatedCount 
    });
  });
  
  // 3. CRUCIALE: Attendiamo che il bulkWriter svuoti la coda e completi i flussi verso il server
  await bulkWriter.close();
  
  onProgress("Aggiornamento Fonte completato.", { step: 1, action: "done", totalUpdated: updatedCount });
  return { updatedSentences: updatedCount };
}

export async function runUpdateMetadata(onProgress: ProgressCallback): Promise<{
  scanned: number;
  newSubcats: number;
  newPres: number;
  newRel: number;
}> {
  onProgress("Avvio aggiornamento Metadati (Taxonomy e Magistrati)...", { step: 2, action: "start" });

  const taxonomyRef = db.collection("meta").doc("taxonomy");
  const magistrateRef = db.collection("meta").doc("magistrate");

  // USIAMO DELLE MAPPE: chiave = nome, valore = conteggio occorrenze di OGGI
  const foundSubcats = new Map<string, number>();
  const foundPresidenti = new Map<string, number>();
  const foundRelatori = new Map<string, number>();
  
  let scanned = 0;
  await forEachTodaySentencePage((docs, pageCount) => {
    for (const d of docs) {
      scanned++;
      const data = d.data();
      
      // Estraiamo e incrementiamo il contatore GIORNALIERO nella Map
      extractSubcats(data.sottocategoria).forEach(s => {
        const currentCount = foundSubcats.get(s) || 0;
        foundSubcats.set(s, currentCount + 1);
      });
      
      if (typeof data.presidente === 'string' && data.presidente.trim()) {
        const p = data.presidente.trim();
        foundPresidenti.set(p, (foundPresidenti.get(p) || 0) + 1);
      }
      if (typeof data.relatore === 'string' && data.relatore.trim()) {
        const r = data.relatore.trim();
        foundRelatori.set(r, (foundRelatori.get(r) || 0) + 1);
      }
    }

    onProgress(`Scansione sentenze in corso: lette ${scanned} (Pagina #${pageCount})`, { 
      step: 2, 
      scannedSoFar: scanned, 
      pagesScanned: pageCount 
    });
  });

  onProgress("Verifica e Salvataggio metadati e contatori...", { step: 2, action: "saving" });

  // Funzione helper aggiornata per gestire Set (Creazione) e Update (Incremento)
  async function saveNewMetadata(parentRef: DocumentReference, subcollectionName: string, fieldName: string, values: Map<string, number>) {
    const subcollRef = parentRef.collection(subcollectionName);
    let addedCount = 0;
    let updatedCount = 0;
    
    let batch = db.batch();
    let batchWrites = 0;

    for (const [value, countOfToday] of values.entries()) {
      // Controlla se il valore esiste già
      const existing = await subcollRef.where(fieldName, '==', value).limit(1).get();
      
      if (existing.empty) {
        // NON ESISTE: Creiamo il nuovo documento impostando il contatore iniziale
        const newDocRef = subcollRef.doc();
        batch.set(newDocRef, { 
          [fieldName]: value, 
          sentences: countOfToday // Imposta il contatore
        });
        addedCount++;
      } else {
        // ESISTE: Incrementiamo il contatore esistente
        batch.update(existing.docs[0].ref, { 
          sentences: FieldValue.increment(countOfToday) 
        });
        updatedCount++;
      }

      batchWrites++;

      // Rispettiamo il limite di 500 scritture per batch
      if (batchWrites === 500) {
        await batch.commit();
        batch = db.batch();
        batchWrites = 0;
      }
    }
    
    if (batchWrites > 0) {
      await batch.commit();
    }
    
    return { added: addedCount, updated: updatedCount };
  }

  const timestamp = FieldValue.serverTimestamp();

  // Eseguiamo i salvataggi
  const [resSubcats, resPres, resRel] = await Promise.all([
    saveNewMetadata(taxonomyRef, "sottocategorie", "nome", foundSubcats),
    saveNewMetadata(magistrateRef, "presidenti", "nome", foundPresidenti),
    saveNewMetadata(magistrateRef, "relatori", "nome", foundRelatori),
  ]);

  await Promise.all([
    taxonomyRef.set({ lastScanAt: timestamp }, { merge: true }),
    magistrateRef.set({ lastScanAt: timestamp }, { merge: true })
  ]);

  onProgress(
    `Aggiornamento completato. Categorie: ${resSubcats.added} nuove, ${resSubcats.updated} aggiornate. ` +
    `Presidenti: ${resPres.added} nuovi, ${resPres.updated} aggiornati. ` +
    `Relatori: ${resRel.added} nuovi, ${resRel.updated} aggiornati.`, 
    { step: 2, action: "done", totalScanned: scanned }
  );
  
  return { 
    scanned, 
    newSubcats: resSubcats.added, 
    newPres: resPres.added, 
    newRel: resRel.added 
  };
}
