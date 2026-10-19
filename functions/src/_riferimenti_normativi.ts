export type Source =
  | { kind: "code"; code: "cpc" | "cpp" | "cp" | "cc" | "preleggi" | "tub" | "tuf" | "tuel" | "ordpen" | "dispatt_cpc" | "dispatt_cpp"; }
  | { kind: "act"; act: "dlgs" | "dl" | "dpr" | "rd" | "l"; no: string; year?: string }
  | { kind: "eu"; eu: "reg" | "dir"; no: string; year?: string; scheme?: "ce" | "ue" | "cee" }
  | { kind: "cedu" }
  | { kind: "prot_cedu"; protNo: string }
  | { kind: "lf" }
  | { kind: "unknown"; raw: string };

const MAX_REF_INPUT = 500; 

export type Parsed = {
  source: Source;
  article?: string; 
  comma?: string;
  letter?: string;
  nnum?: string;
  par?: string;
};

export type Translation = {
  raw: string;
  normalized: string;
  parsed: Parsed;
  key: string | null;
};

export const normalizeRef = (s: string) => s.replace(/\u00A0/g, " ").replace(/[‐-‒–—]/g, "-").replace(/\s+/g, " ").trim();
const lower = (s: string) => s.toLowerCase();

export function uniqStable(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of arr) {
    const k = lower(x);
    if (!seen.has(k)) { seen.add(k); out.push(x); }
  }
  return out;
}

function firstNumberish(s: string): string | undefined {
  const m = s.match(/\d+(?:\s*-\s*\d+)?/);
  return m ? m[0].replace(/\s+/g, "") : undefined;
}

export function extractFirstArticle(text: string): string | undefined {
  const t = lower(text).slice(0, MAX_REF_INPUT);
  const m = t.match(/\b(?:art\.?|artt\.?|articolo|articoli)\s*([0-9]+(?:\s*-\s*[0-9]+)?(?:\s*(?:bis|ter|quater|quinquies|sexies|septies|octies|novies|decies|undecies|duodecies))?(?:\s*-\s*(?:bis|ter|quater|quinquies|sexies|septies|octies|novies|decies|undecies|duodecies))?(?:\s*-\s*[0-9]+)?(?:\s*-\s*[a-z]+)?(?:\s*\.\s*\d+)?)\b/);
  if (!m) return undefined;
  return normalizeRef(m[1]).replace(/\s*/g, "").replace(/\./g, ".");
}

export function extractComma(text: string): string | undefined {
  const t = lower(text).slice(0, MAX_REF_INPUT);
  const m = t.match(/\b(?:comma|commi)\b|\bco\./);
  if (!m || m.index == null) return undefined;
  let i = m.index + m[0].length;
  while (i < t.length && /\s/.test(t[i])) i++;
  let j = i;
  while (j < t.length && t[j] !== ")" && t[j] !== "," && t[j] !== ";") j++;
  return firstNumberish(t.slice(i, j));
}

export function extractLetter(text: string): string | undefined {
  const t = lower(text).slice(0, MAX_REF_INPUT);
  const m = t.match(/\b(?:lett\.?|lettera)\s*([a-z])\b/);
  return m ? m[1] : undefined;
}

export function extractNnum(text: string): string | undefined {
  const t = lower(text).slice(0, MAX_REF_INPUT);
  const m = t.match(/\bn\.?\s*(\d+)\b/);
  return m ? m[1] : undefined;
}

export function extractPar(text: string): string | undefined {
  const t = lower(text).slice(0, MAX_REF_INPUT);
  const m = t.match(/§\s*(\d+)/);
  return m ? m[1] : undefined;
}

export function detectSource(text: string): Source {
  const t = lower(text).slice(0, MAX_REF_INPUT);

  const prot = t.match(/\b(?:protocollo|prot\.)\s*n\.?\s*(\d+)\b.*\bcedu\b/);
  if (prot) return { kind: "prot_cedu", protNo: prot[1] };

  if (/\bcedu\b/.test(t) || /convenzione europea dei diritti dell['’]uomo/.test(t)) return { kind: "cedu" };

  const eu2 = t.match(/\breg\.\s*(ue|ce|cee)\s*(?:n\.?\s*)?(\d+)(?:\s*\/\s*(\d{4}))?\b/);
  if (eu2) return { kind: "eu", eu: "reg", no: eu2[2], year: eu2[3], scheme: eu2[1] as any };

  const eu1 = t.match(/\b(reg\.|regolamento|dir\.|direttiva)(?:\s*\((ue|ce|cee)\)|\s+(ue|ce|cee))?\s*(?:n\.?\s*)?(\d+)(?:\s*\/\s*(\d{4}))?\b/);
  if (eu1) return { kind: "eu", eu: eu1[1].startsWith("dir") ? "dir" : "reg", no: eu1[4], year: eu1[5], scheme: (eu1[2] ?? eu1[3]) as any };

  if (/disp\.\s*att\.\s*cod\.\s*proc\.\s*civ\./.test(t)) return { kind: "code", code: "dispatt_cpc" };
  if (/disp\.\s*att\.\s*cod\.\s*proc\.\s*pen\./.test(t)) return { kind: "code", code: "dispatt_cpp" };

  if (/\bc\.?\s*p\.?\s*c\.?\b/.test(t)) return { kind: "code", code: "cpc" };
  if (/\bc\.?\s*p\.?\s*p\.?\b/.test(t)) return { kind: "code", code: "cpp" };
  if (/\bc\.?\s*p\.?\b/.test(t)) return { kind: "code", code: "cp" };
  if (/\bc\.?\s*c\.?\b/.test(t)) return { kind: "code", code: "cc" };

  if (/cod\.\s*proc\.\s*civ\./.test(t)) return { kind: "code", code: "cpc" };
  if (/cod\.\s*proc\.\s*pen\./.test(t)) return { kind: "code", code: "cpp" };
  if (/cod\.\s*pen\./.test(t)) return { kind: "code", code: "cp" };
  if (/cod\.\s*civ\./.test(t)) return { kind: "code", code: "cc" };

  if (/\bcodice\s+di\s+procedura\s+civile\b/.test(t) || /\bcodice\s+procedura\s+civile\b/.test(t)) return { kind: "code", code: "cpc" };
  if (/\bcodice\s+di\s+procedura\s+penale\b/.test(t) || /\bcodice\s+procedura\s+penale\b/.test(t)) return { kind: "code", code: "cpp" };
  if (/\bcodice\s+penale\b/.test(t)) return { kind: "code", code: "cp" };
  if (/\bcodice\s+civile\b/.test(t)) return { kind: "code", code: "cc" };

  if (/\bpreleggi\b/.test(t)) return { kind: "code", code: "preleggi" };
  if (/\bt\.?\s*u\.?\s*b\.?\b/.test(t)) return { kind: "code", code: "tub" };
  if (/\btuf\b/.test(t)) return { kind: "code", code: "tuf" };
  if (/\btuel\b/.test(t)) return { kind: "code", code: "tuel" };
  if (/\bord\.\s*pen\./.test(t) || /\bordinamento penitenziario\b/.test(t)) return { kind: "code", code: "ordpen" };

  if (/\blegge\s+fallimentare\b/.test(t) || /\bl\.\s*fall\./.test(t)) return { kind: "lf" };

  const act = t.match(/\b(d\.?\s*lgs\.?|d\.?\s*l\.?|d\.?\s*p\.?\s*r\.?|r\.?\s*d\.?|legge|l\.)\s*(?:n\.?\s*)?(\d+)(?:\s*\/\s*(\d{4}))?\b/);
  if (act) {
    const kindRaw = act[1].replace(/\s+/g, "");
    const actType = kindRaw.startsWith("d.lgs") || kindRaw === "dlgs" ? "dlgs" : kindRaw.startsWith("d.l.") || kindRaw === "dl" ? "dl" : kindRaw.startsWith("d.p.r") || kindRaw === "dpr" ? "dpr" : kindRaw.startsWith("r.d") || kindRaw === "rd" ? "rd" : "l";
    return { kind: "act", act: actType, no: act[2], year: act[3] };
  }

  return { kind: "unknown", raw: text };
}

export function toKey(p: Parsed): string | null {
  const parts: string[] = [];
  switch (p.source.kind) {
    case "code": parts.push(p.source.code); break;
    case "act": parts.push(`${p.source.act}:${p.source.no}${p.source.year ? `:${p.source.year}` : ""}`); break;
    case "eu":
      parts.push(`eu:${p.source.eu}:${p.source.no}${p.source.year ? `:${p.source.year}` : ""}`);
      if (p.source.scheme) parts.push(p.source.scheme);
      break;
    case "cedu": parts.push("cedu"); break;
    case "prot_cedu": parts.push(`prot:${p.source.protNo}:cedu`); break;
    case "lf": parts.push("lf"); break;
    case "unknown": break;
  }

  if (p.article) parts.push(`a${p.article}`);
  if (p.par) parts.push(`p${p.par}`);
  if (p.comma) parts.push(`c${p.comma}`);
  if (p.letter) parts.push(`l${p.letter}`);

  const isNumberedAct = p.source.kind === "act" || p.source.kind === "prot_cedu" || p.source.kind === "eu";
  if (p.nnum && !isNumberedAct) parts.push(`n${p.nnum}`);

  if (parts.length === 0) return null;
  return parts.join(":");
}

export function translateRiferimento(raw: string): Translation {
  const normalized = normalizeRef(raw).slice(0, MAX_REF_INPUT);
  const source = detectSource(normalized);
  const parsed: Parsed = {
    source,
    article: extractFirstArticle(normalized),
    comma: extractComma(normalized),
    letter: extractLetter(normalized),
    nnum: extractNnum(normalized),
    par: extractPar(normalized),
  };
  return { raw, normalized, parsed, key: toKey(parsed) };
}

export function makeRiferimentiNormativiKeys(input: unknown): string[] {
  const refs: string[] = [];
  if (Array.isArray(input)) {
    for (const x of input) if (typeof x === "string") refs.push(x);
  } else if (typeof input === "string") {
    refs.push(input);
  } else {
    return [];
  }
  const keys: string[] = [];
  for (const r of refs) {
    const t = translateRiferimento(r);
    if (t.key) keys.push(t.key);
  }
  return uniqStable(keys);
}