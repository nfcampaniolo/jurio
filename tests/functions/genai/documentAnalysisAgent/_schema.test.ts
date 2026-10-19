import { beforeEach, describe, expect, it, vi } from "vitest";
import { DoctrineOutputSchema } from "@functions/genai/documentAnalysisAgent/_schema";

describe("doctrine extraction schema", () => {
  beforeEach(() => vi.clearAllMocks());

  it("coerces malformed field shapes to safe defaults", () => {
    const parsed = DoctrineOutputSchema.parse({
      tematiche: [{
        tipo_documento: 4, sezioni_coinvolte: "Prima", norme_citate: ["art. 1", null],
        precedenti_citati: [null, { sezione: "Civile", numero: "1", anno: "20/24" }],
      }],
    });
    expect(parsed.tematiche[0].tipo_documento).toBe("4");
    expect(parsed.tematiche[0].sezioni_coinvolte).toEqual(["Prima"]);
    expect(parsed.tematiche[0].norme_citate).toEqual(["art. 1", ""]);
    expect(parsed.tematiche[0].precedenti_citati[1].anno).toBe(2024);
  });

  it("defaults a non-array tematiche value to an empty array", () => {
    expect(DoctrineOutputSchema.parse({ tematiche: null })).toEqual({ tematiche: [] });
  });
});
