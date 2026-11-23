import { AsyncLocalStorage } from "node:async_hooks";
import {
  AMBIGUOUS_NAME_WORDS,
  bareWord,
  detectPersonNames,
  FIRST_NAMES,
  isKnownSurname,
  isNameLikeWord,
  isNameToken,
  PARTICLES,
  PLACE_BEFORE,
  PROTECTED,
  SURNAMES,
  tokenize,
  type Token,
} from "./personNames";
import { enrichVaultWithDlp, isDlpEnabled } from "./dlp";

/**
 * Pseudonimizzazione reversibile dei dati personali inviati agli LLM.
 *
 * I dati vengono sostituiti con segnaposto ({NOME_1}, {EMAIL_1}…) SOLO nel payload diretto
 * al modello o a servizi esterni (ricerca web, embedding); le risposte vengono ripristinate prima
 * di essere inviate al client o salvate su Firestore, che quindi conserva sempre i dati originali.
 * La mappa segnaposto→valore vive solo in memoria per la durata della richiesta.
 */

export type PiiCategory =
  | "EMAIL"
  | "TELEFONO"
  | "CODICE_FISCALE"
  | "PARTITA_IVA"
  | "IBAN"
  | "INDIRIZZO"
  | "DATA_NASCITA"
  | "TARGA"
  | "NOME"
  | "COGNOME";

const CATEGORIES: PiiCategory[] = [
  "EMAIL",
  "TELEFONO",
  "CODICE_FISCALE",
  "PARTITA_IVA",
  "IBAN",
  "INDIRIZZO",
  "DATA_NASCITA",
  "TARGA",
  "NOME",
  "COGNOME",
];

const activeVault = new AsyncLocalStorage<PseudonymizationVault>();

/** Segnaposto nella forma canonica emessa dal vault. */
const CANONICAL_TOKEN = new RegExp(`\\{(?:${CATEGORIES.join("|")})_\\d+\\}`, "g");

/**
 * Segnaposto come possono tornare dal modello: parentesi quadre, minuscole, underscore
 * escapati dal markdown ("{NOME\_1}"), spazi interni.
 */
const LOOSE_TOKEN = new RegExp(
  `\\\\?[{[]\\s*(${CATEGORIES.map((c) => c.replace(/_/g, "\\\\?_")).join("|")})\\\\?_(\\d+)\\s*\\\\?[}\\]]`,
  "gi"
);

/** Parte finale di un chunk che potrebbe essere l'inizio di un segnaposto non ancora completo. */
const PARTIAL_TOKEN_TAIL = /\\?[{[][\sA-Za-z_\\]{0,20}\d{0,4}$/;

export const PSEUDONYM_INSTRUCTION =
  "[NOTA PRIVACY] Alcuni dati personali sono sostituiti da segnaposto nel formato {CATEGORIA_n} " +
  "(es. {NOME_n}, {COGNOME_n}, {EMAIL_n}). Quando ti riferisci a quei dati riporta il segnaposto esattamente " +
  "com'è, con le parentesi graffe, senza modificarlo, tradurlo, descriverlo o tentare di ricostruire il dato " +
  "originale. {NOME_n} e {COGNOME_n} con lo stesso numero indicano la stessa persona.";

const ROLE_FIELDS =
  "attor[ei]|convenut[oaie]|ricorrent[ei]|resistent[ei]|imputat[oaie]|indagat[oaie]|persona.?offesa|" +
  "parte(?:.?(?:attrice|convenuta|civile|lesa|assistita|avversa))?|locator[ei]|conduttor[ei]|debitor[ei]|" +
  "creditor[ei]|ered[ei]|de.?cuius|defunt[oa]|testimon[ei]|datore|lavorator[ei]|dipendente|coniuge|" +
  "minore|figli[oa]?|danneggiat[oa]|assicurat[oa]|beneficiari[oa]|committente|appaltator[ei]|fornitore|" +
  "acquirente|vendit(?:or[ei]|rice)|legale.?rappresentante|amministrator[ei]|referente|interlocutore";

const sensitiveFieldCategories: Array<[RegExp, PiiCategory]> = [
  [/(?:email|e-mail|mail|pec)/i, "EMAIL"],
  [/(?:phone|telefono|cellulare|mobile)/i, "TELEFONO"],
  [/(?:codice.?fiscale|\bcf\b|tax.?id)/i, "CODICE_FISCALE"],
  [/(?:partita.?iva|\bp\.?iva\b|vat.?id)/i, "PARTITA_IVA"],
  [/\biban\b/i, "IBAN"],
  [/(?:indirizzo|address|residenza|domicilio)/i, "INDIRIZZO"],
  [
    new RegExp(
      `(?:nome|cognome|cliente|assistit[oa]|controparte|mittente|destinatario|denominazione|ragione.?sociale|` +
        `first.?name|last.?name|full.?name|${ROLE_FIELDS})`,
      "i"
    ),
    "NOME",
  ],
];

/**
 * Etichette che introducono un nome. La parola chiave è cercata senza distinzione di maiuscole,
 * mentre il nome che segue è verificato separatamente in modo case-sensitive (NAME_SEQUENCE):
 * con il flag "i" `\p{Lu}` accetterebbe anche le minuscole ("cliente vuole sapere…").
 */
const NAME_CUE =
  /\b(?:mi chiamo|marito|moglie|coniuge|padre|madre|figli[oa]|fratell[oa]|sorella|zi[oa]|nonn[oa]|cugin[oa]|nipote|cognat[oa]|suocer[oa]|genero|nuora|compagn[oa]|fidanzat[oa]|convivente|collega|soci[oa]|amic[oa]|vedov[oa]|(?:nome|cognome)(?:\s+(?:del|della|cliente|assistito|controparte))?|cliente|assistit[oa]|controparte|mittente|destinatario|sig(?:nore|nora)?|signor[ae]|sig\.r[ae]|avv(?:ocat[oa])?|dott(?:ore|oressa|\.?ssa)?|ing(?:egnere)?|geom|arch|rag|prof(?:essore|essoressa)?)\.?(?:\s*[:=])?\s+/giu;
const NAME_WORD = String.raw`(?:\p{Lu}\p{Ll}{0,3}['’])?\p{Lu}[\p{L}'’-]*`;
const NAME_SEQUENCE = new RegExp(
  `${NAME_WORD}(?:[ \\t]+(?:(?:De|Di|Da|Del|Della|Dello|Dei|Degli|Dal|Dalla|La|Lo|Li)[ \\t]+)?${NAME_WORD}){0,3}`,
  "uy"
);

const addressPattern =
  /\b(?:[Vv]ia|[Vv]iale|[Pp]iazza(?:le)?|[Cc]orso|[Ll]argo|[Vv]icolo|[Ss]trada|[Ll]ungomare|[Cc]ontrada|[Bb]orgo)\s+(?:(?:d(?:i|el|ella|ello|elle|egli|ei)|San|Santa|Sant['’])\s+)?[\p{Lu}\d][\p{L}\d'’.-]*(?:\s+(?:d(?:i|el|ella|elle|egli|ei)\s+)?[\p{Lu}][\p{L}'’.-]*){0,4},?\s+(?:n\.?\s*)?\d+[A-Za-z]?\b/gu;

const DATE = String.raw`\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{1,2}°?\s+(?:gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+\d{4}`;
const birthDatePatterns = [
  new RegExp(String.raw`\bnat[oa]\s+(?:(?:a|ad|in)\s+[^,;\n]{1,50}?\s*,?\s+)?il\s+(${DATE})`, "gi"),
  new RegExp(String.raw`\b(?:data\s+di\s+nascita|d\.\s?n\.)\s*[:=]?\s*(${DATE})`, "gi"),
];

/** Lettere ammesse nelle targhe italiane (escluse I, O, Q, U). */
const PLATE_LETTER = "[A-HJ-NPR-TV-Z]";
const platePatterns = [
  new RegExp(`\\b${PLATE_LETTER}{2}\\d{3}${PLATE_LETTER}{2}\\b`, "g"),
  new RegExp(`\\b(?:targ(?:a|at[oa])|veicolo|autovettura)\\s*[:n.°]*\\s*(${PLATE_LETTER}{2}\\s?\\d{3}\\s?${PLATE_LETTER}{2})\\b`, "gi"),
];

/** Partita IVA o codice fiscale numerico (11 cifre) introdotti dall'etichetta, con o senza "IT". */
const vatPattern =
  /\b(?:p\.?\s?iva|partita\s+iva|vat(?:\s+(?:number|id))?|c\.?\s?f\.?|codice\s+fiscale)\s*(?:n\.?|nr\.?|:)?\s*(?:IT\s?)?(\d{11})(?!\d)/gi;

/** Cellulari (3xx) e fissi (0x) anche senza separatori o in due gruppi ("333 1234567", "0612345678"). */
const compactPhonePattern = /(?<![\d/.,])(?:\+39\s?)?(?:3\d{2}[ .-]?\d{6,7}|0\d{1,3}[ .-]?\d{5,8})(?![\d/]|[.,]\d)/g;

/**
 * Contesto che precede un nome proprio senza riferirsi a una persona: luoghi ("Via Marco Polo",
 * "San Giovanni"), leggi e riforme ("legge Biagi"), denominazioni ("teatro", "stadio").
 */
const NON_PERSON_BEFORE =
  /(?:\b(?:legge|l\.|decreto|d\.?\s?lgs\.?|d\.?\s?l\.|ddl|riforma|lodo|codice|teorema|principio|caso|metodo|scala|governo|premio|teatro|stadio|stazione|aeroporto|palazzo|chiesa|basilica|parco|museo|hotel|ponte|galleria)\s+)$/i;
/**
 * Nomi propri che sono anche parole comuni ("Chiara", "Rosa"): da soli valgono solo a metà frase,
 * dove l'iniziale maiuscola non dipende dalla punteggiatura.
 */
const MID_SENTENCE_NAMES = new Set(
  "rosa vera serena chiara bianca viola gioia stella speranza celeste aurora alba diana gemma ambra flora dora lea pia norma linda giada carmen grazia regina".split(
    " "
  )
);
/** Parole con l'iniziale maiuscola a inizio frase che non fanno parte di un nome ("Il Rossi", "Con Marco"). */
const CAPITALIZED_FUNCTION_WORDS = new Set(
  (
    "il i gli un una uno ed ma con per in su tra fra ad al allo alla ai agli alle dal dai dagli dalle nel nella " +
    "nei negli nelle sul sulla sui che se anche come quando mentre dopo prima poi ho ha hanno sono ecco oggi ieri domani"
  ).split(" ")
);

/** Dopo il nome: forma societaria ("Bianchi Srl", "Rossi & C."). */
const COMPANY_AFTER = /^\s*(?:S\.?\s?r\.?\s?l|S\.?\s?p\.?\s?A|S\.?\s?n\.?\s?c|S\.?\s?a\.?\s?s|&|e\s+C\.)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** Oggetti da non attraversare né clonare: built-in con stato interno, schemi zod, AbortSignal… */
function isOpaqueObject(value: object): boolean {
  if (
    value instanceof Date ||
    value instanceof RegExp ||
    value instanceof Map ||
    value instanceof Set ||
    value instanceof Promise ||
    value instanceof Error ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value)
  ) {
    return true;
  }
  if (typeof EventTarget !== "undefined" && value instanceof EventTarget) return true;
  const candidate = value as { _def?: unknown; safeParse?: unknown };
  return candidate._def !== undefined || typeof candidate.safeParse === "function";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const normalizeKey = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

/** Vero se il valore di un campo "nome" sembra davvero un nome (e non "attore", "sì", una frase…). */
function looksLikeName(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 120 || /[\n{}]/.test(trimmed)) return false;
  const words = trimmed.split(/\s+/);
  if (words.length > 8) return false;
  return words.some((word) => isNameLikeWord(word.replace(/[.,;:]+$/, "")));
}

/**
 * Restringe una sequenza "Mario Rossi Tribunale" alle sole parole con forma di nome,
 * scartando quelle protette e le particelle finali.
 */
function trimNameSequence(text: string, start: number, raw: string): string | null {
  const tokens = tokenize(raw);
  let end = -1;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (isNameToken(token)) {
      end = i;
      continue;
    }
    if (PARTICLES.has(token.lower) && i + 1 < tokens.length) continue;
    break;
  }
  if (end < 0) return null;
  return text.slice(start + tokens[0].start, start + tokens[end].end);
}

/**
 * Cognomi isolati da collegare a un nome completo ("Mario Rossi" → "Rossi", "Mario De Luca" → "De Luca"),
 * così che "il Rossi" o "ROSSI" vengano sostituiti con lo stesso indice ({COGNOME_n}).
 */
function surnameAliases(value: string): string[] {
  const tokens = tokenize(value);
  if (tokens.length < 2 || tokens.length > 5) return [];
  const isCapitalParticle = (i: number) => PARTICLES.has(tokens[i].lower) && /^\p{Lu}/u.test(tokens[i].text);
  if (!tokens.every((t, i) => isNameToken(t) || isCapitalParticle(i))) return [];

  const aliases: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (isCapitalParticle(i) && i + 1 < tokens.length) {
      aliases.push(value.slice(tokens[i].start, tokens[i + 1].end));
      i += 1;
      continue;
    }
    const word = bareWord(tokens[i].text);
    if (word.length >= 3 && !FIRST_NAMES.has(word) && !PROTECTED.has(word)) aliases.push(tokens[i].text);
  }
  return aliases;
}

export class PseudonymizationVault {
  /** Chiave normalizzata (minuscole, spazi compattati) → segnaposto. */
  private readonly valueToToken = new Map<string, string>();
  private readonly tokenToValue = new Map<string, string>();
  private readonly categoryCounts = new Map<PiiCategory, number>();
  /** Regex di sostituzione compilata, ricalcolata solo quando cambiano i valori registrati. */
  private pattern?: RegExp;
  private patternSize = 0;

  registerPayload(payload: unknown): void {
    const seen = new WeakSet<object>();
    const texts: string[] = [];
    const visit = (value: unknown, fieldName = ""): void => {
      if (typeof value === "string") {
        const category = sensitiveFieldCategories.find(([pattern]) => pattern.test(fieldName))?.[1];
        if (category && value.trim().length >= 2 && (category !== "NOME" || looksLikeName(value))) {
          this.getToken(value.trim(), category);
        }
        texts.push(value);
        return;
      }
      if (!value || typeof value !== "object" || seen.has(value)) return;
      seen.add(value);
      if (Array.isArray(value)) {
        value.forEach((item) => visit(item, fieldName));
        return;
      }
      if (isRecord(value)) {
        Object.entries(value).forEach(([key, item]) => visit(item, key));
      }
    };

    visit(payload);
    this.registerTexts(texts);
  }

  /**
   * Due passate: prima si raccolgono i dati da TUTTE le stringhe (storico, documenti, messaggio),
   * poi si sostituisce. Così un nome scritto per intero solo in un messaggio successivo viene
   * mascherato anche nei testi che lo precedono ("Verdi non ha pagato" … "il debitore è Luigi Verdi").
   */
  pseudonymize<T>(value: T): T {
    const texts: string[] = [];
    this.transform(value, (text) => {
      texts.push(text);
      return text;
    });
    this.registerTexts(texts);
    return this.transform(value, (text) => this.replaceText(text));
  }

  /**
   * Registra i dati trovati nei testi: prima i nomi completi e gli identificativi, poi le parole
   * isolate (cognomi e nomi da elenco), così "Rossi" diventa l'alias {COGNOME_n} di "Mario Rossi"
   * anziché un nome a sé.
   */
  private registerTexts(texts: string[]): void {
    const cleaned = texts.map((input) => input.replace(CANONICAL_TOKEN, (token) => " ".repeat(token.length)));
    cleaned.forEach((text) => this.registerDetectedValues(text));
    cleaned.forEach((text) => this.registerIsolatedNames(text));
  }

  restore<T>(value: T): T {
    return this.transform(value, (text) => this.restoreText(text));
  }

  /**
   * Registra i dati trovati da un rilevatore esterno (Cloud DLP). I nomi passano dagli stessi filtri
   * delle regex ("Corte", "Tribunale" non sono persone); i nomi completi prima dei cognomi isolati,
   * così "Rossi" diventa l'alias di "Mario Rossi".
   */
  registerExternalFindings(findings: Array<{ value: string; category: PiiCategory }>): void {
    const wordCount = (value: string) => value.trim().split(/\s+/).length;
    const sorted = [...findings].sort((left, right) => wordCount(right.value) - wordCount(left.value));
    for (const { value, category } of sorted) {
      const trimmed = value.trim();
      if (category === "NOME") {
        this.registerName(trimmed);
      } else if (category === "TELEFONO") {
        if (trimmed.replace(/\D/g, "").length >= 9) this.getToken(trimmed, category);
      } else if (trimmed.length >= 3) {
        this.getToken(trimmed, category);
      }
    }
  }

  /** Ripristina un frammento di testo (usato per lo streaming). */
  restoreString(text: string): string {
    return this.restoreText(text);
  }

  clear(): void {
    this.valueToToken.clear();
    this.tokenToValue.clear();
    this.categoryCounts.clear();
    this.pattern = undefined;
    this.patternSize = 0;
  }

  private getToken(value: string, category: PiiCategory): string {
    const key = normalizeKey(value);
    const existing = this.valueToToken.get(key);
    if (existing) return existing;

    const next = (this.categoryCounts.get(category) ?? 0) + 1;
    this.categoryCounts.set(category, next);
    const token = `{${category}_${next}}`;
    this.valueToToken.set(key, token);
    this.tokenToValue.set(token, value);

    if (category === "NOME") {
      for (const alias of surnameAliases(value)) {
        const aliasKey = normalizeKey(alias);
        if (this.valueToToken.has(aliasKey)) continue;
        const aliasToken = `{COGNOME_${next}}`;
        this.valueToToken.set(aliasKey, aliasToken);
        this.tokenToValue.set(aliasToken, alias);
      }
    }
    return token;
  }

  private registerName(candidate: string | null): void {
    if (!candidate) return;
    const value = candidate.trim();
    if (value.length < 2 || !looksLikeName(value)) return;
    this.getToken(value, "NOME");
  }

  /** `text` ha già i segnaposto sostituiti da spazi: non vanno riconosciuti come nomi ("{NOME_1}" → "NOME"). */
  private registerDetectedValues(text: string): void {
    for (const match of text.matchAll(/\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/gi)) {
      this.getToken(match[0], "CODICE_FISCALE");
    }
    for (const match of text.matchAll(/\bIT\d{11}\b/gi)) {
      this.getToken(match[0], "PARTITA_IVA");
    }
    for (const match of text.matchAll(/\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/gi)) {
      this.getToken(match[0], "IBAN");
    }
    for (const match of text.matchAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi)) {
      this.getToken(match[0], "EMAIL");
    }
    // Prima dei telefoni: una P.IVA che inizia con 0 ha la forma di un numero fisso.
    for (const match of text.matchAll(vatPattern)) {
      this.getToken(match[1], "PARTITA_IVA");
    }
    for (const match of text.matchAll(/(?:\+?\d[\d\s()./-]{6,}\d)/g)) {
      const digits = match[0].replace(/\D/g, "");
      const start = match.index ?? 0;
      const precedingText = text.slice(Math.max(0, start - 24), start);
      const followingText = text.slice(start + match[0].length, start + match[0].length + 8);
      const explicitlyLabelled = /(?:tel(?:efono)?|cellulare|mobile|phone|recapito)\s*[:=]?\s*$/i.test(precedingText);
      const groups = match[0].trim().split(/[\s()./-]+/).filter(Boolean);
      const hasProtocolPrefix = /\b(?:LEG|PROT(?:OCOLLO)?)[- /]?\s*$/i.test(precedingText);
      const hasCurrencyContext = /(?:€|\bEUR)\s*$/i.test(precedingText);
      const hasDecimalCents = /^,\d{2}\b/.test(followingText);
      const phoneLikeFormat =
        match[0].trim().startsWith("+") ||
        (groups.length >= 3 && groups.every((group) => /^\d{2,4}$/.test(group)));
      if (
        digits.length >= 9 &&
        digits.length <= 15 &&
        !hasProtocolPrefix &&
        !hasCurrencyContext &&
        !hasDecimalCents &&
        (explicitlyLabelled || phoneLikeFormat)
      ) {
        this.getToken(match[0], "TELEFONO");
      }
    }
    for (const match of text.matchAll(compactPhonePattern)) {
      const digits = match[0].replace(/\D/g, "");
      const start = match.index ?? 0;
      const precedingText = text.slice(Math.max(0, start - 24), start);
      if (digits.length < 9 || digits.length > 12) continue;
      if (/(?:€|\bEUR|\bn\.|\bn°|\bnr\.?|\bprot\.?|\br\.?\s?g\.?|\bart\.?)\s*$/i.test(precedingText)) continue;
      this.getToken(match[0], "TELEFONO");
    }
    for (const pattern of birthDatePatterns) {
      for (const match of text.matchAll(pattern)) this.getToken(match[1], "DATA_NASCITA");
    }
    for (const match of text.matchAll(platePatterns[0])) this.getToken(match[0], "TARGA");
    for (const match of text.matchAll(platePatterns[1])) this.getToken(match[1].toUpperCase(), "TARGA");
    for (const match of text.matchAll(addressPattern)) {
      this.getToken(match[0], "INDIRIZZO");
    }

    // Nomi introdotti da un'etichetta ("Cliente: Mario Rossi", "avv. Bianchi", "mi chiamo…").
    for (const match of text.matchAll(NAME_CUE)) {
      NAME_SEQUENCE.lastIndex = (match.index ?? 0) + match[0].length;
      const sequence = NAME_SEQUENCE.exec(text);
      if (sequence) this.registerName(trimNameSequence(text, sequence.index, sequence[0]));
    }

    // Nomi riconosciuti dal rilevatore condiviso (nome proprio + cognome, "contro ROSSI MARIO", "nato a"…).
    for (const match of detectPersonNames(text).matches) {
      this.registerName(match.text);
    }

    this.registerLowercaseNames(text);
  }

  /** Nome e cognome scritti tutti in minuscolo ("mario rossi"): solo se entrambi sono negli elenchi. */
  private registerLowercaseNames(text: string): void {
    const tokens = tokenize(text);
    const isLower = (t: Token) => /^\p{Ll}+$/u.test(t.text);
    for (let i = 0; i + 1 < tokens.length; i++) {
      const first = tokens[i];
      const last = tokens[i + 1];
      // Il nome proprio non deve essere ambiguo ("rosa bianco"); il cognome sì ("giuseppe verdi").
      if (!isLower(first) || AMBIGUOUS_NAME_WORDS.has(first.lower) || !isLower(last)) continue;
      if (!/^[ \t]+$/.test(text.slice(first.end, last.start))) continue;
      if (FIRST_NAMES.has(first.lower) && SURNAMES.has(last.lower)) {
        this.getToken(text.slice(first.start, last.end), "NOME");
        i += 1;
      }
    }
  }

  /**
   * Cognomi e nomi propri da elenco che compaiono da soli ("Esposito mi ha chiesto…", "ho parlato con Marco").
   * Esclusi: parole ambigue ("Rosa", "Costa"), luoghi ("Via Marco Polo", "San Giovanni"), leggi
   * ("legge Biagi") e società ("Bianchi Srl").
   */
  private registerIsolatedNames(text: string): void {
    const tokens = tokenize(text);
    const isCapitalizedNeighbour = (a: Token, b: Token, neighbour: Token) =>
      /^[ \t]+$/.test(text.slice(a.end, b.start)) &&
      /^\p{Lu}/u.test(neighbour.text) &&
      !CAPITALIZED_FUNCTION_WORDS.has(neighbour.lower);

    tokens.forEach((token, i) => {
      if (!isNameToken(token)) return;
      const word = bareWord(token.text);
      const midSentence = !/(?:^|[.!?:;\n]\s*)$/.test(text.slice(Math.max(0, token.start - 3), token.start));
      const knownFirstName =
        FIRST_NAMES.has(word) && (!AMBIGUOUS_NAME_WORDS.has(word) || (midSentence && MID_SENTENCE_NAMES.has(word)));
      if (!(isKnownSurname(token) || knownFirstName) || word.length < 3) return;
      // Parte di una denominazione di più parole maiuscole ("San Giovanni Rotondo", "Villa Borghese"):
      // le combinazioni di nomi le gestisce già detectPersonNames.
      const prev = tokens[i - 1];
      const next = tokens[i + 1];
      if (prev && isCapitalizedNeighbour(prev, token, prev)) return;
      if (next && isCapitalizedNeighbour(token, next, next)) return;
      const before = text.slice(Math.max(0, token.start - 30), token.start);
      if (PLACE_BEFORE.test(before) || NON_PERSON_BEFORE.test(before)) return;
      if (COMPANY_AFTER.test(text.slice(token.end, token.end + 12))) return;
      this.getToken(token.text, "NOME");
    });
  }

  private replaceText(text: string): string {
    if (this.valueToToken.size === 0) return text;

    if (!this.pattern || this.patternSize !== this.valueToToken.size) {
      const keys = Array.from(this.valueToToken.keys()).sort((left, right) => right.length - left.length);
      const alternatives = keys.map((key) => escapeRegExp(key).replace(/ /g, "\\s+"));
      this.pattern = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${alternatives.join("|")})(?![\\p{L}\\p{N}_])`, "giu");
      this.patternSize = this.valueToToken.size;
    }

    return text.replace(this.pattern, (match) => {
      const token = this.valueToToken.get(normalizeKey(match));
      if (!token) return match;
      // I nomi si sostituiscono solo con l'iniziale maiuscola ("Rosa" sì, "rosa" colore no),
      // salvo quelli rilevati già in minuscolo ("mario rossi").
      if (
        (token.startsWith("{NOME_") || token.startsWith("{COGNOME_")) &&
        /^\p{Ll}/u.test(match) &&
        !/^\p{Ll}/u.test(this.tokenToValue.get(token) ?? "")
      ) {
        return match;
      }
      return token;
    });
  }

  private restoreText(text: string): string {
    return text.replace(LOOSE_TOKEN, (token, category: string, index: string) => {
      const canonical = `{${category.replace(/\\/g, "").toUpperCase()}_${index}}`;
      return this.tokenToValue.get(canonical) ?? token;
    });
  }

  /**
   * Applica la trasformazione a stringhe annidate. Oggetti plain e array vengono ricostruiti;
   * le istanze di classe (es. GenerateResponse/Message di Genkit) sono clonate preservando
   * il prototipo, così i getter (`text`, `output`, `toolRequests`) leggono il contenuto trasformato.
   */
  private transform<T>(value: T, transformText: (text: string) => string): T {
    const seen = new WeakMap<object, unknown>();
    const visit = (item: unknown): unknown => {
      if (typeof item === "string") return transformText(item);
      if (!item || typeof item !== "object") return item;
      if (seen.has(item)) return seen.get(item);
      if (Array.isArray(item)) {
        const out: unknown[] = [];
        seen.set(item, out);
        item.forEach((entry) => out.push(visit(entry)));
        return out;
      }
      if (isOpaqueObject(item)) return item;
      const out = Object.create(Object.getPrototypeOf(item)) as Record<string, unknown>;
      seen.set(item, out);
      for (const [key, entry] of Object.entries(item)) out[key] = visit(entry);
      return out;
    };
    return visit(value) as T;
  }
}

/**
 * Creates a private in-memory mapping for one operation. Detection covers
 * structured PII fields, common identifiers, addresses, and person names.
 */
export async function withPseudonymization<T>(
  payload: unknown,
  operation: () => T | Promise<T>
): Promise<T> {
  const vault = new PseudonymizationVault();
  vault.registerPayload(payload);
  try {
    return await activeVault.run(vault, operation);
  } finally {
    vault.clear();
  }
}

export function getActivePseudonymizationVault(): PseudonymizationVault | undefined {
  return activeVault.getStore();
}

/** Vero se il valore contiene ancora segnaposto canonici. */
export function containsPseudonymTokens(value: unknown): boolean {
  if (typeof value === "string") return new RegExp(CANONICAL_TOKEN.source).test(value);
  if (Array.isArray(value)) return value.some(containsPseudonymTokens);
  if (value && typeof value === "object") return Object.values(value).some(containsPseudonymTokens);
  return false;
}

/**
 * Da usare per testi diretti a servizi esterni (embedding, API di terze parti): sostituisce
 * i dati personali con i segnaposto della richiesta corrente.
 */
export function pseudonymizeOutbound(text: string): string {
  const vault = getActivePseudonymizationVault();
  return vault ? vault.pseudonymize(text) : text;
}

/**
 * Query per motori di ricerca esterni: i dati personali vengono rimossi del tutto,
 * perché un segnaposto non ha significato per il motore.
 */
export function stripPersonalDataForSearch(text: string): string {
  const pseudonymized = pseudonymizeOutbound(text);
  if (pseudonymized === text) return text;
  return pseudonymized
    .replace(CANONICAL_TOKEN, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

/**
 * Da usare prima di ogni scrittura su Firestore di contenuti generati dal modello:
 * ripristina i dati originali e segnala (senza contenuti) eventuali segnaposto residui.
 */
export function restoreForStorage<T>(value: T, label = "unknown"): T {
  const vault = getActivePseudonymizationVault();
  const restored = vault ? vault.restore(value) : value;
  if (containsPseudonymTokens(restored)) {
    console.warn(`[PRIVACY] PSEUDONYM_LEAK: segnaposto non ripristinati prima del salvataggio (${label})`);
  }
  return restored;
}

/** Aggiunge l'istruzione sui segnaposto in coda all'ultimo messaggio utente (o al prompt). */
function appendPseudonymInstruction(request: Record<string, unknown>): void {
  const note = `\n\n${PSEUDONYM_INSTRUCTION}`;
  if (typeof request.prompt === "string") {
    request.prompt = `${request.prompt}${note}`;
    return;
  }
  if (Array.isArray(request.prompt)) {
    request.prompt = [...request.prompt, { text: note }];
    return;
  }
  if (Array.isArray(request.messages)) {
    const messages = request.messages as Array<{ role?: string; content?: unknown }>;
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message?.role === "user" && Array.isArray(message.content)) {
        messages[i] = { ...message, content: [...message.content, { text: note }] };
        return;
      }
    }
  }
}

type ChunkLike = Record<string, unknown> & { content?: unknown; text?: unknown };

/**
 * Ripristina i chunk in streaming trattenendo la coda di un segnaposto spezzato tra due chunk
 * ("{NO" + "ME_1}"), che altrimenti arriverebbe al client non ripristinato.
 */
function createStreamRestorer(vault: PseudonymizationVault) {
  let pending = "";
  let lastChunk: ChunkLike | undefined;

  const holdBack = (text: string): string => {
    const restored = vault.restoreString(pending + text);
    pending = "";
    const tail = PARTIAL_TOKEN_TAIL.exec(restored);
    if (!tail) return restored;
    pending = tail[0];
    return restored.slice(0, tail.index);
  };

  return {
    push(chunk: unknown): unknown {
      const restored = vault.restore(chunk) as ChunkLike;
      if (!restored || typeof restored !== "object") return restored;
      lastChunk = restored;

      if (Array.isArray(restored.content)) {
        const parts = restored.content as Array<Record<string, unknown>>;
        const textIndexes = parts.flatMap((part, i) => (typeof part?.text === "string" ? [i] : []));
        if (textIndexes.length === 0) return restored;
        const joined = textIndexes.map((i) => parts[i].text as string).join("");
        const visible = holdBack(joined);
        const nextParts = parts.filter((_, i) => !textIndexes.includes(i));
        nextParts.splice(textIndexes[0], 0, { ...parts[textIndexes[0]], text: visible });
        restored.content = nextParts;
        return restored;
      }

      if (typeof restored.text === "string" && Object.prototype.hasOwnProperty.call(restored, "text")) {
        restored.text = holdBack(restored.text);
      }
      return restored;
    },
    flush(): unknown {
      if (!pending || !lastChunk) return undefined;
      const text = vault.restoreString(pending);
      pending = "";
      const finalChunk = Object.assign(Object.create(Object.getPrototypeOf(lastChunk)), lastChunk) as ChunkLike;
      if (Array.isArray(lastChunk.content)) finalChunk.content = [{ text }];
      else finalChunk.text = text;
      return finalChunk;
    },
  };
}

export function pseudonymizeGenkit<T extends object>(instance: T): T {
  return new Proxy(instance, {
    get(target, property) {
      const original = Reflect.get(target, property, target);
      if (property !== "generate" || typeof original !== "function") {
        return typeof original === "function" ? original.bind(target) : original;
      }

      return (...args: unknown[]) => {
        const vault = getActivePseudonymizationVault();
        if (!vault) return Reflect.apply(original, target, args);

        const request = args[0];
        // Con DLP attivo, prima si arricchisce il vault con i dati trovati da DLP, poi si pseudonimizza.
        if (isDlpEnabled()) return enrichVaultWithDlp(vault, request).then(() => generate(vault, request, args.slice(1)));
        return generate(vault, request, args.slice(1));
      };

      function generate(vault: PseudonymizationVault, request: unknown, rest: unknown[]) {
        const safeRequest = vault.pseudonymize(request);
        let streamRestorer: ReturnType<typeof createStreamRestorer> | undefined;
        let onChunk: unknown;

        if (
          request &&
          typeof request === "object" &&
          safeRequest &&
          typeof safeRequest === "object" &&
          !Array.isArray(safeRequest)
        ) {
          const safe = safeRequest as Record<string, unknown>;
          // The model identifier is configuration, not user content. Keep it
          // unchanged so a PII value cannot corrupt a provider/model name.
          if ("model" in request) safe.model = (request as Record<string, unknown>).model;

          if (containsPseudonymTokens({ prompt: safe.prompt, messages: safe.messages, system: safe.system })) {
            appendPseudonymInstruction(safe);
          }

          onChunk = (request as { onChunk?: unknown }).onChunk;
          if (typeof onChunk === "function") {
            const restorer = createStreamRestorer(vault);
            streamRestorer = restorer;
            safe.onChunk = (chunk: unknown, ...rest: unknown[]) =>
              Reflect.apply(onChunk as (...a: unknown[]) => unknown, request, [restorer.push(chunk), ...rest]);
          }
        }

        const generated = Reflect.apply(original as (...a: unknown[]) => unknown, target, [safeRequest, ...rest]);
        return Promise.resolve(generated).then((response) => {
          const tail = streamRestorer?.flush();
          if (tail !== undefined && typeof onChunk === "function") Reflect.apply(onChunk, request, [tail]);
          return vault.restore(response);
        });
      }
    },
  });
}
