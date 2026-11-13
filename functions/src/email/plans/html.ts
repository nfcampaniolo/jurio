import type { MonthlyUsageReportData } from "../_interfaces";
import {
  SITE_URL,
  button,
  callout,
  detailsTable,
  escapeHtml,
  featureList,
  link,
  paragraph,
  renderEmailLayout,
  sectionLabel,
  statHighlight,
} from "../_layout";
import { formatTimeSaved } from "./time";

export const generateDowngradeEmail = (nome: string) => {
  return renderEmailLayout({
    title: "Piano scaduto | Jurio",
    preheader: "Il tuo account è passato al piano gratuito. Puoi riattivare l'accesso completo in qualsiasi momento.",
    eyebrow: "Stato dell'abbonamento",
    heading: "Il tuo piano è scaduto",
    body: `
      ${paragraph(`Ciao ${escapeHtml(nome)},`)}
      ${paragraph("ti informiamo che il periodo di validità del tuo piano Jurio è terminato. Il tuo account è stato riportato al <strong>piano gratuito</strong>: i tuoi dati, i fascicoli e lo storico restano disponibili.")}
      ${featureList([
        {
          title: "Cosa cambia",
          text: "Il piano gratuito include un numero limitato di utilizzi e non comprende le funzionalità avanzate.",
        },
        {
          title: "Come riattivare l'accesso completo",
          text: "Con un nuovo piano tornerai a disporre di ricerca giurisprudenziale completa, analisi dei documenti, consulente legale e analisi approfondite.",
        },
        {
          title: "Serve un consiglio?",
          text: "Se non sei sicuro di quale piano scegliere, il nostro team è a disposizione per aiutarti.",
        },
      ])}
      ${button(`${SITE_URL}/prezzi`, "Scopri i piani")}
    `,
    footerNote: `Ricevi questa email perché sei titolare di un account Jurio. Puoi verificare lo stato del piano dal tuo ${link(`${SITE_URL}/profilo/piani`, "profilo")}.`,
  });
};

export const generatePurchaseEmail = (
  nome: string,
  piano: string,
  prezzo: string,
  dataAcquisto: string,          // es. "2026-01-19 19:30"
  dataScadenza: string,          // es. "2027-01-19"
  ordineId: string,              // es. "JURIO-20260119-000123" o PayPal orderId
  transazioneId?: string,        // opzionale
  metodoPagamento?: string,      // es. "PayPal"
  linkRicevuta?: string,         // opzionale (URL)
  linkFattura?: string           // opzionale (URL)
) => {
  const rows: Array<[string, string]> = [
    ["Piano", escapeHtml(piano)],
    ["Importo", escapeHtml(prezzo)],
    ["Data di acquisto", escapeHtml(dataAcquisto)],
    ["Valido fino al", escapeHtml(dataScadenza)],
    ["Numero d'ordine", escapeHtml(ordineId)],
  ];
  if (transazioneId) rows.push(["ID transazione", escapeHtml(transazioneId)]);
  if (metodoPagamento) rows.push(["Metodo di pagamento", escapeHtml(metodoPagamento)]);
  if (linkRicevuta) rows.push(["Ricevuta", link(linkRicevuta, "Apri ricevuta")]);
  if (linkFattura) rows.push(["Fattura", link(linkFattura, "Apri fattura")]);

  return renderEmailLayout({
    title: "Acquisto completato | Jurio",
    preheader: `Il tuo piano ${piano} è attivo. Qui trovi il riepilogo dell'ordine.`,
    eyebrow: "Conferma d'ordine",
    heading: "Grazie, il tuo piano è attivo",
    body: `
      ${paragraph(`Ciao ${escapeHtml(nome)},`)}
      ${paragraph("ti confermiamo che il pagamento è andato a buon fine e che l'accesso al piano è già attivo sul tuo account.")}
      ${sectionLabel("Riepilogo dell'ordine")}
      ${detailsTable(rows)}
      ${callout("Il piano è <strong>una tantum</strong>: non prevede rinnovi automatici né addebiti ricorrenti. Alla scadenza potrai scegliere liberamente se acquistare un nuovo periodo.", "accent")}
      ${button(SITE_URL, "Accedi a Jurio")}
    `,
    footerNote: `Conserva questa email come conferma dell'acquisto. Puoi verificare in ogni momento stato e scadenza del piano dal tuo ${link(`${SITE_URL}/profilo/piani`, "profilo")}.`,
  });
};

export const generateMonthlyReportEmail = (data: MonthlyUsageReportData) => {
  const totalTimeSavedLabel = formatTimeSaved(data.totalTimeSavedMinutes);
  const mese = escapeHtml(data.mese);

  // Formula senza accordo di genere ("circa 1,4 ore" / "circa 45 minuti")
  const risparmio = (minutes: number, rispetto = "") =>
    `con un risparmio stimato di circa <strong>${formatTimeSaved(minutes)}</strong>${rispetto}.`;
  const conta = (count: number, singolare: string, plurale: string) =>
    `<strong>${count}</strong> ${count === 1 ? singolare : plurale}`;

  const attivita: Array<{ title: string; text: string }> = [];
  if (data.ricerca.count > 0) {
    attivita.push({
      title: "Ricerca giurisprudenziale",
      text: `${conta(data.ricerca.count, "ricerca", "ricerche")}, ${risparmio(data.ricerca.timeSavedMinutes, " rispetto alla ricerca tradizionale")}`,
    });
  }
  if (data.analisi.count > 0) {
    attivita.push({
      title: "Analisi documentale",
      text: `${conta(data.analisi.count, "elaborazione", "elaborazioni")} tra analisi, reasoning e OCR, ${risparmio(data.analisi.timeSavedMinutes)}`,
    });
  }
  if (data.deepAnalysis.count > 0) {
    attivita.push({
      title: "Ricerca giurisprudenziale approfondita",
      text: `${conta(data.deepAnalysis.count, "indagine completata", "indagini completate")}, ${risparmio(data.deepAnalysis.timeSavedMinutes)}`,
    });
  }
  if (data.sintesi.count > 0) {
    attivita.push({
      title: "Sintesi e redazione",
      text: `${conta(data.sintesi.count, "sintesi generata", "sintesi generate")}, ${risparmio(data.sintesi.timeSavedMinutes, " sulla stesura manuale")}`,
    });
  }

  const bloccoPrompting = data.haFattoPrompting
    ? callout("<strong>Consulente legale.</strong> Questo mese hai posto quesiti in forma libera (prompting libero). Se una risposta non ti ha convinto, scrivici: ogni segnalazione ci aiuta a migliorare la qualità dell'assistente.", "accent")
    : "";

  return renderEmailLayout({
    title: "Il tuo mese su Jurio",
    preheader: `Resoconto di ${data.mese}: ${totalTimeSavedLabel} di lavoro risparmiato con Jurio.`,
    eyebrow: `Resoconto di ${mese}`,
    heading: "Il tuo mese su Jurio",
    body: `
      ${paragraph(`Ecco il riepilogo della tua attività di <strong>${mese}</strong>. Affidando a Jurio le attività di ricerca e analisi, hai recuperato tempo per il lavoro a maggior valore.`)}
      ${statHighlight(totalTimeSavedLabel, "di lavoro risparmiato, secondo una stima indicativa")}
      ${attivita.length ? `${sectionLabel("Dettaglio delle attività")}${featureList(attivita)}` : ""}
      ${bloccoPrompting}
      ${button(`${SITE_URL}/profilo/utilizzi`, "Vedi il dettaglio degli utilizzi")}
    `,
    footerNote: "Le stime del tempo risparmiato sono indicative e calcolate sui tempi medi delle attività svolte manualmente.",
    showPreferences: true,
  });
};

export interface InternalPurchaseEmailData {
  customerEmail: string;
  uid: string;
  planId: string;
  amountLabel: string;
  provider: string;
  orderId: string;
  dataAcquisto: string;
  dataScadenza: string;
}

/** Notifica interna (contatti@jurio.it) per ogni nuovo acquisto. */
export const generateInternalPurchaseNotificationEmail = (data: InternalPurchaseEmailData) => {
  const rows: Array<[string, string]> = [
    ["Cliente", data.customerEmail || "Email non disponibile"],
    ["UID", data.uid],
    ["Piano", data.planId || "Non disponibile"],
    ["Importo", data.amountLabel],
    ["Provider", data.provider],
    ["ID ordine", data.orderId],
    ["Data acquisto", data.dataAcquisto || "Non disponibile"],
    ["Scadenza", data.dataScadenza || "Non disponibile"],
  ].map(([label, value]) => [escapeHtml(label), escapeHtml(value)]);

  return renderEmailLayout({
    title: "Nuovo acquisto | Jurio",
    preheader: `Nuovo acquisto: ${data.planId || "piano"} · ${data.amountLabel}`,
    eyebrow: "Notifica interna",
    heading: "Nuovo acquisto",
    body: detailsTable(rows),
    signature: false,
  });
};
