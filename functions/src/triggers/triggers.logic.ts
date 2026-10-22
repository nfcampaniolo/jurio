import { FirestoreEvent, Change, DocumentSnapshot, QueryDocumentSnapshot } from "firebase-functions/v2/firestore";
import { getAdminStorage } from "../_deps";
import { applyTeamVisibility } from "./_helper";
import { enqueueContactEmail }  from "../email/comms/logic";
import { logSafeError } from "../_logging";

export async function handleFileCreation(
  event: FirestoreEvent<Change<DocumentSnapshot> | undefined, Record<string, string>>
) {
  const change = event.data;
  if (!change) return;
  const snapBefore = change.before;
  const snapAfter = change.after;
  if (!snapAfter.exists) return;
  const dataBefore = snapBefore.exists ? snapBefore.data() : null;
  const dataAfter = snapAfter.data();
  if (!dataAfter) return;
  const ownerChanged = dataBefore?.user !== dataAfter.user;
  if (snapBefore.exists && !ownerChanged) {
    return;
  }
  await applyTeamVisibility(snapAfter.ref, dataAfter);
}

export async function handleGenerateStaticStatsJson(
  event: FirestoreEvent<QueryDocumentSnapshot | undefined, { docId: string }>
): Promise<void> {
  const snapshot = event.data;
  if (!snapshot) return;
  const data = snapshot.data();

  // 1. Filtriamo solo i documenti che ci interessano
  if (data.type !== "weekly_sentences_stats") {
    console.log("Documento ignorato: non è una statistica settimanale.");
    return;
  }

  console.log("Elaborazione nuove statistiche settimanali");

  // 2. Formattiamo la data per il frontend (es: "31 Maggio 2026")
  const createdAtDate = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
  const dateFormatter = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  const dataAggiornamento = dateFormatter.format(createdAtDate);

  // 3. Ordiniamo esplicitamente gli anni per evitare il riordinamento automatico numerico di V8
  const sortedPerAnno = Object.keys(data.per_anno || {})
    .sort((a, b) => Number(a) - Number(b)) 
    .reduce((acc, key) => {
      acc[key] = data.per_anno[key];
      return acc;
    }, {} as Record<string, number>);

  // 4. Mappiamo il documento Firestore nella struttura esatta attesa dal file HTML
  const configJson = {
    meta: {
      totale_documenti: data.totale_documenti || 0,
      data_aggiornamento: dataAggiornamento
    },
    per_anno: sortedPerAnno,
    per_organo: {
      "Cassazione": data.per_organo?.corte_di_cassazione || 0,
      "Consiglio di Stato": data.per_organo?.consiglio_di_stato || 0,
      "Corte Costituzionale": data.per_organo?.corte_costituzionale || 0,
    },
    per_tipo: {
      "Ordinanza": data.per_tipo?.ordinanza || 0,
      "Sentenza": data.per_tipo?.sentenza || 0,
      "Decreto": data.per_tipo?.decreto || 0,
    },
    per_materia: {
      "civile": data.per_materia?.civile || 0,
      "penale": data.per_materia?.penale || 0,
    },
    per_sezione_cassazione: data.per_sezione_cassazione || { civili: {}, penali: {} }
  };

  // 5. Scriviamo il file su Firebase Cloud Storage
  try {
    const storage = getAdminStorage();
    const bucket = storage.bucket();
    const file = bucket.file("dataConfig.json");

    await file.save(JSON.stringify(configJson, null, 2), {
      contentType: "application/json",
      metadata: {
        cacheControl: "public, max-age=3600", 
      }
    });

    await file.makePublic();
    console.log("dataConfig.json aggiornato e pubblicato");
  } catch (error) {
    logSafeError("STATIC_STATS_UPLOAD_FAILED", error);
    throw error; // Rilanciamo l'errore per garantire il corretto retry della Cloud Function in caso di fallimento
  }
}

export async function handleProcessContacts(
  event: FirestoreEvent<QueryDocumentSnapshot | undefined, { docId: string }>
): Promise<void> {
  const snapshot = event.data;
  
  // 1. Controllo esistenza snapshot
  if (!snapshot || !snapshot.exists) {
    console.log("Documento non esistente.");
    return;
  }

  const data = snapshot.data();
  const docId = event.params.docId;

  // 2. Controllo robusto sui campi obbligatori
  const hasRequiredFields = 
    data &&
    typeof data.name === "string" && data.name.trim() !== "" &&
    typeof data.email === "string" && data.email.trim() !== "" &&
    typeof data.subject === "string" && data.subject.trim() !== "" &&
    typeof data.message === "string" && data.message.trim() !== "";

  if (!hasRequiredFields) {
    console.warn("Ticket contatti ignorato: campi obbligatori mancanti o malformati");
    return;
  }

  try {
    // 3. Chiamata al metodo solo se tutto è validato
    await enqueueContactEmail({
      nome: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      subject: data.subject.trim(),
      message: data.message.trim(),
      id: docId
    });

    console.log("Email del ticket contatti processata");
  } catch (error) {
    logSafeError("CONTACT_EMAIL_ENQUEUE_FAILED", error);
    throw error;
  }
}