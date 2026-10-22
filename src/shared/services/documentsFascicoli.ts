import type { PastFascicolo, DBThreadPayload, DBThreadData, Message } from "@/interfaces/interfaces";
import { getDb } from "../../infrastructure/db";
import { toDateSafe } from "./documentsHelpers";

export async function listFascicoliByUser(userId: string): Promise<PastFascicolo[]> {
  const db = await getDb();
  const { collection, getDocs, query, where, orderBy, or } = await import("firebase/firestore");
  const q = query(
    collection(db, "fascicoli"), 
    or(
      where("user", "==", userId),
      where("visibleTo", "array-contains", userId)
    ),
    orderBy("updatedAt", "desc")
  );
  
  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      title: data.title || "Nuovo Fascicolo",
      createdAt: data.createdAt?.toDate().toLocaleDateString("it-IT") || new Date().toLocaleDateString("it-IT"),
      updatedAt: data.updatedAt?.toDate().toLocaleDateString("it-IT") || new Date().toLocaleDateString("it-IT"), 
      user: data.user || ""
    };
  }).sort((a, b) => {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

const fetchThreadMessages = async (
  db: Awaited<ReturnType<typeof getDb>>,
  firestore: typeof import("firebase/firestore"),
  fascicoloId: string,
  threadId: string
): Promise<Message[]> => {
  const { collection, query, getDocs, orderBy } = firestore;
  const messagesRef = collection(db, "fascicoli", fascicoloId, "threads", threadId, "messages");
  const messagesSnapshot = await getDocs(query(messagesRef, orderBy("timestamp", "asc")));

  const messages: Message[] = messagesSnapshot.docs.map(m => {
    const data = m.data();
    return {
      id: m.id,
      role: data.role || 'user',
      content: data.content || '',
      timestamp: data.timestamp,
      sources: data.sources || undefined,
      isHistorical: true
    } as Message;
  });

  messages.sort((a, b) => {
    const timeA = toDateSafe(a.timestamp).getTime();
    const timeB = toDateSafe(b.timestamp).getTime();
    if (timeA !== timeB) return timeA - timeB;
    if (a.role === 'user' && b.role === 'model') return -1;
    if (a.role === 'model' && b.role === 'user') return 1;
    return 0;
  });
  return messages;
};

export const fetchSingleThreadMessages = async (fascicoloId: string, threadId: string): Promise<Message[]> => {
  try {
    const db = await getDb();
    const firestore = await import("firebase/firestore");
    return await fetchThreadMessages(db, firestore, fascicoloId, threadId);
  } catch (error) {
    console.error("Errore nel recupero messaggi thread:", error);
    return [];
  }
};

/**
 * Carica i thread del fascicolo. Con `activeThreadId` definito (anche null = primo thread)
 * legge i messaggi solo del thread attivo; gli altri hanno `messagesLoaded: false` e vanno caricati on demand.
 */
export const fetchFascicoloData = async (
  fascicoloId: string,
  activeThreadId?: string | null
): Promise<DBThreadPayload[]> => {
  const db = await getDb();
  const firestore = await import("firebase/firestore");
  const { collection, query, getDocs, orderBy } = firestore;

  try {
    const threadsRef = collection(db, "fascicoli", fascicoloId, "threads");
    const threadsSnapshot = await getDocs(query(threadsRef, orderBy("updatedAt", "desc")));

    console.log(`\n=== 📁 LOG DB: FASCICOLO ${fascicoloId} (Ordinato per updatedAt) ===`);

    const lazy = activeThreadId !== undefined;
    const docs = threadsSnapshot.docs;
    const targetId = lazy
      ? (docs.find(d => d.id === activeThreadId) ?? docs[0])?.id
      : undefined;

    const fascicoloData = await Promise.all(docs.map(async (threadDoc): Promise<DBThreadPayload> => {
      const shouldLoad = !lazy || threadDoc.id === targetId;
      return {
        threadId: threadDoc.id,
        threadData: threadDoc.data() as DBThreadData,
        messages: shouldLoad ? await fetchThreadMessages(db, firestore, fascicoloId, threadDoc.id) : [],
        messagesLoaded: shouldLoad
      };
    }));

    fascicoloData.sort((a, b) => {
      const timeA = toDateSafe(a.threadData?.updatedAt).getTime();
      const timeB = toDateSafe(b.threadData?.updatedAt).getTime();
      return timeB - timeA;
    });

    return fascicoloData;
  } catch (error) {
    console.error("Errore nel recupero dati fascicolo:", error);
    return [];
  }
};
