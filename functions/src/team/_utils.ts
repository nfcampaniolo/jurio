import { randomInt } from "node:crypto";
import { FieldValue, WriteBatch } from "firebase-admin/firestore";
import { getDb} from "../_deps";

const db = getDb();

export async function removeUserVisibilityFromDocuments(uidDelete: string) {
  const collectionsToUpdate = ["fascicoli", "documents", "document_chunks"];
  
  for (const collectionName of collectionsToUpdate) {
    const snapshot = await db.collection(collectionName)
      .where("visibleTo", "array-contains", uidDelete)
      .get();

    if (snapshot.empty) continue;

    // Split array into chunks of 500 (Firestore max batch size)
    const batches: WriteBatch[] = [];
    let currentBatch = db.batch();
    let operationCount = 0;

    snapshot.docs.forEach((doc) => {
      currentBatch.update(doc.ref, {
        visibleTo: FieldValue.arrayRemove(uidDelete)
      });
      operationCount++;

      if (operationCount === 500) {
        batches.push(currentBatch);
        currentBatch = db.batch();
        operationCount = 0;
      }
    });

    if (operationCount > 0) {
      batches.push(currentBatch);
    }

    // Esegue tutti i batch per la collection corrente
    await Promise.all(batches.map(batch => batch.commit()));
  }
}

export async function updateUserDocuments(uidDelete: string, uidOwner: string) {
  const collectionsToUpdate = ["fascicoli", "documents", "document_chunks"];
  
  for (const collectionName of collectionsToUpdate) {
    // Seleziona dinamicamente il campo da interrogare in base alla collection
    const fieldToQuery = collectionName === "fascicoli" ? "ownerId" : "user";

    const snapshot = await db.collection(collectionName)
      .where(fieldToQuery, "==", uidDelete)
      .get();

    if (snapshot.empty) continue;

    const batches: WriteBatch[] = [];
    let currentBatch = db.batch();
    let operationCount = 0;

    snapshot.docs.forEach((doc) => {
      // Aggiorna solo i campi di proprietà senza toccare nient'altro
      currentBatch.update(doc.ref, {
        user: uidOwner,
        ownerId: uidOwner
      });
      
      operationCount++;

      // Gestione partizionamento batch (limite 500)
      if (operationCount === 500) {
        batches.push(currentBatch);
        currentBatch = db.batch();
        operationCount = 0;
      }
    });

    if (operationCount > 0) {
      batches.push(currentBatch);
    }

    // Esegue tutti i batch per la collection corrente in parallelo
    await Promise.all(batches.map(batch => batch.commit()));
  }
}

function generateVoucherCode(): string {
  return `VCH-${randomInt(36 ** 6).toString(36).toUpperCase().padStart(6, "0")}`;
}

export async function handleTeamCreationInTx(
  tx: any, 
  db: any, 
  uid: string, 
  planId: string, 
  expireSec: number, 
  now: any
): Promise<{ finalUserStatus: string; needsTask: boolean }> {
  
  // 1. Se non è un piano team, ritorna subito
  if (!planId.startsWith("team")) {
    return { finalUserStatus: planId, needsTask: true };
  }

  // 2. LETTURA: Controlla lo status attuale dell'utente
  const userRef = db.collection("users").doc(uid);
  const userSnap = await tx.get(userRef);
  const currentStatus = userSnap.data()?.status;

  // 3. LETTURA: Cerca se l'utente è già owner di un team esistente
  const teamsQuery = db.collection("teams")
    .where("owners", "array-contains", uid)
    .limit(1); // Ne basta 1 (presumiamo che un utente abbia un solo team principale)
  const teamQuerySnap = await tx.get(teamsQuery);

  // 4. Calcola quanti voucher emettere
  const numStr = planId.replace("team", "");
  let totalVouchers = parseInt(numStr, 10) || 3;
  let vouchersToIssue = totalVouchers;
  
  let needsTask = false;

  // Se l'utente non è già "business", consuma un voucher per il suo account e attiva il task
  if (currentStatus !== "business") {
    vouchersToIssue -= 1;
    needsTask = true; 
  }

  // Genera l'array con i nuovi voucher
  const newVouchers = Array.from({ length: vouchersToIssue }).map(() => ({
    id: generateVoucherCode(),
    duration: 365,
    used: false
  }));

  // Calcola la scadenza come oggetto Timestamp
  const expireTimestamp = now.constructor.fromMillis(expireSec * 1000);

  // 5. SCRITTURE: Logica condizionale (Crea nuovo vs Aggiorna esistente)
  if (teamQuerySnap.empty) {
    
    // --- CASO A: NESSUN TEAM ESISTENTE -> CREA NUOVO ---
    const teamRef = db.collection("teams").doc();
    tx.set(teamRef, {
      name: "Il mio Workspace",
      owners: [uid],
      member_ids: [uid],
      visibility_default: "private",
      vouchers: newVouchers,
      createdAt: now
    });

    tx.set(teamRef.collection("members").doc(uid), {
      role: "owner",
      date_start: now,
      expire: expireTimestamp
    });

  } else {
    
    // --- CASO B: TEAM ESISTENTE -> AGGIUNGI VOUCHER E AGGIORNA SCADENZA ---
    const existingTeamDoc = teamQuerySnap.docs[0];
    const teamRef = existingTeamDoc.ref;
    const teamData = existingTeamDoc.data();
    
    // Recupera i voucher vecchi (se non ci sono, usa array vuoto)
    const existingVouchers = teamData.vouchers || [];
    
    // Unisci i voucher vecchi con quelli appena generati
    tx.update(teamRef, {
      vouchers: [...existingVouchers, ...newVouchers]
    });

    // OPZIONALE MA CONSIGLIATO: Aggiorna la scadenza dell'owner nella sotto-collezione
    const memberRef = teamRef.collection("members").doc(uid);
    tx.set(memberRef, {
      expire: expireTimestamp
    }, { merge: true }); // Usiamo merge per non sovrascrivere data_start e role
  }

  return { finalUserStatus: "business", needsTask };
}