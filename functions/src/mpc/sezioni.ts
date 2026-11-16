// Legenda delle sezioni usata dal filtro `sezione` di ricercaSemantica.
// I valori devono coincidere ESATTAMENTE con il campo `sezione` dei documenti in `sentences`
// (verificati a nov. 2026). Attenzione: l'Adunanza Plenaria del Consiglio di Stato è salvata come "PLENARIA"
// e la Sezione Feriale della Cassazione come "SEZIONE FERIALE PENALE".

interface Sezione {
  valore: string;
  competenze: string;
}

interface GruppoSezioni {
  organo: string;
  sezioni: Sezione[];
}

export const LEGENDA_SEZIONI: GruppoSezioni[] = [
  {
    organo: "Corte di Cassazione - Civile",
    sezioni: [
      { valore: "PRIMA SEZIONE CIVILE", competenze: "famiglia, stato delle persone, diritto d'autore, diritto bancario, procedure concorsuali" },
      { valore: "SECONDA SEZIONE CIVILE", competenze: "proprietà, diritti reali, successioni, condominio, responsabilità professionale" },
      { valore: "TERZA SEZIONE CIVILE", competenze: "responsabilità civile, risarcimento del danno, assicurazioni, locazioni, contratti atipici" },
      { valore: "QUARTA SEZIONE CIVILE", competenze: "lavoro, previdenza sociale, pubblico impiego contrattualizzato" },
      { valore: "QUINTA SEZIONE CIVILE", competenze: "contenzioso tributario tra contribuenti e amministrazione finanziaria" },
      { valore: "SESTA SEZIONE CIVILE", competenze: "filtro e valutazione preliminare di ammissibilità dei ricorsi" },
      { valore: "SEZIONI UNITE CIVILI", competenze: "contrasti interpretativi e questioni di particolare importanza" },
    ],
  },
  {
    organo: "Corte di Cassazione - Penale",
    sezioni: [
      { valore: "PRIMA SEZIONE PENALE", competenze: "omicidi, criminalità organizzata, misure di prevenzione, esecuzione penale" },
      { valore: "SECONDA SEZIONE PENALE", competenze: "reati contro il patrimonio" },
      { valore: "TERZA SEZIONE PENALE", competenze: "reati ambientali, urbanistici, tributari, contro la libertà sessuale" },
      { valore: "QUARTA SEZIONE PENALE", competenze: "responsabilità medica, infortuni sul lavoro, reati colposi (anche circolazione stradale)" },
      { valore: "QUINTA SEZIONE PENALE", competenze: "reati contro la persona, diffamazione, reati fallimentari e a mezzo stampa" },
      { valore: "SESTA SEZIONE PENALE", competenze: "reati contro la Pubblica Amministrazione e l'amministrazione della giustizia" },
      { valore: "SETTIMA SEZIONE PENALE", competenze: "filtro: inammissibilità dei ricorsi" },
      { valore: "SEZIONE FERIALE PENALE", competenze: "questioni urgenti durante la sospensione estiva" },
      { valore: "SEZIONI UNITE PENALI", competenze: "contrasti interpretativi e uniformità giurisprudenziale" },
    ],
  },
  {
    organo: "Consiglio di Stato",
    sezioni: [
      { valore: "SEZIONE II", competenze: "ricorsi straordinari al Presidente della Repubblica" },
      { valore: "SEZIONE III", competenze: "sanità, assistenza sociale, immigrazione, interdittive antimafia" },
      { valore: "SEZIONE IV", competenze: "urbanistica, edilizia, espropriazioni, tutela dell'ambiente" },
      { valore: "SEZIONE V", competenze: "appalti e contratti pubblici, procedure di gara" },
      { valore: "SEZIONE VI", competenze: "università, istruzione, energia, antitrust, beni culturali" },
      { valore: "SEZIONE VII", competenze: "smaltimento dell'arretrato e materie trasversali" },
      { valore: "PLENARIA", competenze: "Adunanza Plenaria: questioni di particolare rilevanza e contrasti interpretativi tra le sezioni" },
    ],
  },
];

const valori = LEGENDA_SEZIONI.flatMap((g) => g.sezioni.map((s) => s.valore));
export const VALORI_SEZIONE = valori as [string, ...string[]];

export const TESTO_LEGENDA_SEZIONI = LEGENDA_SEZIONI.map(
  (g) => `${g.organo}:\n${g.sezioni.map((s) => `- ${s.valore}: ${s.competenze}`).join("\n")}`
).join("\n");
