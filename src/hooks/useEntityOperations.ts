import { useCallback } from "react";
import { toast } from "react-hot-toast";
import type { DocumentReference, DocumentData, UpdateData } from "firebase/firestore";
import { deleteDocument, renameDocument } from "@/services/document";
import { deleteDocumentStorage } from "@/services/storage";
import { trackEvent } from "@/services/analytics";
import type { AttachedDocument, PastChat, PastFascicolo } from "@/interfaces/interfaces";
import { getDb } from "@/services/db";

export interface EntityOperationsProps {
  archiveDocs: AttachedDocument[];
  setPastFascicoli: React.Dispatch<React.SetStateAction<PastFascicolo[]>>;
  setPastChats: React.Dispatch<React.SetStateAction<PastChat[]>>;
  setThreads: React.Dispatch<React.SetStateAction<{id: string, title: string, createdAt: Date}[]>>;
  setArchiveDocs: React.Dispatch<React.SetStateAction<AttachedDocument[]>>;
}
type BatchOperation = 
  | { type: 'update'; ref: DocumentReference<DocumentData>; data: UpdateData<DocumentData>; }
  | { type: 'delete'; ref: DocumentReference<DocumentData>; };

export const useEntityOperations = ({
  archiveDocs, setPastFascicoli, setPastChats, setThreads, setArchiveDocs
}: EntityOperationsProps) => {

  const renameFascicolo = async (id: string, newTitle: string) => {
    try {
      const [{ doc, updateDoc, serverTimestamp }, { getDb }] = await Promise.all([
        import("firebase/firestore"), import("@/services/db")
      ]);
      const db = await getDb();
      const fascicoloRef = doc(db, "fascicoli", id);
      await updateDoc(fascicoloRef, { title: newTitle, updatedAt: serverTimestamp() });
      setPastFascicoli((prev) => prev.map((f) => f.id === id ? { ...f, title: newTitle, updatedAt: new Date() } : f));
    } catch (error) {
      console.error("Errore durante la rinomina del fascicolo:", error);
      toast.error("Errore durante la rinomina del fascicolo.");
    }
  };

  const renameChat = async (id: string, newTitle: string) => {
    try {
      const [{ doc, updateDoc, serverTimestamp }, { getDb }] = await Promise.all([
        import("firebase/firestore"), import("@/services/db")
      ]);
      const db = await getDb();
      const chatRef = doc(db, "chats", id);
      await updateDoc(chatRef, { title: newTitle, updatedAt: serverTimestamp() });
      setPastChats((prev) => prev.map((c) => c.id === id ? { ...c, title: newTitle, updatedAt: new Date() } : c));
    } catch (error) {
      console.error("Errore durante la rinomina della chat:", error);
      toast.error("Errore durante la rinomina della chat.");
    }
  };

  const deleteFascicolo = async (id: string) => {
    try {
      const { getCurrentUserId } = await import("@/services/security");
      const userId = await getCurrentUserId();
      if (!userId) { toast.error("Utente non autenticato."); return; }
      
      const { collection, query, where, getDocs, doc, writeBatch, arrayRemove } = await import("firebase/firestore");
      const db = await getDb();
      const operations: BatchOperation[] = [];

      const documentsQuery = query(collection(db, "documents"), where("fascicoloIds", "array-contains", id), where("user", "==", userId));
      const documentsSnapshot = await getDocs(documentsQuery);
      documentsSnapshot.forEach((docSnap) => operations.push({ type: "update", ref: docSnap.ref, data: { fascicoloIds: arrayRemove(id) } }));

      const chunksQuery = query(collection(db, "document_chunks"), where("fascicoloIds", "array-contains", id), where("user", "==", userId));
      const chunksSnapshot = await getDocs(chunksQuery);
      chunksSnapshot.forEach((docSnap) => operations.push({ type: "update", ref: docSnap.ref, data: { fascicoloIds: arrayRemove(id) } }));

      const threadsSnapshot = await getDocs(collection(db, "fascicoli", id, "threads"));
      const threadOperations = await Promise.all(threadsSnapshot.docs.map(async (threadDoc) => {
        const threadOps: BatchOperation[] = [{ type: "delete", ref: threadDoc.ref }];
        const messagesSnapshot = await getDocs(collection(db, "fascicoli", id, "threads", threadDoc.id, "messages"));
        messagesSnapshot.forEach((messageDoc) => threadOps.push({ type: "delete", ref: messageDoc.ref }));
        return threadOps;
      }));
      threadOperations.forEach(ops => operations.push(...ops));

      operations.push({ type: "delete", ref: doc(db, "fascicoli", id) });

      const BATCH_SIZE = 400;
      for (let i = 0; i < operations.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = operations.slice(i, i + BATCH_SIZE);
        for (const operation of chunk) {
          if (operation.type === "update") batch.update(operation.ref, operation.data);
          else batch.delete(operation.ref);
        }
        await batch.commit();
      }
      setPastFascicoli((prev) => prev.filter((f) => f.id !== id));
      toast.success("Fascicolo eliminato correttamente.");
    } catch (error) {
      console.error("Errore eliminazione fascicolo:", error);
      toast.error("Errore durante l'eliminazione del fascicolo.");
    }
  };

  const deleteChat = async (id: string) => {
    try {
      const { collection, getDocs, doc, writeBatch } = await import("firebase/firestore");
      const db = await getDb();
      const refsToDelete: DocumentReference[] = [];
      const messagesSnapshot = await getDocs(collection(db, "chats", id, "messages"));
      messagesSnapshot.forEach((messageDoc) => refsToDelete.push(messageDoc.ref));
      refsToDelete.push(doc(db, "chats", id));

      const BATCH_SIZE = 400;
      for (let i = 0; i < refsToDelete.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        refsToDelete.slice(i, i + BATCH_SIZE).forEach(ref => batch.delete(ref));
        await batch.commit();
      }
      setPastChats((prev) => prev.filter((c) => c.id !== id));
      toast.success("Chat e messaggi eliminati.");
    } catch (error) {
      console.error("Errore eliminazione chat:", error);
      toast.error("Errore durante l'eliminazione della chat.");
    }
  };

  const deleteThread = async (fascicoloId: string, threadId: string) => {
    try {
      const { collection, getDocs, doc, writeBatch } = await import("firebase/firestore");
      const db = await getDb();
      const batch = writeBatch(db);
      const messagesSnapshot = await getDocs(collection(db, "fascicoli", fascicoloId, "threads", threadId, "messages"));
      messagesSnapshot.forEach((messageDoc) => batch.delete(messageDoc.ref));
      batch.delete(doc(db, "fascicoli", fascicoloId, "threads", threadId));
      await batch.commit();
      setThreads((prev) => prev.filter((t) => t.id !== threadId));
      toast.success("Conversazione eliminata con successo.");
    } catch (error) {
      console.error("Errore eliminazione thread:", error);
      toast.error("Errore durante l'eliminazione della conversazione.");
    }
  };

  const handleToggleFascicoloLink = async (docItem: AttachedDocument, fascicoloId: string, isLinking: boolean) => {
    const previousDocs = [...archiveDocs];
    try {
      const [{ doc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, writeBatch }, { getCurrentUserId }] = await Promise.all([
        import("firebase/firestore"), import("@/services/security")
      ]);
      const db = await getDb();
      const userId = await getCurrentUserId();
      
      setArchiveDocs(prev => prev.map(d => d.id === docItem.id ? {
        ...d, fascicoloIds: isLinking ? [...(d.fascicoloIds || []), fascicoloId] : (d.fascicoloIds || []).filter(id => id !== fascicoloId)
      } : d));

      const arrayOperation = isLinking ? arrayUnion(fascicoloId) : arrayRemove(fascicoloId);
      await updateDoc(doc(db, "documents", docItem.id), { fascicoloIds: arrayOperation });

      const chunksQuery = query(collection(db, "document_chunks"), where("user", "==", userId), where("parentId", "==", docItem.id));
      const querySnapshot = await getDocs(chunksQuery);
      if (!querySnapshot.empty) {
        const batch = writeBatch(db);
        querySnapshot.forEach((chunkDoc) => batch.update(chunkDoc.ref, { fascicoloIds: arrayOperation }));
        await batch.commit();
      }
      toast.success(isLinking ? "Documento copiato nel fascicolo." : "Documento rimosso dal fascicolo.");
    } catch (error) {
      console.error("Errore trasferimento documento:", error);
      setArchiveDocs(previousDocs);
      toast.error("Errore durante lo spostamento.");
    }
  };

  const handleDeleteDocumento = useCallback(async (id: string) => {
    try {
      setArchiveDocs(prev => prev.filter(doc => doc.id !== id));
      const { getCurrentUserId } = await import("@/services/security");
      const userId = await getCurrentUserId();
      await deleteDocument("documents", id);
      await deleteDocumentStorage(id, `users/${userId}/documents`);
      trackEvent("document_deleted", {});
      toast.success("Documento eliminato");
    } catch (err) {
      console.error("Errore eliminazione:", err);
      toast.error("Errore eliminazione documento");
    }
  }, [setArchiveDocs]);

  const handleRenameDocumento = useCallback(async (id: string, name: string) => {
    try {
      setArchiveDocs(prev => prev.map(doc => doc.id === id ? { ...doc, name } : doc));
      await renameDocument(id, name);
      toast.success("Documento rinominato");
    } catch (err) {
      console.error("Errore rinomina:", err);
      toast.error("Errore rinomina documento");
    }
  }, [setArchiveDocs]);

  return { renameFascicolo, renameChat, deleteChat, deleteFascicolo, deleteThread, handleToggleFascicoloLink, handleDeleteDocumento, handleRenameDocumento };
};