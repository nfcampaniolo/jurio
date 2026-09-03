import type { PastFascicolo, DBThreadPayload, DBThreadData, Message } from "@/interfaces/interfaces";
import { getDb } from "../../infrastructure/db";
import { toDateSafe } from "./documentsHelpers";

export async function listFascicoliByUser(userId: string): Promise<PastFascicolo[]> {
  const db = await getDb();
  const { collection, getDocs, query, where, orderBy, or } = await import("firebase/firestore");
  const q = query(
    collection(db, "fascicoli"), 
    or(
      where("ownerId", "==", userId),
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
      ownerId: data.ownerId || ""
    };
  }).sort((a, b) => {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export const fetchFascicoloData = async (fascicoloId: string): Promise<DBThreadPayload[]> => {
  const db = await getDb();
  const { collection, query, getDocs, orderBy } = await import("firebase/firestore");
  
  try {
    const threadsRef = collection(db, "fascicoli", fascicoloId, "threads");
    const q = query(threadsRef, orderBy("updatedAt", "desc"));
    const threadsSnapshot = await getDocs(q);
    
    const fascicoloData: DBThreadPayload[] = [];

    console.log(`\n=== 📁 LOG DB: FASCICOLO ${fascicoloId} (Ordinato per updatedAt) ===`);
    console.log(`Percorso base: fascicoli/${fascicoloId}/threads`);
    
    for (const threadDoc of threadsSnapshot.docs) {
      const threadId = threadDoc.id;
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
      
      const threadData = threadDoc.data() as DBThreadData;
      
      fascicoloData.push({
        threadId,
        threadData,
        messages
      });

      console.log(`\n↳ 🧵 Thread: ${threadId} | Aggiornato il:`, toDateSafe(threadData.updatedAt).toLocaleString("it-IT"));
      console.log(`  Messaggi nel thread:`, messages.length);
    }
    
    fascicoloData.sort((a, b) => {
      const timeA = toDateSafe(a.threadData?.updatedAt).getTime();
      const timeB = toDateSafe(b.threadData?.updatedAt).getTime();
      return timeB - timeA; 
    });

    console.log("====================================\n");

    return fascicoloData;
  } catch (error) {
    console.error("Errore nel recupero dati fascicolo:", error);
    return [];
  }
};