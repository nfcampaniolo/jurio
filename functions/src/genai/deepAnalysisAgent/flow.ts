import { z } from 'genkit';
import { ai } from "../_config";
import { buildConceptMap, sanitizeConceptMapForSynthesis, mergeConceptMaps } from "./_helper";
import { validaFonti, extractResearchSources, extractKnownSourceIds } from "./_utils";
import { DeepAnalysisConfigSchema, ResearchSource, ConceptMapSchema, ResearchOutputWithConceptMapSchema, InquadramentoSchema, MappaDialetticaSchema, ResearchMappingSchema, ReportSintesiSchema} from "./_schema";
import { userFileSearch, internalDatabaseSearch, doctrineSearch, webSearch } from "../tools/index";
import { reportDeepAnalysisProgress } from "./_progress";
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

async function collectResearchSources(params: {
  prompt: string;
  directive?: string;
  docs: string[];
  knownIds?: string[];
  userId: string;
  sessionId?: string;
  config: z.infer<typeof DeepAnalysisConfigSchema>;
}): Promise<ResearchSource[]> {
  const { prompt, directive, docs, knownIds, userId, sessionId, config } = params;
  const { confidenceLevel, sourceWeb, sourceInternalDB, sourceDoctrine, webLimit } = config;
  const hasUserDocs = docs.length > 0;
  const enabledNames: ExternalSearchName[] = [
    sourceInternalDB ? "internalDatabaseSearch" : null,
    sourceDoctrine ? "doctrineSearch" : null,
    sourceWeb ? "webSearch" : null,
  ].filter((name): name is ExternalSearchName => name !== null);

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
    });

    const planningStartedAt = Date.now();
    try {
      const response = await ai.generate({
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
      });

      if (!response?.output) {
        throw new Error("Il pianificatore non ha restituito query strutturate.");
      }
      plan = ResearchQueryPlanSchema.parse(response.output);
      console.info(
        "[DeepAnalysisTiming]",
        JSON.stringify({ phase: "query_planning", durationMs: Date.now() - planningStartedAt })
      );
    } catch (error) {
      console.error(
        "[DeepAnalysisTiming]",
        JSON.stringify({ phase: "query_planning", durationMs: Date.now() - planningStartedAt, failed: true })
      );
      console.error("[DeepAnalysisResearch] Errore pianificazione query:", error);
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
    sourceWeb && plan.webSearch
      ? { name: "webSearch" as const, input: plan.webSearch }
      : null,
  ].filter((candidate): candidate is ExternalSearchRequest => candidate !== null);

  const selectedExternal = externalCandidates.slice(0, 2);
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
          query: makeBoundedSearchQuery(directive ?? prompt, 3000),
        },
      });
    } else if (fallbackName === "doctrineSearch") {
      selectedExternal.push({
        name: fallbackName,
        input: { query: makeBoundedSearchQuery(directive ?? prompt, 4000) },
      });
    } else {
      selectedExternal.push({
        name: fallbackName,
        input: {
          query: makeBoundedSearchQuery(directive ?? prompt, 3000),
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
                directive ? `${prompt}\n${directive}` : prompt,
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
        console.info(
          "[DeepAnalysisTiming]",
          JSON.stringify({
            phase: "tool_search",
            tool: search.name,
            durationMs: Date.now() - startedAt,
            resultCount: Array.isArray(output) ? output.length : null,
          })
        );
        return {
          toolResponse: {
            name: search.name,
            output,
          },
        };
      } catch (error) {
        console.error(
          "[DeepAnalysisTiming]",
          JSON.stringify({
            phase: "tool_search",
            tool: search.name,
            durationMs: Date.now() - startedAt,
            failed: true,
          })
        );
        console.error(`[DeepAnalysisResearch] Errore tool ${search.name}:`, error);
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

  return extractResearchSources([
    {
      content: results.map((result) => ({ toolResponse: result.toolResponse })),
    },
  ]);
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

function makeBoundedSearchQuery(value: string, maxLength: number): string {
  const query = value.trim().slice(0, maxLength);
  return query.length >= 3 ? query : `${query} ricerca`;
}

export const researchAnalysisFlow = ai.defineFlow(
  {
    name: "researchAnalysisFlow",
    inputSchema: z.object({
      prompt: z.string().min(1).max(20_000),
      docs: z
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
        ),
      userId: z.string().min(1),
      config: DeepAnalysisConfigSchema.optional().default({}),
      sessionId: z.string().optional(),
    }),
    outputSchema: ResearchOutputWithConceptMapSchema,
  },
  async ({ prompt, docs, userId, config, sessionId }) => {
    try {
      const allSources = await collectResearchSources({
        prompt,
        docs,
        userId,
        sessionId,
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

    let rawMapping: z.infer<typeof ResearchMappingSchema> | undefined;

    const mappingStartedAt = Date.now();
    try {
      const mappingResponse = await ai.generate({
        messages: [
          {
            role: "system",
            content: [{ text: mappingSystemPrompt }],
          },
          {
            role: "user",
            content: [
              {
                text: "Genera l'inquadramento e la mappa dialettica in formato strutturato.",
              },
            ],
          },
        ],
        output: {
          schema: ResearchMappingSchema,
        },
      });
      if (mappingResponse?.output) {
        rawMapping = ResearchMappingSchema.parse(mappingResponse.output);
      }
      console.info(
        "[DeepAnalysisTiming]",
        JSON.stringify({ phase: "research_mapping", durationMs: Date.now() - mappingStartedAt })
      );
    } catch (err: unknown) {
      console.error(
        "[DeepAnalysisTiming]",
        JSON.stringify({ phase: "research_mapping", durationMs: Date.now() - mappingStartedAt, failed: true })
      );
      console.error("[ResearchAnalysisFlow] Mapping error:", err);
      throw new Error(
        `Errore durante la generazione della mappa dialettica: ${
          getErrorMessage(err)
        }`
      );
    }

    if (!rawMapping) {
      throw new Error("Output della mappa dialettica vuoto.");
    }

    const validFavSources = validaFonti(
      rawMapping.mappaDialettica.orientamentoFavorevole?.fonti ?? []
    );
    const validContSources = validaFonti(
      rawMapping.mappaDialettica.orientamentoContrario?.fonti ?? []
    );

    const mappedMappaDialettica: z.infer<typeof MappaDialetticaSchema> = {
      orientamentoFavorevole: rawMapping.mappaDialettica.orientamentoFavorevole
        ? {
            titoloTesi: rawMapping.mappaDialettica.orientamentoFavorevole.titoloTesi,
            argomentazioneLogica: rawMapping.mappaDialettica.orientamentoFavorevole.argomentazioneLogica,
            fonti: validFavSources,
          }
        : null,
      orientamentoContrario: rawMapping.mappaDialettica.orientamentoContrario
        ? {
            titoloTesi: rawMapping.mappaDialettica.orientamentoContrario.titoloTesi,
            argomentazioneLogica: rawMapping.mappaDialettica.orientamentoContrario.argomentazioneLogica,
            fonti: validContSources,
          }
        : null,
      puntiAperti: rawMapping.mappaDialettica.puntiAperti ?? [],
    };

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
      docs: z
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
        ),
      userId: z.string().min(1),
      config: DeepAnalysisConfigSchema.optional().default({}),
      sessionId: z.string().optional(),
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
  }) => {
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
      sessionId,
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

    let rawMapping: z.infer<typeof ResearchMappingSchema> | undefined;

    const mappingStartedAt = Date.now();
    try {
      const mappingResponse = await ai.generate({
        messages: [
          {
            role: "system",
            content: [{ text: mappingSystemPrompt }],
          },
          {
            role: "user",
            content: [
              {
                text: JSON.stringify({
                  currentInquadramento,
                  currentMappaDialettica,
                  nuoveFonti: newSources,
                }),
              },
            ],
          },
        ],
        output: {
          schema: ResearchMappingSchema,
        },
      });
      if (mappingResponse?.output) {
        rawMapping = ResearchMappingSchema.parse(mappingResponse.output);
      }
      console.info(
        "[DeepAnalysisTiming]",
        JSON.stringify({ phase: "refine_mapping", durationMs: Date.now() - mappingStartedAt })
      );
    } catch (err: unknown) {
      console.error(
        "[DeepAnalysisTiming]",
        JSON.stringify({ phase: "refine_mapping", durationMs: Date.now() - mappingStartedAt, failed: true })
      );
      console.error("[RefineResearchFlow] Mapping error:", err);
      throw new Error(
        `Errore durante l'aggiornamento della mappa dialettica: ${
          getErrorMessage(err)
        }`
      );
    }

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

      const incoming = validaFonti(newFonts).filter(
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
    }), 
    outputSchema: ReportSintesiSchema,
  },
  async ({
    quesitoOriginale,
    inquadramento,
    mappaDialettica,
    mappaConcettuale,
    sessionId,
  }) => {

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

    try {
      await reportDeepAnalysisProgress(
        sessionId,
        "synthesis",
        "Sto redigendo la sintesi strategica sulle fonti verificate."
      );
      const startedAt = Date.now();
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
      console.info(
        "[DeepAnalysisTiming]",
        JSON.stringify({ phase: "synthesis", durationMs: Date.now() - startedAt })
      );

      if (!response?.output) {
        throw new Error("Generazione del report fallita: output vuoto.");
      }

      return ReportSintesiSchema.parse(response.output);
    } catch (err: unknown) {
      console.error("[GenerateSynthesisReportFlow] errore:", err);
      if (err instanceof VertexAiTemporarilyUnavailableError) {
        throw err;
      }
      throw new Error(
        `Errore nella stesura del report: ${getErrorMessage(err)}`
      );
    }
  }
);