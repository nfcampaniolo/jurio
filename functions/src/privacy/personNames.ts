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
 * - sequenze nome+cognome riconosciute tramite un elenco di nomi propri italiani.
 *
 * Esclude i magistrati (Presidente, Consigliere, Relatore, P.M.), enti, società e luoghi.
 */

export const FIRST_NAMES = new Set(
  (
    "adriana adriano agata agostino alberto alba alessandra alessandro alessia alessio alfonso alfredo alice " +
    "amedeo andrea angela angelo anna annalisa antonella antonietta antonino antonio arianna armando " +
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
    "vincenza vincenzo virginia vito vittorio walter " +
    // Integrazione con altri nomi frequenti (ISTAT) e varianti diffuse.
    "achille ada adele agnese alda aldo alessio alfio amalia ambra anastasia angelica angelina annamaria " +
    "antonia assunta aurora brunella carolina cecilia cinzia clara clelia cristiano dalila " +
    "dante denis denise dina dino edda egidio elio eliana elvira emma enrica erica ermanno ester " +
    "eva fausto fernanda fernando ferdinando fiorella flavia franca franco gemma gerardo giada " +
    "gianfranco giancarlo gianluigi gianmarco gianpaolo gianpiero gilda gino gioele giordano grazia " +
    "graziano greta gregorio ida ileana ines iolanda isabella lara lea leonardo lidia livia " +
    "loredano lucrezia ludovica lucio maddalena mafalda manlio mara marcella mariano marilena mariella " +
    "mariarosa marta mattia melissa miriam mirella morena nadia nando natalia nicolas nina " +
    "nino oreste orietta ottavio pierluigi pierpaolo pino quirino rachele raimondo rebecca " +
    "renata riccarda rino roberta rolando romina rosetta rossana ruben sabina samuel " +
    "sebastiana selene severino silvano sonia susanna tamara tecla teodoro tina " +
    "tullio ugo valter vania viviana yuri zaira"
  ).split(" ").filter(Boolean)
);

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
    "nome cognome cliente assistito controparte mittente destinatario email telefono via viale piazza corso"
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
const PLACE_BEFORE =
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
