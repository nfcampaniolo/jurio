/**
 * Anonimizzazione euristica dei dati delle persone fisiche nei testi restituiti dal server MCP.
 *
 * Maschera con "[omissis]":
 * - codici fiscali, indirizzi email, luogo e data di nascita;
 * - nomi introdotti da avv./sig. o da formule di parte ("proposto da", "contro", "a carico di"…);
 * - nomi che precedono "nato/nata a";
 * - sequenze nome+cognome riconosciute tramite un elenco di nomi propri italiani;
 * - ogni altra occorrenza, nello stesso testo, dei nomi e cognomi già individuati.
 *
 * Non maschera i magistrati (Presidente, Consigliere, Relatore, P.M.) né enti, società o luoghi.
 * È un filtro euristico: riduce l'esposizione di dati personali, ma non garantisce
 * un'anonimizzazione completa.
 */

export const OMISSIS = "[omissis]";

const FIRST_NAMES = new Set(
  (
    "adriana adriano agata agostino alberto alba alessandra alessandro alessia alessio alfonso alfredo alice " +
    "alessandra amedeo andrea angela angelo anna annalisa antonella antonietta antonino antonio arianna armando " +
    "arturo attilio aurelio barbara beatrice benedetta bruno calogero camilla carla carlo carmela carmelo carmine " +
    "caterina cesare chiara claudia claudio concetta corrado cosimo cristian cristiana cristina cristiano damiano " +
    "daniela daniele dario davide debora diego domenico donatella donato edoardo elena eleonora elisa elisabetta " +
    "emanuela emanuele emilio enrico enzo erika ernesto ettore eugenio fabiana fabio fabrizio federica federico " +
    "filippo filomena flavio francesca francesco gabriele gabriella gaetano giacomo gianluca gianni giorgia giorgio " +
    "giovanna giovanni girolamo giulia giuliana giuliano giulio giuseppa giuseppe giuseppina graziella guido " +
    "ignazio ilaria immacolata irene ivan ivana jessica laura leonardo letizia liliana lino lisa loredana lorena " +
    "lorenzo luana luca lucia luciana luciano lucio luigi luisa manuel manuela marcello marco margherita maria " +
    "mariagrazia mariangela marianna mario marisa martina massimiliano massimo matilde matteo mattia maurizio " +
    "mauro michela michele milena mirko monica nadia nicola nicoletta nicolò noemi nunzia nunzio orazio ornella " +
    "pamela paola paolo pasquale patrizia patrizio piera piero pietro raffaele raffaella renato riccardo rita " +
    "roberta roberto rocco romano rosalba rosanna rosaria rosario rossella ruggero sabrina salvatore samuele " +
    "sandra sandro sara saverio sebastiano serena sergio silvana silvia silvio simona simone sofia stefania " +
    "stefano teresa tiziana tiziano tommaso ugo umberto valentina valentino valeria valerio vanessa veronica " +
    "vincenza vincenzo virginia vito vittorio walter"
  ).split(" ")
);

// Parole che, anche con l'iniziale maiuscola o tutte maiuscole, non sono mai nomi di persona.
const PROTECTED = new Set(
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
    "processo ricorso controricorso memoria memorie omissis"
  ).split(" ")
);

const PARTICLES = new Set("de di da del della dello dei degli dal dalla lo la li le".split(" "));

const NAME_LIKE =
  /^(?:\p{Lu}\p{Ll}{0,3}['’])?(?:\p{Lu}\p{Ll}+|\p{Lu}{3,})(?:-(?:\p{Lu}\p{Ll}+|\p{Lu}{3,}))*$/u;
const ALL_UPPER = /^(?:\p{Lu}+['’])?\p{Lu}{3,}(?:-\p{Lu}{3,})*$/u;
const TOKEN_RE = /(?:\p{L}{1,4}['’])?\p{L}+(?:-\p{L}+)*/gu;

const JUDGE_BEFORE =
  /(?:\bdott(?:\.ssa|ssa|or|ore|oressa)?\.?|\bpres\.|\bcons\.|\bpresidente|\bconsigliere|\brelatore|\bestensore|\bmagistrat[oi]|\bgiudice|\bprocuratore(?:\s+generale)?|\bp\.\s?[gm]\.)\s*:?\s*$/i;
const JUDGE_AFTER = /^\s*[-–—,]?\s*(?:(?:presidente|consigliere|relatore|estensore)\b|rel\.|est\.)/i;
const PLACE_BEFORE =
  /(?:\b(?:san|santa|santo|via|viale|piazza|piazzale|corso|largo|vicolo|reggio|venezia|ospedale|istituto|liceo|scuola|policlinico|fondazione|borgo|castel|monte|porta)\s+|\bsant['’]|\bs\.\s?)$/i;

const LAWYER_CUE =
  /\b(?:avvocat[oi]\b|avv\.t[io]|avv\.|signor[ae]?\b|sig\.r[ae]|sigg\.ri|sig\.)\s*:?\s*/gi;
const PARTY_CUE =
  /\b(?:propost[oaie]\s+da|ricorso\s+di|contro|nei\s+confronti\s+di|a\s+carico\s+di|nell['’]interesse\s+di)\s*:?\s*/gi;
const BORN_CUE = /,?\s+nat[oa]\s+(?:a|ad|in|il)\b/gi;

interface Token {
  text: string;
  lower: string;
  start: number;
  end: number;
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const m of text.matchAll(TOKEN_RE)) {
    const start = m.index ?? 0;
    tokens.push({ text: m[0], lower: m[0].toLowerCase(), start, end: start + m[0].length });
  }
  return tokens;
}

// Parola senza l'eventuale prefisso eliso ("D'Amico" → "amico") per i confronti con gli elenchi.
const bare = (t: Token) => t.lower.replace(/^\p{L}{1,4}['’]/u, "");

const isParticle = (t: Token) => PARTICLES.has(t.lower) && /^\p{Lu}/u.test(t.text);
const isNameToken = (t: Token) => NAME_LIKE.test(t.text) && !PROTECTED.has(bare(t)) && !PARTICLES.has(t.lower);
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

interface Span {
  start: number;
  end: number;
  tokens: Token[];
}

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
  const tokens = tokenize(text);
  const byStart = new Map(tokens.map((t, idx) => [t.start, idx]));
  const byEnd = new Map(tokens.map((t, idx) => [t.end, idx]));

  const spans: Span[] = [];
  const judgeTokens = new Set<string>();

  const addSpan = (s: number, e: number, checkContext: boolean) => {
    const start = tokens[s].start;
    const end = tokens[e].end;
    const spanTokens = tokens.slice(s, e + 1);
    if (checkContext) {
      const before = text.slice(Math.max(0, start - 45), start);
      const after = text.slice(end, end + 25);
      if (JUDGE_BEFORE.test(before) || JUDGE_AFTER.test(after)) {
        spanTokens.filter(isNameToken).forEach((t) => judgeTokens.add(bare(t)));
        return;
      }
      if (PLACE_BEFORE.test(before)) return;
    }
    spans.push({ start, end, tokens: spanTokens });
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

  if (spans.length === 0) return text;

  // Sostituzione delle sequenze individuate (senza sovrapposizioni).
  spans.sort((a, b) => a.start - b.start || b.end - a.end);
  let out = "";
  let cursor = 0;
  const masked = new Set<string>();
  for (const span of spans) {
    if (span.start < cursor) continue;
    out += text.slice(cursor, span.start) + OMISSIS;
    cursor = span.end;
    // Si propagano solo i cognomi: i nomi propri da soli sono troppo ambigui ("Santa Maria").
    span.tokens
      .filter((t) => isNameToken(t) && bare(t).length >= 3 && !FIRST_NAMES.has(bare(t)))
      .forEach((t) => masked.add(t.text.replace(/^\p{L}{1,4}['’]/u, "")));
  }
  out += text.slice(cursor);

  // Propagazione: altre occorrenze degli stessi nomi/cognomi (es. "il ROSSI", "la Bianchi").
  for (const word of masked) {
    if (judgeTokens.has(word.toLowerCase())) continue;
    const lower = word.toLowerCase();
    const variants = new Set([word, word.toUpperCase(), lower.charAt(0).toUpperCase() + lower.slice(1)]);
    for (const v of variants) {
      const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(`(?<![\\p{L}])${escaped}(?![\\p{L}])`, "gu"), OMISSIS);
    }
  }

  return out.replace(/\[omissis\](?:[ \t]+\[omissis\])+/g, OMISSIS);
}
