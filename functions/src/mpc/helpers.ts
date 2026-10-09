import { getAuth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { consumePerMinuteFeature, consumeDailyFeature } from "../utils";

export interface JurioDocument {
  id?: string;
  tipo_documento?: string;
  organo_giudicante?: string;
  numero_sentenza?: string;
  data_decisione?: string;
  massima?: string;
  fattispecie_rilevante?: string;
  area?: string;
  sottocategoria?: string[];
  ecli?: string;
  urn?: string;
  [key: string]: unknown;
}

export interface DoctrineDocument {
  tipo_documento?: string;
  origine?: string;
  numero_anno?: string;
  tematica?: string;
  questione_di_diritto?: string;
  orientamento?: string;
  tipo_orientamento?: string;
  sintesi?: string;
  norme_citate?: string[];
  url_pdf?: string;
  [key: string]: unknown;
}

export interface AuthVerificationResult {
  ok: boolean;
  isError: boolean;
  text: string;
}

const ALLOWED_PLANS = new Set([
  "prova",
  "admin",
  "business",
  "personale",
  "business_m",
  "personale_m",
]);

/**
 * Verifica l'autenticazione dell'utente, la validità del piano e i limiti di frequenza (rate limiting).
 */
export async function verifyPlanAndLimits(
  authHeader: string,
  db: Firestore
): Promise<AuthVerificationResult> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      ok: false,
      isError: true,
      text: "Sessione Jurio non valida o token assente. Verifica l'autenticazione OAuth e ricollega il connettore.",
    };
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return {
      ok: false,
      isError: true,
      text: "Token di autenticazione non valido.",
    };
  }


  let uid: string | null = null;

  const tokenSnap = await db.collection("oauth_tokens").doc(token).get();

  if (tokenSnap.exists) {
    const tokenData = tokenSnap.data();
    const expiresAt = tokenData?.expiresAt;

    if (
      !tokenData?.uid ||
      !expiresAt ||
      typeof expiresAt.toDate !== "function" ||
      expiresAt.toDate() <= new Date()
    ) {
      return {
        ok: false,
        isError: true,
        text: "Token OAuth non valido o scaduto. Ricollega il connettore Jurio.",
      };
    }

    uid = String(tokenData.uid);
  } else {
    // Compatibilità con richieste autenticate mediante Firebase ID token.
    try {
      const decodedToken = await getAuth().verifyIdToken(token);
      uid = decodedToken.uid;
    } catch {
      return {
        ok: false,
        isError: true,
        text: "Token di autenticazione non valido o scaduto.",
      };
    }
  }

  if (!uid) {
    return {
      ok: false,
      isError: true,
      text: "Accesso negato: impossibile identificare l'utente.",
    };
  }

  const limits = { perMinute: 20, perDay: 200 };

  try {
    const [userSnap] = await Promise.all([
      db.collection("register").doc(uid).get(),
      consumePerMinuteFeature(uid, "research" as unknown as Parameters<typeof consumePerMinuteFeature>[1], limits.perMinute),
      consumeDailyFeature(uid, "research" as unknown as Parameters<typeof consumeDailyFeature>[1], limits.perDay),
    ]);

    if (!userSnap.exists) {
      return {
        ok: false,
        isError: true,
        text: "Errore: Account utente non trovato nel registro Jurio.",
      };
    }

    const planId = String(userSnap.data()?.planId ?? "");

    if (!ALLOWED_PLANS.has(planId)) {
      return {
        ok: false,
        isError: false,
        text: "Accesso non consentito: nessun piano attivo rilevato. Per utilizzare gli strumenti di ricerca giuridica di Jurio tramite MCP è necessario un abbonamento. Attiva o rinnova il tuo piano su: https://jurio.it/prezzi",
      };
    }

    return { ok: true, isError: false, text: "Autorizzato" };
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    if (
      errMessage.toLowerCase().includes("limit") ||
      errMessage.toLowerCase().includes("quota") ||
      (typeof error === "object" && error !== null && "status" in error && (error as { status?: number }).status === 429)
    ) {
      return {
        ok: false,
        isError: false,
        text: "Hai raggiunto il limite massimo di ricerche (orario o giornaliero) consentito dal tuo piano. Riprova più tardi.",
      };
    }
    throw error;
  }
}

export function formatDocument(doc: JurioDocument): string {
  const lines: string[] = [];
  lines.push(
    `DOCUMENTO: ${doc.tipo_documento ?? ""} ${doc.organo_giudicante ?? ""}, N. ${doc.numero_sentenza ?? ""}`
  );
  if (doc.data_decisione) lines.push(`DATA: ${doc.data_decisione}`);
  if (doc.massima?.trim()) lines.push(`MASSIMA: ${doc.massima.trim()}`);
  if (doc.fattispecie_rilevante?.trim()) lines.push(`FATTISPECIE: ${doc.fattispecie_rilevante.trim()}`);
  if (doc.id) {
    lines.push(`URL: https://jurio.it/giurisprudenza/${doc.id.trim()}`);
  }
  return lines.join("\n");
}

export function formatDoctrineDocument(doc: DoctrineDocument): string {
  const lines: string[] = [];
  lines.push(`FONTE: ${doc.tipo_documento ?? "Documento di Dottrina"} - ${doc.origine ?? "Sconosciuta"}`);
  if (doc.numero_anno) lines.push(`RIF: ${doc.numero_anno}`);
  if (doc.tematica?.trim()) lines.push(`TEMATICA: ${doc.tematica.trim()}`);
  if (doc.questione_di_diritto?.trim()) lines.push(`QUESTIONE: ${doc.questione_di_diritto.trim()}`);
  if (doc.orientamento?.trim()) lines.push(`ORIENTAMENTO (${doc.tipo_orientamento ?? "N/A"}): ${doc.orientamento.trim()}`);
  if (doc.sintesi?.trim()) lines.push(`SINTESI: ${doc.sintesi.trim()}`);
  if (doc.norme_citate && Array.isArray(doc.norme_citate) && doc.norme_citate.length > 0) {
    lines.push(`NORME CITATE: ${doc.norme_citate.join(", ")}`);
  }
  if (doc.url_pdf) {
    lines.push(`URL DOCUMENTO ORIGINALE: ${doc.url_pdf.trim()}`);
  }
  return lines.join("\n");
}

export async function findByNumeroSentenzaAdmin(
  identificativo: string,
  db: Firestore
): Promise<JurioDocument[]> {
  const cleanId = identificativo.trim();
  const match = cleanId.match(/(\d+)\/(\d+)/);
  let variazioniNumero: string[] = [];

  if (match) {
    const numeroBase = parseInt(match[1], 10);
    const anno = match[2];
    const combinazioni = new Set<string>();
    combinazioni.add(`${numeroBase}/${anno}`);
    combinazioni.add(`${String(numeroBase).padStart(2, "0")}/${anno}`);
    combinazioni.add(`${String(numeroBase).padStart(3, "0")}/${anno}`);
    combinazioni.add(`${String(numeroBase).padStart(4, "0")}/${anno}`);
    combinazioni.add(`${String(numeroBase).padStart(5, "0")}/${anno}`);
    combinazioni.add(match[0]);
    variazioniNumero = Array.from(combinazioni);
  }

  const sentencesRef = db.collection("sentences");
  const promises = [];

  if (variazioniNumero.length > 0) {
    promises.push(sentencesRef.where("numero_sentenza", "in", variazioniNumero).get());
  } else {
    promises.push(Promise.resolve({ empty: true, docs: [] }));
  }

  promises.push(sentencesRef.where("ecli", "==", cleanId).get());
  promises.push(sentencesRef.where("urn", "==", cleanId).get());

  const [snapNumero, snapEcli, snapUrn] = await Promise.all(promises);

  const uniqueDocs = new Map<string, JurioDocument>();

  [...snapNumero.docs, ...snapEcli.docs, ...snapUrn.docs].forEach((d) => {
    uniqueDocs.set(d.id, { id: d.id, ...d.data() } as JurioDocument);
  });

  return Array.from(uniqueDocs.values());
}

export async function findBySottocategoriaAdmin(
  termine: string,
  max: number,
  db: Firestore
): Promise<JurioDocument[]> {
  const original = termine.trim();
  const lower = original.toLowerCase();
  if (!lower) return [];

  const sentencesRef = db.collection("sentences");
  const [snapArea, snapSotto] = await Promise.all([
    sentencesRef.where("area", "==", original).limit(max).get(),
    sentencesRef.where("sottocategoria", "array-contains", lower).limit(max).get(),
  ]);

  const uniqueDocs = new Map<string, JurioDocument>();
  snapArea.docs.forEach((d) => uniqueDocs.set(d.id, { id: d.id, ...d.data() } as JurioDocument));
  snapSotto.docs.forEach((d) => uniqueDocs.set(d.id, { id: d.id, ...d.data() } as JurioDocument));

  return Array.from(uniqueDocs.values()).slice(0, max);
}