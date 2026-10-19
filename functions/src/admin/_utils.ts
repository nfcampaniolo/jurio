import { SentenceDoc } from "./_interfaces";

function normalizeUpperSpaces(s: string): string {
  return s.replaceAll(/\s+/g, " ").trim();
}

const parseSezione = (sezione?: string): string => {
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

const STOPWORDS_ADMIN = new Set([
  "SUPREMA", "DEL", "DAL", "DELLA", "DELLO", "DEI", "DEGLI", "DELLE",
  "DI", "DA", "AL", "ALLA", "ALLE", "AGLI", "AI", "A", "IL", "LO",
  "LA", "I", "GLI", "LE",
]);

function tokenizeOrgano(s: string): string {
  return s.split(" ")
    .filter((t) => t.length >= 3 && !STOPWORDS_ADMIN.has(t.toUpperCase()))
    .slice(0, 4).map((t) => t.toLowerCase()).join(".");
}

function buildAuthorityCodeECLIFromOrgano(raw?: string): string {
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

function buildNumeroSentenza(data: SentenceDoc): string {
  const numero = data.numero_sentenza?.toString().trim() || "";
  if (!numero || numero.includes('/')) return numero;
  const anno = (data.data_sentenza?.trim() || "").split('-')[0];
  return (anno && anno.length === 4) ? `${numero}/${anno}` : numero;
}

function getNumSentenzaECLI(numeroNormalizzato: string): string {
  if (!numeroNormalizzato) return "";
  const parts = numeroNormalizzato.split('/');
  if (parts.length !== 2) return "";
  const parsedNum = parseInt(parts[0].trim(), 10);
  if (Number.isNaN(parsedNum)) return "";
  return `${parts[1].trim()}:${parsedNum}`;
}

function getEcliSuffix(data: SentenceDoc, authority: string): string | null {
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

const normalizeMeta = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
export function extractSubcats(raw: unknown): string[] { 
  if (!raw) return [];
  if (typeof raw === "string") { const v = normalizeMeta(raw); return v ? [v] : []; }
  if (Array.isArray(raw)) return raw.filter(x => typeof x === "string").map(normalizeMeta).filter(Boolean);
  return []; 
}