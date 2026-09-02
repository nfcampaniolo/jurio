import { getFirestore } from "firebase-admin/firestore";
import { getDb, getAdmin, sanitize, getAdminAuth } from "./deps";
import { enqueueMonthlyUsageEmail, calculateReportData } from "./email";

export async function scheduleDowngradeTask(args: {
  projectId: string;
  location: string;
  queue: string;
  targetUrl: string;
  serviceAccountEmail: string;
  uid: string;
  expireSec: number; // <-- nuovo
}) {
  const { CloudTasksClient } = await import("@google-cloud/tasks");
  const tasks = new CloudTasksClient();
  const parent = tasks.queuePath(args.projectId, args.location, args.queue);
  const taskId = `downgrade-${args.uid}-${args.expireSec}`.replaceAll(/[^a-zA-Z0-9-_]/g, "_");
  const payload = { uid: args.uid, expireSec: args.expireSec };
  const task = {
    name: tasks.taskPath(args.projectId, args.location, args.queue, taskId),
    scheduleTime: { seconds: args.expireSec },
    httpRequest: {
      httpMethod: "POST" as const,
      url: args.targetUrl,
      headers: { "Content-Type": "application/json" },
      body: Buffer.from(JSON.stringify(payload)).toString("base64"),
      oidcToken: {
        serviceAccountEmail: args.serviceAccountEmail,
        audience: args.targetUrl,
      },
    },
  };
  try {
    await tasks.createTask({ parent, task });
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    if (e?.code === 6 || msg.includes("ALREADY_EXISTS")) return;
    throw e;
  }
}

export type DowngradeTxResult = {
  skipped: "user_not_found" | "register_not_found" | "no_current_expire" | "outdated_task" | null;
  alreadyDowngraded: boolean;
  alreadyEmailed: boolean;
  shouldSendEmail: boolean;
};

// --- COSTANTI ---
export const SEZIONI_CASSAZIONE_CIVILE = [
  "PRIMA SEZIONE CIVILE",
  "SECONDA SEZIONE CIVILE",
  "TERZA SEZIONE CIVILE",
  "QUARTA SEZIONE CIVILE",
  "QUINTA SEZIONE CIVILE",
  "SESTA SEZIONE CIVILE",
  "SEZIONI UNITE CIVILI",
] as const;

export const SEZIONI_CASSAZIONE_PENALE = [
  "PRIMA SEZIONE PENALE",
  "SECONDA SEZIONE PENALE",
  "TERZA SEZIONE PENALE",
  "QUARTA SEZIONE PENALE",
  "QUINTA SEZIONE PENALE",
  "SESTA SEZIONE PENALE",
  "SETTIMA SEZIONE PENALE",
  "SEZIONE FERIALE PENALE",
  "SEZIONI UNITE PENALI",
] as const;

// --- METODO CRON ---
export async function computeAndSaveWeeklyStats() {
  const db = getFirestore();
  const coll = db.collection("sentences");

  // 1. Conteggi Base (eseguiti in parallelo)
  const [
    totalSnap,
    sentenzaSnap,
    ordinanzaSnap,
    decretoSnap,
    consiglioStatoSnap,
    cassazioneSnap,
    costituzionaleSnap,
    penaleSnap,
    civileSnap,
  ] = await Promise.all([
    coll.count().get(),
    coll.where("tipo_documento", "==", "sentenza").count().get(),
    coll.where("tipo_documento", "==", "ordinanza").count().get(),
    coll.where("tipo_documento", "==", "decreto").count().get(),
    coll.where("organo_giudicante", "==", "CONSIGLIO DI STATO").count().get(),
    coll.where("organo_giudicante", "==", "CORTE DI CASSAZIONE").count().get(),
    coll.where("organo_giudicante", "==", "CORTE COSTITUZIONALE").count().get(),
    coll.where("materia", "==", "Penale").count().get(),
    coll.where("materia", "==", "Civile").count().get(),
  ]);

  // 2. Variabili per raccogliere i risultati dinamici
  const sezioniCiviliStats: Record<string, number> = {};
  const sezioniPenaliStats: Record<string, number> = {};
  const yearStats: Record<string, number> = {};

  // 3. Prepariamo le Promise per le Sezioni Civili
  const sezioniCiviliPromises = SEZIONI_CASSAZIONE_CIVILE.map(async (sezione) => {
    const snap = await coll.where("sezione", "==", sezione).count().get();
    sezioniCiviliStats[sezione] = snap.data().count;
  });

  // 4. Prepariamo le Promise per le Sezioni Penali
  const sezioniPenaliPromises = SEZIONI_CASSAZIONE_PENALE.map(async (sezione) => {
    const snap = await coll.where("sezione", "==", sezione).count().get();
    sezioniPenaliStats[sezione] = snap.data().count;
  });

  // 5. Prepariamo le Promise per gli Anni (Ultimi 5)
  const currentYear = new Date().getFullYear();
  const yearsToCount = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4, currentYear - 5, currentYear - 6, currentYear - 7, currentYear - 8, currentYear - 9, currentYear - 10];

  const yearPromises = yearsToCount.map(async (year) => {
    const startOfYear = new Date(`${year}-01-01T00:00:00Z`);
    const endOfYear = new Date(`${year}-12-31T23:59:59.999Z`);
    const snap = await coll
      .where("dataSentenza", ">=", startOfYear)
      .where("dataSentenza", "<=", endOfYear)
      .count()
      .get();
    yearStats[year.toString()] = snap.data().count;
  });

  // 6. Eseguiamo tutte le Promise dinamiche in un colpo solo (Massima velocità)
  await Promise.all([
    ...sezioniCiviliPromises,
    ...sezioniPenaliPromises,
    ...yearPromises,
  ]);

  // 7. Costruiamo l'oggetto finale
  const weeklyStats = {
    type: "weekly_sentences_stats", // Utile per filtrare la collection "meta"
    createdAt: new Date(),
    totale_documenti: totalSnap.data().count,
    totale_completi: totalSnap.data().count, // Sostituisci se hai un flag specifico per i "completi"
    per_tipo: {
      sentenza: sentenzaSnap.data().count,
      ordinanza: ordinanzaSnap.data().count,
      decreto: decretoSnap.data().count,
    },
    per_organo: {
      consiglio_di_stato: consiglioStatoSnap.data().count,
      corte_di_cassazione: cassazioneSnap.data().count,
      corte_costituzionale: costituzionaleSnap.data().count,
    },
    per_materia: {
      penale: penaleSnap.data().count,
      civile: civileSnap.data().count,
    },
    per_sezione_cassazione: {
      civili: sezioniCiviliStats,
      penali: sezioniPenaliStats,
    },
    per_anno: yearStats,
  };

  // 8. Salviamo aggiungendo un nuovo documento nella collection "meta"
  await db.collection("metadocument").add(weeklyStats);

  return weeklyStats;
}

export async function computeAndSaveMonthlyUsage() {
  const db = getDb();
  const admin = getAdmin();
  const auth = getAdminAuth(); // Aggiunto per recuperare l'email
  
  // 1. Calcolo del range temporale (mese precedente)
  const now = new Date();
  const firstDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  
  // targetMonthStr per l'ID del documento (es. "2026_07")
  const year = firstDayOfLastMonth.getFullYear();
  const month = String(firstDayOfLastMonth.getMonth() + 1).padStart(2, '0');
  const targetMonthStr = `${year}_${month}`;

  // meseDescrittivo per l'email (es. "Luglio 2026")
  const formatter = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' });
  const meseDescrittivoRaw = formatter.format(firstDayOfLastMonth);
  const meseDescrittivo = meseDescrittivoRaw.charAt(0).toUpperCase() + meseDescrittivoRaw.slice(1);

  // Creiamo i Timestamp
  const startTimestamp = admin.firestore.Timestamp.fromDate(firstDayOfLastMonth);
  const endTimestamp = admin.firestore.Timestamp.fromDate(firstDayOfCurrentMonth);

  console.log(`📊 Estrazione usage per il mese: ${targetMonthStr} (${meseDescrittivo})`);

  // 2. Recupero dei dati usando Collection Group
  const daysSnapshot = await db.collectionGroup('days')
    .where('updatedAt', '>=', startTimestamp)
    .where('updatedAt', '<', endTimestamp)
    .get();

  // 3. Aggregazione dei dati in memoria
  const usageByUser: Record<string, Record<string, number>> = {};

  daysSnapshot.forEach((doc) => {
    const data = doc.data();
    const count = typeof data.count === 'number' ? data.count : 0;
    
    const uid = doc.ref.parent.parent?.id; 
    if (!uid) return;

    const docIdParts = doc.id.split('_');
    const serviceName = docIdParts.length > 3 ? docIdParts.slice(3).join('_') : 'unknown_service';

    if (!usageByUser[uid]) {
      usageByUser[uid] = {};
    }
    
    usageByUser[uid][serviceName] = (usageByUser[uid][serviceName] || 0) + count;
  });

  // Array per immagazzinare i report da spedire DOPO il commit al DB
  const emailTasks: Array<{ uid: string; reportData: any }> = [];

  // 4. Salvataggio in batch in register/{uid}/usage/{YYYY_MM}
  const batches: Promise<any>[] = [];
  let currentBatch = db.batch();
  let operationCount = 0;
  let utentiProcessati = 0;

  for (const [uid, servicesRecord] of Object.entries(usageByUser)) {
    // Prepariamo i dati per il DB
    const usageDocRef = db.collection('register').doc(uid).collection('usage').doc(targetMonthStr);
    const payload = sanitize({
      ...servicesRecord,
      _updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    currentBatch.set(usageDocRef, payload, { merge: true });

    // Prepariamo i dati per l'email sfruttando la funzione pura
    const reportData = calculateReportData(servicesRecord, meseDescrittivo);
    
    // Accodiamo l'email solo se l'utente ha usato effettivamente qualcosa
    if (reportData.totalTimeSavedMinutes > 0 || reportData.haFattoPrompting || reportData.interazioniCount > 0) {
      emailTasks.push({ uid, reportData });
    }

    operationCount++;
    utentiProcessati++;

    if (operationCount === 500) { // Firestore WriteBatch limite max è 500
      batches.push(currentBatch.commit());
      currentBatch = db.batch();
      operationCount = 0;
    }
  }

  // Commit finale per i documenti residui
  if (operationCount > 0) {
    batches.push(currentBatch.commit());
  }

  // Aspettiamo che TUTTI i dati statistici siano scritti su Firestore
  await Promise.all(batches);
  console.log(`✅ DB Aggiornato. Procedo all'invio di ${emailTasks.length} email.`);

  // 5. Invio delle email (Fase 2)
  for (const task of emailTasks) {
    try {
      // Otteniamo l'email dell'utente da Firebase Auth
      const userRecord = await auth.getUser(task.uid);
      if (userRecord.email) {
        await enqueueMonthlyUsageEmail({
          email: userRecord.email,
          reportData: task.reportData
        });
      }
    } catch (error) {
      // In caso l'utente sia stato cancellato da Auth o non abbia un'email
      console.warn(`⚠️ Impossibile inviare l'email per l'uid ${task.uid}. Utente non trovato in Auth?`);
    }
  }

  return { 
    utenti_processati: utentiProcessati, 
    email_accodate: emailTasks.length 
  };
}