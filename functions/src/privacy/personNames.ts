/**
 * Rilevamento euristico dei nomi di persona fisica in testi italiani.
 *
 * Condiviso da:
 * - `mpc/anonimizza.ts`: mascheramento irreversibile con "[omissis]" dei provvedimenti esposti via MCP;
 * - `privacy/pseudonymization.ts`: pseudonimizzazione reversibile dei dati utente inviati agli LLM.
 *
 * Individua:
 * - nomi introdotti da avv./sig. o da formule di parte ("proposto da", "contro", "a carico di"…);
 * - nomi che precedono "nato/nata a";
 * - sequenze nome+cognome riconosciute tramite gli elenchi di nomi propri e cognomi (`nameLists.ts`).
 *
 * Esclude i magistrati (Presidente, Consigliere, Relatore, P.M.), enti, società e luoghi.
 */

import { AMBIGUOUS_NAME_WORDS, FIRST_NAMES, SURNAMES } from "./nameLists";

export { AMBIGUOUS_NAME_WORDS, FIRST_NAMES, SURNAMES };

// Parole che, anche con l'iniziale maiuscola o tutte maiuscole, non sono mai nomi di persona.
export const PROTECTED = new Set(
  (
    "corte suprema cassazione tribunale appello assise sezione sezioni unite civile penale lavoro tributaria " +
    "repubblica italiana italiano italiane italiani italia stato comune provincia regione ministero ministro " +
    "giustizia interno economia finanze agenzia entrate riscossione inps inail asl ausl anas procura procuratore " +
    "generale pubblico giudice presidente consigliere relatore estensore cancelliere funzionario dott dottor " +
    "dottore dottoressa avv avvocato avvocati avvocatura prof professore sig signor signora signori sigg magistrati " +
    "ricorrente ricorrenti controricorrente resistente intimato intimata imputato imputata imputati parte parti " +
    "consorzio bonifica condominio società spa srl snc sas banca fallimento curatela curatore ente istituto azienda " +
    "università ordinanza sentenza decreto motivi motivo fatto fatti diritto ritenuto considerato rilevato osserva " +
    "pqm legge codice costituzione cost cedu europea unione consiglio collegio udienza camera carabinieri polizia " +
    "guardia finanza questura prefettura prefetto sindaco gip gup tar ecli onere ragioni decisione causa svolgimento " +
    "processo ricorso controricorso memoria memorie omissis " +
    // Parole d'uso comune che spesso iniziano una frase dopo un'etichetta ("Cliente: Buongiorno…").
    "buongiorno buonasera salve gentile egregio spettabile spett cordiali saluti grazie oggetto allegato " +
    "nome cognome cliente assistito controparte mittente destinatario email telefono via viale piazza corso " +
    // Parole tipiche delle denominazioni sociali ("Rossi Costruzioni Srl").
    "costruzioni immobiliare servizi group holding trasporti impianti consulting associati industrie commerciale"
  ).split(" ")
);

export const PARTICLES = new Set("de di da del della dello dei degli dal dalla lo la li le".split(" "));

const NAME_LIKE =
  /^(?:\p{Lu}\p{Ll}{0,3}['’])?(?:\p{Lu}\p{Ll}+|\p{Lu}{3,})(?:-(?:\p{Lu}\p{Ll}+|\p{Lu}{3,}))*$/u;
const ALL_UPPER = /^(?:\p{Lu}+['’])?\p{Lu}{3,}(?:-\p{Lu}{3,})*$/u;
const TOKEN_RE = /(?:\p{L}{1,4}['’])?\p{L}+(?:-\p{L}+)*/gu;

const JUDGE_BEFORE =
  /(?:\bdott(?:\.ssa|ssa|or|ore|oressa)?\.?|\bpres\.|\bcons\.|\bpresidente|\bconsigliere|\brelatore|\bestensore|\bmagistrat[oi]|\bgiudice|\bprocuratore(?:\s+generale)?|\bp\.\s?[gm]\.)\s*:?\s*$/i;
const JUDGE_AFTER = /^\s*[-–—,]?\s*(?:(?:presidente|consigliere|relatore|estensore)\b|rel\.|est\.)/i;
export const PLACE_BEFORE =
  /(?:\b(?:san|santa|santo|via|viale|piazza|piazzale|corso|largo|vicolo|reggio|venezia|ospedale|istituto|liceo|scuola|policlinico|fondazione|borgo|castel|monte|porta)\s+|\bsant['’]|\bs\.\s?)$/i;

const LAWYER_CUE =
  /\b(?:avvocat[oi]\b|avv\.t[io]|avv\.|signor[ae]?\b|sig\.r[ae]|sigg\.ri|sig\.)\s*:?\s*/gi;
const PARTY_CUE =
  /\b(?:propost[oaie]\s+da|ricorso\s+di|contro|nei\s+confronti\s+di|a\s+carico\s+di|nell['’]interesse\s+di)\s*:?\s*/gi;
// Il lookbehind fa partire il match solo all'inizio di una sequenza di spazi: evita backtracking quadratico.
const BORN_CUE = /(?<![\s,]),?\s+nat[oa]\s+(?:a|ad|in|il)\b/gi;

export interface Token {
  text: string;
  lower: string;
  start: number;
  end: number;
}

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const m of text.matchAll(TOKEN_RE)) {
    const start = m.index ?? 0;
    tokens.push({ text: m[0], lower: m[0].toLowerCase(), start, end: start + m[0].length });
  }
  return tokens;
}

/** Parola senza l'eventuale prefisso eliso ("D'Amico" → "amico") per i confronti con gli elenchi. */
export const bareWord = (word: string) => word.toLowerCase().replace(/^\p{L}{1,4}['’]/u, "");
const bare = (t: Token) => bareWord(t.text);

/** Vero se la parola ha la forma di un nome/cognome (iniziale maiuscola o tutta maiuscola) e non è protetta. */
export function isNameLikeWord(word: string): boolean {
  return NAME_LIKE.test(word) && !PROTECTED.has(bareWord(word)) && !PARTICLES.has(word.toLowerCase());
}

const isParticle = (t: Token) => PARTICLES.has(t.lower) && /^\p{Lu}/u.test(t.text);
export const isNameToken = (t: Token) => isNameLikeWord(t.text);
const isUpperName = (t: Token) => isNameToken(t) && ALL_UPPER.test(t.text);

function adjacent(text: string, a: Token, b: Token): boolean {
  return /^[ \t]+$/.test(text.slice(a.end, b.start));
}

/** Estende a destra una sequenza di nomi (con particelle tipo "De", "Di") a partire da `i`. */
function expandRight(text: string, tokens: Token[], s: number, i: number, upperOnly: boolean, max = 5): number {
  let e = i;
  const ok = (t: Token) => (upperOnly ? isUpperName(t) : isNameToken(t));
  while (e + 1 < tokens.length && e - s + 1 < max && adjacent(text, tokens[e], tokens[e + 1])) {
    const next = tokens[e + 1];
    if (ok(next)) {
      e += 1;
      continue;
    }
    const after = tokens[e + 2];
    if (isParticle(next) && after && adjacent(text, next, after) && ok(after)) {
      e += 2;
      continue;
    }
    break;
  }
  return e;
}

/** Estende a sinistra: solo cognomi in maiuscolo ("ROSSI Mario") o particelle, salvo `anyCase`. */
function expandLeft(text: string, tokens: Token[], i: number, e: number, anyCase: boolean, max = 5): number {
  let s = i;
  while (s - 1 >= 0 && e - s + 1 < max && adjacent(text, tokens[s - 1], tokens[s])) {
    const prev = tokens[s - 1];
    if ((anyCase ? isNameToken(prev) : isUpperName(prev)) || isParticle(prev)) {
      s -= 1;
      continue;
    }
    break;
  }
  return s;
}

/** Cognome dell'elenco che non è anche una parola comune, una città o un marchio. */
export function isKnownSurname(t: Token): boolean {
  const word = t.lower;
  const key = SURNAMES.has(word) ? word : bare(t);
  return SURNAMES.has(key) && !AMBIGUOUS_NAME_WORDS.has(key);
}

export interface PersonNameMatch {
  start: number;
  end: number;
  text: string;
  tokens: Token[];
}

export interface PersonNameDetection {
  /** Sequenze individuate come nomi di persona, ordinate e senza sovrapposizioni. */
  matches: PersonNameMatch[];
  /** Parole (minuscole) riconosciute come nomi di magistrati: non vanno propagate. */
  judgeWords: Set<string>;
}

/**
 * Cognomi di una sequenza da propagare alle altre occorrenze del testo ("il ROSSI", "la Bianchi").
 * I nomi propri da soli sono troppo ambigui ("Santa Maria") e non si propagano.
 */
export function surnamesOf(tokens: Token[]): string[] {
  return tokens
    .filter((t) => isNameToken(t) && bare(t).length >= 3 && !FIRST_NAMES.has(bare(t)))
    .map((t) => t.text.replace(/^\p{L}{1,4}['’]/u, ""));
}

export function detectPersonNames(text: string): PersonNameDetection {
  const judgeWords = new Set<string>();
  if (!text) return { matches: [], judgeWords };

  const tokens = tokenize(text);
  const byStart = new Map(tokens.map((t, idx) => [t.start, idx]));
  const byEnd = new Map(tokens.map((t, idx) => [t.end, idx]));
  const spans: PersonNameMatch[] = [];

  const addSpan = (s: number, e: number, checkContext: boolean) => {
    const start = tokens[s].start;
    const end = tokens[e].end;
    const spanTokens = tokens.slice(s, e + 1);
    if (checkContext) {
      const before = text.slice(Math.max(0, start - 45), start);
      const after = text.slice(end, end + 25);
      if (JUDGE_BEFORE.test(before) || JUDGE_AFTER.test(after)) {
        spanTokens.filter(isNameToken).forEach((t) => judgeWords.add(bare(t)));
        return;
      }
      if (PLACE_BEFORE.test(before)) return;
    }
    spans.push({ start, end, text: text.slice(start, end), tokens: spanTokens });
  };

  // 1. Avvocati e "sig./sig.ra" seguiti dal nome.
  for (const m of text.matchAll(LAWYER_CUE)) {
    const i = byStart.get((m.index ?? 0) + m[0].length);
    if (i === undefined) continue;
    const seed = isParticle(tokens[i]) && tokens[i + 1] && isNameToken(tokens[i + 1]) ? i + 1 : i;
    if (!isNameToken(tokens[seed])) continue;
    addSpan(i, expandRight(text, tokens, i, seed, false), false);
  }

  // 2. Formule di parte seguite da nome e cognome in maiuscolo ("contro ROSSI MARIO").
  for (const m of text.matchAll(PARTY_CUE)) {
    const i = byStart.get((m.index ?? 0) + m[0].length);
    if (i === undefined || !isUpperName(tokens[i])) continue;
    const e = expandRight(text, tokens, i, i, true);
    if (tokens.slice(i, e + 1).filter(isNameToken).length >= 2) addSpan(i, e, true);
  }

  // 3. Nome che precede "nato a / nata il".
  for (const m of text.matchAll(BORN_CUE)) {
    const i = byEnd.get(m.index ?? 0);
    if (i === undefined || !isNameToken(tokens[i])) continue;
    addSpan(expandLeft(text, tokens, i, i, true), i, true);
  }

  // 4. Nome proprio da elenco + cognome adiacente ("Mario Rossi", "ROSSI MARIO", "De Luca Anna").
  tokens.forEach((t, i) => {
    if (!isNameToken(t) || !FIRST_NAMES.has(bare(t))) return;
    const e = expandRight(text, tokens, i, i, false, 4);
    const s = expandLeft(text, tokens, i, e, false, 4);
    if (s === i && e === i) return; // nome isolato: troppo ambiguo
    addSpan(s, e, true);
  });

  // 5. Cognome frequente (non ambiguo) + nome di forma qualsiasi ("Kevin Esposito", "ESPOSITO Kevin").
  tokens.forEach((t, i) => {
    if (!isNameToken(t) || !isKnownSurname(t)) return;
    const e = expandRight(text, tokens, i, i, false, 4);
    // A sinistra solo nomi propri da elenco o parole maiuscole ("Kevin Esposito", "KEVIN ESPOSITO"),
    // non qualsiasi parola con l'iniziale maiuscola ("Il Esposito" a inizio frase).
    let s = i;
    while (s - 1 >= 0 && e - s + 1 < 4 && adjacent(text, tokens[s - 1], tokens[s])) {
      const prev = tokens[s - 1];
      if (!(isUpperName(prev) || (isNameToken(prev) && FIRST_NAMES.has(bare(prev))))) break;
      s -= 1;
    }
    if (s === i && e === i) return;
    addSpan(s, e, true);
  });

  // Ordinamento e rimozione delle sovrapposizioni (vince la sequenza che inizia prima/più lunga).
  spans.sort((a, b) => a.start - b.start || b.end - a.end);
  const matches: PersonNameMatch[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start < cursor) continue;
    matches.push(span);
    cursor = span.end;
  }
  return { matches, judgeWords };
}
