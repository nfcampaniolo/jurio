import { z } from 'genkit';
import { ai } from "../_config";
import { buildConceptMap, sanitizeConceptMapForSynthesis, mergeConceptMaps } from "./_helper";
import { validaFonti, extractResearchSources, extractKnownSourceIds } from "./_utils";
import { DeepAnalysisConfigSchema, ResearchSource, ConceptMapSchema, ResearchOutputWithConceptMapSchema, InquadramentoSchema, MappaDialetticaSchema, ResearchMappingSchema, ReportSintesiSchema} from "./_schema";
import { userFileSearch, internalDatabaseSearch, doctrineSearch, webSearch } from "../tools/index";
import { reportDeepAnalysisProgress } from "./_progress";
import { logSafeError } from "../../_logging";
import {
  createDeepAnalysisCorrelationId,
  getSafeErrorType,
  logDeepAnalysisEvent,
  type DeepAnalysisPhase,
} from "./_observability";
import { getDb } from "../../_deps";
import {
  generateWithVertexRetry,
  VertexAiTemporarilyUnavailableError,
} from "./_vertexRetry";
import {
  buildResearchAnalysisSystemPrompt,
  buildResearchMappingSystemPrompt,
  buildRefineMappingSystemPrompt,
  buildSynthesisReportSystemPrompt,
} from "./_prompts";

const ResearchQueryPlanSchema = z.object({
  internalDatabaseSearch: z
    .object({
      searchType: z.enum(["semantic", "exact", "legal_reference"]),
      query: z.string().min(1).max(3000),
      caseNumber: z.string().max(100).optional(),
    })
    .nullable(),
  doctrineSearch: z
    .object({
      query: z.string().min(3).max(4000),
      subject: z.string().max(100).optional(),
      guidanceType: z.string().max(100).optional(),
      limit: z.number().int().min(1).max(10).optional(),
    })
    .nullable(),
  webSearch: z
    .object({
      query: z.string().min(3).max(3000),
      focus: z.enum(["institutional", "editorial", "all"]),
    })
    .nullable(),
});

const normalizedDocsSchema = z
  .array(
    z.union([
      z.string(),
      z.object({
        id: z.string(),
      }),
    ])
  )
  .optional()
  .default([])
  .transform((items) =>
    Array.from(
      new Set(
        items
          .map((item) => (typeof item === "string" ? item : item.id))
          .map((id) => id.trim())
          .filter(Boolean)
      )
    ).slice(0, 50)
  );

type ResearchQueryPlan = z.infer<typeof ResearchQueryPlanSchema>;
type ExternalSearchName =
  | "internalDatabaseSearch"
  | "doctrineSearch"
  | "webSearch";
type ResearchSearchRequest =
  | { name: "internalDatabaseSearch"; input: NonNullable<ResearchQueryPlan["internalDatabaseSearch"]> }
  | { name: "doctrineSearch"; input: NonNullable<ResearchQueryPlan["doctrineSearch"]> }
  | { name: "webSearch"; input: NonNullable<ResearchQueryPlan["webSearch"]> }
  | { name: "userFileSearch"; input: { query: string } };
type ExternalSearchRequest = Exclude<
  ResearchSearchRequest,
  { name: "userFileSearch" }
>;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "errore sconosciuto");
}

async function generateResearchMapping(
  systemPrompt: string,
  userPrompt: string,
  phase: DeepAnalysisPhase,
  failureMessage: string,
  correlationId: string,
  useFullModel = false
): Promise<z.infer<typeof ResearchMappingSchema> | undefined> {
  const startedAt = Date.now();
  try {
    const generateWithModel = (model: string) =>
      generateWithVertexRetry(
        () =>
          ai.generate({
            model,
            messages: [
              { role: "system", content: [{ text: systemPrompt }] },
              { role: "user", content: [{ text: userPrompt }] },
            ],
            output: { schema: ResearchMappingSchema },
          }),
        async () => undefined
      );
    // Il lite è più stabile su Vertex; in caso di errore si ripiega sul modello completo
    const response = useFullModel
      ? await generateWithModel("vertexai/gemini-3.5-flash")
      : await generateWithModel("vertexai/gemini-3.5-flash-lite").catch(
          (liteError: unknown) => {
            logSafeError("DEEP_ANALYSIS_MAPPING_LITE_FAILED", liteError);
            return generateWithModel("vertexai/gemini-3.5-flash");
          }
        );
    const rawMapping = response?.output
      ? ResearchMappingSchema.parse(response.output)
      : undefined;

    logDeepAnalysisEvent("phase_finished", {
      correlationId,
      phase,
      status: "completed",
      durationMs: Date.now() - startedAt,
    });
    return rawMapping;
  } catch (error: unknown) {
    logDeepAnalysisEvent("phase_failed", {
      correlationId,
      phase,
      status: "failed",
      durationMs: Date.now() - startedAt,
      errorType: getSafeErrorType(error),
    });
    logSafeError("DEEP_ANALYSIS_MAPPING_FAILED", error);
    throw new Error(`${failureMessage}: ${getErrorMessage(error)}`);
  }
}

async function collectResearchSources(params: {
  prompt: string;
  directive?: string;
  docs: string[];
  knownIds?: string[];
  userId: string;
  action: "start_research" | "refine_research";
  sessionId?: string;
  correlationId: string;
  config: z.infer<typeof DeepAnalysisConfigSchema>;
}): Promise<ResearchSource[]> {
  const { prompt, directive, docs, knownIds, userId, action, sessionId, correlationId, config } = params;
  const { confidenceLevel, sourceWeb, sourceInternalDB, sourceDoctrine, webLimit } = config;
  const hasUserDocs = docs.length > 0;
  const enabledNames: ExternalSearchName[] = [
    sourceInternalDB ? "internalDatabaseSearch" : null,
    sourceDoctrine ? "doctrineSearch" : null,
    sourceWeb ? "webSearch" : null,
  ].filter((name): name is ExternalSearchName => name !== null);

  const attachedSummaries = await loadAttachedDocumentSummaries(docs, userId);
  const attachedContext = attachedSummaries
    .map((item) =>
      [item.fileName, item.summary, item.legalIssues]
        .filter(Boolean)
        .join(" — ")
        .slice(0, 2500)
    )
    .join("\n\n");
  // Un quesito generico ("sul documento allegato") non contiene il tema: lo si ricava dall'allegato
  const searchBase = attachedContext
    ? `${directive ?? prompt}\n${attachedContext}`
    : directive ?? prompt;

  let plan: ResearchQueryPlan = {
    internalDatabaseSearch: null,
    doctrineSearch: null,
    webSearch: null,
  };

  if (enabledNames.length > 0) {
    await reportDeepAnalysisProgress(
      sessionId,
      "planning",
      "Sto preparando le query per le fonti abilitate."
    );

    const plannerPrompt = buildResearchAnalysisSystemPrompt({
      prompt: directive ? `${prompt}\n\nDirettiva di approfondimento: ${directive}` : prompt,
      requiredTools: enabledNames,
      hasUserDocs,
      docsLength: docs.length,
      docs,
      knownIds,
      attachedContext,
    });

    const planningStartedAt = Date.now();
    try {
      const response = await generateWithVertexRetry(() => ai.generate({
        // Pianificazione di query strutturate: il modello lite è più rapido e stabile
        model: "vertexai/gemini-3.5-flash-lite",
        messages: [
          { role: "system", content: [{ text: plannerPrompt }] },
          {
            role: "user",
            content: [
              {
                text: directive
                  ? `Prepara le query per l'approfondimento richiesto: "${directive}"`
                  : `Prepara le query di ricerca per il quesito: "${prompt}"`,
              },
            ],
          },
        ],
        output: { schema: ResearchQueryPlanSchema },
      }), async (retryNumber, delayMs) => {
        await reportDeepAnalysisProgress(
          sessionId,
          "planning",
          `Vertex AI è momentaneamente occupato. Nuovo tentativo ${retryNumber}/2 tra ${Math.round(delayMs / 1000)} secondi.`
        );
      });

      if (!response?.output) {
        throw new Error("Il pianificatore non ha restituito query strutturate.");
      }
      plan = ResearchQueryPlanSchema.parse(response.output);
      logDeepAnalysisEvent("phase_finished", {
        correlationId,
        action,
        phase: "query_planning",
        status: "completed",
        durationMs: Date.now() - planningStartedAt,
      });
    } catch (error) {
      logDeepAnalysisEvent("phase_failed", {
        correlationId,
        action,
        phase: "query_planning",
        status: "failed",
        durationMs: Date.now() - planningStartedAt,
        errorType: getSafeErrorType(error),
      });
      logSafeError("DEEP_ANALYSIS_QUERY_PLANNING_FAILED", error);
      throw new Error(
        `Errore durante la pianificazione delle ricerche: ${
          error instanceof Error ? error.message : "errore sconosciuto"
        }`
      );
    }
  }

  const externalCandidates: ExternalSearchRequest[] = [
    sourceInternalDB && plan.internalDatabaseSearch
      ? {
        name: "internalDatabaseSearch" as const,
          input: plan.internalDatabaseSearch,
        }
      : null,
    sourceDoctrine && plan.doctrineSearch
      ? {
          name: "doctrineSearch" as const,
          input: plan.doctrineSearch,
        }
      : null,
    // La Web è una fonte esplicitamente attivata dall'utente: non dipendere
    // dalla scelta facoltativa del pianificatore per eseguirla.
    sourceWeb
      ? {
          name: "webSearch" as const,
          input: plan.webSearch ?? {
            query: makeBoundedSearchQuery(searchBase, 3000),
            focus: "all" as const,
          },
        }
      : null,
  ].filter((candidate): candidate is ExternalSearchRequest => candidate !== null);

  // Manteniamo il limite di due ricerche esterne, ma riserviamo uno slot alla
  // Web quando è abilitata: con l'ordine precedente internal + doctrine
  // occupavano entrambi gli slot e la ricerca web non partiva mai.
  const selectedExternal = externalCandidates.length <= 2
    ? [...externalCandidates]
    : [
        ...externalCandidates.filter(({ name }) => name === "webSearch"),
        ...externalCandidates.filter(({ name }) => name !== "webSearch").slice(0, 1),
      ];
  if (externalCandidates.length > 2) {
    console.warn("[DeepAnalysisResearch] Limitate a due le ricerche esterne pianificate.");
  }

  if (enabledNames.length > 0 && selectedExternal.length === 0) {
    const fallbackName = enabledNames[0];
    console.warn(
      `[DeepAnalysisResearch] Nessuna fonte selezionata dal pianificatore; uso ${fallbackName} come fallback.`
    );
    if (fallbackName === "internalDatabaseSearch") {
      selectedExternal.push({
        name: fallbackName,
        input: {
          searchType: "semantic",
          query: makeBoundedSearchQuery(searchBase, 3000),
        },
      });
    } else if (fallbackName === "doctrineSearch") {
      selectedExternal.push({
        name: fallbackName,
        input: { query: makeBoundedSearchQuery(searchBase, 4000) },
      });
    } else {
      selectedExternal.push({
        name: fallbackName,
        input: {
          query: makeBoundedSearchQuery(searchBase, 3000),
          focus: "all",
        },
      });
    }
  }

  const searches: ResearchSearchRequest[] = [
    ...selectedExternal,
    ...(hasUserDocs
      ? [
          {
            name: "userFileSearch" as const,
            input: {
              query: makeBoundedSearchQuery(
                directive ? `${prompt}\n${directive}\n${attachedContext}` : `${prompt}\n${attachedContext}`,
                4000
              ),
            },
          },
        ]
      : []),
  ];

  const sourceNames = searches.map(({ name }) => name);
  await reportDeepAnalysisProgress(
    sessionId,
    "searching",
    sourceNames.length
      ? `Ricerca in corso: ${sourceNames.join(", ")}${hasUserDocs ? ` (${docs.length} allegati)` : ""}.`
      : "Nessuna fonte esterna selezionata; preparo la mappa dai dati disponibili."
  );

  const context = {
    userId,
    docs,
    webLimit,
    confidenceLevel,
    sourceWeb,
    sourceInternalDB,
    sourceDoctrine,
    requiredTools: [...sourceNames],
  };

  let completedSearches = 0;
  let progressWrites = Promise.resolve();
  const results = await Promise.all(
    searches.map(async (search) => {
      const startedAt = Date.now();
      try {
        const output = await executeResearchTool(search, context);
        logDeepAnalysisEvent("tool_search_finished", {
          correlationId,
          action,
          phase: "tool_search",
          status: "completed",
          tool: search.name,
          durationMs: Date.now() - startedAt,
          resultCount: Array.isArray(output) ? output.length : undefined,
        });
        return {
          toolResponse: {
            name: search.name,
            output,
          },
        };
      } catch (error) {
        logDeepAnalysisEvent("tool_search_failed", {
          correlationId,
          action,
          phase: "tool_search",
          status: "failed",
          tool: search.name,
          durationMs: Date.now() - startedAt,
          errorType: getSafeErrorType(error),
        });
        logSafeError("DEEP_ANALYSIS_TOOL_FAILED", error);
        return {
          toolResponse: {
            name: search.name,
            output: { error: `Errore durante la ricerca con ${search.name}.` },
          },
        };
      } finally {
        completedSearches += 1;
        const completedCount = completedSearches;
        progressWrites = progressWrites.then(() =>
          reportDeepAnalysisProgress(
            sessionId,
            "searching",
            `Completata ricerca ${search.name} (${completedCount}/${searches.length}).`
          )
        );
        await progressWrites;
      }
    })
  );

  await reportDeepAnalysisProgress(
    sessionId,
    "sources_ready",
    `Ricerca completata: ${results.length} strumenti consultati.`
  );

  const sources = extractResearchSources([
    {
      content: [
        ...results.map((result) => ({ toolResponse: result.toolResponse })),
        ...(attachedSummaries.length
          ? [{ toolResponse: { name: "attachedDocuments", output: attachedSummaries } }]
          : []),
      ],
    },
  ]);
  logDeepAnalysisEvent("phase_finished", {
    correlationId,
    action,
    phase: "tool_search",
    status: "completed",
    sourceCount: sources.length,
  });
  return sources;
}

// Riassunto e questioni giuridiche dell'allegato, sempre disponibili anche se la ricerca per paragrafi non trova nulla
async function loadAttachedDocumentSummaries(docs: string[], userId: string) {
  const ids = Array.from(new Set(docs.filter((id) => id && !id.includes("/")))).slice(0, 10);
  if (ids.length === 0) return [];

  try {
    const db = getDb();
    const snaps = await db.getAll(...ids.map((id) => db.collection("documents").doc(id)));
    return snaps.flatMap((snap) => {
      const data = snap.data();
      if (!data) return [];
      const visibleTo = Array.isArray(data.visibleTo) ? data.visibleTo : [];
      if (data.user !== userId && !visibleTo.includes(userId)) return [];
      return [{
        _type: "document_summary",
        documentId: snap.id,
        fileName: data.nome_file ?? "",
        summary: data.summary ?? "",
        legalIssues: data.extract_legal_issues ?? "",
      }];
    });
  } catch (error) {
    logSafeError("DEEP_ANALYSIS_ATTACHED_SUMMARY_FAILED", error);
    return [];
  }
}

function executeResearchTool(
  search: ResearchSearchRequest,
  context: {
    userId: string;
    docs: string[];
    webLimit: number;
    confidenceLevel: number;
    sourceWeb: boolean;
    sourceInternalDB: boolean;
    sourceDoctrine: boolean;
    requiredTools: string[];
  }
): Promise<unknown> {
  switch (search.name) {
    case "internalDatabaseSearch":
      return internalDatabaseSearch(search.input, { context });
    case "doctrineSearch":
      return doctrineSearch(search.input, { context });
    case "webSearch":
      return webSearch(search.input, { context });
    case "userFileSearch":
      return userFileSearch(search.input, { context });
  }
}

type RawMapping = z.infer<typeof ResearchMappingSchema>;

// Una tesi è accettata solo se collegata a fonti realmente reperite: gli id sconosciuti vengono scartati
function groundMapping(rawMapping: RawMapping, allSources: ResearchSource[]) {
  const ground = (
    orientamento: RawMapping["mappaDialettica"]["orientamentoFavorevole"]
  ) => {
    if (!orientamento) return null;
    const known = new Set(allSources.map((source) => source.sourceId));
    const fonti = validaFonti(orientamento.fonti ?? [], allSources).filter(
      (fonte: { id?: unknown }) => typeof fonte.id === "string" && known.has(fonte.id)
    ) as NonNullable<typeof orientamento>["fonti"];
    return fonti.length > 0
      ? {
          titoloTesi: orientamento.titoloTesi,
          argomentazioneLogica: orientamento.argomentazioneLogica,
          fonti,
        }
      : null;
  };

  const favorevole = ground(rawMapping.mappaDialettica.orientamentoFavorevole);
  const contrario = ground(rawMapping.mappaDialettica.orientamentoContrario);
  const puntiAperti = [...(rawMapping.mappaDialettica.puntiAperti ?? [])];
  const scartato =
    (rawMapping.mappaDialettica.orientamentoFavorevole && !favorevole) ||
    (rawMapping.mappaDialettica.orientamentoContrario && !contrario);
  if (scartato) {
    puntiAperti.unshift(
      "Alcune tesi non sono state riportate perché non supportate da fonti reperite: è consigliabile affinare la ricerca."
    );
  }

  return {
    mappaDialettica: {
      orientamentoFavorevole: favorevole,
      orientamentoContrario: contrario,
      puntiAperti,
    } as z.infer<typeof MappaDialetticaSchema>,
    totaleFonti:
      (favorevole?.fonti.length ?? 0) + (contrario?.fonti.length ?? 0),
  };
}

function makeBoundedSearchQuery(value: string, maxLength: number): string {
  const query = value.trim().slice(0, maxLength);
  return query.length >= 3 ? query : `${query} ricerca`;
}

export const researchAnalysisFlow = ai.defineFlow(
  {
    name: "researchAnalysisFlow",
    inputSchema: z.object({
      prompt: z.string().min(1).max(20_000),
      docs: normalizedDocsSchema,
      userId: z.string().min(1),
      config: DeepAnalysisConfigSchema.optional().default({}),
      sessionId: z.string().optional(),
      correlationId: z.string().optional(),
    }),
    outputSchema: ResearchOutputWithConceptMapSchema,
  },
  async ({ prompt, docs, userId, config, sessionId, correlationId: inputCorrelationId }) => {
    const correlationId = createDeepAnalysisCorrelationId(inputCorrelationId);
    try {
      const allSources = await collectResearchSources({
        prompt,
        docs,
        userId,
        action: "start_research",
        sessionId,
        correlationId,
        config,
      });
      await reportDeepAnalysisProgress(
        sessionId,
        "mapping",
        `Sto organizzando ${allSources.length} fonti nella mappa dialettica.`
      );

    const mappingSystemPrompt = buildResearchMappingSystemPrompt({
      prompt,
      allSources,
    });

    const mappingUserPrompt =
      "Genera l'inquadramento e la mappa dialettica in formato strutturato.";
    let rawMapping = await generateResearchMapping(
      mappingSystemPrompt,
      mappingUserPrompt,
      "research_mapping",
      "Errore durante la generazione della mappa dialettica",
      correlationId
    );

    if (!rawMapping) {
      throw new Error("Output della mappa dialettica vuoto.");
    }

    let grounded = groundMapping(rawMapping, allSources);

    // Fonti reperite ma nessuna collegata alle tesi: nuovo tentativo con il modello completo
    if (grounded.totaleFonti === 0 && allSources.length > 0) {
      console.warn("[DeepAnalysisResearch] Mappa senza fonti collegate: retry con modello completo.");
      const retried = await generateResearchMapping(
        mappingSystemPrompt,
        `${mappingUserPrompt}\nATTENZIONE: il tentativo precedente non ha collegato alcuna fonte alle tesi. Valuta massima, contenuto ed estratti di ciascuna fonte dell'elenco e associa a ogni tesi gli ID pertinenti. Se nessuna fonte è pertinente per un orientamento, restituisci null per quell'orientamento.`,
        "research_mapping_retry",
        "Errore durante la generazione della mappa dialettica",
        correlationId,
        true
      );
      if (retried) {
        rawMapping = retried;
        grounded = groundMapping(retried, allSources);
      }
    }

    if (grounded.totaleFonti === 0) {
      grounded.mappaDialettica.puntiAperti.unshift(
        allSources.length > 0
          ? "Le fonti reperite non risultano pertinenti al quesito: riformula la domanda o amplia le fonti."
          : "Nessuna fonte pertinente è stata reperita con i parametri impostati."
      );
    }

    const mappedMappaDialettica = grounded.mappaDialettica;

    const mappaConcettuale = buildConceptMap({
      prompt,
      sources: allSources,
      mappaDialettica: mappedMappaDialettica,
    });

    return {
      inquadramento: rawMapping.inquadramento,
      mappaDialettica: mappedMappaDialettica,
      mappaConcettuale,
    };
    } catch (error) {
      await reportDeepAnalysisProgress(
        sessionId,
        "research",
        "La ricerca non è riuscita. Riprova tra poco.",
        "error"
      );
      throw error;
    }
  }
);

export const refineResearchFlow = ai.defineFlow(
  {
    name: "refineResearchFlow",
    inputSchema: z.object({
      originalPrompt: z.string().min(1).max(20_000),
      direttivaHitl: z.string().min(1).max(4_000),
      currentInquadramento: InquadramentoSchema,
      currentMappaDialettica: MappaDialetticaSchema,
      currentMappaConcettuale: ConceptMapSchema.nullable().optional(),
      docs: normalizedDocsSchema,
      userId: z.string().min(1),
      config: DeepAnalysisConfigSchema.optional().default({}),
      sessionId: z.string().optional(),
      correlationId: z.string().optional(),
    }),
    outputSchema: ResearchOutputWithConceptMapSchema,
  },
  async ({
    originalPrompt,
    direttivaHitl,
    currentInquadramento,
    currentMappaDialettica,
    currentMappaConcettuale,
    docs,
    userId,
    config,
    sessionId,
    correlationId: inputCorrelationId,
  }) => {
    const correlationId = createDeepAnalysisCorrelationId(inputCorrelationId);
    const knownIds = extractKnownSourceIds(
      currentMappaConcettuale,
      currentMappaDialettica
    );

    const allSources = await collectResearchSources({
      prompt: originalPrompt,
      directive: direttivaHitl,
      docs,
      knownIds,
      userId,
      action: "refine_research",
      sessionId,
      correlationId,
      config,
    });

    const knownSet = new Set(knownIds);
    const newSources = allSources.filter(
      (source: ResearchSource) => !knownSet.has(source.sourceId)
    );

    const mappingSystemPrompt = buildRefineMappingSystemPrompt({
      originalPrompt,
      direttivaHitl,
    });

    await reportDeepAnalysisProgress(
      sessionId,
      "mapping",
      `Integro ${newSources.length} nuove fonti nella mappa dialettica.`
    );

    const rawMapping = await generateResearchMapping(
      mappingSystemPrompt,
      JSON.stringify({
        currentInquadramento,
        currentMappaDialettica,
        nuoveFonti: newSources,
      }),
      "refine_mapping",
      "Errore durante l'aggiornamento della mappa dialettica",
      correlationId
    );

    if (!rawMapping) {
      throw new Error("Output della mappa dialettica vuoto.");
    }

    const mergeFonti = (
      oldFonts: NonNullable<z.infer<typeof MappaDialetticaSchema>["orientamentoFavorevole"]>["fonti"],
      newFonts: NonNullable<z.infer<typeof MappaDialetticaSchema>["orientamentoFavorevole"]>["fonti"]
    ) => {
      const map = new Map<string, (typeof oldFonts)[number]>();

      for (const source of oldFonts) {
        if (source?.id) {
          map.set(source.id, source);
        }
      }

      const allowedIds = new Set(
        newSources.map((source: ResearchSource) => source.sourceId)
      );

      const incoming = validaFonti(newFonts, allSources).filter(
        (source: { id?: unknown }) =>
          typeof source.id === "string" &&
          (knownSet.has(source.id) || allowedIds.has(source.id))
      ) as (typeof oldFonts)[number][];

      for (const source of incoming) {
        const existing = map.get(source.id);
        if (!existing) {
          map.set(source.id, {
            ...source,
            nuova: allowedIds.has(source.id),
          });
          continue;
        }

        map.set(source.id, {
          ...existing,
          ...source,
          escluso: existing.escluso ?? source.escluso,
          nuova: existing.nuova ?? false,
        });
      }

      return Array.from(map.values());
    };

    const mergedFav = rawMapping.mappaDialettica.orientamentoFavorevole
      ? {
          ...rawMapping.mappaDialettica.orientamentoFavorevole,
          fonti: mergeFonti(
            currentMappaDialettica.orientamentoFavorevole?.fonti ?? [],
            rawMapping.mappaDialettica.orientamentoFavorevole.fonti
          ),
        }
      : currentMappaDialettica.orientamentoFavorevole;

    const mergedCont = rawMapping.mappaDialettica.orientamentoContrario
      ? {
          ...rawMapping.mappaDialettica.orientamentoContrario,
          fonti: mergeFonti(
            currentMappaDialettica.orientamentoContrario?.fonti ?? [],
            rawMapping.mappaDialettica.orientamentoContrario.fonti
          ),
        }
      : currentMappaDialettica.orientamentoContrario;

    const mergedMappaDialettica = {
      orientamentoFavorevole: mergedFav,
      orientamentoContrario: mergedCont,
      puntiAperti: Array.from(
        new Set([
          ...(currentMappaDialettica.puntiAperti ?? []),
          ...(rawMapping.mappaDialettica.puntiAperti ?? []),
        ])
      ),
    };

    const mergedInquadramento = {
      qualificazioneGiuridica:
        rawMapping.inquadramento.qualificazioneGiuridica ||
        currentInquadramento.qualificazioneGiuridica,
      fattispecieEstratta:
        rawMapping.inquadramento.fattispecieEstratta ||
        currentInquadramento.fattispecieEstratta,
      normeRiferimento: rawMapping.inquadramento.normeRiferimento?.length
        ? rawMapping.inquadramento.normeRiferimento
        : currentInquadramento.normeRiferimento,
    };

    const newConceptMap = buildConceptMap({
      prompt: originalPrompt,
      sources: newSources,
      mappaDialettica: mergedMappaDialettica,
    });

    const finalConceptMap = mergeConceptMaps(
      currentMappaConcettuale,
      newConceptMap
    );

    return {
      inquadramento: mergedInquadramento,
      mappaDialettica: mergedMappaDialettica,
      mappaConcettuale: finalConceptMap,
    };
  }
);

export const generateSynthesisReportFlow = ai.defineFlow(
  {
    name: "generateSynthesisReportFlow",
    inputSchema: z.object({
      quesitoOriginale: z.string().min(1).max(20_000),
      inquadramento: InquadramentoSchema,
      mappaDialettica: MappaDialetticaSchema,
      mappaConcettuale: ConceptMapSchema.nullable().optional(),
      userId: z.string().min(1),
      sessionId: z.string().optional(),
      correlationId: z.string().optional(),
    }), 
    outputSchema: ReportSintesiSchema,
  },
  async ({
    quesitoOriginale,
    inquadramento,
    mappaDialettica,
    mappaConcettuale,
    sessionId,
    correlationId: inputCorrelationId,
  }) => {
    const correlationId = createDeepAnalysisCorrelationId(inputCorrelationId);

    const filterActiveSources = (
      fonti: NonNullable<z.infer<typeof MappaDialetticaSchema>["orientamentoFavorevole"]>["fonti"] | undefined
    ) => {
      return (fonti ?? []).filter((source) => !source.escluso);
    };

    const mappaFiltrata = {
      orientamentoFavorevole: mappaDialettica.orientamentoFavorevole
        ? {
            ...mappaDialettica.orientamentoFavorevole,
            fonti: filterActiveSources(
              mappaDialettica.orientamentoFavorevole.fonti
            ),
          }
        : null,
      orientamentoContrario: mappaDialettica.orientamentoContrario
        ? {
            ...mappaDialettica.orientamentoContrario,
            fonti: filterActiveSources(
              mappaDialettica.orientamentoContrario.fonti
            ),
          }
        : null,
      puntiAperti: Array.from(new Set(mappaDialettica.puntiAperti ?? [])),
    };

    const conceptMap = sanitizeConceptMapForSynthesis(mappaConcettuale);

    const datiAnalisiJSON = JSON.stringify(
      {
        inquadramento,
        mappaDialettica: mappaFiltrata,
        mappaConcettuale: conceptMap,
      },
      null,
      2
    );

    const systemPrompt = buildSynthesisReportSystemPrompt(quesitoOriginale);
    const synthesisStartedAt = Date.now();

    try {
      await reportDeepAnalysisProgress(
        sessionId,
        "synthesis",
        "Sto redigendo la sintesi strategica sulle fonti verificate."
      );
      const response = await generateWithVertexRetry(
        () =>
          ai.generate({
            messages: [
              {
                role: "system",
                content: [
                  {
                    text: systemPrompt,
                  },
                ],
              },
              {
                role: "user",
                content: [
                  {
                    text: `DATI CONSOLIDATI DELLA RICERCA:\n\n${datiAnalisiJSON}`,
                  },
                ],
              },
            ],
            output: {
              schema: ReportSintesiSchema,
            },
          }),
        async (retryNumber, delayMs) => {
          await reportDeepAnalysisProgress(
            sessionId,
            "synthesis",
            `Vertex AI è momentaneamente occupato. Nuovo tentativo ${retryNumber}/2 tra ${Math.round(delayMs / 1000)} secondi.`
          );
        }
      );
      logDeepAnalysisEvent("phase_finished", {
        correlationId,
        phase: "synthesis",
        status: "completed",
        durationMs: Date.now() - synthesisStartedAt,
      });

      if (!response?.output) {
        throw new Error("Generazione del report fallita: output vuoto.");
      }

      return ReportSintesiSchema.parse(response.output);
    } catch (err: unknown) {
      logDeepAnalysisEvent("phase_failed", {
        correlationId,
        phase: "synthesis",
        status: "failed",
        durationMs: Date.now() - synthesisStartedAt,
        errorType: getSafeErrorType(err),
      });
      logSafeError("DEEP_ANALYSIS_SYNTHESIS_FAILED", err);
      if (err instanceof VertexAiTemporarilyUnavailableError) {
        throw err;
      }
      throw new Error(
        `Errore nella stesura del report: ${getErrorMessage(err)}`
      );
    }
  }
);
