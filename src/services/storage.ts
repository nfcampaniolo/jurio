import { FirebaseError } from "firebase/app";
import { getStorageClient } from "./storageClient";

export async function uploadAvatar(file: File, uid: string): Promise<string> {
  const storage = await getStorageClient();
  const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");

  const avatarRef = ref(storage, `users/${uid}/image.jpeg`);
  await uploadBytes(avatarRef, file);
  return getDownloadURL(avatarRef);
}

export async function loadSentence(
  file: File,
  uid: string,
  collectionName: string
): Promise<string> {
  const storage = await getStorageClient();
  const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");

  const pdfRef = ref(storage, `${collectionName}/${uid}.pdf`);
  await uploadBytes(pdfRef, file);
  return getDownloadURL(pdfRef);
}

export async function deleteAccountFolder(uid: string): Promise<void> {
  const storage = await getStorageClient();
  const { ref, listAll, deleteObject } = await import("firebase/storage");
  // Creiamo una piccola funzione helper per svuotare una cartella specifica
  const clearFolder = async (folderPath: string) => {
    try {
      const folderRef = ref(storage, folderPath);
      const listResult = await listAll(folderRef);
      const deletePromises = listResult.items.map((itemRef) => deleteObject(itemRef));
      await Promise.all(deletePromises);
    } catch (error) {
      // Ignoriamo o logghiamo l'errore se la cartella non esiste (es. l'utente non ha mai caricato documenti)
      console.warn(`Nessun file trovato in ${folderPath} o errore durante l'eliminazione`, error);
    }
  };
  // 1. Svuotiamo prima la sottocartella dei documenti
  await clearFolder(`users/${uid}/documents`);
  // 2. Svuotiamo la directory radice dell'utente
  await clearFolder(`users/${uid}`);
}

export async function getDocumentStorage(
  id: string,
  collectionName: string
): Promise<string | null> {
  const storage = await getStorageClient();
  const { ref, getDownloadURL } = await import("firebase/storage");
  const pdfRef = ref(storage, `${collectionName}/${id}.pdf`);
  try {
    return await getDownloadURL(pdfRef);
  } catch (e: unknown) {
    if (e instanceof FirebaseError && e.code === "storage/object-not-found") {
      return null; // file non esiste
    }
    throw e; // altri errori vanno propagati
  }
}

export async function deleteDocumentStorage(
  id: string,
  collectionName: string
): Promise<void> {
  const storage = await getStorageClient();
  const { ref, deleteObject } = await import("firebase/storage");

  const pdfRef = ref(storage, `${collectionName}/${id}.pdf`);
  try {
    await deleteObject(pdfRef);
  } catch (e: unknown) {
    if (e instanceof FirebaseError) {
      if (e.code === "storage/object-not-found") return;
      throw new Error(e.message);
    }
    throw new Error("Errore sconosciuto durante l'eliminazione del file");
  }
}

export async function getAvatar(uid: string): Promise<string> {
  const DEFAULT_AVATAR = "https://jurio-it.web.app/image.png";
  try {
    const storage = await getStorageClient();
    const { ref, getDownloadURL } = await import("firebase/storage");
    const avatarRef = ref(storage, `users/${uid}/image_1080x1080.jpeg`);
    
    return await getDownloadURL(avatarRef);
  } catch (error) {
    console.error(`Errore nel recupero dell'avatar per l'utente ${uid}:`, error);
    // 3. Fallback finale: Immagine di default
    return DEFAULT_AVATAR;
  }
}