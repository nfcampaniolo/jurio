import { firebaseApp } from "./firebase";

export async function getStorageClient() {
  const { getStorage } = await import("firebase/storage");
  return getStorage(firebaseApp);
}