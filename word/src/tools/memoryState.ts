/* global localStorage */
import { useCallback, useState } from "react";

/**
 * Stato degli strumenti che sopravvive al cambio di schermata ma SOLO in memoria:
 * il testo dei documenti non viene mai scritto nello storage del browser (riservatezza).
 * Si azzera alla chiusura del pannello e al logout.
 */
const store = new Map<string, unknown>();

export function useMemoryState<T>(
  key: string,
  initial: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => (store.has(key) ? (store.get(key) as T) : initial));
  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        store.set(key, resolved);
        return resolved;
      });
    },
    [key]
  );
  return [value, update];
}

/** Scrive un valore che i componenti leggeranno al prossimo montaggio. */
export function writeMemoryState<T>(key: string, value: T): void {
  store.set(key, value);
}

export function readMemoryState<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

export function clearMemoryState(): void {
  store.clear();
}

/** Chiavi scritte dalle versioni precedenti dell'add-in, che salvavano il testo nel localStorage. */
export const LEGACY_DOCUMENT_KEYS = [
  "search_contesto",
  "search_istruzioni",
  "search_testoQuote",
  "search_fonti",
  "review_testoAtto",
  "review_istruzioni",
  "review_risultati",
] as const;

export function purgeLegacyDocumentCache(): void {
  try {
    LEGACY_DOCUMENT_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    // storage non disponibile: niente da cancellare
  }
}
