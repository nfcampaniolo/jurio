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

/** Parole che a inizio frase hanno l'iniziale maiuscola ma non fanno parte di un nome ("Il Rossi", "Anche Mario"). */
export const CAPITALIZED_FUNCTION_WORDS = new Set(
  (
    "il i gli un una uno ed ma con per in su tra fra ad al allo alla ai agli alle dal dai dagli dalle nel nella " +
    "nei negli nelle sul sulla sui che se anche come quando mentre dopo prima poi ho ha hanno sono ecco oggi ieri " +
    "domani secondo inoltre quindi pertanto infatti tuttavia ebbene peraltro invero orbene non né ne " +
    "questo questa quello quella tale detto detta citato citata medesimo medesima suddetto suddetta"
  ).split(" ")
);

/** Parole che, subito prima di un nome proprio, indicano un luogo ("Santa Maria", "Reggio Emilia", "Via Mario"). */
const PLACE_WORDS = new Set(
  "san santa santo sant via viale piazza piazzale corso largo vicolo reggio venezia ospedale istituto liceo scuola policlinico fondazione borgo castel monte porta palazzo".split(
    " "
  )
);

export const PARTICLES = new Set("de di da del della dello dei degli dal dalla lo la li le".split(" "));

const NAME_LIKE =
  /^(?:\p{Lu}\p{Ll}{0,3}['’])?(?:\p{Lu}\p{Ll}+|\p{Lu}{3,})(?:-(?:\p{Lu}\p{Ll}+|\p{Lu}{3,}))*$/u;
const ALL_UPPER = /^(?:\p{Lu}+['’])?\p{Lu}{3,}(?:-\p{Lu}{3,})*$/u;
const TOKEN_RE = /(?:\p{L}{1,4}['’])?\p{L}+(?:-\p{L}+)*/gu;

/**
 * Magistrato: il nome segue un ruolo (eventualmente con "dott." in mezzo: "Presidente della Sezione dott.",
 * "Sostituto Procuratore Generale Dott.") oppure è seguito dal ruolo ("Dott. ROSSI Mario - Presidente -").
 * "Dott." da solo non basta: precede anche consulenti, medici, commercialisti.
 */
const JUDGE_BEFORE =
  /(?:\bpres\.|\bcons\.|\bpresidente|\bconsigliere|\brelatore|\bestensore|\bmagistrat[oi]|\bgiudice|\bprocuratore(?:\s+generale)?|\bavvocato\s+generale|\bp\.\s?[gm]\.|\bg\.\s?[uio]\.|\bgip\b|\bgup\b)[^.;\n]{0,30}?(?:\bdott(?:\.ssa|ssa|or|ore|oressa)?\.?)?\s*:?\s*$/i;
const JUDGE_AFTER = /^\s*[-–—,]?\s*(?:(?:presidente|consigliere|relatore|estensore)\b|rel\.|est\.)/i;
/** Ausiliari e professionisti: anche se nel contesto compare "P.M." o "giudice" non sono magistrati. */
const NOT_JUDGE_BEFORE = /\b(?:consulent[ei]|perit[oi]|c\.?\s?t\.?\s?[up]\.?|ausiliari[oa]|praticante|difensor[ei]|custode|delegat[oa])\b[^;\n]*$/i;
export const PLACE_BEFORE =
  /(?:\b(?:san|santa|santo|via|viale|piazza|piazzale|corso|largo|vicolo|reggio|venezia|ospedale|istituto|liceo|scuola|policlinico|fondazione|borgo|castel|monte|porta)\s+|\bsant['’]|\bs\.\s?)$/i;

const LAWYER_CUE =
  /\b(?:(?:praticante\s+)?avvocat(?:[oia]|essa)\b(?!\s+generale)|avv\.t[ioa]|avv\.ssa|avv\.|signor[ae]?\b|sig\.r[ae]|sigg\.ri|sig\.)\s*:?\s*/gi;
/**
 * Etichette che introducono una persona ma possono precedere anche un magistrato ("dott.") o essere
 * seguite da un ente ("il ricorrente Comune di…"): il contesto viene verificato.
 */
const PERSON_CUE =
  /\b(?:tale|teste|testimone|testi|praticante|consulente(?:\s+tecnico)?(?:\s+(?:d['’]ufficio|di\s+parte|del\s+(?:p\.\s?m\.|pm|pubblico\s+ministero)))?|c\.?\s?t\.?\s?[up]\.?|perito|dott(?:\.ssa|ssa|or|ore|oressa)?\.?|ing\.|arch\.|geom\.|rag\.|prof(?:\.ssa|\.)|notaio|ricorrente|controricorrente|resistente|imputat[oa]|indagat[oa]|vittima|persona\s+offesa|appellante|appellat[oa]|attore|attrice|convenut[oa]|nipote|figli[oa]|madre|padre|moglie|marito|coniuge|fratello|sorella)\s*[:,]?\s*/gi;
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

/** Parole consecutive separate solo da spazi o da un singolo a capo (i PDF spezzano i nomi tra le righe). */
function adjacent(text: string, a: Token, b: Token): boolean {
  return /^[ \t]*\r?\n?[ \t]*$/.test(text.slice(a.end, b.start)) && b.start > a.end;
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
    const nameLike = anyCase ? isNameToken(prev) && !CAPITALIZED_FUNCTION_WORDS.has(prev.lower) : isUpperName(prev);
    if (nameLike || isParticle(prev)) {
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
      if ((JUDGE_BEFORE.test(before) && !NOT_JUDGE_BEFORE.test(before)) || JUDGE_AFTER.test(after)) {
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

  // 1b. Persone introdotte da un'etichetta o da un ruolo ("tale Rossi", "il teste Bianchi", "dott. Neri",
  //     "il ricorrente Verdi"), escluso il contesto dei magistrati.
  for (const m of text.matchAll(PERSON_CUE)) {
    const i = byStart.get((m.index ?? 0) + m[0].length);
    if (i === undefined) continue;
    const seed = isParticle(tokens[i]) && tokens[i + 1] && isNameToken(tokens[i + 1]) ? i + 1 : i;
    if (!isNameToken(tokens[seed]) || CAPITALIZED_FUNCTION_WORDS.has(tokens[seed].lower)) continue;
    addSpan(i, expandRight(text, tokens, i, seed, false), true);
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

  // 4. Nome proprio da elenco + cognome adiacente ("Mario Rossi", "ROSSI MARIO", "Pirrone Antonella").
  tokens.forEach((t, i) => {
    if (!isNameToken(t) || !FIRST_NAMES.has(bare(t))) return;
    const prev = tokens[i - 1];
    if (prev && PLACE_WORDS.has(bare(prev)) && adjacent(text, prev, t)) return; // "Santa Maria", "Reggio Emilia"
    const e = expandRight(text, tokens, i, i, false, 4);
    const s = expandLeft(text, tokens, i, e, true, 4);
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

/** Parole istituzionali che seguono spesso un articolo e non sono già tra le protette. */
const INSTITUTIONAL_WORDS = new Set(
  (
    "regolamento convenzione direttiva trattato carta commissione parlamento senato governo garante fondo cassa " +
    "difensore difesa legislatore territoriale amministrazione autorità ufficio cancelleria segreteria ordine " +
    "primo secondo terzo quarto quinto sesto settimo ottavo nono decimo"
  ).split(" ")
);

const ARTICLE_SURNAME =
  /\b(?:il|lo|la|i|gli|le|al|allo|alla|ai|del|dello|della|dei|dal|dallo|dalla|dai|col|nel|nella|sul|sulla)\s+((?:\p{Lu}\p{Ll}{0,3}['’])?(?:\p{Lu}\p{Ll}+|\p{Lu}{3,}))(?![\p{L}'’-])/gu;

/**
 * Cognomi usati da soli con l'articolo ("il Cutrupi", "i Pirrone"), tipici delle sentenze.
 * Per non confonderli con enti e atti ("la Corte", "il Regolamento") la parola deve:
 * comparire almeno due volte (o essere un cognome noto), non comparire mai in minuscolo nel testo,
 * non essere seguita da un'altra parola maiuscola e non essere il cognome di un magistrato.
 */
export function detectArticleSurnames(text: string, judgeWords: Set<string> = new Set()): string[] {
  const candidates = new Map<string, number>();
  for (const m of text.matchAll(ARTICLE_SURNAME)) {
    const word = m[1];
    const lower = bareWord(word);
    const after = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 3);
    if (/^[ \t]+\p{Lu}/u.test(after)) continue;
    if (!isNameLikeWord(word) || CAPITALIZED_FUNCTION_WORDS.has(lower) || INSTITUTIONAL_WORDS.has(lower)) continue;
    if (judgeWords.has(lower) || AMBIGUOUS_NAME_WORDS.has(lower) || lower.length < 3) continue;
    candidates.set(word, (candidates.get(word) ?? 0) + 1);
  }

  const result: string[] = [];
  for (const [word, count] of candidates) {
    const lower = word.toLowerCase();
    const escaped = lower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(?<![\\p{L}])${escaped}(?![\\p{L}])`, "u").test(text)) continue; // usata anche come parola comune
    const known = SURNAMES.has(lower);
    const occurrences = text.match(new RegExp(`(?<![\\p{L}])${escaped}(?![\\p{L}])`, "giu"))?.length ?? 0;
    if (known || count >= 2 || occurrences >= 2) result.push(word);
  }
  return result;
}

/** Vero se, subito prima della posizione, c'è una parola che indica un luogo ("Santa", "Via", "Reggio"). */
export function isAfterPlaceWord(text: string, start: number): boolean {
  const before = /(\p{L}+)['’]?[ \t]*$/u.exec(text.slice(Math.max(0, start - 15), start));
  return !!before && PLACE_WORDS.has(before[1].toLowerCase());
}

/** Nomi propri contenuti in una sequenza, da propagare alle menzioni isolate ("Antonella" dopo "Antonella Pirrone"). */
export function firstNamesOf(tokens: Token[]): string[] {
  return tokens.filter((t) => isNameToken(t) && FIRST_NAMES.has(bare(t))).map((t) => t.text);
}
