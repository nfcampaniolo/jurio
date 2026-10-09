import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { translateRiferimento } from "../utils";
import { getDb } from "../deps";
import { AREE } from "../params";
import {
  verifyPlanAndLimits,
  formatDocument,
  formatDoctrineDocument,
  findByNumeroSentenzaAdmin,
  findBySottocategoriaAdmin,
  JurioDocument,
  DoctrineDocument,
} from "./helpers";

const JURIO_VECTOR_SEARCH_URL = "https://vectorsearchjurio-vqoobrenua-ew.a.run.app";
const JURIO_EXTRACT_TEXT_URL = "https://extractdocumenttext-vqoobrenua-ew.a.run.app";
const JURIO_DOCTRINE_SEARCH_URL = "https://vectorsearchdoctrine-vqoobrenua-ew.a.run.app";

const NOMI_AREE = Object.values(AREE).join("', '");

export function createMcpServer(authHeader: string): McpServer {
  const server = new McpServer({
    name: "jurio-mcp",
    version: "1.1.0",
  });

  // --------------------------------------------------------------------------
  // TOOL 1: RICERCA VETTORIALE / SEMANTICA (GIURISPRUDENZA)
  // --------------------------------------------------------------------------
  server.registerTool(
    "ricercaSemantica",
    {
      title: "Ricerca Semantica Precedenti Giurisprudenziali",
      description:
        "Cerca nella giurisprudenza italiana confrontando il quesito con un indice vettoriale composto da FATTISPECIE CONCRETA e MASSIMA.\n" +
        "- QUANDO USARLO: Per trovare orientamenti giurisprudenziali, casi analoghi e applicazioni pratiche.\n" +
        "- COME STRUTTURARE LA QUERY: Costruisci una frase densa che combini ELEMENTI DI FATTO e QUALIFICAZIONE GIURIDICA.\n" +
        "- DA EVITARE: Non inserire convenevoli, stop-word o soli articoli di legge.\n" +
        "- ESEMPIO OTTIMALE: 'caduta pedone dislivello marciapiede insidia stradale non visibile caso fortuito 2051 cc'",
      inputSchema: {
        query: z
          .string()
          .min(5)
          .describe(
            "Sintesi densa che unisce elementi fattuali specifici e istituto giuridico. Evitare stop-word."
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(15)
          .optional()
          .describe("Numero massimo di precedenti da estrarre (default: 10)."),
      },
    },
    async ({ query, limit }) => {
      try {
        const safeLimit = Math.min(limit ?? 10, 15);
        const response = await fetch(JURIO_VECTOR_SEARCH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authHeader ? { Authorization: authHeader } : {}),
          },
          body: JSON.stringify({ query, limit: safeLimit }),
        });

        if (response.status === 401) {
          return {
            content: [
              {
                type: "text",
                text: "Sessione Jurio non valida o scaduta. Ricollega il tuo account Jurio dalle impostazioni del client MCP.",
              },
            ],
            isError: true,
          };
        }
        if (response.status === 403) {
          return {
            content: [
              {
                type: "text",
                text: "Accesso non consentito: nessun piano attivo rilevato. Attiva o rinnova il tuo piano su: https://jurio.it/prezzi",
              },
            ],
            isError: false,
          };
        }
        if (response.status === 429) {
          return {
            content: [
              {
                type: "text",
                text: "Hai raggiunto il limite di ricerche disponibili per il tuo piano. Riprova più tardi.",
              },
            ],
            isError: false,
          };
        }

        const data = (await response
          .json()
          .catch(async () => ({ error: await response.text() }))) as {
          topMatches?: JurioDocument[];
          error?: string;
        };

        if (!response.ok) {
          return {
            content: [
              {
                type: "text",
                text: `Errore dal backend Jurio (${response.status}): ${
                  data.error ?? response.statusText
                }`,
              },
            ],
            isError: true,
          };
        }

        const matches = data.topMatches ?? [];
        if (matches.length === 0) {
          return {
            content: [
              { type: "text", text: "Nessuna sentenza pertinente trovata per questo quesito." },
            ],
          };
        }

        const formatted = matches.map((m) => formatDocument(m)).join("\n\n---\n\n");
        return { content: [{ type: "text", text: formatted }] };
      } catch (error: unknown) {
        return {
          content: [
            {
              type: "text",
              text: `Errore di rete o timeout: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // --------------------------------------------------------------------------
  // TOOL 2: RICERCA VETTORIALE / SEMANTICA (DOTTRINA E RELAZIONI)
  // --------------------------------------------------------------------------
  server.registerTool(
    "ricercaDottrina",
    {
      title: "Ricerca Semantica Dottrina, Relazioni e Novità Legislative",
      description:
        "Cerca nella dottrina ufficiale (Relazioni dell'Ufficio del Massimario, Quaderni, approfondimenti sulle novità normative).\n" +
        "- QUANDO USARLO: Per ottenere un inquadramento teorico e dogmatico, spiegazioni su contrasti giurisprudenziali, analisi di nuove leggi o per comprendere la 'ratio' di un istituto.\n" +
        "- DIFFERENZA CON LA GIURISPRUDENZA: Usa questo tool per la TEORIA, usa 'ricercaSemantica' per la PRATICA e i casi concreti.",
      inputSchema: {
        query: z
          .string()
          .min(5)
          .describe("Concetto giuridico, istituto o questione di diritto da approfondire nella dottrina."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(10)
          .optional()
          .describe("Numero massimo di tematiche da estrarre (default: 5)."),
      },
    },
    async ({ query, limit }) => {
      try {
        const safeLimit = Math.min(limit ?? 5, 10);
        const response = await fetch(JURIO_DOCTRINE_SEARCH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authHeader ? { Authorization: authHeader } : {}),
          },
          body: JSON.stringify({ query, limit: safeLimit }),
        });

        if (response.status === 401) {
          return { content: [{ type: "text", text: "Sessione Jurio non valida o scaduta." }], isError: true };
        }
        if (response.status === 403) {
          return { content: [{ type: "text", text: "Accesso non consentito per il piano attuale." }], isError: false };
        }
        if (response.status === 429) {
          return { content: [{ type: "text", text: "Limite di ricerche raggiunto. Riprova più tardi." }], isError: false };
        }

        const data = (await response
          .json()
          .catch(async () => ({ error: await response.text() }))) as {
          results?: DoctrineDocument[];
          error?: string;
        };

        if (!response.ok) {
          return {
            content: [
              {
                type: "text",
                text: `Errore dal backend Jurio (${response.status}): ${
                  data.error ?? response.statusText
                }`,
              },
            ],
            isError: true,
          };
        }

        const matches = data.results ?? [];
        if (matches.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "Nessun approfondimento dottrinale pertinente trovato per questo quesito.",
              },
            ],
          };
        }

        const formatted = matches.map((m) => formatDoctrineDocument(m)).join("\n\n---\n\n");
        return { content: [{ type: "text", text: formatted }] };
      } catch (error: unknown) {
        return {
          content: [
            {
              type: "text",
              text: `Errore di rete o timeout: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // --------------------------------------------------------------------------
  // TOOL 3: RICERCA PUNTUALE PER NORMATIVA (Firestore Key Lookup)
  // --------------------------------------------------------------------------
  server.registerTool(
    "ricercaNormativa",
    {
      title: "Ricerca Sentenze per Riferimento Normativo",
      description:
        "Trova massime e sentenze associate a uno specifico articolo di legge o codice.\n" +
        "USO OBBLIGATORIO: Passa un singolo articolo formattato secondo lo standard italiano (es. 'art. 2051 c.c.').",
      inputSchema: {
        riferimento: z
          .string().max(100)
          .describe("La norma da cercare nel formato 'art. [numero] [fonte]' (es. 'art. 2051 c.c.')."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .describe("Numero di sentenze da recuperare (default: 10)."),
      },
    },
    async ({ riferimento, limit }) => {
      try {
        const db = getDb();

        const authCheck = await verifyPlanAndLimits(authHeader, db);
        if (!authCheck.ok) {
          return { content: [{ type: "text", text: authCheck.text }], isError: authCheck.isError };
        }

        const safeLimit = Math.min(limit ?? 10, 20);
        const translation = translateRiferimento(riferimento);
        const searchKey = translation.key;

        if (!searchKey) {
          return {
            content: [
              {
                type: "text",
                text: `Impossibile interpretare il riferimento normativo: '${riferimento}'. Verifica il formato.`,
              },
            ],
            isError: true,
          };
        }

        const snap = await db
          .collection("sentences")
          .where("riferimenti_normativi_key", "array-contains", searchKey)
          .limit(safeLimit)
          .get();

        if (snap.empty) {
          return {
            content: [
              {
                type: "text",
                text: `Nessun precedente trovato con riferimento diretto a ${riferimento} (chiave: ${searchKey}).`,
              },
            ],
          };
        }

        const formatted = snap.docs
          .map((doc) => formatDocument({ id: doc.id, ...doc.data() } as JurioDocument))
          .join("\n\n---\n\n");
        return { content: [{ type: "text", text: formatted }] };
      } catch (error: unknown) {
        return {
          content: [
            {
              type: "text",
              text: `Errore Firestore: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // --------------------------------------------------------------------------
  // TOOL 4: RICERCA PUNTUALE PER IDENTIFICATIVO (Numero, ECLI, URN)
  // --------------------------------------------------------------------------
  server.registerTool(
    "ricercaIdentificativo",
    {
      title: "Ricerca per Numero Sentenza, ECLI o URN",
      description:
        "Usa questo strumento QUANDO l'utente chiede una sentenza specifica citando il suo identificativo (es. '123/2026', ECLI o URN).",
      inputSchema: {
        identificativo: z.string().max(100).describe("L'identificativo esatto (es. '456/2023' o ECLI)."),
      },
    },
    async ({ identificativo }) => {
      try {
        const db = getDb();

        const authCheck = await verifyPlanAndLimits(authHeader, db);
        if (!authCheck.ok) {
          return { content: [{ type: "text", text: authCheck.text }], isError: authCheck.isError };
        }

        const docs = await findByNumeroSentenzaAdmin(identificativo, db);
        if (!docs || docs.length === 0) {
          return {
            content: [
              { type: "text", text: `Nessun documento trovato per l'identificativo: ${identificativo}` },
            ],
          };
        }

        const formatted = docs.map((doc) => formatDocument(doc)).join("\n\n---\n\n");
        return { content: [{ type: "text", text: formatted }] };
      } catch (error: unknown) {
        return {
          content: [
            {
              type: "text",
              text: `Errore nella ricerca per identificativo: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // --------------------------------------------------------------------------
  // TOOL 5: RICERCA PER MATERIA (Area o Sottocategoria)
  // --------------------------------------------------------------------------
  server.registerTool(
    "ricercaPerMateria",
    {
      title: "Ricerca per Area Giuridica o Sottocategoria",
      description:
        "Trova sentenze filtrate per materia (MACRO-AREA o SOTTOCATEGORIA).\n" +
        "Se cerchi per macro-area, DEVI usare uno dei seguenti valori esatti: '" +
        NOMI_AREE +
        "'.",
      inputSchema: {
        termine: z
          .string()
          .describe(
            "Il nome esatto della Macro-Area oppure una parola chiave per la sottocategoria (es. 'Diritto Penale Sostanziale' oppure 'bancarotta')."
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Numero massimo di risultati (default: 10)."),
      },
    },
    async ({ termine, limit }) => {
      try {
        const db = getDb();

        const authCheck = await verifyPlanAndLimits(authHeader, db);
        if (!authCheck.ok) {
          return { content: [{ type: "text", text: authCheck.text }], isError: authCheck.isError };
        }

        const safeLimit = Math.min(limit ?? 10, 50);
        const docs = await findBySottocategoriaAdmin(termine, safeLimit, db);

        if (!docs || docs.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `Nessuna giurisprudenza trovata per la materia/categoria: '${termine}'. Prova a usare termini più generici o la macro-area esatta.`,
              },
            ],
          };
        }

        const formatted = docs.map((doc) => formatDocument(doc)).join("\n\n---\n\n");
        return { content: [{ type: "text", text: formatted }] };
      } catch (error: unknown) {
        return {
          content: [
            {
              type: "text",
              text: `Errore nella ricerca per materia: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // --------------------------------------------------------------------------
  // TOOL 6: ESTRAZIONE TESTO DA DOCUMENTO (PDF) VIA URL
  // --------------------------------------------------------------------------
  server.registerTool(
    "estraiTestoDocumento",
    {
      title: "Estrai Testo Documento PDF da URL",
      description:
        "Estrae e pulisce il testo da un documento PDF memorizzato su Jurio a partire dal suo URL pubblico.",
      inputSchema: {
        url: z
          .string()
          .describe(
            "L'URL della sentenza su Jurio (es. 'https://jurio.it/giurisprudenza/8c0893ca-5a7a-471a-9ed0-128ab34d0bfa')."
          ),
      },
    },
    async ({ url }) => {
      try {
        // Validazione URL e estrazione sicura del document ID
        const match = url.match(/\/giurisprudenza\/([a-zA-Z0-9_-]+)/);
        const currentDocId = match ? match[1] : null;

        if (!currentDocId) {
          return {
            content: [
              {
                type: "text",
                text: "Impossibile estrarre l'ID del documento dall'URL fornito. Assicurati che l'URL sia nel formato corretto.",
              },
            ],
            isError: true,
          };
        }

        const storagePath = `sentences/${currentDocId}.pdf`;

        const response = await fetch(JURIO_EXTRACT_TEXT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authHeader ? { Authorization: authHeader } : {}),
          },
          body: JSON.stringify({ storagePath }),
        });

        if (response.status === 401) {
          return {
            content: [
              {
                type: "text",
                text: "Sessione Jurio non valida o scaduta. Ricollega il tuo account Jurio dalle impostazioni del client MCP.",
              },
            ],
            isError: true,
          };
        }
        if (response.status === 403) {
          return {
            content: [
              {
                type: "text",
                text: "Accesso non consentito: nessun piano attivo rilevato per leggere i documenti integrali.",
              },
            ],
            isError: false,
          };
        }
        if (response.status === 404) {
          return {
            content: [
              {
                type: "text",
                text: "Errore: Il documento PDF non esiste nello storage per questo identificativo.",
              },
            ],
            isError: true,
          };
        }
        if (response.status === 429) {
          return {
            content: [
              {
                type: "text",
                text: "Hai raggiunto il limite di estrazioni disponibili per il tuo piano. Riprova più tardi.",
              },
            ],
            isError: false,
          };
        }

        const data = (await response
          .json()
          .catch(async () => ({ error: await response.text() }))) as {
          pages?: number;
          text?: string;
          error?: string;
        };

        if (!response.ok) {
          return {
            content: [
              {
                type: "text",
                text: `Errore dal backend Jurio (${response.status}): ${
                  data.error ?? response.statusText
                }`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `ESTRAZIONE COMPLETATA (Pagine: ${data.pages ?? 0})\n\n${data.text ?? ""}`,
            },
          ],
        };
      } catch (error: unknown) {
        return {
          content: [
            {
              type: "text",
              text: `Errore di rete o timeout durante l'estrazione: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  return server;
}