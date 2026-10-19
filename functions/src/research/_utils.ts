import * as natural from "natural";
// @ts-ignore
import stopwords from "stopwords-iso";

// -- UTILITY E SETUP (mantenuto intatto) --

export const SENTENCE_MULTIPLIER = 0.95; // Boost per hit in massima/fattispecie
const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmerIt;

interface KeywordStem {
  original: string;
  stem: string;
}

const getStopWords = (): string[] => {
  try { return stopwords?.it || []; } 
  catch (e) { return []; }
};

export const getKeywordStems = (text: string): KeywordStem[] => {
  const itStopWords = getStopWords();
  const tokens: string[] = tokenizer.tokenize(text.toLowerCase()) || [];
  return tokens
    .filter((word: string) => word.length > 2 && !itStopWords.includes(word) && !/^[0-9]+$/.test(word))
    .map((word: string): KeywordStem => ({ original: word, stem: stemmer.stem(word) }));
};

export const calculateMatchScore = (targetText: string, kwObjects: any[], docData?: any) => {
  if (!targetText || kwObjects.length === 0) {
    return { textMatchScore: 0, authorityBonus: 0, recencyBonus: 0 };
  }

  // Se il targetText non ha lunghezza sufficiente, skippa le tokenizzazioni pesanti
  if (targetText.length < 5) {
      return { textMatchScore: 0, authorityBonus: 0, recencyBonus: 0 };
  }

  const textTokens: string[] = tokenizer.tokenize(targetText.toLowerCase()) || [];
  if (textTokens.length === 0) {
      return { textMatchScore: 0, authorityBonus: 0, recencyBonus: 0 };
  }
  
  // N.B: Questo map() pesa sulla CPU. Se un giorno vuoi ottimizzare ulteriormente, 
  // potresti salvare gli stems direttamente in Firestore quando crei il documento.
  const textStems: string[] = textTokens.map((t: string) => stemmer.stem(t));

  const kwPositions = new Map<string, number[]>();
  let uniqueMatchesCount = 0;

  // 1. TEXT MATCHING
  kwObjects.forEach((kw) => {
    const positions: number[] = [];
    for (let i = 0; i < textTokens.length; i++) {
      if (textTokens[i] === kw.original || textStems[i] === kw.stem) {
        positions.push(i);
      }
    }
    if (positions.length > 0) {
      kwPositions.set(kw.original, positions);
      uniqueMatchesCount++;
    }
  });

  // 2. CALCOLO PROSSIMITÀ
  let proximityBonus = 0;
  if (uniqueMatchesCount > 1) {
    let minDistance = Infinity;
    const keys = Array.from(kwPositions.keys());

    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const posA = kwPositions.get(keys[i])!;
        const posB = kwPositions.get(keys[j])!;

        for (const pA of posA) {
          for (const pB of posB) {
            const dist = Math.abs(pA - pB);
            if (dist < minDistance) {
              minDistance = dist;
            }
          }
        }
      }
    }
    if (minDistance > 0 && minDistance < Infinity) {
      proximityBonus = 2 / minDistance;
    }
  }

  // 3. BOOST DEI METADATI
  let authorityBonus = 0;
  let recencyBonus = 0;

  if (docData) {
    const organo = String(docData.organo_giudicante || "").toUpperCase();
    if (organo.includes("UNITE")) {
      authorityBonus = 0.06;
    } else if (organo.includes("CASSAZIONE")) {
      authorityBonus = 0.02;
    }

    const dataString = String(docData.data_sentenza || "");
    if (dataString.length >= 4) {
      const anno = parseInt(dataString.substring(0, 4), 10);
      const currentYear = new Date().getFullYear();
      if (anno >= currentYear - 1) {
        recencyBonus = 0.03; 
      } else if (anno >= currentYear - 3) {
        recencyBonus = 0.015;
      }
    }
  }

  return { textMatchScore: uniqueMatchesCount + proximityBonus, authorityBonus, recencyBonus };
};

export function applyHighlight(text: string, keywords: string[], stems: string[] = []): string {
  if (!text) return "";
  
  const allTerms = [...new Set([...keywords, ...stems])]
    .map(t => t.trim())
    .filter(t => t.length > 3)
    .sort((a, b) => b.length - a.length);

  if (allTerms.length === 0) return text;

  const pattern = allTerms
    .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

  const regex = new RegExp(`\\b(${pattern})`, "gi");
  return text.replace(regex, "<mark>$1</mark>");
}

export function generateHighlightRegex(keywords: string[], stems: string[] = []): RegExp | null {
  const allTerms = [...new Set([...keywords, ...stems])]
    .map(t => t.trim())
    .filter(t => t.length > 3)
    .sort((a, b) => b.length - a.length);

  if (allTerms.length === 0) return null;

  const pattern = allTerms
    .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

  return new RegExp(`\\b(${pattern})`, "gi");
}

export function applyHighlightWithRegex(text: string, regex: RegExp | null): string {
  if (!text) return "";
  if (!regex) return text;
  
  return text.replace(regex, "<mark>$1</mark>");
}