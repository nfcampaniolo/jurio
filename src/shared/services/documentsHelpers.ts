import type {
  DocumentoGiurisprudenziale,
  Sentenza,
  Ordinanza,
  Decreto,
  DocumentoGiurisprudenzaGenerico,
} from "@/interfaces/interfaces";

export type TipoDocumento =
  | "sentenza"
  | "ordinanza"
  | "decreto"
  | "documento_giurisprudenza_generico";

export type WithRiferimenti = {
  riferimenti_normativi?: string[] | string;
  riferimenti_normativi_key?: string[];
};

export type RawGiuris = Record<string, unknown> & {
  createdAt?: unknown;
  tipo_documento?: unknown;
};

export function normalizeTipoDocumento(v: unknown): TipoDocumento {
  if (
    v === "sentenza" ||
    v === "ordinanza" ||
    v === "decreto" ||
    v === "documento_giurisprudenza_generico"
  ) {
    return v;
  }
  return "documento_giurisprudenza_generico";
}

export function toDateSafe(value: unknown): Date {
  if (value && typeof value === "object" && "toDate" in value) {
    const maybe = value as { toDate?: unknown };
    if (typeof maybe.toDate === "function") {
      try {
        const d = (maybe.toDate as () => Date)();
        if (d instanceof Date && !Number.isNaN(d.getTime())) return d;
      } catch {
        // ignore
      }
    }
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (typeof value === "number") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date(0);
}

export function _mapFirestoreDocToMassima(
  id: string,
  data: Record<string, unknown>
): DocumentoGiurisprudenziale {
  const raw = data as RawGiuris;
  const createdAt = toDateSafe(raw.createdAt);
  const tipo_documento = normalizeTipoDocumento(raw.tipo_documento);
  const fascicoloIds = raw.fascicoloIds as string[] | undefined;
  const base = {
    id,
    ...(raw as Omit<
      DocumentoGiurisprudenziale,
      "id" | "createdAt" | "tipo_documento"
    >),
    createdAt,
    tipo_documento,
    fascicoloIds,
  };

  switch (tipo_documento) {
    case "sentenza":
      return base as Sentenza;
    case "ordinanza":
      return base as Ordinanza;
    case "decreto":
      return base as Decreto;
    default:
      return base as DocumentoGiurisprudenzaGenerico;
  }
}

export function buildNumeroSentenza(data: DocumentoGiurisprudenziale): string {
  const numero = data.numero_sentenza?.trim() || "";
  if (!numero || numero.includes("/")) return numero;

  const anno = (data.data_sentenza?.trim() || "").split("-")[0];
  return anno && anno.length === 4 ? `${numero}/${anno}` : numero;
}

export function parseSezioneUrn(sezione?: string): string {
  if (!sezione) return "sez";
  const s = sezione.toUpperCase();

  if (s.includes("SEZIONI UNITE")) return "unite";
  if (s.includes("PLENARIA")) return "adunanza.plenaria";

  const mapping: Record<string, string> = {
    PRIMA: "1", SECONDA: "2", TERZA: "3", QUARTA: "4",
    QUINTA: "5", SESTA: "6", SETTIMA: "7",
    VII: "7", VI: "6", III: "3", IV: "4", II: "2", V: "5",
  };

  for (const [key, val] of Object.entries(mapping)) {
    if (s.includes(key)) return val;
  }

  const match = s.match(/\d+/);
  return match ? match[0] : "sez";
}

export function normalizeUpperSpaces(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function normalizeNumeroSentenzaFirstPart(raw?: string | number): string {
  if (raw == null) return "";
  return String(raw).trim().split("/")[0].trim();
}

export function buildUrnFromMassima(data: DocumentoGiurisprudenziale): string {
  const organoRaw = normalizeUpperSpaces(data.organo_giudicante ?? "");
  const organoUpper = organoRaw.toUpperCase();
  const tipo = data.tipo_documento?.toLowerCase();
  const tipiValidi = ["sentenza", "ordinanza", "decreto"];
  const num = normalizeNumeroSentenzaFirstPart(data.numero_sentenza);
  const dataSentenza = data.data_sentenza?.split("T")[0];

  if (!tipo || !tipiValidi.includes(tipo) || !dataSentenza || !num || !organoUpper) {
    return "";
  }

  const sezId = parseSezioneUrn(data.sezione);

  if (organoUpper.includes("COSTITUZIONALE")) {
    return `urn:nir:corte.costituzionale:${tipo}:${dataSentenza};${num}`;
  }

  if (organoUpper.includes("CASSAZIONE")) {
    const materia = data.materia?.toLowerCase().includes("civile") ? "civile" : "penale";
    const sezPart = sezId === "unite" ? "sezione.unite" : `sezione.${sezId}`;
    return `urn:nir:corte.cassazione;${materia};${sezPart}:${tipo}:${dataSentenza};${num}`;
  }

  if (organoUpper.includes("CONSIGLIO DI STATO")) {
    const sezPart = sezId === "adunanza.plenaria" ? sezId : `sezione.${sezId}`;
    return `urn:nir:consiglio.di.stato:${sezPart}:${tipo}:${dataSentenza};${num}`;
  }

  return "";
}

export function lowerArrayOrString(v: unknown): string[] | string | undefined {
  if (v == null) return undefined;
  if (Array.isArray(v)) {
    const arr = v.reduce<string[]>((acc, x) => {
      const str = String(x).trim();
      if (str) acc.push(str.toLowerCase());
      return acc;
    }, []);
    return arr.length ? arr : undefined;
  }
  if (typeof v === "string") {
    const s = v.trim();
    return s ? s.toLowerCase() : undefined;
  }
  return undefined;
}