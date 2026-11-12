import { z } from "zod";
import { ai, CFG } from "../_config";
import { isSafeHttpUrl, normalizeQuery } from "./_utils";
import { getDb } from "../../_deps";
import { logSafeError } from "../../_logging";
import { validateUserPlanAndLimits } from "../../_utils";
import { extractPdfTextFromStorage } from "../../support/pdfText";

const db = getDb();
const DOC_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

/** Accetta un ID documento o un URL Jurio del tipo .../giurisprudenza/<id>. */
export function resolveSentenceId(value: unknown): string | null {
  const raw = normalizeQuery(value);
  if (!raw) return null;
  const fromUrl = raw.match(/\/giurisprudenza\/([a-zA-Z0-9_-]+)/);
  const candidate = fromUrl ? fromUrl[1] : raw;
  return DOC_ID_PATTERN.test(candidate) ? candidate : null;
}

async function findSentenceByIdentifier(
  identifier: string
): Promise<FirebaseFirestore.DocumentSnapshot | null> {
  const match = identifier.match(/\d+\s*\/\s*\d{4}/);
  const numero = match ? match[0].replace(/\s+/g, "") : identifier;
  const sentencesRef = db.collection("sentences");

  for (const [field, value] of [
    ["numero_sentenza", numero],
    ["ecli", identifier],
    ["urn", identifier],
  ] as const) {
    const snap = await sentencesRef.where(field, "==", value).limit(1).get();
    if (!snap.empty) return snap.docs[0];
  }
  return null;
}

export const readFullText = ai.defineTool(
  {
    name: "readFullText",
    description:
      "Reads the FULL TEXT (testo integrale) of an Italian court decision stored on Jurio. " +
      "Use it when the user asks to read, analyse or quote the complete text, the reasoning (motivazione), " +
      "the facts or the operative part (dispositivo) of a specific decision, and the summary/massima is not enough. " +
      "Pass in 'identifier' the internal id (e.g. from previous search results), the Jurio URL " +
      "(.../giurisprudenza/<id>), the sentence number (e.g. '12345/2023'), the ECLI or the URN.",
    inputSchema: z.object({
      identifier: z
        .string()
        .min(1)
        .max(500)
        .describe("Internal id, Jurio URL, sentence number (e.g. '12345/2023'), ECLI or URN of the decision."),
    }),
    outputSchema: z.any(),
  },
  async (input, { context }) => {
    try {
      const userId = context?.userId;
      if (!userId) {
        return { error: "Autenticazione mancante." };
      }

      const identifier = normalizeQuery(input.identifier);
      const documentId = resolveSentenceId(identifier);

      if (!identifier) {
        return {
          message:
            "Per leggere il testo integrale è necessario indicare l'identificativo del provvedimento o il suo numero.",
        };
      }

      let snap: FirebaseFirestore.DocumentSnapshot | null = null;
      if (documentId) {
        const byId = await db.collection("sentences").doc(documentId).get();
        snap = byId.exists ? byId : null;
      }
      if (!snap && !/\/giurisprudenza\//.test(identifier)) {
        snap = await findSentenceByIdentifier(identifier);
      }

      if (!snap) {
        return {
          message: `Nessun provvedimento trovato nel database interno per "${identifier}".`,
        };
      }

      await validateUserPlanAndLimits(userId, "extract_document");

      const { text, pages } = await extractPdfTextFromStorage(`sentences/${snap.id}.pdf`);
      const data = snap.data() ?? {};
      const maxChars = CFG.maxChars.fullText;
      const truncated = text.length > maxChars;

      return {
        id: snap.id,
        caseNumber: data.numero_sentenza ?? "",
        court: data.organo_giudicante ?? "",
        sezione: data.sezione ?? "",
        dataSentenza: data.dataSentenza ?? null,
        ecli: data.ecli ?? "",
        urn: data.urn ?? "",
        sourceUrl: isSafeHttpUrl(data.sourceUrl) ? data.sourceUrl : null,
        pages,
        truncated,
        fullText: truncated
          ? `${text.slice(0, maxChars)}\n\n[... testo troncato: mostrati ${maxChars} caratteri su ${text.length} ...]`
          : text,
        _distance: 0,
        _score: 1,
        _type: "giurisprudenza_puntuale",
        sourceType: "case_law",
      };
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "FILE_NOT_FOUND") {
        return { message: "Il testo integrale di questo provvedimento non è disponibile." };
      }
      if (code === "FILE_TOO_LARGE") {
        return { message: "Il documento è troppo grande per essere letto integralmente." };
      }
      if (code === "TOO_MANY_REQUESTS") {
        return { error: "Limite di utilizzo per la lettura dei testi integrali superato. Riprova più tardi." };
      }
      if (code === "FORBIDDEN") {
        return { error: "Il piano attuale non consente la lettura dei testi integrali." };
      }
      logSafeError("READ_FULL_TEXT_FAILED", error);
      return { error: "Errore temporaneo durante la lettura del testo integrale." };
    }
  }
);
