import { getDb } from "../../_deps";
import { estraiMetadatiFlow } from "./flow";
import { MessageDoc, FascicoloDoc, ExtractedMetadataItem, EstraiMetadatiResult } from "../_interfaces";
import { withPseudonymization } from "../../privacy/pseudonymization";

const db = getDb();
const MAX_CONTEXT_CHARS = 40_000;

/**
 * Estrae i metadati dal contesto e li scrive sul fascicolo.
 * Restituisce il numero di chiavi aggiornate.
 */
export async function extractAndSaveFascicoloMetadata(
  fascicoloId: string,
  chatContext: string
): Promise<number> {
  const fascicoloRef = db.collection("fascicoli").doc(fascicoloId);
  const fascicoloSnap = await fascicoloRef.get();
  if (!fascicoloSnap.exists) return 0;

  const fascicoloData = fascicoloSnap.data() as FascicoloDoc;
  const metadatiAttuali = fascicoloData.metadati || {};

  const result = (await withPseudonymization(
    { chatContext, metadatiAttuali },
    () => estraiMetadatiFlow({ chatContext, metadatiAttuali })
  )) as EstraiMetadatiResult;

  const estratti = result.dati_nuovi_o_aggiornati || [];
  if (!Array.isArray(estratti) || estratti.length === 0) return 0;

  const updatePayload: Record<string, string> = {};

  // Sanitizzazione input IA prima della scrittura DB
  estratti.forEach((item: ExtractedMetadataItem) => {
    if (typeof item.chiave === "string" && typeof item.valore === "string") {
      const safeKey = item.chiave.replace(/[^a-zA-Z0-9_]/g, "").trim().substring(0, 50);
      const safeValue = item.valore.trim().substring(0, 500);
      if (safeKey && safeValue) updatePayload[`metadati.${safeKey}`] = safeValue;
    }
  });

  const updatedKeys = Object.keys(updatePayload).length;
  if (updatedKeys === 0) return 0;

  await fascicoloRef.update(updatePayload);
  console.log(`[JURIO-METADATA] Aggiornate ${updatedKeys} chiavi`);
  return updatedKeys;
}

/**
 * Estrae i metadati da un'intera conversazione già presente nel fascicolo
 * (es. dopo la conversione di una chat): una sola chiamata invece di una per messaggio.
 */
export async function extractMetadataFromThread(
  fascicoloId: string,
  threadId: string,
  messageLimit = 100
): Promise<number> {
  const historySnap = await db.collection("fascicoli").doc(fascicoloId)
    .collection("threads").doc(threadId)
    .collection("messages")
    .orderBy("timestamp", "desc")
    .limit(messageLimit)
    .get();

  const lines = historySnap.docs
    .map((doc) => {
      const data = doc.data() as MessageDoc;
      const content = typeof data.content === "string" ? data.content.trim() : "";
      return content ? `${data.role === "model" ? "IA" : "UTENTE"}: ${content.substring(0, 1500)}` : "";
    })
    .filter(Boolean)
    .reverse();

  const chatContext = lines.join("\n\n").slice(-MAX_CONTEXT_CHARS);
  if (!chatContext) return 0;

  return extractAndSaveFascicoloMetadata(fascicoloId, chatContext);
}
