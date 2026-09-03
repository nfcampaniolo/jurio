import type { PastChat, Message } from "@/interfaces/interfaces";
import { getDb } from "../../infrastructure/db";

export async function listChatsByUser(userId: string): Promise<PastChat[]> {
  const db = await getDb();
  const { collection, getDocs, query, where, orderBy } = await import("firebase/firestore");

  const q = query(
    collection(db, "chats"), 
    where("ownerId", "==", userId),
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
    };
  }).sort((a, b) => {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export const fetchChatMessages = async (chatId: string): Promise<Message[]> => {
    const db = await getDb();
    const { collection, query, getDocs, orderBy } = await import("firebase/firestore");
    
  try {
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    const snapshot = await getDocs(q);
    
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Message[];

    console.log(`\n=== 🗂️ LOG DB: CHAT ${chatId} ===`);
    console.log(`Percorso: chats/${chatId}/messages`);
    console.log("Messaggi trovati:", messages.length);
    console.table(messages.map(m => ({ id: m.id, mittente: m.role, testo: m.content?.substring(0, 30) + '...' })));
    console.log("====================================\n");

    return messages;
  } catch (error) {
    console.error("Errore nel recupero messaggi chat:", error);
    return [];
  }
};