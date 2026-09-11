import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { translateRiferimento } from "./utils";
import { getDb } from "./deps";
import { AREE } from "./params";

const JURIO_VECTOR_SEARCH_URL = "https://vectorsearchjurio-vqoobrenua-ew.a.run.app";


const NOMI_AREE = Object.values(AREE).join("', '");

export function createMcpServer(authHeader: string): McpServer {
  const server = new McpServer({
    name: "jurio-mcp",
    version: "1.0.1",
  });
  
  // --------------------------------------------------------------------------
  // TOOL 1: RICERCA VETTORIALE / SEMANTICA
  // --------------------------------------------------------------------------
  server.registerTool(
    "ricercaSemantica",
    {
      title: "Ricerca Semantica Precedenti Giurisprudenziali",
      description: 
        "Cerca nella giurisprudenza italiana confrontando il quesito con un indice vettoriale composto da FATTISPECIE CONCRETA (dinamica dei fatti) e MASSIMA (principio di diritto espresso dal giudice).\n" +
        "- QUANDO USARLO: Per trovare orientamenti giurisprudenziali, casi analoghi e applicazioni pratiche di istituti legali.\n" +
        "- COME STRUTTURARE LA QUERY: Costruisci una frase densa che combini sia gli ELEMENTI DI FATTO salienti (es. condotta, contesto, danno) sia la QUALIFICAZIONE GIURIDICA o l'effetto conteso (es. nesso causale, onere della prova, risarcimento).\n" +
        "- DA EVITARE: Non inserire convenevoli, preposizioni inutili o soli articoli di legge (per cercare singoli articoli usa 'ricercaNormativa').\n" +
        "- ESEMPIO OTTIMALE: 'caduta pedone dislivello marciapiede insidia stradale non visibile caso fortuito 2051 cc'",
      inputSchema: {
        query: z.string().min(5).describe(
          "Sintesi densa che unisce elementi fattuali specifici (fatto storico) e istituto giuridico/principio applicabile. Evitare stop-word."
        ),
        limit: z.number().int().min(1).max(15).optional().describe("Numero massimo di precedenti da estrarre (default: 3)."),
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

        const data = await response.json().catch(async () => ({ error: await response.text() }));

        if (!response.ok) {
          return {
            content: [{ type: "text", text: `Errore dal backend Jurio: ${data.error ?? response.statusText}` }],
            isError: true,
          };
        }

        const matches = data.topMatches ?? [];
        if (matches.length === 0) {
          return { content: [{ type: "text", text: "Nessuna sentenza pertinente trovata per questo quesito." }] };
        }

        const formatted = matches.map((m: any) => formatDocument(m)).join("\n\n---\n\n");
        return { content: [{ type: "text", text: formatted }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Errore di rete: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // --------------------------------------------------------------------------
  // TOOL 2: RICERCA PUNTUALE PER NORMATIVA (Firestore Key Lookup)
  // --------------------------------------------------------------------------
  server.registerTool(
    "ricercaNormativa",
    {
      title: "Ricerca Sentenze per Riferimento Normativo",
      description:
        "Trova massime e sentenze associate a uno specifico articolo di legge o codice. " +
        "USO OBBLIGATORIO: Passa un singolo articolo formattato secondo lo standard italiano. " +
        "Esempi validi: 'art. 2051 c.c.', 'art. 380-bis c.p.c.', 'art. 3 d.lgs. n. 50/2016', 'art. 144 d.p.r. n. 115/2002'. " +
        "Se l'utente cita più articoli (es. 'artt. 1453 e 1455 c.c.'), invoca questo strumento più volte, una per ciascun articolo.",
      inputSchema: {
        riferimento: z.string().describe("La norma da cercare nel formato 'art. [numero] [fonte]' (es. 'art. 2051 c.c.')."),
        limit: z.number().int().min(1).max(20).optional().describe("Numero di sentenze da recuperare (default: 3)."),
      },
    },
    async ({ riferimento, limit }) => {
      try {
        const safeLimit = Math.min(limit ?? 10, 20);

        const translation = translateRiferimento(riferimento);
        const searchKey = translation.key;

        if (!searchKey) {
          return {
            content: [{ type: "text", text: `Impossibile interpretare il riferimento normativo: '${riferimento}'. Verifica il formato.` }],
            isError: true,
          };
        }

        const db = getDb();
        const snap = await db
          .collection("sentences")
          .where("riferimenti_normativi_key", "array-contains", searchKey)
          .limit(safeLimit)
          .get();

        if (snap.empty) {
          return {
            content: [{ type: "text", text: `Nessun precedente trovato con riferimento diretto a ${riferimento} (chiave: ${searchKey}).` }],
          };
        }

        const formatted = snap.docs.map((doc: any) => formatDocument({ id: doc.id, ...doc.data() })).join("\n\n---\n\n");
        return { content: [{ type: "text", text: formatted }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Errore Firestore: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // --------------------------------------------------------------------------
  // TOOL 3: RICERCA PUNTUALE PER IDENTIFICATIVO (Numero, ECLI, URN)
  // --------------------------------------------------------------------------
  server.registerTool(
    "ricercaIdentificativo",
    {
      title: "Ricerca per Numero Sentenza, ECLI o URN",
      description:
        "Usa questo strumento QUANDO l'utente chiede una sentenza specifica citando il suo identificativo. " +
        "Formati supportati: " +
        "- Numero e Anno (es. '123/2026', '2/2024') " +
        "- Codice ECLI (es. 'ECLI:IT:CASS:2024:12345') " +
        "- Codice URN (es. urn:nir:corte.cassazione;civile;sezione.1:decreto:2025-02-20;4438)",
      inputSchema: {
        identificativo: z.string().describe("L'identificativo esatto (es. '456/2023' o ECLI)."),
      },
    },
    async ({ identificativo }) => {
      try {
        const db = getDb();
        const docs = await findByNumeroSentenzaAdmin(identificativo, db);
        if (!docs || docs.length === 0) {
          return {
            content: [{ type: "text", text: `Nessun documento trovato per l'identificativo: ${identificativo}` }],
          };
        }
        const formatted = docs.map((doc: any) => formatDocument(doc)).join("\n\n---\n\n");
        return { content: [{ type: "text", text: formatted }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Errore nella ricerca per identificativo: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // --------------------------------------------------------------------------
  // TOOL 4: RICERCA PER MATERIA (Area o Sottocategoria)
  // --------------------------------------------------------------------------
  server.registerTool(
    "ricercaPerMateria",
    {
      title: "Ricerca per Area Giuridica o Sottocategoria",
      description:
        "Trova sentenze filtrate per materia. Puoi cercare per MACRO-AREA o per SOTTOCATEGORIA specifica (es. 'licenziamento', 'usucapione', 'stupefacenti'). " +
        "Se cerchi per macro-area, DEVI usare uno dei seguenti valori esatti: '" + NOMI_AREE + "'.",
      inputSchema: {
        termine: z.string().describe("Il nome esatto della Macro-Area oppure una parola chiave per la sottocategoria (es. 'Diritto Penale Sostanziale' oppure 'bancarotta')."),
        limit: z.number().int().min(1).max(50).optional().describe("Numero massimo di risultati (default: 10)."),
      },
    },
    async ({ termine, limit }) => {
      try {
        const safeLimit = Math.min(limit ?? 10, 50);
        const db = getDb();
        const docs = await findBySottocategoriaAdmin(termine, safeLimit, db);

        if (!docs || docs.length === 0) {
          return {
            content: [{ type: "text", text: `Nessuna giurisprudenza trovata per la materia/categoria: '${termine}'. Prova a usare termini più generici o la macro-area esatta.` }],
          };
        }

        const formatted = docs.map((doc: any) => formatDocument(doc)).join("\n\n---\n\n");
        return { content: [{ type: "text", text: formatted }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Errore nella ricerca per materia: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  return server;
}

// ============================================================================
// FUNZIONI HELPER INTERNE
// ============================================================================

function formatDocument(doc: any): string {
  const lines: string[] = [];
  lines.push(`DOCUMENTO: ${doc.tipo_documento ?? ""} ${doc.organo_giudicante ?? ""}, N. ${doc.numero_sentenza ?? ""}`);
  if (doc.data_decisione) lines.push(`DATA: ${doc.data_decisione}`);
  if (doc.massima?.trim()) lines.push(`MASSIMA: ${doc.massima.trim()}`);
  if (doc.fattispecie_rilevante?.trim()) lines.push(`FATTISPECIE: ${doc.fattispecie_rilevante.trim()}`);
  if (doc.url?.trim()) lines.push(`URL: https://jurio.it/giurisprudenza/${doc.id?.trim() ?? ""}`);
  return lines.join("\n");
}

/**
 * Ricerca puntuale per identificativo (Admin SDK)
 */
async function findByNumeroSentenzaAdmin(identificativo: string, db: any): Promise<any[]> {
  const match = identificativo.match(/(\d+)\/(\d+)/);
  let variazioniNumero: string[] = [];

  if (match) {
    const numeroBase = parseInt(match[1], 10);
    const anno = match[2];
    const combinazioni = new Set<string>();
    combinazioni.add(`${numeroBase}/${anno}`);                            
    combinazioni.add(`${String(numeroBase).padStart(2, '0')}/${anno}`);   
    combinazioni.add(`${String(numeroBase).padStart(3, '0')}/${anno}`);   
    combinazioni.add(`${String(numeroBase).padStart(4, '0')}/${anno}`);   
    combinazioni.add(`${String(numeroBase).padStart(5, '0')}/${anno}`);   
    combinazioni.add(match[0]);                                           
    variazioniNumero = Array.from(combinazioni);
  }

  const sentencesRef = db.collection("sentences");

  // Prepariamo le promises per l'esecuzione parallela
  const promises = [];
  
  if (variazioniNumero.length > 0) {
    promises.push(sentencesRef.where("numero_sentenza", "in", variazioniNumero).get());
  } else {
    // Fallback vuoto per mantenere allineati gli indici dell'array
    promises.push(Promise.resolve({ empty: true, docs: [] }));
  }

  const idTrimmed = identificativo.trim();
  promises.push(sentencesRef.where("ecli", "==", idTrimmed).get());
  promises.push(sentencesRef.where("urn", "==", idTrimmed).get());

  const [snapNumero, snapEcli, snapUrn] = await Promise.all(promises);

  const uniqueDocs = new Map();

  // Unione risultati evitando duplicati e iniettando l'ID del documento
  [...snapNumero.docs, ...snapEcli.docs, ...snapUrn.docs].forEach((d) => {
    uniqueDocs.set(d.id, { id: d.id, ...d.data() });
  });

  return Array.from(uniqueDocs.values());
}

/**
 * Ricerca per materia o area (Admin SDK)
 */

async function findBySottocategoriaAdmin(termine: string, max: number, db: any): Promise<any[]> {
  const original = termine.trim();
  const lower = original.toLowerCase();
  
  if (!lower) return [];

  const sentencesRef = db.collection("sentences");

  // Eseguiamo due query parallele per aggirare in modo sicuro le differenze di case
  // tra le macro-aree (spesso Title Case) e le sottocategorie (spesso array lowercase).
  const [snapArea, snapSotto] = await Promise.all([
    sentencesRef.where("area", "==", original).limit(max).get(),
    sentencesRef.where("sottocategoria", "array-contains", lower).limit(max).get()
  ]);

  const uniqueDocs = new Map();
  // Mappiamo entrambi i risultati garantendo l'iniezione dell'id per i link di Jurio
  snapArea.docs.forEach((d: any) => uniqueDocs.set(d.id, { id: d.id, ...d.data() }));
  snapSotto.docs.forEach((d: any) => uniqueDocs.set(d.id, { id: d.id, ...d.data() }));

  // Ritorniamo i valori assicurandoci di non superare il limite massimo richiesto
  return Array.from(uniqueDocs.values()).slice(0, max);
}