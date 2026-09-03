import type {
  UserData,
  RegisterDoc,
  UserExportData,
  ExportedChat,
  ExportedFascicolo,
  ExportedThread
} from "@/interfaces/interfaces";
import { getDb } from "@/infrastructure/db";
import { getStorageClient } from "@/infrastructure/storageClient";
import { toast } from "react-hot-toast";

export async function userExists(uid: string): Promise<boolean> {
  const db = await getDb();
  const { doc, getDoc } = await import("firebase/firestore");
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists();
}

export async function getUser(uid: string): Promise<UserData> {
  const db = await getDb();
  const { doc, getDoc } = await import("firebase/firestore");

  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.data() as UserData;
}

export async function saveUserData(uid: string, data: UserData) {
  if (!uid) throw new Error("UID mancante");

  const db = await getDb();
  const { doc, setDoc } = await import("firebase/firestore");

  const userRef = doc(db, "users", uid);
  await setDoc(userRef, data, { merge: true });
}

export async function deleteUser(uid: string): Promise<void> {
  const db = await getDb();

  const {
    doc,
    deleteDoc,
    collection,
    query,
    where,
    getDocs,
  } = await import("firebase/firestore");

  // ============================================================
  // 0. SICUREZZA
  // ============================================================

  const { getAuth } = await import("firebase/auth");
  const auth = getAuth();
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error("Utente non autenticato.");
  }

  if (currentUser.uid !== uid) {
    throw new Error(
      "Non puoi eliminare un account diverso da quello autenticato."
    );
  }

  // ============================================================
  // 1. CONTROLLO TEAM
  // ============================================================
  //
  // Prima di iniziare QUALSIASI cancellazione controlliamo se
  // l'utente appartiene a un team.
  //
  // Se appartiene a un team:
  // - mostriamo il toast
  // - interrompiamo la procedura
  // - nessun dato viene cancellato
  //
  // L'utente dovrà prima uscire dal team.
  // ============================================================

  const teamsQuery = query(
    collection(db, "teams"),
    where("member_ids", "array-contains", uid)
  );

  const teamsSnap = await getDocs(teamsQuery);

  // Controlliamo anche eventuali team dove è presente solo
  // nell'array owners.
  const ownersQuery = query(
    collection(db, "teams"),
    where("owners", "array-contains", uid)
  );

  const ownersSnap = await getDocs(ownersQuery);

  const teamIds = new Set([
    ...teamsSnap.docs.map((team) => team.id),
    ...ownersSnap.docs.map((team) => team.id),
  ]);

  if (teamIds.size > 0) {
    toast.error(
      "Prima di eliminare il tuo account devi uscire da tutti i team di cui fai parte."
    );

    throw new Error(
      "ACCOUNT_DELETION_BLOCKED_BY_TEAM_MEMBERSHIP"
    );
  }

  // ============================================================
  // 2. CHATS & MESSAGES
  // ============================================================

  const chatsQuery = query(
    collection(db, "chats"),
    where("ownerId", "==", uid)
  );

  const chatsSnap = await getDocs(chatsQuery);

  for (const chatDoc of chatsSnap.docs) {
    const messagesSnap = await getDocs(
      collection(chatDoc.ref, "messages")
    );

    await Promise.all(
      messagesSnap.docs.map((messageDoc) =>
        deleteDoc(messageDoc.ref)
      )
    );

    await deleteDoc(chatDoc.ref);
  }

  // ============================================================
  // 3. FASCICOLI → THREADS → MESSAGES
  // ============================================================

  const fascicoliQuery = query(
    collection(db, "fascicoli"),
    where("user", "==", uid)
  );

  const fascicoliSnap = await getDocs(fascicoliQuery);

  for (const fascicoloDoc of fascicoliSnap.docs) {
    const threadsSnap = await getDocs(
      collection(fascicoloDoc.ref, "threads")
    );

    for (const threadDoc of threadsSnap.docs) {
      const messagesSnap = await getDocs(
        collection(threadDoc.ref, "messages")
      );

      await Promise.all(
        messagesSnap.docs.map((messageDoc) =>
          deleteDoc(messageDoc.ref)
        )
      );

      await deleteDoc(threadDoc.ref);
    }

    await deleteDoc(fascicoloDoc.ref);
  }

  // ============================================================
  // 4. DOCUMENT CHUNKS & DOCUMENTS
  // ============================================================

  const chunksQuery = query(
    collection(db, "document_chunks"),
    where("user", "==", uid)
  );

  const documentsQuery = query(
    collection(db, "documents"),
    where("user", "==", uid)
  );

  const [chunksSnap, documentsSnap] = await Promise.all([
    getDocs(chunksQuery),
    getDocs(documentsQuery),
  ]);

  await Promise.all([
    ...chunksSnap.docs.map((d) => deleteDoc(d.ref)),
    ...documentsSnap.docs.map((d) => deleteDoc(d.ref)),
  ]);

  // ============================================================
  // 5. USERS SUBCOLLECTIONS
  // ============================================================

  const userRef = doc(db, "users", uid);

  // search_terms
  const searchTermsSnap = await getDocs(
    collection(userRef, "search_terms")
  );

  await Promise.all(
    searchTermsSnap.docs.map((d) => deleteDoc(d.ref))
  );

  // savedSentenze
  const savedSentenzeSnap = await getDocs(
    collection(userRef, "savedSentenze")
  );

  await Promise.all(
    savedSentenzeSnap.docs.map((d) => deleteDoc(d.ref))
  );

  // ============================================================
  // 6. DOCUMENTO UTENTE
  // ============================================================

  await deleteDoc(userRef);

  console.log(
    "[deleteUser] Cancellazione completata:",
    uid
  );
}

export async function getRegisterPlanId(uid: string): Promise<string> {
  const db = await getDb();
  const { doc, getDoc } = await import("firebase/firestore");

  const ref = doc(db, "register", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return "";

  const data = snap.data() as { planId?: unknown };
  return typeof data.planId === "string" ? data.planId : "";
}

export async function fetchRegisterDoc(uid: string): Promise<RegisterDoc | null> {
  const db = await getDb();
  const { doc, getDoc } = await import("firebase/firestore");
  const ref = doc(db, "register", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as RegisterDoc;
}

export async function exportUserData(uid: string): Promise<void> {
  const db = await getDb();
  const storage = await getStorageClient();
  
  const { doc, getDoc, collection, query, where, getDocs } = await import("firebase/firestore");
  const { ref, listAll, getDownloadURL } = await import("firebase/storage");

  // ==========================================
  // 1. RACCOLTA DATI FIRESTORE (JSON)
  // ==========================================
  const userDataExport: UserExportData = {
    exportDate: new Date().toISOString(),
    user: null,
    chats: [],
    fascicoli: [],
    documents: [],
    document_chunks: [],
    teams: []
  };

  // --- Utente ---
  const userSnap = await getDoc(doc(db, "users", uid));
  if (userSnap.exists()) {
    userDataExport.user = userSnap.data();
  }

  // --- Chats & Messages ---
  const chatsSnap = await getDocs(query(collection(db, "chats"), where("ownerId", "==", uid)));
  for (const chatDoc of chatsSnap.docs) {
    const chatData: ExportedChat = { 
      id: chatDoc.id, 
      ...chatDoc.data(), 
      messages: [] 
    };
    
    const messagesSnap = await getDocs(collection(chatDoc.ref, "messages"));
    chatData.messages = messagesSnap.docs.map((m) => ({ 
      id: m.id, 
      ...m.data() 
    }));
    
    userDataExport.chats.push(chatData);
  }

  // --- Fascicoli, Threads & Messages ---
  const fascicoliSnap = await getDocs(query(collection(db, "fascicoli"), where("user", "==", uid)));
  for (const fascicoloDoc of fascicoliSnap.docs) {
    const fascicoloData: ExportedFascicolo = { 
      id: fascicoloDoc.id, 
      ...fascicoloDoc.data(), 
      threads: [] 
    };
    
    const threadsSnap = await getDocs(collection(fascicoloDoc.ref, "threads"));
    for (const threadDoc of threadsSnap.docs) {
      const threadData: ExportedThread = { 
        id: threadDoc.id, 
        ...threadDoc.data(), 
        messages: [] 
      };
      
      const threadMsgsSnap = await getDocs(collection(threadDoc.ref, "messages"));
      threadData.messages = threadMsgsSnap.docs.map((m) => ({ 
        id: m.id, 
        ...m.data() 
      }));
      
      fascicoloData.threads.push(threadData);
    }
    userDataExport.fascicoli.push(fascicoloData);
  }

  // --- Documents & Chunks ---
  const docsSnap = await getDocs(query(collection(db, "documents"), where("user", "==", uid)));
  userDataExport.documents = docsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const chunksSnap = await getDocs(query(collection(db, "document_chunks"), where("user", "==", uid)));
  userDataExport.document_chunks = chunksSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // --- Teams ---
  const teamsSnap = await getDocs(query(collection(db, "teams"), where("member_ids", "array-contains", uid)));
  userDataExport.teams = teamsSnap.docs.map((t) => ({ id: t.id, ...t.data() }));

  // ==========================================
  // 2. CREAZIONE E DOWNLOAD DEL FILE JSON
  // ==========================================
  const jsonString = JSON.stringify(userDataExport, null, 2);
  const jsonBlob = new Blob([jsonString], { type: "application/json" });
  downloadBlob(jsonBlob, `export_dati_${uid}.json`);


  // ==========================================
  // 3. RECUPERO E DOWNLOAD DEI FILE (STORAGE)
  // ==========================================
  const downloadStorageFolder = async (folderPath: string): Promise<void> => {
    try {
      const folderRef = ref(storage, folderPath);
      const listResult = await listAll(folderRef);
      
      for (const itemRef of listResult.items) {
        const url = await getDownloadURL(itemRef);
        
        const response = await fetch(url);
        const blob = await response.blob();
        downloadBlob(blob, itemRef.name);
      }
    } catch (error) {
      console.warn(`Impossibile scaricare file da ${folderPath}`, error);
    }
  };

  await downloadStorageFolder(`users/${uid}`);
  await downloadStorageFolder(`users/${uid}/documents`);
}

// --- Funzione Helper per innescare i download ---
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}