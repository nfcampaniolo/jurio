/**
 * Anonimizzazione euristica dei dati delle persone fisiche nei testi restituiti dal server MCP.
 *
 * Maschera con "[omissis]":
 * - codici fiscali, indirizzi email, luogo e data di nascita;
 * - nomi introdotti da avv./sig. o da formule di parte ("proposto da", "contro", "a carico di"…);
 * - nomi che precedono "nato/nata a";
 * - sequenze nome+cognome riconosciute tramite un elenco di nomi propri italiani;
 * - nomi introdotti da un ruolo o da un'etichetta ("tale", "teste", "il ricorrente", "dott." non magistrato);
 * - cognomi usati da soli con l'articolo ("il Cutrupi", "i Pirrone");
 * - ogni altra occorrenza, nello stesso testo, dei nomi e cognomi già individuati.
 *
 * Non maschera i magistrati (Presidente, Consigliere, Relatore, P.M.) né enti, società o luoghi.
 * È un filtro euristico: riduce l'esposizione di dati personali, ma non garantisce
 * un'anonimizzazione completa.
 */

import {
  detectArticleSurnames,
  detectPersonNames,
  firstNamesOf,
  isAfterPlaceWord,
  surnamesOf,
} from "../privacy/personNames";

export const OMISSIS = "[omissis]";

/** Rimuove dati identificativi strutturati: codice fiscale, email, luogo e data di nascita. */
function maskStructuredData(text: string): string {
  return text
    .replace(/\b[A-Z]{6}\d{2}[A-EHLMPRST]\d{2}[A-Z]\d{3}[A-Z]\b/gi, OMISSIS)
    .replace(/\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g, OMISSIS)
    .replace(
      /\b(nat[oa])\s+(?:(?:a|ad|in)\s+[^,;\n]{1,60}?\s*,?\s+il\s+|il\s+)\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/gi,
      `$1 ${OMISSIS}`
    );
}

export function anonimizzaTesto(input: string): string {
  if (!input) return input;
  const text = maskStructuredData(input);
  const { matches, judgeWords } = detectPersonNames(text);
  const articleSurnames = detectArticleSurnames(text, judgeWords);
  if (matches.length === 0 && articleSurnames.length === 0) return text;

  // Sostituzione delle sequenze individuate (già ordinate e senza sovrapposizioni).
  let out = "";
  let cursor = 0;
  const masked = new Set<string>(articleSurnames);
  const firstNames = new Set<string>();
  for (const match of matches) {
    out += text.slice(cursor, match.start) + OMISSIS;
    cursor = match.end;
    surnamesOf(match.tokens).forEach((word) => masked.add(word));
    firstNamesOf(match.tokens).forEach((word) => firstNames.add(word));
  }
  out += text.slice(cursor);

  // Nomi propri ripetuti da soli ("Antonella veniva trasportata…"), esclusi magistrati e luoghi ("Santa Maria").
  for (const name of firstNames) {
    if (judgeWords.has(name.toLowerCase())) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(?<![\\p{L}])${escaped}(?![\\p{L}])`, "gu");
    out = out.replace(pattern, (found: string, offset: number, whole: string) => {
      const after = whole.slice(offset + found.length, offset + found.length + 3);
      return isAfterPlaceWord(whole, offset) || /^[ \t]+\p{Lu}\p{Ll}/u.test(after) ? found : OMISSIS;
    });
  }

  // Propagazione: altre occorrenze degli stessi cognomi (es. "il ROSSI", "la Bianchi").
  for (const word of masked) {
    if (judgeWords.has(word.toLowerCase())) continue;
    const lower = word.toLowerCase();
    const variants = new Set([word, word.toUpperCase(), lower.charAt(0).toUpperCase() + lower.slice(1)]);
    for (const v of variants) {
      const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(`(?<![\\p{L}])${escaped}(?![\\p{L}])`, "gu"), OMISSIS);
    }
  }

  return out.replace(/\[omissis\](?:[ \t]+\[omissis\])+/g, OMISSIS);
}
