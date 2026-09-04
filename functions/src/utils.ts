import cors from "cors";
import { getAppCheck } from "firebase-admin/app-check";
import {Timestamp, FieldValue, QueryDocumentSnapshot, DocumentReference, WriteBatch } from "firebase-admin/firestore";
import { getDb, getAdminAuth} from "./deps";

const db = getDb();
const auth = getAdminAuth();

const ALLOWED_ORIGINS = [
  "https://jurio.it",
  "https://jurio-it.web.app",
  "https://jurio-it.firebaseapp.com"
];

export const corsHandlerDomain = cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, false);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Firebase-AppCheck"], 
});

export async function requireAppCheck(req: any): Promise<void> {
  // Ignora il controllo se le funzioni girano nell'emulatore locale
  if (process.env.FUNCTIONS_EMULATOR === "true") return;
  const appCheckToken = req.headers["x-firebase-appcheck"];
  if (!appCheckToken || typeof appCheckToken !== "string") {
    throw new Error("Missing App Check token");
  }
  try {
    await getAppCheck().verifyToken(appCheckToken);
  } catch (err) {
    throw new Error("Invalid App Check token");
  }
}

export async function requireUidFromAuthHeader(req: any): Promise<string> {
  const h = req.headers?.authorization;
  if (!h || typeof h !== "string" || !h.startsWith("Bearer ")) {
    throw new Error("Missing Authorization Bearer token");
  }
  const token = h.slice("Bearer ".length);
  const decoded = await auth.verifyIdToken(token);
  return decoded.uid;
}

export function fmtRome(ts: Timestamp): string {
  return ts.toDate().toLocaleString("it-IT", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "long",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function minuteKeyRome(d = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);

  const y = parts.find(p => p.type === "year")?.value ?? "1970";
  const m = parts.find(p => p.type === "month")?.value ?? "01";
  const day = parts.find(p => p.type === "day")?.value ?? "01";
  const h = parts.find(p => p.type === "hour")?.value ?? "00";
  const min = parts.find(p => p.type === "minute")?.value ?? "00";
  return `${y}-${m}-${day}T${h}:${min}`;
}

export function dayKeyRome(d = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const y = parts.find(p => p.type === "year")?.value ?? "1970";
  const m = parts.find(p => p.type === "month")?.value ?? "01";
  const day = parts.find(p => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${day}`;
}

export async function consumePerMinuteFeature(uid: string, feature: "semantic" | "web", limit: number): Promise<void> {
  // Isoliamo il contatore dei minuti unendo la chiave temporale alla feature
  const key = `${minuteKeyRome()}_${feature}`;
  const ref = db.collection("rate").doc(uid).collection("minutes").doc(key);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const prev = snap.exists ? Number(snap.data()?.count ?? 0) : 0;
    const next = prev + 1;

    if (next > limit) {
      throw Object.assign(new Error("rate_limited"), { code: "rate_limited", feature, prev });
    }

    tx.set(ref, { count: next, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
}

export async function consumeDailyFeature(uid: string, feature: "semantic" | "web", limit: number): Promise<{ remaining: number }> {
  // Isoliamo il contatore giornaliero unendo la chiave temporale alla feature
  const key = `${dayKeyRome()}_${feature}`;
  const ref = db.collection("usage").doc(uid).collection("days").doc(key);

  return await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const prev = snap.exists ? Number(snap.data()?.count ?? 0) : 0;
    const next = prev + 1;

    if (next > limit) {
      throw Object.assign(new Error("quota_exceeded"), { code: "quota_exceeded", feature, prev });
    }

    tx.set(ref, { count: next, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { remaining: limit - next };
  });
}

// ============================================================================
// VECTOR E RICERCA SEMANTICA
// ============================================================================

import * as natural from "natural";
// @ts-ignore
import stopwords from "stopwords-iso";
import { scheduleDowngradeTask } from "./tasks";

// -- UTILITY E SETUP (mantenuto intatto) --
interface KeywordStem {
  original: string;
  stem: string;
}

export const SENTENCE_MULTIPLIER = 0.95; // Boost per hit in massima/fattispecie
const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmerIt;

const getStopWords = (): string[] => {
  try { return stopwords?.it || []; } 
  catch (e) { return []; }
};

export const getKeywordStems = (text: string): KeywordStem[] => {
  const itStopWords = getStopWords();
  const tokens: string[] = tokenizer.tokenize(text.toLowerCase()) || [];
  return tokens
    .filter((word: string) => word.length > 2 && !itStopWords.includes(word) && !/^[0-9]+$/.test(word))
    .map((word: string): KeywordStem => ({ original: word, stem: stemmer.stem(word) }));
};

export const calculateMatchScore = (targetText: string, kwObjects: any[], docData?: any) => {
  if (!targetText || kwObjects.length === 0) {
    return { textMatchScore: 0, authorityBonus: 0, recencyBonus: 0 };
  }

  // Se il targetText non ha lunghezza sufficiente, skippa le tokenizzazioni pesanti
  if (targetText.length < 5) {
      return { textMatchScore: 0, authorityBonus: 0, recencyBonus: 0 };
  }

  const textTokens: string[] = tokenizer.tokenize(targetText.toLowerCase()) || [];
  if (textTokens.length === 0) {
      return { textMatchScore: 0, authorityBonus: 0, recencyBonus: 0 };
  }
  
  // N.B: Questo map() pesa sulla CPU. Se un giorno vuoi ottimizzare ulteriormente, 
  // potresti salvare gli stems direttamente in Firestore quando crei il documento.
  const textStems: string[] = textTokens.map((t: string) => stemmer.stem(t));

  const kwPositions = new Map<string, number[]>();
  let uniqueMatchesCount = 0;

  // 1. TEXT MATCHING
  kwObjects.forEach((kw) => {
    const positions: number[] = [];
    for (let i = 0; i < textTokens.length; i++) {
      if (textTokens[i] === kw.original || textStems[i] === kw.stem) {
        positions.push(i);
      }
    }
    if (positions.length > 0) {
      kwPositions.set(kw.original, positions);
      uniqueMatchesCount++;
    }
  });

  // 2. CALCOLO PROSSIMITÀ
  let proximityBonus = 0;
  if (uniqueMatchesCount > 1) {
    let minDistance = Infinity;
    const keys = Array.from(kwPositions.keys());

    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const posA = kwPositions.get(keys[i])!;
        const posB = kwPositions.get(keys[j])!;

        for (const pA of posA) {
          for (const pB of posB) {
            const dist = Math.abs(pA - pB);
            if (dist < minDistance) {
              minDistance = dist;
            }
          }
        }
      }
    }
    if (minDistance > 0 && minDistance < Infinity) {
      proximityBonus = 2 / minDistance;
    }
  }

  // 3. BOOST DEI METADATI
  let authorityBonus = 0;
  let recencyBonus = 0;

  if (docData) {
    const organo = String(docData.organo_giudicante || "").toUpperCase();
    if (organo.includes("UNITE")) {
      authorityBonus = 0.06;
    } else if (organo.includes("CASSAZIONE")) {
      authorityBonus = 0.02;
    }

    const dataString = String(docData.data_sentenza || "");
    if (dataString.length >= 4) {
      const anno = parseInt(dataString.substring(0, 4), 10);
      const currentYear = new Date().getFullYear();
      if (anno >= currentYear - 1) {
        recencyBonus = 0.03; 
      } else if (anno >= currentYear - 3) {
        recencyBonus = 0.015;
      }
    }
  }

  return { textMatchScore: uniqueMatchesCount + proximityBonus, authorityBonus, recencyBonus };
};
export function applyHighlight(text: string, keywords: string[], stems: string[] = []): string {
  if (!text) return "";
  
  const allTerms = [...new Set([...keywords, ...stems])]
    .map(t => t.trim())
    .filter(t => t.length > 3)
    .sort((a, b) => b.length - a.length);

  if (allTerms.length === 0) return text;

  const pattern = allTerms
    .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

  const regex = new RegExp(`\\b(${pattern})`, "gi");
  return text.replace(regex, "<mark>$1</mark>");
}
// 1. Questa funzione va chiamata UNA SOLA VOLTA per richiesta
export function generateHighlightRegex(keywords: string[], stems: string[] = []): RegExp | null {
  const allTerms = [...new Set([...keywords, ...stems])]
    .map(t => t.trim())
    .filter(t => t.length > 3)
    .sort((a, b) => b.length - a.length);

  if (allTerms.length === 0) return null;

  const pattern = allTerms
    .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

  return new RegExp(`\\b(${pattern})`, "gi");
}

// 2. Questa funzione viene chiamata nel ciclo map() finale sui pochi risultati restanti
export function applyHighlightWithRegex(text: string, regex: RegExp | null): string {
  if (!text) return "";
  if (!regex) return text;
  
  return text.replace(regex, "<mark>$1</mark>");
}

// ============================================================================
// PARSER RIFERIMENTI NORMATIVI
// ============================================================================

export type Source =
  | { kind: "code"; code: "cpc" | "cpp" | "cp" | "cc" | "preleggi" | "tub" | "tuf" | "tuel" | "ordpen" | "dispatt_cpc" | "dispatt_cpp"; }
  | { kind: "act"; act: "dlgs" | "dl" | "dpr" | "rd" | "l"; no: string; year?: string }
  | { kind: "eu"; eu: "reg" | "dir"; no: string; year?: string; scheme?: "ce" | "ue" | "cee" }
  | { kind: "cedu" }
  | { kind: "prot_cedu"; protNo: string }
  | { kind: "lf" }
  | { kind: "unknown"; raw: string };

const MAX_REF_INPUT = 500; 

export type Parsed = {
  source: Source;
  article?: string; 
  comma?: string;
  letter?: string;
  nnum?: string;
  par?: string;
};

export type Translation = {
  raw: string;
  normalized: string;
  parsed: Parsed;
  key: string | null;
};

export const normalizeRef = (s: string) => s.replace(/\u00A0/g, " ").replace(/[‐-‒–—]/g, "-").replace(/\s+/g, " ").trim();
const lower = (s: string) => s.toLowerCase();

export function uniqStable(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of arr) {
    const k = lower(x);
    if (!seen.has(k)) { seen.add(k); out.push(x); }
  }
  return out;
}

function firstNumberish(s: string): string | undefined {
  const m = s.match(/\d+(?:\s*-\s*\d+)?/);
  return m ? m[0].replace(/\s+/g, "") : undefined;
}

export function extractFirstArticle(text: string): string | undefined {
  const t = lower(text).slice(0, MAX_REF_INPUT);
  const m = t.match(/\b(?:art\.?|artt\.?|articolo|articoli)\s*([0-9]+(?:\s*-\s*[0-9]+)?(?:\s*(?:bis|ter|quater|quinquies|sexies|septies|octies|novies|decies|undecies|duodecies))?(?:\s*-\s*(?:bis|ter|quater|quinquies|sexies|septies|octies|novies|decies|undecies|duodecies))?(?:\s*-\s*[0-9]+)?(?:\s*-\s*[a-z]+)?(?:\s*\.\s*\d+)?)\b/);
  if (!m) return undefined;
  return normalizeRef(m[1]).replace(/\s*/g, "").replace(/\./g, ".");
}

export function extractComma(text: string): string | undefined {
  const t = lower(text).slice(0, MAX_REF_INPUT);
  const m = t.match(/\b(?:comma|commi)\b|\bco\./);
  if (!m || m.index == null) return undefined;
  let i = m.index + m[0].length;
  while (i < t.length && /\s/.test(t[i])) i++;
  let j = i;
  while (j < t.length && t[j] !== ")" && t[j] !== "," && t[j] !== ";") j++;
  return firstNumberish(t.slice(i, j));
}

export function extractLetter(text: string): string | undefined {
  const t = lower(text).slice(0, MAX_REF_INPUT);
  const m = t.match(/\b(?:lett\.?|lettera)\s*([a-z])\b/);
  return m ? m[1] : undefined;
}

export function extractNnum(text: string): string | undefined {
  const t = lower(text).slice(0, MAX_REF_INPUT);
  const m = t.match(/\bn\.?\s*(\d+)\b/);
  return m ? m[1] : undefined;
}

export function extractPar(text: string): string | undefined {
  const t = lower(text).slice(0, MAX_REF_INPUT);
  const m = t.match(/§\s*(\d+)/);
  return m ? m[1] : undefined;
}

export function detectSource(text: string): Source {
  const t = lower(text).slice(0, MAX_REF_INPUT);

  const prot = t.match(/\b(?:protocollo|prot\.)\s*n\.?\s*(\d+)\b.*\bcedu\b/);
  if (prot) return { kind: "prot_cedu", protNo: prot[1] };

  if (/\bcedu\b/.test(t) || /convenzione europea dei diritti dell['’]uomo/.test(t)) return { kind: "cedu" };

  const eu2 = t.match(/\breg\.\s*(ue|ce|cee)\s*(?:n\.?\s*)?(\d+)(?:\s*\/\s*(\d{4}))?\b/);
  if (eu2) return { kind: "eu", eu: "reg", no: eu2[2], year: eu2[3], scheme: eu2[1] as any };

  const eu1 = t.match(/\b(reg\.|regolamento|dir\.|direttiva)(?:\s*\((ue|ce|cee)\)|\s+(ue|ce|cee))?\s*(?:n\.?\s*)?(\d+)(?:\s*\/\s*(\d{4}))?\b/);
  if (eu1) return { kind: "eu", eu: eu1[1].startsWith("dir") ? "dir" : "reg", no: eu1[4], year: eu1[5], scheme: (eu1[2] ?? eu1[3]) as any };

  if (/disp\.\s*att\.\s*cod\.\s*proc\.\s*civ\./.test(t)) return { kind: "code", code: "dispatt_cpc" };
  if (/disp\.\s*att\.\s*cod\.\s*proc\.\s*pen\./.test(t)) return { kind: "code", code: "dispatt_cpp" };

  if (/\bc\.?\s*p\.?\s*c\.?\b/.test(t)) return { kind: "code", code: "cpc" };
  if (/\bc\.?\s*p\.?\s*p\.?\b/.test(t)) return { kind: "code", code: "cpp" };
  if (/\bc\.?\s*p\.?\b/.test(t)) return { kind: "code", code: "cp" };
  if (/\bc\.?\s*c\.?\b/.test(t)) return { kind: "code", code: "cc" };

  if (/cod\.\s*proc\.\s*civ\./.test(t)) return { kind: "code", code: "cpc" };
  if (/cod\.\s*proc\.\s*pen\./.test(t)) return { kind: "code", code: "cpp" };
  if (/cod\.\s*pen\./.test(t)) return { kind: "code", code: "cp" };
  if (/cod\.\s*civ\./.test(t)) return { kind: "code", code: "cc" };

  if (/\bcodice\s+di\s+procedura\s+civile\b/.test(t) || /\bcodice\s+procedura\s+civile\b/.test(t)) return { kind: "code", code: "cpc" };
  if (/\bcodice\s+di\s+procedura\s+penale\b/.test(t) || /\bcodice\s+procedura\s+penale\b/.test(t)) return { kind: "code", code: "cpp" };
  if (/\bcodice\s+penale\b/.test(t)) return { kind: "code", code: "cp" };
  if (/\bcodice\s+civile\b/.test(t)) return { kind: "code", code: "cc" };

  if (/\bpreleggi\b/.test(t)) return { kind: "code", code: "preleggi" };
  if (/\bt\.?\s*u\.?\s*b\.?\b/.test(t)) return { kind: "code", code: "tub" };
  if (/\btuf\b/.test(t)) return { kind: "code", code: "tuf" };
  if (/\btuel\b/.test(t)) return { kind: "code", code: "tuel" };
  if (/\bord\.\s*pen\./.test(t) || /\bordinamento penitenziario\b/.test(t)) return { kind: "code", code: "ordpen" };

  if (/\blegge\s+fallimentare\b/.test(t) || /\bl\.\s*fall\./.test(t)) return { kind: "lf" };

  const act = t.match(/\b(d\.?\s*lgs\.?|d\.?\s*l\.?|d\.?\s*p\.?\s*r\.?|r\.?\s*d\.?|legge|l\.)\s*(?:n\.?\s*)?(\d+)(?:\s*\/\s*(\d{4}))?\b/);
  if (act) {
    const kindRaw = act[1].replace(/\s+/g, "");
    const actType = kindRaw.startsWith("d.lgs") || kindRaw === "dlgs" ? "dlgs" : kindRaw.startsWith("d.l.") || kindRaw === "dl" ? "dl" : kindRaw.startsWith("d.p.r") || kindRaw === "dpr" ? "dpr" : kindRaw.startsWith("r.d") || kindRaw === "rd" ? "rd" : "l";
    return { kind: "act", act: actType, no: act[2], year: act[3] };
  }

  return { kind: "unknown", raw: text };
}

export function toKey(p: Parsed): string | null {
  const parts: string[] = [];
  switch (p.source.kind) {
    case "code": parts.push(p.source.code); break;
    case "act": parts.push(`${p.source.act}:${p.source.no}${p.source.year ? `:${p.source.year}` : ""}`); break;
    case "eu":
      parts.push(`eu:${p.source.eu}:${p.source.no}${p.source.year ? `:${p.source.year}` : ""}`);
      if (p.source.scheme) parts.push(p.source.scheme);
      break;
    case "cedu": parts.push("cedu"); break;
    case "prot_cedu": parts.push(`prot:${p.source.protNo}:cedu`); break;
    case "lf": parts.push("lf"); break;
    case "unknown": break;
  }

  if (p.article) parts.push(`a${p.article}`);
  if (p.par) parts.push(`p${p.par}`);
  if (p.comma) parts.push(`c${p.comma}`);
  if (p.letter) parts.push(`l${p.letter}`);

  const isNumberedAct = p.source.kind === "act" || p.source.kind === "prot_cedu" || p.source.kind === "eu";
  if (p.nnum && !isNumberedAct) parts.push(`n${p.nnum}`);

  if (parts.length === 0) return null;
  return parts.join(":");
}

export function translateRiferimento(raw: string): Translation {
  const normalized = normalizeRef(raw).slice(0, MAX_REF_INPUT);
  const source = detectSource(normalized);
  const parsed: Parsed = {
    source,
    article: extractFirstArticle(normalized),
    comma: extractComma(normalized),
    letter: extractLetter(normalized),
    nnum: extractNnum(normalized),
    par: extractPar(normalized),
  };
  return { raw, normalized, parsed, key: toKey(parsed) };
}

export function makeRiferimentiNormativiKeys(input: unknown): string[] {
  const refs: string[] = [];
  if (Array.isArray(input)) {
    for (const x of input) if (typeof x === "string") refs.push(x);
  } else if (typeof input === "string") {
    refs.push(input);
  } else {
    return [];
  }
  const keys: string[] = [];
  for (const r of refs) {
    const t = translateRiferimento(r);
    if (t.key) keys.push(t.key);
  }
  return uniqStable(keys);
}


// ============================================================================
// SUPPORT ADMIN (URN/ECLI E TASK BATCH)
// ============================================================================

export interface SentenceDoc {
  ecli?: string;
  urn?: string;
  organo_giudicante?: string;
  materia?: string;
  sezione?: string;
  tipo_documento?: "sentenza" | "ordinanza" | "decreto";
  tipo_ordinanza?: string;
  tipo_decreto?: string;
  data_sentenza?: string;
  numero_sentenza?: string | number;
  sottocategoria?: unknown;
  createdAt?: Timestamp; // Corretto usando l'import di Firestore
  fonte?: string;
  logo_fonte?: string;
}

const STOPWORDS_ADMIN = new Set([
  "SUPREMA", "DEL", "DAL", "DELLA", "DELLO", "DEI", "DEGLI", "DELLE",
  "DI", "DA", "AL", "ALLA", "ALLE", "AGLI", "AI", "A", "IL", "LO",
  "LA", "I", "GLI", "LE",
]);

export function normalizeUpperSpaces(s: string): string {
  return s.replaceAll(/\s+/g, " ").trim();
}

export function tokenizeOrgano(s: string): string {
  return s.split(" ")
    .filter((t) => t.length >= 3 && !STOPWORDS_ADMIN.has(t.toUpperCase()))
    .slice(0, 4).map((t) => t.toLowerCase()).join(".");
}

export const parseSezione = (sezione?: string): string => {
  if (!sezione) return "sez";
  const s = sezione.toUpperCase();
  if (s.includes("SEZIONI UNITE")) return "unite";
  const mapping: Record<string, string> = {
    "PRIMA": "1", "SECONDA": "2", "TERZA": "3", "QUARTA": "4", 
    "QUINTA": "5", "SESTA": "6", "SETTIMA": "7", "FERIALE":"feriale",
    "II": "2", "III": "3", "IV": "4", "V": "5", "VI": "6", "VII": "7","PLENARIA":"adunanza.plenaria"
  };
  for (const [key, val] of Object.entries(mapping)) {
    if (s.includes(key)) return val;
  }
  return s.includes("PLENARIA") ? "adunanza.plenaria" : "sez";
};

export function buildNumeroSentenza(data: SentenceDoc): string {
  const numero = data.numero_sentenza?.toString().trim() || "";
  if (!numero || numero.includes('/')) return numero;
  const anno = (data.data_sentenza?.trim() || "").split('-')[0];
  return (anno && anno.length === 4) ? `${numero}/${anno}` : numero;
}

export const generateUrn = (data: SentenceDoc): string => {
  const organoRaw = normalizeUpperSpaces(data.organo_giudicante ?? "");
  const organoUpper = organoRaw.toUpperCase();
  const tipo = data.tipo_documento?.toLowerCase();
  const tipiValidi = ["sentenza", "ordinanza", "decreto"];
  const num = data.numero_sentenza?.toString().trim().split("/")[0].trim();
  const dataSentenza = data.data_sentenza?.split("T")[0];

  if (!tipo || !tipiValidi.includes(tipo) || !dataSentenza || !num || !organoUpper) return "";

  const sezId = parseSezione(data.sezione);

  if (organoUpper.includes("COSTITUZIONALE")) return `urn:nir:corte.costituzionale:${tipo}:${dataSentenza};${num}`;
  if (organoUpper.includes("CASSAZIONE")) {
    const mat = data.materia?.toLowerCase().includes("civile") ? "civile" : "penale";
    const sezPart = sezId === "unite" ? "sezione.unite" : `sezione.${sezId}`;
    return `urn:nir:corte.cassazione;${mat};${sezPart}:${tipo}:${dataSentenza};${num}`;
  }
  if (organoUpper.includes("CONSIGLIO DI STATO")) {
    const sezPart = sezId === "adunanza.plenaria" ? sezId : `sezione.${sezId}`;
    return `urn:nir:consiglio.di.stato:${sezPart}:${tipo}:${dataSentenza};${num}`;
  }
  return ""; 
};

export function buildAuthorityCodeECLIFromOrgano(raw?: string): string {
  const s = normalizeUpperSpaces(raw ?? "");
  const upperS = s.toUpperCase();
  if (upperS.includes("CASSAZIONE")) return "CASS";
  if (upperS.includes("COSTITUZIONALE")) return "COST";
  if (upperS.includes("CONSIGLIO DI STATO")) return "CDS";
  if (upperS.includes("CONTI")) return "CCONT"; 
  if (upperS.includes("TRIBUNALE AMMINISTRATIVO") || /\bTAR\b/.test(upperS)) return "TAR";
  if (upperS.includes("APPELLO")) return "CAPP"; 
  if (upperS.includes("TRIBUNALE")) return "TRIB";
  if (upperS.includes("GIUDICE DI PACE")) return "GDP";
  return tokenizeOrgano(s);
}

export function getNumSentenzaECLI(numeroNormalizzato: string): string {
  if (!numeroNormalizzato) return "";
  const parts = numeroNormalizzato.split('/');
  if (parts.length !== 2) return "";
  const parsedNum = parseInt(parts[0].trim(), 10);
  if (Number.isNaN(parsedNum)) return "";
  return `${parts[1].trim()}:${parsedNum}`;
}

export function getEcliSuffix(data: SentenceDoc, authority: string): string | null {
  const tipo = data.tipo_documento?.toLowerCase();
  const materia = data.materia?.toLocaleLowerCase();
  if (authority === "CDS") {
    if (tipo === "sentenza") return "SENT";
    if (tipo === "ordinanza") return (data.tipo_ordinanza?.toLowerCase() || "").includes("cautelare") ? "OCAU" : "OCOL";
    if (tipo === "decreto") return (data.tipo_decreto?.toLowerCase() || "").includes("cautelare") ? "DCAU" : "DCOL";
    return null;
  } else if(authority === "CASS"){
    if (materia === "civile") return "CIV";
    if (materia === "penale") return "PEN";
  }
  return ""; 
}

export function generateEcli(data: SentenceDoc): string {
  const authority = buildAuthorityCodeECLIFromOrgano(data.organo_giudicante);
  if (!authority) return "";
  const num = getNumSentenzaECLI(buildNumeroSentenza(data)); 
  if (!num) return "";
  const suffix = getEcliSuffix(data, authority);
  if (suffix === null) return ""; 
  return `ECLI:IT:${authority}:${num}${suffix}`;
}

type ProgressCallback = (message: string, progressData: any) => void;

export async function runCleanupDuplicates(onProgress: ProgressCallback): Promise<{ deletedCount: number }> {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const midnightTs = Timestamp.fromDate(midnight);
  
  const QUERY_PAGE_SIZE = 200; 
  let deletedCount = 0;
  let pageCount = 0;
  let lastDoc: QueryDocumentSnapshot | null = null;

  // Memoria per tenere traccia di quelli già visti in questa sessione
  const seenUrns = new Set<string>();
  const seenEclis = new Set<string>();

  onProgress("Avvio pulizia duplicati (BulkWriter)...", { step: 2, action: "start" });

  const bulkWriter = db.bulkWriter();
  bulkWriter.onWriteError((error) => {
    console.error(`[BulkWriter Error] Errore eliminazione ${error.documentRef.path}:`, error.message);
    return false; 
  });

  while (true) {
    let query = db.collection("sentences")
      .where("createdAt", ">", midnightTs)
      .orderBy("createdAt", "asc")
      .limit(QUERY_PAGE_SIZE);
      
    if (lastDoc) query = query.startAfter(lastDoc);

    const snap = await query.get();
    if (snap.empty) break;
    pageCount++;

    snap.docs.forEach((d) => {
      const docData = d.data() as any;
      const urn = docData.urn ? String(docData.urn).trim() : "";
      const ecli = docData.ecli ? String(docData.ecli).trim() : "";

      // Se sono entrambi vuoti, lo ignoriamo (non lo consideriamo duplicato)
      if (urn === "" && ecli === "") {
        return; 
      }

      // Se abbiamo già visto l'URN o l'ECLI, è un duplicato! Coda per eliminazione
      if ((urn !== "" && seenUrns.has(urn)) || (ecli !== "" && seenEclis.has(ecli))) {
        bulkWriter.delete(d.ref);
        deletedCount++;
      } else {
        // Altrimenti, è il documento "originale", lo salviamo nella memoria
        if (urn !== "") seenUrns.add(urn);
        if (ecli !== "") seenEclis.add(ecli);
      }
    });

    lastDoc = snap.docs[snap.docs.length - 1];

    onProgress(`Scansionata pagina #${pageCount} (Pulizia)`, { 
      step: 2, 
      pagesScanned: pageCount, 
      queuedDeletionsSoFar: deletedCount 
    });

    if (snap.size < QUERY_PAGE_SIZE) break; 
  }
  
  // Attendiamo che svuoti tutta la coda di eliminazioni
  await bulkWriter.close();
  
  onProgress("Pulizia duplicati completata.", { step: 2, action: "done", totalDeleted: deletedCount });
  return { deletedCount };
}

const normalizeMeta = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
export function extractSubcats(raw: unknown): string[] { 
  if (!raw) return [];
  if (typeof raw === "string") { const v = normalizeMeta(raw); return v ? [v] : []; }
  if (Array.isArray(raw)) return raw.filter(x => typeof x === "string").map(normalizeMeta).filter(Boolean);
  return []; 
}

export function mergeUniqueMetadata(a: string[], b: string[]): string[] {
  return Array.from(new Set([...a.map(normalizeMeta), ...b.map(normalizeMeta)])).sort();
}

export async function runUpdateFonte(params: any, onProgress: ProgressCallback): Promise<{ updatedSentences: number; }> {
  const { newFonte, newFonteLogo, materia, sezione, organo_giudicante } = params;
  const baseUpdateData: Record<string, string> = {}; 
  if (newFonte?.trim()) baseUpdateData.fonte = newFonte.trim();
  if (newFonteLogo?.trim()) baseUpdateData.logo_fonte = newFonteLogo.trim();
  if (materia?.trim()) baseUpdateData.materia = materia.trim();
  if (sezione?.trim()) baseUpdateData.sezione = sezione.trim();
  if (organo_giudicante?.trim()) baseUpdateData.organo_giudicante = organo_giudicante.trim();

  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const midnightTs = Timestamp.fromDate(midnight);
  
  // Utilizzato solo per la paginazione della query di lettura
  const QUERY_PAGE_SIZE = 200; 
  let updatedCount = 0;
  let pageCount = 0;
  let lastDoc: QueryDocumentSnapshot | null = null;

  onProgress("Avvio aggiornamento Fonte e URN/ECLI...", { step: 1, action: "start" });

  // 1. Inizializziamo il BulkWriter invece del Batch classico
  const bulkWriter = db.bulkWriter();

  // Opzionale: Gestione degli errori sui singoli documenti per evitare il blocco totale
  bulkWriter.onWriteError((error) => {
    console.error(`[BulkWriter Error] Errore sul documento ${error.documentRef.path}:`, error.message);
    return false; // Ritorna false per NON riprovare l'operazione se fallisce a livello di regole/validazione
  });

  while (true) {
    let query = db.collection("sentences")
      .where("createdAt", ">", midnightTs)
      .orderBy("createdAt", "asc")
      .limit(QUERY_PAGE_SIZE);
      
    if (lastDoc) query = query.startAfter(lastDoc);

    const snap = await query.get();
    if (snap.empty) break;
    pageCount++;

    snap.docs.forEach((d) => {
      const docData = d.data() as SentenceDoc;
      const docUpdateData: Record<string, string> = { ...baseUpdateData };
      let needsUpdate = Object.keys(docUpdateData).length > 0;
      const mergedData = { ...docData, ...docUpdateData };

      const newUrn = generateUrn(mergedData);
      if (docData.urn !== newUrn) { docUpdateData.urn = newUrn; needsUpdate = true; }

      const newEcli = generateEcli(mergedData); 
      if (!docData.ecli || !docData.ecli.startsWith("ECLI:")) {
        if (newEcli) { docUpdateData.ecli = newEcli; needsUpdate = true; }
      }
      
      if (needsUpdate) {
        // 2. Inviamo l'operazione al bulkWriter.
        // Pensa a questo come a una coda: bulkWriter accumula e invia pacchetti ottimizzati a Firestore.
        bulkWriter.update(d.ref, docUpdateData);
        updatedCount++;
      }
    });

    lastDoc = snap.docs[snap.docs.length - 1];

    // Aggiorna il progresso basandosi sui blocchi letti e messi in coda
    onProgress(`Scansionata pagina #${pageCount}`, { 
      step: 1, 
      pagesScanned: pageCount, 
      queuedUpdatesSoFar: updatedCount 
    });

    if (snap.size < QUERY_PAGE_SIZE) break; 
  }
  
  // 3. CRUCIALE: Attendiamo che il bulkWriter svuoti la coda e completi i flussi verso il server
  await bulkWriter.close();
  
  onProgress("Aggiornamento Fonte completato.", { step: 1, action: "done", totalUpdated: updatedCount });
  return { updatedSentences: updatedCount };
}

export async function runUpdateMetadata(onProgress: ProgressCallback): Promise<any> {
  onProgress("Avvio aggiornamento Metadati (Taxonomy e Magistrati)...", { step: 2, action: "start" });

  const taxonomyRef = db.collection("meta").doc("taxonomy");
  const magistrateRef = db.collection("meta").doc("magistrate");

  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const midnightTs = Timestamp.fromDate(midnight);

  const QUERY_PAGE_SIZE = 200;
  let lastDoc: QueryDocumentSnapshot | null = null;
  
  // USIAMO DELLE MAPPE: chiave = nome, valore = conteggio occorrenze di OGGI
  const foundSubcats = new Map<string, number>();
  const foundPresidenti = new Map<string, number>();
  const foundRelatori = new Map<string, number>();
  
  let scanned = 0;
  let pageCount = 0;

  while (true) {
    let query = db.collection("sentences")
      .where("createdAt", ">", midnightTs)
      .orderBy("createdAt", "asc")
      .limit(QUERY_PAGE_SIZE);
      
    if (lastDoc) query = query.startAfter(lastDoc);

    const snap = await query.get();
    if (snap.empty) break;

    pageCount++;
    for (const d of snap.docs) {
      scanned++;
      const data = d.data();
      
      // Estraiamo e incrementiamo il contatore GIORNALIERO nella Map
      extractSubcats(data.sottocategoria).forEach(s => {
        const currentCount = foundSubcats.get(s) || 0;
        foundSubcats.set(s, currentCount + 1);
      });
      
      if (typeof data.presidente === 'string' && data.presidente.trim()) {
        const p = data.presidente.trim();
        foundPresidenti.set(p, (foundPresidenti.get(p) || 0) + 1);
      }
      if (typeof data.relatore === 'string' && data.relatore.trim()) {
        const r = data.relatore.trim();
        foundRelatori.set(r, (foundRelatori.get(r) || 0) + 1);
      }
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    
    onProgress(`Scansione sentenze in corso: lette ${scanned} (Pagina #${pageCount})`, { 
      step: 2, 
      scannedSoFar: scanned, 
      pagesScanned: pageCount 
    });
    
    if (snap.size < QUERY_PAGE_SIZE) break;
  }

  onProgress("Verifica e Salvataggio metadati e contatori...", { step: 2, action: "saving" });

  // Funzione helper aggiornata per gestire Set (Creazione) e Update (Incremento)
  async function saveNewMetadata(parentRef: DocumentReference, subcollectionName: string, fieldName: string, values: Map<string, number>) {
    const subcollRef = parentRef.collection(subcollectionName);
    let addedCount = 0;
    let updatedCount = 0;
    
    let batch = db.batch();
    let batchWrites = 0;

    for (const [value, countOfToday] of values.entries()) {
      // Controlla se il valore esiste già
      const existing = await subcollRef.where(fieldName, '==', value).limit(1).get();
      
      if (existing.empty) {
        // NON ESISTE: Creiamo il nuovo documento impostando il contatore iniziale
        const newDocRef = subcollRef.doc();
        batch.set(newDocRef, { 
          [fieldName]: value, 
          sentences: countOfToday // Imposta il contatore
        });
        addedCount++;
      } else {
        // ESISTE: Incrementiamo il contatore esistente
        batch.update(existing.docs[0].ref, { 
          sentences: FieldValue.increment(countOfToday) 
        });
        updatedCount++;
      }

      batchWrites++;

      // Rispettiamo il limite di 500 scritture per batch
      if (batchWrites === 500) {
        await batch.commit();
        batch = db.batch();
        batchWrites = 0;
      }
    }
    
    if (batchWrites > 0) {
      await batch.commit();
    }
    
    return { added: addedCount, updated: updatedCount };
  }

  const timestamp = FieldValue.serverTimestamp();

  // Eseguiamo i salvataggi
  const [resSubcats, resPres, resRel] = await Promise.all([
    saveNewMetadata(taxonomyRef, "sottocategorie", "nome", foundSubcats),
    saveNewMetadata(magistrateRef, "presidenti", "nome", foundPresidenti),
    saveNewMetadata(magistrateRef, "relatori", "nome", foundRelatori),
  ]);

  await Promise.all([
    taxonomyRef.set({ lastScanAt: timestamp }, { merge: true }),
    magistrateRef.set({ lastScanAt: timestamp }, { merge: true })
  ]);

  onProgress(
    `Aggiornamento completato. Categorie: ${resSubcats.added} nuove, ${resSubcats.updated} aggiornate. ` +
    `Presidenti: ${resPres.added} nuovi, ${resPres.updated} aggiornati. ` +
    `Relatori: ${resRel.added} nuovi, ${resRel.updated} aggiornati.`, 
    { step: 2, action: "done", totalScanned: scanned }
  );
  
  return { 
    scanned, 
    newSubcats: resSubcats.added, 
    newPres: resPres.added, 
    newRel: resRel.added 
  };
}

async function addFascicoloIdToDocAndChunks(
  docId: string,
  fascicoloId: string
): Promise<void> {
  const batch = db.batch();
  // 1. Referenza al documento principale
  const docRef = db.collection('documents').doc(docId);
  // Utilizziamo arrayUnion per appendere l'id all'array 'fascicoloIds'
  batch.update(docRef, { 
    fascicoloIds: FieldValue.arrayUnion(fascicoloId) 
  });
  // 2. Query per trovare i chunk correlati
  const chunksSnapshot = await db.collection('document_chunks')
    .where('parentId', '==', docId)
    .get();
  // 3. Aggiunta dell'ID all'array di ciascun chunk nel batch
  chunksSnapshot.forEach((chunkDoc) => {
    batch.update(chunkDoc.ref, { 
      fascicoloIds: FieldValue.arrayUnion(fascicoloId) 
    });
  });
  // 4. Commit atomico
  await batch.commit();
}

export async function processFascicoloDocs(
  fascicoloId: string,
  docs: string[],  
): Promise<void> {
  if (!fascicoloId || !Array.isArray(docs) || docs.length === 0) {
    console.log("Processo annullato: Fascicolo mancante o nessun documento fornito.");
    return;
  }
  try {
    const updatePromises = docs.map((doc) => {
      const docId = typeof doc === 'string' ? doc : doc;
      return addFascicoloIdToDocAndChunks(docId, fascicoloId);
    });
    await Promise.all(updatePromises);
    console.log(`[Successo] FascicoloId ${fascicoloId} associato a ${docs.length} documenti e relativi chunks.`);
  } catch (error) {
    console.error("Errore durante l'esecuzione di processFascicoloDocs:", error);
    throw error;
  }
}

// GESTIONE TEAM

function generateVoucherCode(): string {
  return 'VCH-' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function handleTeamCreationInTx(
  tx: any, 
  db: any, 
  uid: string, 
  planId: string, 
  expireSec: number, 
  now: any
): Promise<{ finalUserStatus: string; needsTask: boolean }> {
  
  // 1. Se non è un piano team, ritorna subito
  if (!planId.startsWith("team")) {
    return { finalUserStatus: planId, needsTask: true };
  }

  // 2. LETTURA: Controlla lo status attuale dell'utente
  const userRef = db.collection("users").doc(uid);
  const userSnap = await tx.get(userRef);
  const currentStatus = userSnap.data()?.status;

  // 3. LETTURA: Cerca se l'utente è già owner di un team esistente
  const teamsQuery = db.collection("teams")
    .where("owners", "array-contains", uid)
    .limit(1); // Ne basta 1 (presumiamo che un utente abbia un solo team principale)
  const teamQuerySnap = await tx.get(teamsQuery);

  // 4. Calcola quanti voucher emettere
  const numStr = planId.replace("team", "");
  let totalVouchers = parseInt(numStr, 10) || 3;
  let vouchersToIssue = totalVouchers;
  
  let needsTask = false;

  // Se l'utente non è già "business", consuma un voucher per il suo account e attiva il task
  if (currentStatus !== "business") {
    vouchersToIssue -= 1;
    needsTask = true; 
  }

  // Genera l'array con i nuovi voucher
  const newVouchers = Array.from({ length: vouchersToIssue }).map(() => ({
    id: generateVoucherCode(),
    duration: 365,
    used: false
  }));

  // Calcola la scadenza come oggetto Timestamp
  const expireTimestamp = now.constructor.fromMillis(expireSec * 1000);

  // 5. SCRITTURE: Logica condizionale (Crea nuovo vs Aggiorna esistente)
  if (teamQuerySnap.empty) {
    
    // --- CASO A: NESSUN TEAM ESISTENTE -> CREA NUOVO ---
    const teamRef = db.collection("teams").doc();
    tx.set(teamRef, {
      name: "Il mio Workspace",
      owners: [uid],
      member_ids: [uid],
      visibility_default: "private",
      vouchers: newVouchers,
      createdAt: now
    });

    tx.set(teamRef.collection("members").doc(uid), {
      role: "owner",
      date_start: now,
      expire: expireTimestamp
    });

  } else {
    
    // --- CASO B: TEAM ESISTENTE -> AGGIUNGI VOUCHER E AGGIORNA SCADENZA ---
    const existingTeamDoc = teamQuerySnap.docs[0];
    const teamRef = existingTeamDoc.ref;
    const teamData = existingTeamDoc.data();
    
    // Recupera i voucher vecchi (se non ci sono, usa array vuoto)
    const existingVouchers = teamData.vouchers || [];
    
    // Unisci i voucher vecchi con quelli appena generati
    tx.update(teamRef, {
      vouchers: [...existingVouchers, ...newVouchers]
    });

    // OPZIONALE MA CONSIGLIATO: Aggiorna la scadenza dell'owner nella sotto-collezione
    const memberRef = teamRef.collection("members").doc(uid);
    tx.set(memberRef, {
      expire: expireTimestamp
    }, { merge: true }); // Usiamo merge per non sovrascrivere data_start e role
  }

  return { finalUserStatus: "business", needsTask };
}

export async function processSubscriptionInTx(
  tx: any,
  db: any,
  uid: string,
  purchasedPlanId: string,
  providerData: Record<string, any>,
  amountTotal: number | null // <--- NUOVO PARAMETRO per il valore dell'acquisto
): Promise<{ expireSec: number; needsTask: boolean }> {
  
  // 1. Leggi durata piano e calcola il paidValue direttamente qui dentro
  const planSnap = await tx.get(db.collection("plans").doc(purchasedPlanId));
  const planData = planSnap.data();
  const durationDays = planData?.durationDays ?? (purchasedPlanId.endsWith("_m") ? 30 : 365);
  
  // Calcolo del valore pagato (ammontare Stripe / 100 o prezzo del piano)
  const paidValue = typeof amountTotal === "number" 
    ? amountTotal / 100 
    : (typeof planData?.price === "number" ? planData.price : 0);

  // 2. Calcola date
  const now = Timestamp.now();
  const expire = Timestamp.fromMillis(now.toMillis() + durationDays * 24 * 60 * 60 * 1000);
  const expireSec = Math.floor(expire.toMillis() / 1000);

  // 3. Esegui logica Team/Business
  const { finalUserStatus, needsTask } = await handleTeamCreationInTx(tx, db, uid, purchasedPlanId, expireSec, now);

  // ---> ESEGUIAMO LA FUNZIONE DI PULIZIA COUPON <---
  const hasCouponToClear = await processCouponInTx(tx, db, uid, paidValue);

  // 4. Prepara i dati per Register
  const registerUpdateData: any = {
    planId: finalUserStatus, 
    status: "active",
    ...providerData,
    start: now,
    expire,
    expireSec,
    update: now,
  };

  // Se il coupon è stato processato, aggiungiamo il comando per eliminarlo da register
  if (hasCouponToClear) {
    registerUpdateData.coupon = FieldValue.delete();
  }

  // Scrivi Register (eseguirà sia update dei campi che delete del coupon in un unico passaggio atomico)
  tx.set(db.collection("register").doc(uid), registerUpdateData, { merge: true });

  // 5. Aggiorna utente
  tx.set(db.collection("users").doc(uid), { status: finalUserStatus }, { merge: true });

  return { expireSec, needsTask };
}

export async function processCouponInTx(
  tx: any,
  db: any,
  uid: string,
  paidValue: number
): Promise<boolean> {
  const registerRef = db.collection("register").doc(uid);
  const registerSnap = await tx.get(registerRef);

  if (!registerSnap.exists) return false;

  const registerData = registerSnap.data();
  const coupon = registerData?.coupon;

  // Se c'è una mappa coupon con una proprietà 'name'
  if (coupon && typeof coupon === "object" && coupon.name) {
    const couponName = coupon.name;

    // Crea la reference alla subcollection: discount/{couponName}/userby/{uid}
    const discountUserRef = db
      .collection("discount")
      .doc(couponName)
      .collection("userby")
      .doc(uid);

    // Scrive il documento nella subcollection (aggiungendo merge: true per sicurezza se c'è già)
    tx.set(
      discountUserRef,
      {
        uid: uid,
        paidValue: paidValue,
        purchasedAt: Timestamp.now(),
      },
      { merge: true }
    );

    return true; // Segnala che dobbiamo eliminare il campo da register
  }

  return false;
}

// --- HELPER: Schedulazione Task ---
export async function tryScheduleDowngradeTask(uid: string, expireSec: number) {
  await scheduleDowngradeTask({
    projectId: "jurio-it",
    location: "europe-west1",
    queue: "subscription-expire",
    targetUrl: "https://europe-west1-jurio-it.cloudfunctions.net/tasksDowngrade",
    serviceAccountEmail: "130993418358-compute@developer.gserviceaccount.com",
    uid,
    expireSec,
  });
}

export async function removeUserVisibilityFromDocuments(uidDelete: string) {
  const collectionsToUpdate = ["fascicoli", "documents", "document_chunks"];
  
  for (const collectionName of collectionsToUpdate) {
    const snapshot = await db.collection(collectionName)
      .where("visibleTo", "array-contains", uidDelete)
      .get();

    if (snapshot.empty) continue;

    // Split array into chunks of 500 (Firestore max batch size)
    const batches: WriteBatch[] = [];
    let currentBatch = db.batch();
    let operationCount = 0;

    snapshot.docs.forEach((doc) => {
      currentBatch.update(doc.ref, {
        visibleTo: FieldValue.arrayRemove(uidDelete)
      });
      operationCount++;

      if (operationCount === 500) {
        batches.push(currentBatch);
        currentBatch = db.batch();
        operationCount = 0;
      }
    });

    if (operationCount > 0) {
      batches.push(currentBatch);
    }

    // Esegue tutti i batch per la collection corrente
    await Promise.all(batches.map(batch => batch.commit()));
  }
}

export async function updateUserDocuments(uidDelete: string, uidOwner: string) {
  const collectionsToUpdate = ["fascicoli", "documents", "document_chunks"];
  
  for (const collectionName of collectionsToUpdate) {
    // Seleziona dinamicamente il campo da interrogare in base alla collection
    const fieldToQuery = collectionName === "fascicoli" ? "ownerId" : "user";

    const snapshot = await db.collection(collectionName)
      .where(fieldToQuery, "==", uidDelete)
      .get();

    if (snapshot.empty) continue;

    const batches: WriteBatch[] = [];
    let currentBatch = db.batch();
    let operationCount = 0;

    snapshot.docs.forEach((doc) => {
      // Aggiorna solo i campi di proprietà senza toccare nient'altro
      currentBatch.update(doc.ref, {
        user: uidOwner,
        ownerId: uidOwner
      });
      
      operationCount++;

      // Gestione partizionamento batch (limite 500)
      if (operationCount === 500) {
        batches.push(currentBatch);
        currentBatch = db.batch();
        operationCount = 0;
      }
    });

    if (operationCount > 0) {
      batches.push(currentBatch);
    }

    // Esegue tutti i batch per la collection corrente in parallelo
    await Promise.all(batches.map(batch => batch.commit()));
  }
}