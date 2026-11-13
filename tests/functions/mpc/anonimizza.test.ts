import { describe, expect, it } from "vitest";
import { anonimizzaTesto, OMISSIS } from "@functions/mpc/anonimizza";

describe("anonimizzaTesto", () => {
  const intestazione =
    "Composta dagli Ill.mi Sigg.ri Magistrati: Dott. ROSSI Mario - Presidente - Dott. VERDI Anna - Consigliere - Rel. " +
    "ha pronunciato la seguente ORDINANZA sul ricorso proposto da: BIANCHI LUIGI, nato a Napoli il 12/03/1970, " +
    "C.F. BNCLGU70C12F839X, rappresentato e difeso dall'avvocato DE LUCA GIOVANNI (giovanni.deluca@pec.it); " +
    "- ricorrente - contro CONSORZIO DI BONIFICA DELLA PIANURA; - controricorrente - avverso la sentenza " +
    "della CORTE D'APPELLO DI NAPOLI. Il BIANCHI lamenta che la Corte non abbia considerato l'art. 2051 c.c.";

  it("masks parties, lawyers, tax codes, emails and birth data in a Cassazione header", () => {
    const out = anonimizzaTesto(intestazione);

    for (const dato of ["BIANCHI", "LUIGI", "DE LUCA", "GIOVANNI", "BNCLGU70C12F839X", "pec.it", "12/03/1970", "Napoli il"]) {
      expect(out).not.toContain(dato);
    }
    expect(out).toContain(`proposto da: ${OMISSIS}, nato ${OMISSIS}`);
    expect(out).toContain(`Il ${OMISSIS} lamenta`);
  });

  it("keeps judges, public bodies and courts", () => {
    const out = anonimizzaTesto(intestazione);

    expect(out).toContain("Dott. ROSSI Mario - Presidente");
    expect(out).toContain("Dott. VERDI Anna - Consigliere");
    expect(out).toContain("CONSORZIO DI BONIFICA DELLA PIANURA");
    expect(out).toContain("CORTE D'APPELLO DI NAPOLI");

    const finale = "Sostituto Procuratore Generale Dott. Carlo Neri. Il Consigliere estensore Anna Verdi. Il Presidente Mario Rossi.";
    expect(anonimizzaTesto(finale)).toBe(finale);
  });

  it("masks names in an AI-generated fattispecie and propagates surnames", () => {
    const out = anonimizzaTesto(
      "Nel procedimento a carico di ESPOSITO GENNARO e altri, l'imputato Esposito coltivava 136 piantine. " +
        "Il sig. Ferraro ha denunciato i fatti. Paolo Russo, coimputato, era presente."
    );

    expect(out).not.toMatch(/Esposito|ESPOSITO|GENNARO|Ferraro|Paolo|Russo/);
    expect(out).toContain(`l'imputato ${OMISSIS} coltivava`);
  });

  it("does not touch places, streets and institutions that contain first names", () => {
    const testo =
      "Il fatto è avvenuto a Santa Maria Capua Vetere, in via Giuseppe Garibaldi; responsabile ex art. 2051 c.c. " +
      "è il Comune di Reggio Emilia, come ritenuto dalla Corte d'appello di Milano.";

    expect(anonimizzaTesto(testo)).toBe(testo);
  });

  it("returns empty input unchanged", () => {
    expect(anonimizzaTesto("")).toBe("");
  });
});
