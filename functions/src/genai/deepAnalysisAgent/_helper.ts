import { ConceptMapSchema, ConceptMapNodeSchema, ConceptMapEdgeSchema, ResearchSource } from "./_schema";
import { z } from 'genkit';
import { stableId, normalizeText } from "./_utils";
/* ============================================================
   CONCEPT MAP
============================================================ */

export function buildConceptMap(args: {
  prompt: string;
  sources: ResearchSource[];
  mappaDialettica: any;
}): z.infer<typeof ConceptMapSchema> {
  const { prompt, sources, mappaDialettica } = args;

  const nodes = new Map<string, z.infer<typeof ConceptMapNodeSchema>>();
  const edges = new Map<string, z.infer<typeof ConceptMapEdgeSchema>>();

  const rootId = stableId("question", prompt);

  nodes.set(rootId, {
    id: rootId,
    kind: "quesito",
    source: "system",
    sourceId: null,
    label: prompt,
    resolved: true,
    used: true,
  });

  const sourceNodeById = new Map<string, string>();

  for (const source of sources) {
    nodes.set(source.nodeId, {
      id: source.nodeId,
      kind: source.kind,
      source: source.source,
      sourceId: source.sourceId,
      label: source.label,
      url: source.url,
      resolved: true,
      used: true,
      metadata: source.metadata,
    });

    sourceNodeById.set(source.sourceId, source.nodeId);
    addConceptEdge(edges, source.nodeId, rootId, "rilevante_per");
  }

  const knownPrecedents = new Map<string, ResearchSource>();
  for (const source of sources) {
    if (source.kind !== "provvedimento" || !source.metadata?.numero_sentenza) {
      continue;
    }
    const key = normalizeText(source.metadata.numero_sentenza);
    knownPrecedents.set(key, source);
  }

  for (const source of sources) {
    for (const precedent of source.precedentiCitati) {
      const key = precedent.anno
        ? `${precedent.numero}/${precedent.anno}`
        : precedent.numero;

      const resolved = knownPrecedents.get(key);
      const nodeId = resolved
        ? resolved.nodeId
        : stableId("reference_prov", key);

      if (!nodes.has(nodeId)) {
        nodes.set(nodeId, {
          id: nodeId,
          kind: "provvedimento",
          source: "reference",
          sourceId: null,
          label: `Sentenza ${key}`,
          resolved: false,
          used: false,
          metadata: {
            numero_sentenza: key,
          },
        });
      }

      addConceptEdge(edges, source.nodeId, nodeId, "cita");
    }
  }

  for (const source of sources) {
    for (const norma of source.normeCitate) {
      const normalized = normalizeText(norma).toLowerCase();
      if (!normalized) {
        continue;
      }

      const normaId = stableId("norma", normalized);
      if (!nodes.has(normaId)) {
        nodes.set(normaId, {
          id: normaId,
          kind: "norma",
          source: "reference",
          sourceId: null,
          label: normalizeText(norma),
          resolved: true,
          used: true,
        });
      }

      addConceptEdge(edges, source.nodeId, normaId, "richiama_norma");
    }
  }

  addThesisToMap(
    nodes,
    edges,
    sourceNodeById,
    mappaDialettica?.orientamentoFavorevole,
    "supporta"
  );

  addThesisToMap(
    nodes,
    edges,
    sourceNodeById,
    mappaDialettica?.orientamentoContrario,
    "contrasta"
  );

  const nodeList = Array.from(nodes.values());
  const edgeList = Array.from(edges.values());

  return {
    version: 1,
    quesito: prompt,
    rootId,
    nodes: nodeList.slice(0, 200),
    edges: edgeList.slice(0, 500),
    sourceIds: sources.map((source) => source.sourceId).slice(0, 200),
    stats: {
      provvedimenti: nodeList.filter(
        (node) => node.kind === "provvedimento"
      ).length,
      dottrina: nodeList.filter((node) => node.kind === "dottrina").length,
      web: nodeList.filter((node) => node.kind === "web").length,
      documenti: nodeList.filter((node) => node.kind === "documento").length,
      norme: nodeList.filter((node) => node.kind === "norma").length,
      tesi: nodeList.filter((node) => node.kind === "tesi").length,
      relazioni: edgeList.length,
    },
  };
}

function addConceptEdge(
  edges: Map<string, any>,
  source: string,
  target: string,
  type:
    | "rilevante_per"
    | "cita"
    | "richiama_norma"
    | "supporta"
    | "contrasta"
    | "correlato"
): void {
  const id = stableId("edge", `${source}|${target}|${type}`);
  edges.set(id, {
    id,
    source,
    target,
    type,
  });
}

function addThesisToMap(
  nodes: Map<string, any>,
  edges: Map<string, any>,
  sourceNodeById: Map<string, string>,
  branch: any,
  edgeType: "supporta" | "contrasta"
): void {
  if (!branch) {
    return;
  }

  const title = normalizeText(branch.titoloTesi);
  if (!title) {
    return;
  }

  const thesisId = stableId("thesis", `${edgeType}|${title}`);

  nodes.set(thesisId, {
    id: thesisId,
    kind: "tesi",
    source: "system",
    sourceId: null,
    label: title,
    resolved: true,
    used: true,
    metadata: {
      argomentazione: normalizeText(branch.argomentazioneLogica),
    },
  });

  const fonti = Array.isArray(branch.fonti) ? branch.fonti : [];

  for (const fonte of fonti as Array<{ id: string }>) {
    const sourceNodeId = sourceNodeById.get(fonte.id);
    if (!sourceNodeId) {
      continue;
    }
    addConceptEdge(edges, sourceNodeId, thesisId, edgeType);
  }
}

/* ============================================================
   MERGE MAPPE
============================================================ */

export function mergeConceptMaps(
  current: z.infer<typeof ConceptMapSchema> | null | undefined,
  incoming: z.infer<typeof ConceptMapSchema> | null | undefined
): z.infer<typeof ConceptMapSchema> {
  if (!current) {
    return incoming ?? createEmptyConceptMap("");
  }

  if (!incoming) {
    return current;
  }

  const nodes = new Map<string, any>();
  for (const node of current.nodes) {
    nodes.set(node.id, node);
  }

  for (const node of incoming.nodes) {
    const existing = nodes.get(node.id);
    nodes.set(
      node.id,
      existing
        ? {
            ...existing,
            ...node,
            metadata: {
              ...(existing.metadata ?? {}),
              ...(node.metadata ?? {}),
            },
          }
        : node
    );
  }

  const edges = new Map<string, any>();
  for (const edge of current.edges) {
    edges.set(edge.id, edge);
  }

  for (const edge of incoming.edges) {
    edges.set(edge.id, edge);
  }

  const mergedNodes = Array.from(nodes.values()).slice(0, 200);
  const mergedEdges = Array.from(edges.values()).slice(0, 500);

  return {
    version: 1,
    quesito: current.quesito,
    rootId: current.rootId,
    nodes: mergedNodes,
    edges: mergedEdges,
    sourceIds: Array.from(
      new Set([...current.sourceIds, ...incoming.sourceIds])
    ).slice(0, 200),
    stats: {
      provvedimenti: mergedNodes.filter(
        (node) => node.kind === "provvedimento"
      ).length,
      dottrina: mergedNodes.filter((node) => node.kind === "dottrina").length,
      web: mergedNodes.filter((node) => node.kind === "web").length,
      documenti: mergedNodes.filter((node) => node.kind === "documento").length,
      norme: mergedNodes.filter((node) => node.kind === "norma").length,
      tesi: mergedNodes.filter((node) => node.kind === "tesi").length,
      relazioni: mergedEdges.length,
    },
  };
}

function createEmptyConceptMap(
  prompt: string
): z.infer<typeof ConceptMapSchema> {
  const rootId = stableId("question", prompt);
  return {
    version: 1,
    quesito: prompt,
    rootId,
    nodes: [
      {
        id: rootId,
        kind: "quesito",
        source: "system",
        sourceId: null,
        label: prompt,
        resolved: true,
        used: true,
      },
    ],
    edges: [],
    sourceIds: [],
    stats: {
      provvedimenti: 0,
      dottrina: 0,
      web: 0,
      documenti: 0,
      norme: 0,
      tesi: 0,
      relazioni: 0,
    },
  };
}

export function sanitizeConceptMapForSynthesis(
  conceptMap: z.infer<typeof ConceptMapSchema> | null | undefined
) {
  if (!conceptMap) {
    return null;
  }

  return {
    version: conceptMap.version,
    quesito: conceptMap.quesito,
    rootId: conceptMap.rootId,
    sourceIds: conceptMap.sourceIds,
    nodes: conceptMap.nodes,
    edges: conceptMap.edges,
    stats: conceptMap.stats,
  };
}