import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { JURIO_EXTRACT_TEXT_URL } from "../constants";
import { mcpFetch } from "../utils/mcpFetch";
import { anonimizzaTesto } from "../anonimizza";

// ~8-10k token per parte: resta ben sotto il limite di output dei client MCP (~25k token).
export const MAX_CHARS_PER_PARTE = 30_000;

/**
 * Divide il testo in parti di al massimo `maxChars` caratteri, tagliando preferibilmente
 * a fine paragrafo o a fine frase per non spezzare il periodo.
 */
export function splitInParti(text: string, maxChars = MAX_CHARS_PER_PARTE): string[] {
  const parti: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    if (end < text.length) {
      const window = text.slice(start, end);
      const minCut = Math.floor(maxChars * 0.6);
      const paragraphCut = window.lastIndexOf("\n\n");
      const sentenceCut = window.lastIndexOf(". ");
      if (paragraphCut >= minCut) end = start + paragraphCut + 2;
      else if (sentenceCut >= minCut) end = start + sentenceCut + 2;
    }
    parti.push(text.slice(start, end).trim());
    start = end;
  }
  return parti.length > 0 ? parti : [""];
}

const fmt = (n: number) => n.toLocaleString("it-IT");

const AVVISO_ANONIMIZZAZIONE =
  "NOTA: i nomi delle persone fisiche sono mascherati automaticamente con [omissis] (filtro euristico).";

export function registerEstraiTestoDocumento(server: McpServer, authHeader: string): void {
  server.registerTool(
    "estraiTestoDocumento",
    {
      title: "Estrai Testo Documento PDF da URL",
      description:
        "Estrae e pulisce il testo integrale di un provvedimento memorizzato su Jurio a partire dal suo URL pubblico.\n" +
        "I nomi delle persone fisiche (parti, difensori) sono sostituiti con [omissis].\n" +
        `DOCUMENTI LUNGHI: il testo è restituito in parti da massimo ${fmt(MAX_CHARS_PER_PARTE)} caratteri. ` +
        "L'intestazione della risposta indica 'Parte N di M'. Se N < M, per leggere il seguito DEVI richiamare " +
        "lo strumento con lo stesso 'url' e 'parte' = N+1, ripetendo finché non arrivi alla parte M " +
        "(che riporta 'fine del documento').",
      inputSchema: {
        url: z
          .string()
          .describe(
            "L'URL della sentenza su Jurio (es. 'https://jurio.it/giurisprudenza/8c0893ca-5a7a-471a-9ed0-128ab34d0bfa')."
          ),
        // coerce: accetta anche "2" dai client che hanno in cache uno schema senza 'parte'.
        parte: z.coerce
          .number()
          .int()
          .min(1)
          .default(1)
          .describe(
            "Numero della parte da restituire (1-based). La risposta indica il totale delle parti ('Parte N di M'). " +
              "Richiamare il tool con lo stesso url e parte successiva finché non si arriva a M."
          ),
      },
    },
    async ({ url, parte }) => {
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
      const res = await mcpFetch<{ pages?: number; text?: string }>(
        JURIO_EXTRACT_TEXT_URL,
        authHeader,
        { storagePath }
      );

      if (res.errorText) {
        return { content: [{ type: "text", text: res.errorText }], isError: res.isError };
      }

      // Il testo integrale (copia non ufficiale) contiene i nomi delle parti: si mascherano prima di paginare.
      const fullText = anonimizzaTesto(res.data?.text ?? "");
      const pagine = res.data?.pages ?? 0;
      const parti = splitInParti(fullText);
      const totaleParti = parti.length;
      const richiesta = parte ?? 1;

      if (richiesta > totaleParti) {
        return {
          content: [
            {
              type: "text",
              text: `La parte richiesta non esiste. Il documento ha ${totaleParti} ${totaleParti === 1 ? "parte" : "parti"}.`,
            },
          ],
          isError: true,
        };
      }

      if (totaleParti === 1) {
        return {
          content: [
            { type: "text", text: `ESTRAZIONE COMPLETATA (Pagine: ${pagine})\n${AVVISO_ANONIMIZZAZIONE}\n\n${fullText}` },
          ],
        };
      }

      const ultima = richiesta === totaleParti;
      const header =
        `ESTRAZIONE COMPLETATA (Pagine: ${pagine}) — Parte ${richiesta} di ${totaleParti}` +
        (ultima ? " — fine del documento" : "") +
        ` (testo totale: ${fmt(fullText.length)} caratteri)\n${AVVISO_ANONIMIZZAZIONE}`;
      const footer = ultima
        ? ""
        : `\n\n[Continua: richiama estraiTestoDocumento con lo stesso url e parte: ${richiesta + 1}]`;

      return {
        content: [{ type: "text", text: `${header}\n\n${parti[richiesta - 1]}${footer}` }],
      };
    }
  );
}
