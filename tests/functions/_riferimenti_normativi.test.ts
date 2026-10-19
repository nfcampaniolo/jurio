import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  detectSource,
  extractComma,
  extractFirstArticle,
  extractLetter,
  extractNnum,
  extractPar,
  makeRiferimentiNormativiKeys,
  normalizeRef,
  toKey,
  translateRiferimento,
  uniqStable,
  type Parsed,
  type Source,
} from "@functions/_riferimenti_normativi";

describe("riferimenti normativi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("normalization and extraction", () => {
    it("normalizes non-breaking spaces, dash variants, whitespace and edges", () => {
      // Arrange
      const input = "  art.\u00a0 12—bis\t  codice ‒ civile  ";

      // Act
      const result = normalizeRef(input);

      // Assert
      expect(result).toBe("art. 12-bis codice - civile");
    });

    it("keeps the first occurrence of case-insensitive duplicates", () => {
      // Arrange
      const values = ["Codice", "codice", "CODICE", "Legge", "legge"];

      // Act
      const result = uniqStable(values);

      // Assert
      expect(result).toEqual(["Codice", "Legge"]);
    });

    it.each([
      ["art. 12", "12"],
      ["ARTT. 12-14", "12-14"],
      ["articolo 12 bis", "12bis"],
      ["articoli 7-ter-2-a.1", "7-ter-2-a.1"],
      ["riferimento all'art. 12", "12"],
    ])("extracts article from %s", (input, expected) => {
      // Arrange / Act
      const result = extractFirstArticle(input);

      // Assert
      expect(result).toBe(expected);
    });

    it("does not extract an article beyond the input scan limit", () => {
      // Arrange
      const input = `${"x".repeat(500)} art. 12`;

      // Act
      const result = extractFirstArticle(input);

      // Assert
      expect(result).toBeUndefined();
    });

    it.each([
      ["comma 12", "12"],
      ["commi 3-5", "3-5"],
      ["co. n. 8", "8"],
      ["comma (4), comma 7", "4"],
      ["comma 3; comma 4", "3"],
    ])("extracts the first number from %s", (input, expected) => {
      // Arrange / Act
      const result = extractComma(input);

      // Assert
      expect(result).toBe(expected);
    });

    it.each(["nessun comma", "comma", "comma testo"])("returns no comma number for %s", (input) => {
      // Arrange / Act
      const result = extractComma(input);

      // Assert
      expect(result).toBeUndefined();
    });

    it.each([
      ["lett. A", "a"],
      ["lettera b", "b"],
    ])("extracts a normalized letter from %s", (input, expected) => {
      // Arrange / Act
      const result = extractLetter(input);

      // Assert
      expect(result).toBe(expected);
    });

    it("extracts numbered clauses and paragraph symbols only when present", () => {
      // Arrange
      const input = "n. 15 e § 4";

      // Act
      const number = extractNnum(input);
      const paragraph = extractPar(input);

      // Assert
      expect(number).toBe("15");
      expect(paragraph).toBe("4");
      expect(extractNnum("numero 15")).toBeUndefined();
      expect(extractPar("paragrafo 4")).toBeUndefined();
    });
  });

  describe("source detection", () => {
    it.each([
      ["protocollo n. 2 CEDU", { kind: "prot_cedu", protNo: "2" }],
      ["Protocollo n. 13 alla CEDU", { kind: "prot_cedu", protNo: "13" }],
      ["CEDU", { kind: "cedu" }],
      ["Convenzione europea dei diritti dell'uomo", { kind: "cedu" }],
      ["reg. UE 12/2020", { kind: "eu", eu: "reg", no: "12", year: "2020", scheme: "ue" }],
      ["regolamento (CE) n. 45/2021", { kind: "eu", eu: "reg", no: "45", year: "2021", scheme: "ce" }],
      ["direttiva CEE 7/2019", { kind: "eu", eu: "dir", no: "7", year: "2019", scheme: "cee" }],
    ] satisfies Array<[string, Source]>)("detects %s", (input, expected) => {
      // Arrange / Act
      const result = detectSource(input);

      // Assert
      expect(result).toEqual(expected);
    });

    it.each([
      ["disp. att. cod. proc. civ.", { kind: "code", code: "dispatt_cpc" }],
      ["disp. att. cod. proc. pen.", { kind: "code", code: "dispatt_cpp" }],
      ["c.p.c.", { kind: "code", code: "cpc" }],
      ["c.p.p.", { kind: "code", code: "cpp" }],
      ["c.p.", { kind: "code", code: "cp" }],
      ["c.c.", { kind: "code", code: "cc" }],
      ["cod. proc. civ.", { kind: "code", code: "cpc" }],
      ["cod. proc. pen.", { kind: "code", code: "cpp" }],
      ["cod. pen.", { kind: "code", code: "cp" }],
      ["cod. civ.", { kind: "code", code: "cc" }],
      ["codice di procedura civile", { kind: "code", code: "cpc" }],
      ["codice procedura penale", { kind: "code", code: "cpp" }],
      ["codice penale", { kind: "code", code: "cp" }],
      ["codice civile", { kind: "code", code: "cc" }],
      ["preleggi", { kind: "code", code: "preleggi" }],
      ["T.U.B.", { kind: "code", code: "tub" }],
      ["TUF", { kind: "code", code: "tuf" }],
      ["TUEL", { kind: "code", code: "tuel" }],
      ["ord. pen.", { kind: "code", code: "ordpen" }],
      ["ordinamento penitenziario", { kind: "code", code: "ordpen" }],
      ["legge fallimentare", { kind: "lf" }],
      ["l. fall.", { kind: "lf" }],
    ] satisfies Array<[string, Source]>)("recognizes source %s", (input, expected) => {
      // Arrange / Act
      const result = detectSource(input);

      // Assert
      expect(result).toEqual(expected);
    });

    it.each([
      ["d.lgs. n. 10/2020", { kind: "act", act: "dlgs", no: "10", year: "2020" }],
      ["d.l. 11", { kind: "act", act: "dl", no: "11", year: undefined }],
      ["d.p.r. 12/2022", { kind: "act", act: "dpr", no: "12", year: "2022" }],
      ["r.d. 13", { kind: "act", act: "rd", no: "13", year: undefined }],
      ["legge n. 14/2023", { kind: "act", act: "l", no: "14", year: "2023" }],
      ["l. 15", { kind: "act", act: "l", no: "15", year: undefined }],
      ["nessun riferimento", { kind: "unknown", raw: "nessun riferimento" }],
    ] satisfies Array<[string, Source]>)("detects legal act or unknown source in %s", (input, expected) => {
      // Arrange / Act
      const result = detectSource(input);

      // Assert
      expect(result).toEqual(expected);
    });

    it("limits source detection to the first 500 characters", () => {
      // Arrange
      const input = `${"x".repeat(500)} codice civile`;

      // Act
      const result = detectSource(input);

      // Assert
      expect(result).toEqual({ kind: "unknown", raw: input });
    });
  });

  describe("key generation and translation", () => {
    it.each([
      [{ source: { kind: "code", code: "cpc" }, article: "12", par: "2", comma: "3", letter: "a", nnum: "4" }, "cpc:a12:p2:c3:la:n4"],
      [{ source: { kind: "act", act: "l", no: "12", year: "2020" }, article: "3", nnum: "8" }, "l:12:2020:a3"],
      [{ source: { kind: "eu", eu: "reg", no: "4", year: "2021", scheme: "ue" }, article: "2", nnum: "5" }, "eu:reg:4:2021:ue:a2"],
      [{ source: { kind: "cedu" }, article: "8", par: "1" }, "cedu:a8:p1"],
      [{ source: { kind: "prot_cedu", protNo: "6" }, nnum: "4" }, "prot:6:cedu"],
      [{ source: { kind: "lf" }, comma: "2" }, "lf:c2"],
      [{ source: { kind: "unknown", raw: "x" }, article: "4" }, "a4"],
      [{ source: { kind: "unknown", raw: "x" }, nnum: "4" }, "n4"],
      [{ source: { kind: "unknown", raw: "x" } }, null],
    ] satisfies Array<[Parsed, string | null]>)("builds a key for %#", (parsed, expected) => {
      // Arrange / Act
      const result = toKey(parsed);

      // Assert
      expect(result).toBe(expected);
    });

    it("normalizes, parses and retains the original raw input", () => {
      // Arrange
      const raw = "  Art. 12—bis c.p.c., comma 3, lett. A  ";

      // Act
      const result = translateRiferimento(raw);

      // Assert
      expect(result).toEqual({
        raw,
        normalized: "Art. 12-bis c.p.c., comma 3, lett. A",
        parsed: {
          source: { kind: "code", code: "cpc" },
          article: "12-bis",
          comma: "3",
          letter: "a",
          nnum: undefined,
          par: undefined,
        },
        key: "cpc:a12-bis:c3:la",
      });
    });

    it("caps normalized references to 500 characters", () => {
      // Arrange
      const raw = `${"x".repeat(500)} articolo 12`;

      // Act
      const result = translateRiferimento(raw);

      // Assert
      expect(result.normalized).toHaveLength(500);
      expect(result.parsed.article).toBeUndefined();
      expect(result.key).toBeNull();
    });

    it.each([
      [["art. 1 c.p.c.", "Art. 1 c.p.c.", "art. 2 c.p.p."], ["cpc:a1", "cpp:a2"]],
      ["art. 1 c.p.c.", ["cpc:a1"]],
      [42, []],
      [[null, 1, "unrecognized"], []],
    ])("builds stable unique keys from %j", (input, expected) => {
      // Arrange / Act
      const result = makeRiferimentiNormativiKeys(input);

      // Assert
      expect(result).toEqual(expected);
    });
  });
});
