/// <reference types="office-js" />
/* global Word, console */

import { useState, useEffect } from "react";
import { listFascicoliByUser, PastFascicolo } from "../firebase/functions";
import { auth } from "../firebase/auth";

export const isWordEnvironment = (setError: (msg: string) => void): boolean => {
  if (typeof Word === "undefined" || !Word.run) {
    setError("Questa azione è disponibile solo all'interno del pannello di Microsoft Word.");
    return false;
  }
  return true;
};

export const formattaTitoloFonte = (titolo: string): string => {
  const isNumeroSentenza = /^\s*\d+\s*\/\s*\d+\s*$/.test(titolo);
  return isNumeroSentenza ? `Provvedimento giuridico ${titolo.trim()}` : titolo;
};

/** Score di pertinenza: il backend lo restituisce tra 0 e 1; valori > 1 sono già percentuali. */
export const formattaScore = (score: number): string => {
  const pct = score <= 1 ? score * 100 : score;
  return `${Math.round(pct)}%`;
};

export const spezzaTesto = (testo: string, maxLength = 1500, overlap = 200): string[] => {
  if (!testo) return [];
  if (maxLength <= 0 || overlap < 0 || overlap >= maxLength) {
    throw new RangeError("spezzaTesto: richiesto 0 <= overlap < maxLength");
  }
  const chunks: string[] = [];
  let i = 0;
  while (i < testo.length) {
    chunks.push(testo.slice(i, i + maxLength));
    if (i + maxLength >= testo.length) break;
    i += maxLength - overlap;
  }
  return chunks;
};

export function useFascicoloSelector(onSelect: (f: PastFascicolo | null) => void) {
  const [fascicoli, setFascicoli] = useState<PastFascicolo[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const user = auth.currentUser;
    if (!user) return undefined;

    setIsLoading(true);
    listFascicoliByUser(user.uid)
      .then((data) => {
        if (!cancelled) setFascicoli(data);
      })
      .catch((err) => {
        console.error("Errore caricamento fascicoli:", err);
        if (!cancelled) setError("Impossibile caricare i fascicoli.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredFascicoli = fascicoli.filter((f) =>
    f.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (f: PastFascicolo | null) => {
    onSelect(f);
    if (!f) {
      setSearchQuery("");
    }
  };

  return {
    searchQuery,
    setSearchQuery,
    isLoading,
    error,
    filteredFascicoli,
    handleSelect,
  };
}
