import { ResearchSource } from "./_schema";

/* ============================================================
   UTILITY
============================================================ */

export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: unknown, max: number): string {
  const text = normalizeText(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function stableId(prefix: string, value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }
  return `${prefix}_${(hash >>> 0).toString(16)}`;
}

export function normalizeArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map(normalizeText)
        .filter(Boolean)
    )
  );
}

export function normalizePrecedenti(
  value: unknown
): Array<{
  numero: string;
  anno: number | null;
  sezione?: string;
}> {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const raw = item as Record<string, unknown>;
      const numero = normalizeText(raw.numero);
      if (!numero) return null;

      const anno =
        typeof raw.anno === "number" && Number.isFinite(raw.anno)
          ? raw.anno
          : null;

      const sezione = normalizeText(raw.sezione);

      return {
        numero,
        anno,
        ...(sezione ? { sezione } : {}),
      };
    })
    .filter(
      (
        item
      ): item is {
        numero: string;
        anno: number | null;
        sezione?: string;
      } => item !== null
    );
}

/* ============================================================
   ESTRAZIONE OUTPUT DEI TOOL
============================================================ */

export function extractToolOutputs(messages: any[]): any[] {
  const outputs: any[] = [];
  for (const message of messages ?? []) {
    if (!Array.isArray(message?.content)) {
      continue;
    }
    for (const part of message.content) {
      const output = part?.toolResponse?.output;
      if (output !== undefined) {
        outputs.push(output);
      }
    }
  }
  return outputs;
}

/* ============================================================
   ESTRAZIONE FONTI REALI
============================================================ */

export function extractResearchSources(messages: any[]): ResearchSource[] {
  const outputs = extractToolOutputs(messages);
  const registry = new Map<string, ResearchSource>();

  for (const output of outputs) {
    const items = Array.isArray(output) ? output : [output];

    for (const item of items) {
      if (!item || typeof item !== "object" || item.error || item.messaggio) {
        continue;
      }

      if (
        typeof item._type === "string" &&
        item._type.startsWith("giurisprudenza_") &&
        typeof item.id === "string"
      ) {
        const sourceId = item.id;
        registry.set(`internal:${sourceId}`, {
          nodeId: stableId("prov", sourceId),
          sourceId,
          source: "internal",
          kind: "provvedimento",
          label: (item.caseNumber ?? item.numero_sentenza)
            ? `Sentenza ${item.caseNumber ?? item.numero_sentenza}`
            : "Provvedimento",
          url: typeof item.sourceUrl === "string" ? item.sourceUrl : null,
          metadata: {
            numero_sentenza: item.caseNumber ?? item.numero_sentenza ?? "",
            organo_giudicante: item.court ?? item.organo_giudicante ?? "",
            massima: truncate(item.summary ?? item.legalPrinciple, 1200),
            type: item._type,
          },
          normeCitate: normalizeArray(
            item.norme_citate ?? item.riferimenti_normativi_key
          ),
          precedentiCitati: normalizePrecedenti(item.precedenti_citati),
        });
        continue;
      }

      if (
        item._type === "web_search" &&
        item.sourceType === "doctrine" &&
        typeof item.id === "string"
      ) {
        const sourceId = item.id;
        const url =
          typeof item.sourceUrl === "string"
            ? item.sourceUrl
            : typeof item.link === "string"
            ? item.link
            : null;

        registry.set(`doctrine:${sourceId}`, {
          nodeId: stableId("doctrine", sourceId),
          sourceId,
          source: "doctrine",
          kind: "dottrina",
          label:
            normalizeText(item.title) ||
            normalizeText(item.titolo) ||
            normalizeText(item.tematica) ||
            "Documento Doctrine",
          url,
          metadata: {
            materia: item.subject ?? item.materia ?? "",
            tipo_orientamento: item.guidanceType ?? item.tipo_orientamento ?? "",
            data_documento: item.documentDate ?? item.data_documento ?? "",
            pagine: item.pages ?? item.pagine ?? "",
            contenuto: truncate(item.content ?? item.summary, 1500),
          },
          normeCitate: normalizeArray(item.citedNorms ?? item.norme_citate),
          precedentiCitati: normalizePrecedenti(
            item.citedPrecedents ?? item.precedenti_citati
          ),
        });
        continue;
      }

      if (item._type === "web_search") {
        const url =
          typeof item.link === "string"
            ? item.link
            : typeof item.url === "string"
            ? item.url
            : null;

        if (!url) {
          continue;
        }

        registry.set(`web:${url}`, {
          nodeId: stableId("web", url),
          sourceId: url,
          source: "web",
          kind: "web",
          label: normalizeText(item.title ?? item.titolo) || url,
          url,
          metadata: {
            fonte: item.source ?? item.fonte ?? "",
            contenuto: truncate(item.content ?? item.summary, 1800),
          },
          normeCitate: [],
          precedentiCitati: [],
        });
        continue;
      }

      if (item._type === "document_summary" && typeof item.documentId === "string") {
        const registryKey = `document:${item.documentId}`;
        const existing = registry.get(registryKey);
        const riassunto = truncate(item.summary, 2000);
        const questioni = truncate(item.legalIssues, 1500);
        if (existing) {
          existing.metadata.riassunto = riassunto;
          existing.metadata.questioniGiuridiche = questioni;
          if (item.fileName) existing.label = normalizeText(item.fileName);
        } else {
          registry.set(registryKey, {
            nodeId: stableId("document", item.documentId),
            sourceId: item.documentId,
            source: "document",
            kind: "documento",
            label: normalizeText(item.fileName) || "Documento utente",
            url: null,
            metadata: { riassunto, questioniGiuridiche: questioni, estratti: [] },
            normeCitate: [],
            precedentiCitati: [],
          });
        }
        continue;
      }

      if (item._type === "document_chunk") {
        const docId =
          typeof (item.documentId ?? item.documento_id) === "string" &&
          String(item.documentId ?? item.documento_id).trim().length > 0
            ? String(item.documentId ?? item.documento_id).trim()
            : typeof item.id === "string"
            ? item.id
            : null;

        if (!docId) {
          continue;
        }

        const registryKey = `document:${docId}`;
        const existing = registry.get(registryKey);

        const nuovoEstratto = {
          chunkId: item.id ?? "",
          testo: item.paragraphText ?? item.testo_paragrafo ?? "",
          posizione: item.originalPosition ?? item.posizione_originale ?? 0,
          score: item._score ?? 0,
        };

        if (existing) {
          const estrattiEsistenti = existing.metadata.estratti || [];
          const giaPresente = estrattiEsistenti.some(
            (e: any) => e.chunkId === nuovoEstratto.chunkId
          );

          if (!giaPresente) {
            existing.metadata.estratti = [...estrattiEsistenti, nuovoEstratto];
          }
        } else {
          registry.set(registryKey, {
            nodeId: stableId("document", docId),
            sourceId: docId,
            source: "document",
            kind: "documento",
            label:
              normalizeText(item.fileName ?? item.nome_file) ||
              "Documento utente",
            url: null,
            metadata: {
              posizione: item.originalPosition ?? item.posizione_originale ?? 0,
              estratti: [nuovoEstratto],
            },
            normeCitate: [],
            precedentiCitati: [],
          });
        }
      }
    }
  }

  return Array.from(registry.values());
}

export function extractKnownSourceIds(
  conceptMap: any,
  mappaDialettica: any
): string[] {
  const mapIds = Array.isArray(conceptMap?.sourceIds)
    ? conceptMap.sourceIds
    : [];

  const favIds = Array.isArray(mappaDialettica?.orientamentoFavorevole?.fonti)
    ? mappaDialettica.orientamentoFavorevole.fonti.map(
        (source: { id?: unknown }) =>
          typeof source.id === "string" ? source.id : null
      )
    : [];

  const contIds = Array.isArray(mappaDialettica?.orientamentoContrario?.fonti)
    ? mappaDialettica.orientamentoContrario.fonti.map(
        (source: { id?: unknown }) =>
          typeof source.id === "string" ? source.id : null
      )
    : [];

  return Array.from(
    new Set(
      [...mapIds, ...favIds, ...contIds].filter(
        (id): id is string => typeof id === "string"
      )
    )
  );
}

/* ============================================================
   SOURCE SANITIZATION FOR SYNTHESIS
============================================================ */

export const isUrl = (val: string) => {
  try {
    const u = new URL(val);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

export const validaFonti = (
  fonti: any[],
  knownSources: { nodeId: string; sourceId: string; kind?: string; label?: string; url?: string | null }[] = []
) => {
  if (!Array.isArray(fonti)) return [];
  const nodeToSource = new Map(
    knownSources.map((source) => [source.nodeId, source.sourceId])
  );
  const fontiValide = [];
  for (const item of fonti) {
    if (!item || !item.id || !item.fonte) continue;
    const rawId = String(item.id).trim();
    // Il modello può restituire l'id del nodo della mappa (prov_xxx) invece dell'id reale del provvedimento
    const id = nodeToSource.get(rawId) ?? rawId;
    const validUrl = isUrl(id);
    
    if (item.fonte === "web" && !validUrl) {
      console.warn(`[Validazione] Scartata fonte web non valida: ${id}`);
      continue;
    }
    if (item.fonte === "interna" && validUrl) {
      console.warn("[Validazione] Scartata fonte interna non valida (era URL)");
      continue;
    }
    // Preserva escluso, nuova e qualsiasi altro campo passato nel payload
    const known = knownSources.find((source) => source.sourceId === id) as
      | { kind?: string; label?: string; url?: string | null }
      | undefined;
    const tipo = item.fonte === "web" ? "web" : known?.kind;
    fontiValide.push({
      ...item,
      id,
      ...(tipo ? { tipoFonte: tipo } : {}),
      ...(known?.label && item.fonte !== "web" ? { titolo: known.label } : {}),
      ...(known?.url && item.fonte !== "web" ? { url: known.url } : {}),
    });
  }
  return fontiValide;
};
