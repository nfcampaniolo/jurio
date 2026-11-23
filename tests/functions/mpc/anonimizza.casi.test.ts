import { describe, expect, it } from "vitest";
import { anonimizzaTesto } from "@functions/mpc/anonimizza";

/**
 * Casi ricostruiti dalle sentenze in cui estraiTestoDocumento mostrava nomi di persone fisiche
 * (Cass. civ. 3 27833/2026, Cass. pen. 4 14444/2025, Cass. civ. 3 29691/2024, Cass. civ. 3 8038/2025,
 * Cass. pen. 4 10883/2025, Cass. civ. 1 16280/2025). I nomi sono inventati.
 */
const casi: Array<[string, string, string[]]> = [
  [
    "ordine «Cognome Nome» con cognome fuori elenco",
    "Con atto di citazione Pirrone Antonella e Pirrone Giuseppe convenivano in giudizio Cutrupi Salvatore.",
    ["Pirrone", "Antonella", "Giuseppe", "Cutrupi", "Salvatore"],
  ],
  [
    "cognome isolato con articolo",
    "Il Cutrupi, in stato di ebbrezza, colpiva la ricorrente. La Corte ha ritenuto che il Cutrupi fosse responsabile e che i Pirrone non avessero provato il danno. Secondo il Pirrone la caduta era dovuta all'urto.",
    ["Cutrupi", "Pirrone"],
  ],
  [
    "nome proprio isolato dopo la prima menzione",
    "La ricorrente Antonella Pirrone perdeva conoscenza. Antonella veniva trasportata al pronto soccorso; il nipote Davide, sentito come teste, confermava.",
    ["Antonella", "Pirrone", "Davide"],
  ],
  [
    "nomi dopo «tale», «teste», «testimone»",
    "La vittima, tale Bressan Iolanda, era stata vista dal teste Zanchetta e dal testimone Ferraresi Gino, titolare del negozio.",
    ["Bressan", "Iolanda", "Zanchetta", "Ferraresi", "Gino"],
  ],
  [
    "«Dott.» davanti a un consulente o a un professionista, non a un magistrato",
    "Il consulente tecnico del P.M., dott. Ercole Brambati, ha accertato la frattura; il praticante avvocato Michele Lollobrigida era presente.",
    ["Ercole", "Brambati", "Michele", "Lollobrigida"],
  ],
  [
    "avvocata con abbreviazione al femminile",
    "La madre, rappresentata e difesa dall'avv.ta Ludovica Sperandeo e dall'Avv.ssa Teresa Quagliarella, chiede l'affidamento.",
    ["Ludovica", "Sperandeo", "Teresa", "Quagliarella"],
  ],
  [
    "parte indicata dal ruolo processuale",
    "Il ricorrente Zanchetta lamenta la violazione dell'art. 2051 c.c.; l'imputato Kovalenko era già stato condannato.",
    ["Zanchetta", "Kovalenko"],
  ],
  [
    "nome spezzato da un a capo del PDF",
    "ricorso proposto da Antonella\nPirrone, rappresentata dall'avvocato Paolo\nGallo.",
    ["Antonella", "Pirrone", "Paolo", "Gallo"],
  ],
];

describe("anonimizzaTesto — casi segnalati su estraiTestoDocumento", () => {
  it.each(casi)("%s", (_nome, testo, dati) => {
    const out = anonimizzaTesto(testo);
    for (const dato of dati) expect(out).not.toContain(dato);
  });

  it("non maschera magistrati, uffici e luoghi", () => {
    const testo =
      "Composta dagli Ill.mi Sigg.ri Magistrati: Dott. ROSSI Mario - Presidente - Dott.ssa VERDI Anna - Rel. Consigliere - " +
      "udite le conclusioni del Sostituto Procuratore Generale Dott. Carlo Neri; " +
      "sentito l'Avvocato Generale dott. Luigi Salvato. Il Presidente della Sezione dott. Giacomo Travaglino. " +
      "Il Consigliere estensore Dott. Paolo Spaziani. Il fatto è avvenuto a Santa Maria Capua Vetere e a Reggio Emilia, " +
      "presso il Palazzo di giustizia di Atri. La Corte d'appello di Milano e il Tribunale di Roma. " +
      "Il Collegio osserva che la Corte territoriale ha correttamente applicato il Regolamento.";

    expect(anonimizzaTesto(testo)).toBe(testo);
  });
});
