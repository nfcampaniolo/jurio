import { z } from 'genkit';
import { ai } from "../_config";
import { buildConceptMap, sanitizeConceptMapForSynthesis, mergeConceptMaps } from "./_helper";
import { validaFonti, extractResearchSources, extractKnownSourceIds } from "./_utils";
import { DeepAnalysisConfigSchema, ResearchSource, ConceptMapSchema, ResearchOutputWithConceptMapSchema, InquadramentoSchema, MappaDialetticaSchema, ResearchMappingSchema, ReportSintesiSchema} from "./_schema";
import { userFileSearch, internalDatabaseSearch, doctrineSearch, webSearch } from "../tools/index";
import {
  buildResearchAnalysisSystemPrompt,
  buildResearchMappingSystemPrompt,
  buildRefineResearchSystemPrompt,
  buildRefineMappingSystemPrompt,
  buildSynthesisReportSystemPrompt,
} from "./_prompts";

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
    }),
    outputSchema: ResearchOutputWithConceptMapSchema,
  },
  async ({ prompt, docs, userId, config }) => {
    const {
      confidenceLevel,
      sourceWeb,
      sourceInternalDB,
      sourceDoctrine,
      webLimit,
    } = config;

    const hasUserDocs = docs.length > 0;

    const dynamicTools = [
      sourceInternalDB ? internalDatabaseSearch : null,
      sourceDoctrine ? doctrineSearch : null,
      sourceWeb ? webSearch : null,
      hasUserDocs ? userFileSearch : null,
    ].filter(Boolean);

    const requiredTools = [
      sourceInternalDB ? "internalDatabaseSearch" : null,
      sourceDoctrine ? "doctrineSearch" : null,
      sourceWeb ? "webSearch" : null,
      hasUserDocs ? "userFileSearch" : null,
    ].filter((tool): tool is string => typeof tool === "string");

    const systemPrompt = buildResearchAnalysisSystemPrompt({
      prompt,
      requiredTools,
      hasUserDocs,
      docsLength: docs.length,
      docs,
    });

    let searchResponse: any = null;

    try {
      searchResponse = await ai.generate({
        messages: [
          {
            role: "system",
            content: [{ text: systemPrompt }],
          },
          {
            role: "user",
            content: [
              {
                text: `Avvia la ricerca di approfondimento per il quesito: "${prompt}"`,
              },
            ],
          },
        ],
        tools: dynamicTools as any,
        maxTurns: 3,
        context: {
          userId,
          docs,
          webLimit,
          confidenceLevel,
          sourceWeb,
          sourceInternalDB,
          sourceDoctrine,
          requiredTools,
        },
      });
    } catch (err: any) {
      console.error("[ResearchAnalysisFlow] Tool execution warning/error:", err);
      const message = String(err?.message ?? "");

      if (
        message.includes("Exceeded maximum tool call iterations") ||
        message.includes("ToolLoop")
      ) {
        console.warn(
          "[ResearchAnalysisFlow] Raggiunto limite iterazioni tool. Procedo con le evidenze parziali estratte."
        );
        searchResponse = {
          messages: err?.messages || err?.customProperties?.messages || [],
        };
      } else {
        throw new Error(
          `Errore durante la fase di ricerca delle fonti: ${
            message || "errore sconosciuto"
          }`
        );
      }
    }

    const allSources = extractResearchSources(
      searchResponse?.messages ?? []
    );

    const mappingSystemPrompt = buildResearchMappingSystemPrompt({
      prompt,
      allSources,
    });

    let mappingResponse: any;

    try {
      mappingResponse = await ai.generate({
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
    } catch (err: any) {
      console.error("[ResearchAnalysisFlow] Mapping error:", err);
      throw new Error(
        `Errore durante la generazione della mappa dialettica: ${
          err?.message ?? "errore sconosciuto"
        }`
      );
    }

    if (!mappingResponse?.output) {
      throw new Error("Output della mappa dialettica vuoto.");
    }

    const rawMapping = ResearchMappingSchema.parse(mappingResponse.output);

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
  }) => {
    const {
      confidenceLevel,
      sourceWeb,
      sourceInternalDB,
      sourceDoctrine,
      webLimit,
    } = config;

    const hasUserDocs = docs.length > 0;

    const dynamicTools = [
      sourceInternalDB ? internalDatabaseSearch : null,
      sourceDoctrine ? doctrineSearch : null,
      sourceWeb ? webSearch : null,
      hasUserDocs ? userFileSearch : null,
    ].filter(Boolean);

    const requiredTools = [
      sourceInternalDB ? "internalDatabaseSearch" : null,
      sourceDoctrine ? "doctrineSearch" : null,
      sourceWeb ? "webSearch" : null,
      hasUserDocs ? "userFileSearch" : null,
    ].filter((tool): tool is string => typeof tool === "string");

    const knownIds = extractKnownSourceIds(
      currentMappaConcettuale,
      currentMappaDialettica
    );

    const systemPrompt = buildRefineResearchSystemPrompt({
      originalPrompt,
      direttivaHitl,
      requiredTools,
      hasUserDocs,
      docsLength: docs.length,
      docs,
      knownIds,
    });

    let searchResponse: any = null;

    try {
      searchResponse = await ai.generate({
        messages: [
          {
            role: "system",
            content: [{ text: systemPrompt }],
          },
          {
            role: "user",
            content: [
              {
                text: `Esegui l'approfondimento richiesto: "${direttivaHitl}"`,
              },
            ],
          },
        ],
        tools: dynamicTools as any,
        maxTurns: 3,
        context: {
          userId,
          docs,
          webLimit,
          confidenceLevel,
          sourceWeb,
          sourceInternalDB,
          sourceDoctrine,
          requiredTools,
        },
      });
    } catch (err: any) {
      console.error("[RefineResearchFlow] Tool execution warning/error:", err);
      const message = String(err?.message ?? "");

      if (
        message.includes("Exceeded maximum tool call iterations") ||
        message.includes("ToolLoop")
      ) {
        console.warn(
          "[RefineResearchFlow] Raggiunto il limite di iterazioni tool. Procedo con le evidenze parziali."
        );
        searchResponse = {
          messages: err?.messages || err?.customProperties?.messages || [],
        };
      } else {
        throw new Error(
          `Errore durante l'approfondimento delle fonti: ${
            message || "errore sconosciuto"
          }`
        );
      }
    }

    const allSources = extractResearchSources(
      searchResponse?.messages ?? []
    );

    const knownSet = new Set(knownIds);
    const newSources = allSources.filter(
      (source: ResearchSource) => !knownSet.has(source.sourceId)
    );

    const mappingSystemPrompt = buildRefineMappingSystemPrompt({
      originalPrompt,
      direttivaHitl,
    });

    let mappingResponse: any;

    try {
      mappingResponse = await ai.generate({
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
    } catch (err: any) {
      console.error("[RefineResearchFlow] Mapping error:", err);
      throw new Error(
        `Errore durante l'aggiornamento della mappa dialettica: ${
          err?.message ?? "errore sconosciuto"
        }`
      );
    }

    if (!mappingResponse?.output) {
      throw new Error("Output della mappa dialettica vuoto.");
    }

    const rawMapping = ResearchMappingSchema.parse(mappingResponse.output);

    const mergeFonti = (
      oldFonts: Array<{
        id: string;
        fonte: "web" | "interna";
        gradoPertinenza: number;
        escluso?: boolean;
        nuova?: boolean;
      }>,
      newFonts: unknown
    ) => {
      const map = new Map<string, any>();

      for (const source of oldFonts) {
        if (source?.id) {
          map.set(source.id, source);
        }
      }

      const allowedIds = new Set(
        newSources.map((source: ResearchSource) => source.sourceId)
      );

      const incoming = validaFonti(
        Array.isArray(newFonts) ? newFonts : []
      ).filter(
        (source: { id?: unknown }) =>
          typeof source.id === "string" &&
          (knownSet.has(source.id) || allowedIds.has(source.id))
      );

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
    }), 
    outputSchema: ReportSintesiSchema,
  },
  async ({
    quesitoOriginale,
    inquadramento,
    mappaDialettica,
    mappaConcettuale,
  }) => {

    const filterActiveSources = (fonti: unknown): any[] => {
      if (!Array.isArray(fonti)) {
        return [];
      }
      return fonti.filter((source: { escluso?: boolean }) => !source.escluso);
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
      const response = await ai.generate({
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
      });

      if (!response?.output) {
        throw new Error("Generazione del report fallita: output vuoto.");
      }

      return ReportSintesiSchema.parse(response.output);
    } catch (err: any) {
      console.error("[GenerateSynthesisReportFlow] errore:", err);
      throw new Error(
        `Errore nella stesura del report: ${
          err?.message ?? "errore sconosciuto"
        }`
      );
    }
  }
);