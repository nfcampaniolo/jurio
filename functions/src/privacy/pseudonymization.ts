import { AsyncLocalStorage } from "node:async_hooks";

type PiiCategory =
  | "EMAIL"
  | "TELEFONO"
  | "CODICE_FISCALE"
  | "PARTITA_IVA"
  | "IBAN"
  | "INDIRIZZO"
  | "NOME";

const activeVault = new AsyncLocalStorage<PseudonymizationVault>();

const sensitiveFieldCategories: Array<[RegExp, PiiCategory]> = [
  [/(?:email|e-mail|mail)/i, "EMAIL"],
  [/(?:phone|telefono|cellulare|mobile)/i, "TELEFONO"],
  [/(?:codice.?fiscale|\bcf\b|tax.?id)/i, "CODICE_FISCALE"],
  [/(?:partita.?iva|\bp\.?iva\b|vat.?id)/i, "PARTITA_IVA"],
  [/\biban\b/i, "IBAN"],
  [/(?:indirizzo|address|residenza|domicilio)/i, "INDIRIZZO"],
  [/(?:nome|cognome|cliente|assistito|controparte|mittente|destinatario|denominazione|ragione.?sociale|first.?name|last.?name|full.?name)/i, "NOME"],
];

const labelledNamePattern =
  /\b(?:mi chiamo|(?:nome|cognome)(?:\s+(?:del|della|cliente|assistito|controparte))?|cliente|assistito|controparte|mittente|destinatario|sig(?:nore|nora)?|signor[ae]|avv(?:ocato)?|dott(?:\.?(?:ore|ssa))?|ing(?:egnere)?)\.?\s*[:=]?\s+([\p{Lu}][\p{L}'’.-]*(?:\s+[\p{Lu}][\p{L}'’.-]*){0,2})/giu;
const addressPattern =
  /\b(?:via|viale|piazza|corso|largo|vicolo|strada|piazzale|lungomare)\s+[\p{Lu}][\p{L}'’-]*(?:\s+[\p{Lu}][\p{L}'’-]*){0,4}\s+\d+[A-Za-z]?\b/giu;

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class PseudonymizationVault {
  private readonly valueToToken = new Map<string, string>();
  private readonly tokenToValue = new Map<string, string>();
  private readonly categoryCounts = new Map<PiiCategory, number>();

  registerPayload(payload: unknown): void {
    const visit = (value: unknown, fieldName = ""): void => {
      if (typeof value === "string") {
        const category = sensitiveFieldCategories.find(([pattern]) => pattern.test(fieldName))?.[1];
        if (category && value.trim().length >= 2) this.getToken(value, category);
        this.registerDetectedValues(value);
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((item) => visit(item, fieldName));
        return;
      }
      if (isRecord(value)) {
        Object.entries(value).forEach(([key, item]) => visit(item, key));
      }
    };

    visit(payload);
  }

  pseudonymize<T>(value: T): T {
    return this.transform(value, (text) => this.pseudonymizeText(text));
  }

  restore<T>(value: T): T {
    return this.transform(value, (text) => this.restoreText(text));
  }

  clear(): void {
    this.valueToToken.clear();
    this.tokenToValue.clear();
    this.categoryCounts.clear();
  }

  private getToken(value: string, category: PiiCategory): string {
    const existing = this.valueToToken.get(value);
    if (existing) return existing;

    const next = (this.categoryCounts.get(category) ?? 0) + 1;
    this.categoryCounts.set(category, next);
    const token = `{${category}_${next}}`;
    this.valueToToken.set(value, token);
    this.tokenToValue.set(token, value);
    return token;
  }

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
    for (const match of text.matchAll(labelledNamePattern)) {
      this.getToken(match[1], "NOME");
    }
    for (const match of text.matchAll(addressPattern)) {
      this.getToken(match[0], "INDIRIZZO");
    }
  }

  private pseudonymizeText(text: string): string {
    this.registerDetectedValues(text);
    const values = Array.from(this.valueToToken.entries())
      .sort(([left], [right]) => right.length - left.length);
    if (values.length === 0) return text;

    const tokenByValue = new Map(values);
    const pattern = new RegExp(values.map(([value]) => escapeRegExp(value)).join("|"), "g");
    return text.replace(pattern, (value) => tokenByValue.get(value) ?? value);
  }

  private restoreText(text: string): string {
    return text.replace(/\{(?:EMAIL|TELEFONO|CODICE_FISCALE|PARTITA_IVA|IBAN|INDIRIZZO|NOME)_\d+\}/g, (token) =>
      this.tokenToValue.get(token) ?? token
    );
  }

  private transform<T>(value: T, transformText: (text: string) => string): T {
    if (typeof value === "string") return transformText(value) as T;
    if (Array.isArray(value)) {
      return value.map((item) => this.transform(item, transformText)) as T;
    }
    if (!isRecord(value)) return value;

    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, this.transform(item, transformText)])
    ) as T;
  }
}

/**
 * Creates a private in-memory mapping for one operation. Detection covers
 * structured PII fields, common identifiers, addresses, and explicitly labelled names.
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
        const safeRequest = vault.pseudonymize(request);
        if (
          request &&
          typeof request === "object" &&
          safeRequest &&
          typeof safeRequest === "object" &&
          !Array.isArray(safeRequest)
        ) {
          const onChunk = (request as { onChunk?: unknown }).onChunk;
          if (typeof onChunk === "function") {
            (safeRequest as Record<string, unknown>).onChunk = (...chunkArgs: unknown[]) =>
              Reflect.apply(
                onChunk,
                request,
                chunkArgs.map((chunk) => vault.restore(chunk))
              );
          }
        }

        const generated = Reflect.apply(original, target, [safeRequest, ...args.slice(1)]);
        return Promise.resolve(generated).then((response) => vault.restore(response));
      };
    },
  });
}
