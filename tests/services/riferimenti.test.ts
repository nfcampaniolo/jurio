import { describe, test, expect } from "vitest";
import {
  normalize,
  uniqStable,
  extractFirstArticle,
  extractComma,
  extractLetter,
  extractNnum,
  extractPar,
  detectSource,
  translateRiferimento,
  makeRiferimentiNormativiKeys,
} from "@/services/riferimentiTranslator";

describe("Riferimenti Normativi Utility Suite", () => {
  test("normalize pulisce correttamente gli spazi e i trattini", () => {
    expect(normalize("art.  10  – bis")).toBe("art. 10 - bis");
    expect(normalize("\u00A0prova\u00A0")).toBe("prova");
  });

  test("uniqStable rimuove i duplicati mantenendo l'ordine case-insensitive", () => {
    const input = ["cpc:a10", "CPC:A10", "cpp:a1", "cpc:a10"];
    expect(uniqStable(input)).toEqual(["cpc:a10", "cpp:a1"]);
  });

  test("estrae correttamente il primo articolo", () => {
    expect(extractFirstArticle("art. 240-bis del c.c.")).toBe("240-bis");
    expect(extractFirstArticle("artt. 10, 12 del codice civile")).toBe("10");
    expect(extractFirstArticle("nessun articolo")).toBeUndefined();
  });

  test("estrae correttamente il comma", () => {
    expect(extractComma("art. 10, comma 2, lett. a")).toBe("2");
    expect(extractComma("art. 15 co. 3")).toBe("3");
    expect(extractComma("nessun comma")).toBeUndefined();
  });

  test("estrae correttamente la lettera", () => {
    expect(extractLetter("comma 2, lettera b")).toBe("b");
    expect(extractLetter("lett. c")).toBe("c");
    expect(extractLetter("nessuna lettera")).toBeUndefined();
  });

  test("estrae correttamente il numero (nnum) e il paragrafo", () => {
    expect(extractNnum("articolo 5, n. 3")).toBe("3");
    expect(extractPar("art. 1 § 4")).toBe("4");
  });

  test("rileva correttamente la sorgente (detectSource)", () => {
    expect(detectSource("art. 10 c.p.c.")).toEqual({ kind: "code", code: "cpc" });
    expect(detectSource("d.lgs. n. 50/2016")).toEqual({ kind: "act", act: "dlgs", no: "50", year: "2016" });
    expect(detectSource("reg. ce n. 1782/2003")).toEqual({ kind: "eu", eu: "reg", no: "1782", year: "2003", scheme: "ce" });
    expect(detectSource("art. 6 della CEDU")).toEqual({ kind: "cedu" });
    expect(detectSource("protocollo n. 1 alla cedu")).toEqual({ kind: "prot_cedu", protNo: "1" });
    expect(detectSource("legge fallimentare")).toEqual({ kind: "lf" });
    expect(detectSource("testo sconosciuto casuale")).toEqual({ kind: "unknown", raw: "testo sconosciuto casuale" });
  });

  test("traduce correttamente il riferimento e genera la chiave canonica via toKey", () => {
    const translation = translateRiferimento("art. 10 cpc comma 2");
    expect(translation.key).toBe("cpc:a10:c2");
    expect(translation.parsed.article).toBe("10");
    expect(translation.parsed.comma).toBe("2");
  });

  test("makeRiferimentiNormativiKeys elabora stringhe e array restituendo chiavi uniche", () => {
    const keys = makeRiferimentiNormativiKeys(["art. 10 cpc", "art. 10 c.p.c.", "art. 5 cpp"]);
    expect(keys).toEqual(["cpc:a10", "cpp:a5"]);

    expect(makeRiferimentiNormativiKeys("art. 1 cpc")).toEqual(["cpc:a1"]);
    expect(makeRiferimentiNormativiKeys(123 as unknown as string)).toEqual([]);
  });
});