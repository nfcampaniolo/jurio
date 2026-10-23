import emailStyles from '../emailStyles';
import type{ MonthlyUsageReportData } from "../_interfaces";

export const generateDowngradeEmail = (nome: string) => {
  return `
  <!DOCTYPE html>
  <html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Piano scaduto | Jurio</title>
    <style>
      ${emailStyles}
    </style>
  </head>
  <body>
    <div class="container">
      <!-- Logo e header -->
      <div class="header" style="text-align:center;">
        <img src="https://jurio-it.web.app/image.png" alt="Jurio" style="max-width:120px; margin-bottom:15px;" />
        <h1>Jurio</h1>
      </div>

      <!-- Intro -->
      <div class="subheader">
        <p>Ciao ${nome},</p>
        <p>ti informiamo che il tuo <strong>piano attuale su Jurio è scaduto</strong>.</p>
      </div>

      <!-- Contenuto -->
      <div class="feature">
        <h3>Cosa cambia ora?</h3>
        <p>Il tuo account è stato riportato al <strong>piano gratuito</strong>, che include funzionalità limitate rispetto al piano premium.</p>
      </div>

      <div class="feature">
        <h3>Riprendi l’accesso completo</h3>
        <p>Attivando nuovamente un piano a pagamento, potrai tornare a utilizzare tutte le funzionalità avanzate: ricerca giurisprudenziale completa, analisi automatica dei documenti e strumenti di annotazione.</p>
      </div>

      <div class="feature">
        <h3>Hai bisogno di aiuto?</h3>
        <p>Se hai dubbi sui piani o vuoi capire quale sia il più adatto alle tue esigenze, il nostro team è a disposizione.</p>
      </div>

      <!-- CTA -->
      <p style="text-align:center;">
        <a href="https://jurio.it/pricing" class="button">Rinnova il piano</a>
      </p>

      <!-- Footer -->
      <div class="footer">
        <p>Grazie per aver utilizzato Jurio.</p>
        <p>Puoi gestire il tuo piano e le preferenze email dal tuo <a href="https://jurio.it/profilo">profilo</a>.</p>
      </div>
    </div>
  </body>
  </html>
  `;
};

export const generatePurchaseEmail = (
nome: string,
piano: string,
prezzo: string,
dataAcquisto: string,          // es. “2026-01-19 19:30”
dataScadenza: string,          // es. “2027-01-19”
ordineId: string,              // es. “JURIO-20260119-000123” o PayPal orderId
transazioneId?: string,        // opzionale
metodoPagamento?: string,      // es. “PayPal”
linkRicevuta?: string,         // opzionale (URL)
linkFattura?: string           // opzionale (URL)
) => {
const txRow = transazioneId ? `<p><strong>ID transazione:</strong> ${transazioneId}</p>` : ``;
const payRow = metodoPagamento ? `<p><strong>Metodo di pagamento:</strong> ${metodoPagamento}</p>` : ``;
const receiptRow = linkRicevuta ? `<p><strong>Ricevuta:</strong> <a href="${linkRicevuta}">Apri ricevuta</a></p>` : ``;
const invoiceRow = linkFattura ? `<p><strong>Fattura:</strong> <a href="${linkFattura}">Apri fattura</a></p>` : ``;
return `
 <!DOCTYPE html>
   <html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Acquisto completato | Jurio</title>
    <style>
      ${emailStyles}
    </style>
  </head>
  <body>
    <div class="container">
      <!-- Logo e header -->
      <div class="header" style="text-align:center;">
        <img src="https://jurio-it.web.app/image.png" alt="Jurio" style="max-width:120px; margin-bottom:15px;" />
        <h1>Jurio</h1>
      </div>
      <!-- Intro -->
      <div class="subheader">
        <p>Ciao ${nome},</p>
        <p>ti confermiamo che il tuo <strong>acquisto è stato completato con successo</strong> e che l’accesso al piano è attivo.</p>
      </div>

      <!-- Dettagli acquisto -->
      <div class="feature">
        <h3>Dettagli dell’acquisto</h3>
        <p><strong>Piano:</strong> ${piano}</p>
        <p><strong>Prezzo:</strong> ${prezzo}</p>
        <p><strong>Data acquisto:</strong> ${dataAcquisto}</p>
        <p><strong>Scadenza:</strong> ${dataScadenza}</p>
        <p><strong>ID ordine:</strong> ${ordineId}</p>
        ${txRow}
        ${payRow}
        ${receiptRow}
        ${invoiceRow}
      </div>

      <!-- Note contrattuali -->
      <div class="feature">
        <h3>Informazioni importanti</h3>
        <p>Il piano acquistato è <strong>una tantum</strong> e non prevede alcun rinnovo automatico o addebito ricorrente. Alla scadenza, potrai scegliere se acquistare un nuovo periodo di validità.</p>
      </div>

      <!-- Gestione abbonamento -->
      <div class="feature">
        <h3>Gestione dal profilo</h3>
        <p>Puoi verificare in ogni momento lo stato del tuo piano e la data di scadenza accedendo al tuo profilo.</p>
      </div>

      <!-- CTA -->
      <p style="text-align:center;">
        <a href="https://jurio.it" class="button">Accedi a Jurio</a>
      </p>

      <!-- Footer -->
      <div class="footer">
        <p>Se hai bisogno di assistenza, il nostro team è a tua disposizione.</p>
        <p>Puoi gestire le impostazioni del tuo account dal <a href="https://jurio.it/profilo">profilo</a>.</p>
      </div>
    </div>
  </body>
  </html>
  `;
};

export const generateMonthlyReportEmail = (data: MonthlyUsageReportData) => {
  // Costruiamo i blocchi dinamici per le feature usate
  let dettagliOperazioni = "";

  if (data.ricerca.count > 0) {
    dettagliOperazioni += `
      <div class="feature">
        <h3>Ricerca Giurisprudenziale</h3>
        <p>Hai effettuato <strong>${data.ricerca.count}</strong> ricerche intelligenti, risparmiando circa <strong>${data.ricerca.timeSavedMinutes} minuti</strong> rispetto alla ricerca tradizionale.</p>
      </div>
    `;
  }

  if (data.analisi.count > 0) {
    dettagliOperazioni += `
      <div class="feature">
        <h3>Analisi, Reasoning e OCR</h3>
        <p>Hai completato <strong>${data.analisi.count}</strong> elaborazioni, recuperando <strong>${data.analisi.timeSavedMinutes} minuti</strong> di tempo prezioso.</p>
      </div>
    `;
  }

  if (data.deepAnalysis.count > 0) {
    dettagliOperazioni += `
      <div class="feature">
        <h3>Ricerca Giurisprudenziale Approfondita</h3>
        <p>Hai completato <strong>${data.deepAnalysis.count}</strong> indagini approfondite, risparmiando circa <strong>${data.deepAnalysis.timeSavedMinutes} minuti</strong>.</p>
      </div>
    `;
  }

  if (data.sintesi.count > 0) {
    dettagliOperazioni += `
      <div class="feature">
        <h3>Sintesi e Drafting</h3>
        <p>Hai generato <strong>${data.sintesi.count}</strong> sintesi, salvando <strong>${data.sintesi.timeSavedMinutes} minuti</strong> di stesura manuale.</p>
      </div>
    `;
  }

  // Blocco condizionale per il prompting
  let bloccoPrompting = "";
  if (data.haFattoPrompting) {
    bloccoPrompting = `
      <div class="subheader" style="margin-top:30px; background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #0056b3;">
        <h3 style="margin-top: 0;">Siamo curiosi! 🤖</h3>
        <p>Abbiamo notato che questo mese hai messo alla prova Jurio utilizzando il <strong>prompting libero</strong>. Speriamo che il nostro assistente abbia risposto in modo eccellente ai tuoi quesiti giuridici più complessi e fuori dagli schemi.</p>
      </div>
    `;
  }

  return `
  <!DOCTYPE html>
  <html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Il tuo mese su Jurio</title>
    <style>
      ${emailStyles}
      /* Aggiunta di una classe extra per dare enfasi al tempo */
      .highlight-time {
        font-size: 2.5rem;
        color: #0056b3; /* Sostituisci con il colore primario di Jurio */
        font-weight: bold;
        margin: 10px 0;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <!-- Logo e header -->
      <div class="header" style="text-align:center;">
        <img src="https://jurio-it.web.app/image.png" alt="Jurio" style="max-width:120px; margin-bottom:15px;" />
        <h1>Jurio</h1>
      </div>

      <!-- Intro con enfasi sul tempo risparmiato -->
      <div class="subheader" style="text-align: center;">
        <p>Ecco il tuo resoconto di <strong>${data.mese}</strong>.</p>
        <p>Questo mese hai delegato a Jurio il lavoro ripetitivo, recuperando tempo prezioso per le attività ad alto valore aggiunto:</p>
        <div class="highlight-time">${data.totalTimeSavedMinutes} minuti</div>
        <p>risparmiati complessivamente.</p>
      </div>

      <!-- Dettaglio attività dinamico -->
      <div style="margin-top: 30px;">
        ${dettagliOperazioni}
      </div>

      ${bloccoPrompting}

      <!-- CTA -->
      <div style="margin-top: 40px; text-align:center;">
        <p>Vuoi vedere il dettaglio di tutte le tue interazioni?</p>
        <a href="https://jurio.it/profile/utilizzi" class="button">Vai ai tuoi utilizzi</a>
      </div>

      <!-- Footer -->
      <div class="footer">
        <p>Se non vuoi più ricevere queste email, puoi <a href="https://jurio.it/profilo">disiscriverti qui</a>.</p>
      </div>
    </div>
  </body>
  </html>
  `;
};
