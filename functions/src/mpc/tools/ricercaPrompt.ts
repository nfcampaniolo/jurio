import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDb } from "../../_deps";
import { verifyPlanAndLimits } from "../helpers";

export function registerGetPromptList(server: McpServer, authHeader: string): void {
  server.registerTool(
    "getPromptList",
    {
      title: "Ottieni Lista Prompt",
      description:
        "Recupera i prompt. Fornisce istruzioni, obiettivi e schemi di riferimento ottimizzati per la generazione di analisi strutturate in chat per client AI.",
      inputSchema: {
        type: z
          .string()
          .optional()
          .describe(
            "Filtra opzionalmente per tipo di prompt (es. 'analisi'). Lascia vuoto per recuperarli tutti."
          ),
      },
    },
    async ({ type: promptType }) => {
      try {
        const db = getDb();

        // Verfica piano, token e limiti utente
        const authCheck = await verifyPlanAndLimits(authHeader, db);
        if (!authCheck.ok) {
          return { content: [{ type: "text", text: authCheck.text }], isError: authCheck.isError };
        }

        // Interrogazione della collezione prompt_list
        let query: FirebaseFirestore.Query = db.collection("prompt_list");
        if (promptType) {
          query = query.where("type", "==", promptType);
        }

        const snapshot = await query.get();

        if (snapshot.empty) {
          return {
            content: [
              {
                type: "text",
                text: promptType
                  ? `Nessun prompt trovato nella collezione 'prompt_list' per il tipo '${promptType}'.`
                  : "Nessun prompt trovato nella collezione 'prompt_list'.",
              },
            ],
          };
        }

        // Mappatura dei documenti da Firestore
        const prompts = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || "Senza titolo",
            type: data.type || "generico",
            objective: data.objective || "",
            content: data.content || "",
            schema: data.schema || "",
            createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || null,
          };
        });

        // Formattazione ottimizzata per il rendering visuale del client AI
        const formattedPrompts = prompts
          .map(
            (p) => `
---
### 🧠 **PROMPT: ${p.title}** *(Tipo: ${p.type})*
* **ID Documento:** \`\${p.id}\`
* **Obiettivo:** ${p.objective}

#### **Istruzioni Operative (Content):**
> ${p.content}

#### **Struttura Dati di Riferimento:**
\`\`\`typescript
\${p.schema}
\`\`\`

> 💡 **ISTRUZIONI DI PRESENTAZIONE PER L'AI CLIENT (Claude / ChatGPT):**
> 1. Quando applichi questo prompt all'analisi di un documento, **NON restituire il codice JSON grezzo** all'utente finale.
> 2. Utilizza la "Struttura Dati di Riferimento" come traccia guida per analizzare e organizzare tutte le informazioni.
> 3. Renderizza la risposta finale in **Markdown elegante e altamente leggibile**, facendo uso di:
>    * **Tabelle** per riassumere metadati, parti e tipologia di documento;
>    * **Sezioni con Emoji** per distinguere Diritti (🟢), Obblighi (🔴), Criticità/Rischi (⚠️) e Note (🔍);
>    * **Grassetto ed Elenchi puntati** per evidenziare chiaramente soggetti, scadenze e articoli di riferimento.
`
          )
          .join("\n\n");

        return {
          content: [
            {
              type: "text",
              text: `PROMPT DISPONIBILI NELLA COLLEZIONE 'prompt_list' (${prompts.length} trovati):\n${formattedPrompts}`,
            },
          ],
        };
      } catch (error: unknown) {
        return {
          content: [
            {
              type: "text",
              text: `Errore nel recupero della lista prompt: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}