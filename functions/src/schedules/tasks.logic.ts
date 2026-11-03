import { Request, Response } from "express";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { getDb, getAdmin, sanitize, getAdminAuth, getAdminStorage } from "../_deps";
import { calculateReportData } from "../email/_helper";
import { enqueueMonthlyUsageEmail, enqueueDowngradeEmail } from "../email/plans/logic";
import { SEZIONI_CASSAZIONE_CIVILE, SEZIONI_CASSAZIONE_PENALE } from "../_constants";
import { logSafeError } from "../_logging";

export type DowngradeTxResult = {
  skipped: "user_not_found" | "register_not_found" | "no_current_expire" | "outdated_task" | null;
  alreadyDowngraded: boolean;
  alreadyEmailed: boolean;
  shouldSendEmail: boolean;
};

const db = getDb();

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

  // 2. Prepariamo le Promise per le Sezioni Civili (restituendo coppia chiave-valore)
  const sezioniCiviliPromises = SEZIONI_CASSAZIONE_CIVILE.map(async (sezione) => {
    const snap = await coll.where("sezione", "==", sezione).count().get();
    return { sezione, count: snap.data().count };
  });

  // 3. Prepariamo le Promise per le Sezioni Penali
  const sezioniPenaliPromises = SEZIONI_CASSAZIONE_PENALE.map(async (sezione) => {
    const snap = await coll.where("sezione", "==", sezione).count().get();
    return { sezione, count: snap.data().count };
  });

  // 4. Prepariamo le Promise per gli Anni (Ultimi 11 anni, coerente con l'array)
  const currentYear = new Date().getFullYear();
  const yearsToCount = [
    currentYear, currentYear - 1, currentYear - 2, currentYear - 3, 
    currentYear - 4, currentYear - 5, currentYear - 6, currentYear - 7, 
    currentYear - 8, currentYear - 9, currentYear - 10
  ];

  const yearPromises = yearsToCount.map(async (year) => {
    const startOfYear = new Date(`${year}-01-01T00:00:00Z`);
    const endOfYear = new Date(`${year}-12-31T23:59:59.999Z`);
    const snap = await coll
      .where("dataSentenza", ">=", startOfYear)
      .where("dataSentenza", "<=", endOfYear)
      .count()
      .get();
    return { year: year.toString(), count: snap.data().count };
  });

  // 5. Eseguiamo tutte le Promise in parallelo preservando l'ordine posizionale
  const [sezioniCiviliResults, sezioniPenaliResults, yearResults] = await Promise.all([
    Promise.all(sezioniCiviliPromises),
    Promise.all(sezioniPenaliPromises),
    Promise.all(yearPromises),
  ]);

  // 6. Ricostruiamo gli oggetti finali rispettando rigorosamente l'ordine degli array originali
  const sezioniCiviliStats: Record<string, number> = {};
  for (const item of sezioniCiviliResults) {
    sezioniCiviliStats[item.sezione] = item.count;
  }

  const sezioniPenaliStats: Record<string, number> = {};
  for (const item of sezioniPenaliResults) {
    sezioniPenaliStats[item.sezione] = item.count;
  }

  const yearStats: Record<string, number> = {};
  for (const item of yearResults) {
    yearStats[item.year] = item.count;
  }

  // 7. Costruiamo l'oggetto finale
  const weeklyStats = {
    type: "weekly_sentences_stats",
    createdAt: new Date(),
    totale_documenti: totalSnap.data().count,
    totale_completi: totalSnap.data().count,
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

  // 8. Salviamo aggiungendo un nuovo documento nella collection "metadocument"
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
    // Sicurezza: controlla che siamo effettivamente sotto usage/
    if (!doc.ref.path.startsWith('usage/')) return;

    const data = doc.data();
    const count = typeof data.count === 'number' ? data.count : 0;
    
    const uid = doc.ref.parent.parent?.id; 
    if (!uid) return;

    // Estrae dinamicamente tutto ciò che c'è dopo il primo '_' (es. "legal_agent")
    const firstUnderscoreIndex = doc.id.indexOf('_');
    const serviceName = firstUnderscoreIndex !== -1 
      ? doc.id.substring(firstUnderscoreIndex + 1) 
      : 'unknown_service';

    if (!usageByUser[uid]) {
      usageByUser[uid] = {};
    }
    
    usageByUser[uid][serviceName] = (usageByUser[uid][serviceName] || 0) + count;
  });

  // Array per immagazzinare i report da spedire DOPO il commit al DB
  const emailTasks: Array<{ uid: string; reportData: any }> = [];
  const globalUsageByService: Record<string, { utilizzi_totali: number; utenti_attivi: number }> = {};

  // 4. Salvataggio in batch in register/{uid}/usage/{YYYY_MM}
  const batches: Promise<any>[] = [];
  let currentBatch = db.batch();
  let operationCount = 0;
  let utentiProcessati = 0;

  for (const [uid, servicesRecord] of Object.entries(usageByUser)) {
    // 4.1 Verifica che l'utente esista in 'register' scartando ad es. gli IP
    const registerDoc = await db.collection('register').doc(uid).get();
    if (!registerDoc.exists) {
      continue; // Salta questo uid se non è un utente registrato
    }

    // 4.2 Aggregazione globale per servizio (solo utenti registrati)
    for (const [serviceName, serviceCountRaw] of Object.entries(servicesRecord)) {
      const serviceCount = typeof serviceCountRaw === "number" ? serviceCountRaw : 0;
      if (serviceCount <= 0) continue;

      if (!globalUsageByService[serviceName]) {
        globalUsageByService[serviceName] = { utilizzi_totali: 0, utenti_attivi: 0 };
      }

      globalUsageByService[serviceName].utilizzi_totali += serviceCount;
      globalUsageByService[serviceName].utenti_attivi += 1;
    }

    // 4.3 Prepariamo i dati per il DB
    const usageDocRef = db.collection('register').doc(uid).collection('usage').doc(targetMonthStr);
    const payload = sanitize({
      ...servicesRecord,
      _updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    currentBatch.set(usageDocRef, payload, { merge: true });

    // 4.4 Prepariamo i dati per l'email sfruttando la funzione pura
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

  // 5. Salvataggio del report aggregato globale su Cloud Storage
  const serviziOrdinatiPerUtilizzo = Object.entries(globalUsageByService)
    .sort(([, left], [, right]) => right.utilizzi_totali - left.utilizzi_totali)
    .map(([servizio, metriche]) => ({ servizio, ...metriche }));

  const globalUsageReport = {
    type: "monthly_global_usage_by_service",
    mese_id: targetMonthStr,
    mese_descrittivo: meseDescrittivo,
    generato_il: new Date().toISOString(),
    utenti_registrati_processati: utentiProcessati,
    servizi: serviziOrdinatiPerUtilizzo,
  };

  try {
    const storage = getAdminStorage();
    const bucket = storage.bucket();
    const reportPath = `reports/usage/monthly/${targetMonthStr}.json`;
    const latestPath = "reports/usage/monthly/latest.json";

    await Promise.all([
      bucket.file(reportPath).save(JSON.stringify(globalUsageReport, null, 2), {
        contentType: "application/json",
        metadata: { cacheControl: "public, max-age=3600" },
      }),
      bucket.file(latestPath).save(JSON.stringify(globalUsageReport, null, 2), {
        contentType: "application/json",
        metadata: { cacheControl: "public, max-age=3600" },
      }),
    ]);

    console.log(`📁 Report globale utilizzi salvato su Storage: ${reportPath}`);
  } catch (error) {
    logSafeError("MONTHLY_USAGE_GLOBAL_REPORT_UPLOAD_FAILED", error);
    throw error;
  }

  console.log(`✅ DB Aggiornato. Procedo all'invio di ${emailTasks.length} email.`);

  // 6. Invio delle email (Fase 2)
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
      console.warn("Impossibile inviare l'email: utente non trovato in Auth");
    }
  }

  return { 
    utenti_processati: utentiProcessati, 
    email_accodate: emailTasks.length,
    servizi_aggregati: serviziOrdinatiPerUtilizzo.length,
  };
}

export async function executeTasksDowngrade(req: Request, res: Response): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    const uid = typeof req.body?.uid === "string" ? req.body.uid.trim() : "";
    const expireSec =
      typeof req.body?.expireSec === "number" && Number.isFinite(req.body.expireSec)
        ? req.body.expireSec
        : null;

    if (!uid) {
      res.status(400).json({ error: "Missing uid" });
      return;
    }
    if (!expireSec) {
      res.status(400).json({ error: "Missing expireSec" });
      return;
    }

    const userRef = db.collection("users").doc(uid);
    const registerRef = db.collection("register").doc(uid);

    // 1. Guard anti-task-obsoleto: confronta expireSec con register.expire attuale
    const regSnap = await registerRef.get();
    if (!regSnap.exists) {
      res.status(200).json({ ok: true, skipped: "register_not_found" });
      return;
    }

    const reg = regSnap.data() as any;
    const currentExpire: Timestamp | null = reg?.expire instanceof Timestamp ? reg.expire : null;

    if (!currentExpire) {
      res.status(200).json({ ok: true, skipped: "no_current_expire" });
      return;
    }

    const currentExpireSec = Math.floor(currentExpire.toMillis() / 1000);
    if (currentExpireSec !== expireSec) {
      res.status(200).json({ ok: true, skipped: "outdated_task" });
      return;
    }

    // 2. Downgrade + claim email in modo consistente in transazione
    const txOut = await db.runTransaction(async (tx): Promise<DowngradeTxResult> => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) {
        return {
          skipped: "user_not_found",
          alreadyDowngraded: false,
          alreadyEmailed: false,
          shouldSendEmail: false,
        };
      }

      const user = userSnap.data() as any;
      const alreadyDowngraded = user?.status === "nessuno";
      const alreadyEmailed = !!user?.downgradeEmailSentAt;

      if (!alreadyDowngraded) {
        tx.set(userRef, { status: "nessuno", downgradedAt: FieldValue.serverTimestamp() }, { merge: true });
        tx.set(registerRef, { planId: "nessuno", downgradedAt: FieldValue.serverTimestamp() }, { merge: true });
      }

      let shouldSendEmail = false;
      if (!alreadyEmailed) {
        tx.set(userRef, { downgradeEmailSentAt: FieldValue.serverTimestamp() }, { merge: true });
        shouldSendEmail = true;
      }

      return {
        skipped: null,
        alreadyDowngraded,
        alreadyEmailed,
        shouldSendEmail,
      };
    });

    if (txOut.skipped === "user_not_found") {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // 3. Side-effect fuori transaction (idempotenza garantita dal claim in tx)
    if (txOut.shouldSendEmail) {
      await enqueueDowngradeEmail({ uid });
    }

    res.status(200).json({
      ok: true,
      skipped: txOut.skipped,
      alreadyDowngraded: txOut.alreadyDowngraded,
      alreadyEmailed: txOut.alreadyEmailed,
    });
  } catch (e) {
    logSafeError("TASKS_DOWNGRADE_FAILED", e);
    res.status(500).json({ error: "Internal error" });
  }
}
