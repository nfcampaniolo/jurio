import emailStyles from './emailStyles';
import type{ MonthlyUsageReportData } from "../email";

export const generaEmailBenvenuto = (nome: string) => {
  return `
  <!DOCTYPE html>
  <html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Benvenuto in Jurio!</title>
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
        <p>Ciao ${nome}, benvenuto in <strong>Jurio</strong>!</p>
        <p>Il tuo nuovo strumento per la <strong>ricerca giurisprudenziale</strong> e l’<strong>analisi dei documenti legali</strong>.</p>
      </div>

      <!-- Punti principali del tool -->
      <div class="feature">
        <h3>Ricerca giurisprudenziale veloce</h3>
        <p>Trova sentenze e riferimenti legali in pochi secondi grazie a un motore intelligente.</p>
      </div>
      <div class="feature">
        <h3>Analisi documentale automatica</h3>
        <p>Estrai punti chiave, riferimenti normativi e riepiloghi da documenti lunghi in modo rapido e preciso.</p>
      </div>
      <div class="feature">
        <h3>Annotazioni e note condivisibili</h3>
        <p>Aggiungi commenti, evidenzia parti importanti e condividi facilmente con il tuo team.</p>
      </div>
      <div class="feature">
        <h3>Filtri avanzati e ricerche mirate</h3>
        <p>Filtra per tipo di documento, giurisdizione, anno o parola chiave, con risultati sempre rilevanti.</p>
      </div>

      <!-- Approfondimenti -->
      <div class="subheader" style="margin-top:30px;">
        <p>Con Jurio puoi anche:</p>
      </div>

      <div class="feature">
        <h3>Reportistica professionale</h3>
        <p>Genera report sintetici o dettagliati per uffici legali e studi professionali.</p>
      </div>
      <div class="feature">
        <h3>Storico e cronologia</h3>
        <p>Monitora le ricerche effettuate e riprendi facilmente il lavoro precedente.</p>
      </div>
      <div class="feature">
        <h3>Interfaccia intuitiva</h3>
        <p>Design chiaro e pulito, studiato per velocizzare il tuo flusso di lavoro legale.</p>
      </div>

      <!-- CTA -->
      <p style="text-align:center;">
        <a href="https://jurio.it" class="button">Accedi a Jurio</a>
      </p>

      <!-- Footer -->
      <div class="footer">
        <p>Se non vuoi più ricevere queste email, puoi <a href="https://jurio.it/profilo">disiscriverti qui</a>.</p>
      </div>
    </div>
  </body>
  </html>
  `;
};

export const generaEmailProva = (nome: string) => {
  return `
  <!DOCTYPE html>
   <html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Periodo di prova attivato | Jurio</title>
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
        <p>ti confermiamo che il tuo <strong>periodo di prova gratuito di 7 giorni</strong> su <strong>Jurio</strong> è stato attivato con successo.</p>
      </div>

      <!-- Contenuto -->
      <div class="feature">
        <h3>Accesso completo per 7 giorni</h3>
        <p>Per tutta la durata della prova potrai utilizzare tutte le principali funzionalità della piattaforma, incluse la ricerca giurisprudenziale, l’analisi automatica dei documenti e gli strumenti di annotazione.</p>
      </div>

      <div class="feature">
        <h3>Valuta Jurio nel tuo flusso di lavoro</h3>
        <p>Usa questi 7 giorni per capire se Jurio risponde alle tue esigenze professionali e può semplificare concretamente le tue attività quotidiane.</p>
      </div>

      <div class="feature">
        <h3>Nessun rinnovo automatico</h3>
        <p>Al termine del periodo di prova potrai decidere liberamente se attivare un piano a pagamento. Nessun addebito automatico.</p>
      </div>

      <!-- CTA -->
      <p style="text-align:center;">
        <a href="https://jurio.it" class="button">Accedi a Jurio</a>
      </p>

      <!-- Footer -->
      <div class="footer">
        <p>Se hai domande o necessiti di assistenza, il nostro team è a tua disposizione.</p>
        <p>Puoi gestire le tue preferenze email dal tuo <a href="https://jurio.it/profilo">profilo</a>.</p>
      </div>
    </div>
    </body>
  </html>
  `;
};

export const generaEmailAcquisto = (
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

export const generaEmailDowngrade = (nome: string) => {
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

export const generaEmailRichiesta = (nome: string, id: string, subject: string, message: string) => {
  // Pulizia rapida del messaggio per evitare problemi di rendering
  const shortMessage = message.length > 300 ? message.substring(0, 300) + "..." : message;

  return `
  <!DOCTYPE html>
  <html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ticket di Supporto Jurio</title>
    <style>
      ${emailStyles}
      .ticket-box {
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 20px;
        margin: 20px 0;
      }
      .ticket-id {
        font-family: monospace;
        color: #16a34a;
        font-weight: bold;
        font-size: 1.1em;
      }
      .label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #64748b;
        margin-bottom: 4px;
        font-weight: bold;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header" style="text-align:center;">
        <img src="https://jurio-it.web.app/image.png" alt="Jurio" style="max-width:120px; margin-bottom:15px;" />
        <h1>Supporto Jurio</h1>
      </div>

      <div class="subheader">
        <p>Ciao <strong>${nome}</strong>,</p>
        <p>abbiamo ricevuto la tua richiesta di assistenza. Un membro del nostro team tecnico prenderà in carico il ticket il prima possibile.</p>
      </div>

      <div class="ticket-box">
        <div class="label">ID Ticket</div>
        <div class="ticket-id">#${id}</div>
        
        <div class="label" style="margin-top:15px;">Oggetto</div>
        <div style="font-weight: 600; color: #1e293b;">${subject}</div>

        <div class="label" style="margin-top:15px;">Il tuo messaggio</div>
        <div style="color: #475569; font-style: italic; font-size: 14px; line-height: 1.5;">
          "${shortMessage}"
        </div>
      </div>

      <div class="feature">
        <h3>Cosa succede ora?</h3>
        <p>Solitamente rispondiamo entro <strong>24 ore lavorative</strong>. Riceverai una notifica a questo indirizzo email non appena ci saranno aggiornamenti.</p>
      </div>

      <div class="feature">
        <h3>Serve una risposta immediata?</h3>
        <p>Mentre aspetti, puoi consultare il nostro <strong>Assistente AI</strong> direttamente nella sezione contatti per risolvere dubbi tecnici o procedurali in tempo reale.</p>
      </div>

      <p style="text-align:center; margin-top: 30px;">
        <a href="https://jurio.it/contatti" class="button">Vai alla Dashboard</a>
      </p>

      <div class="footer">
        <p>Questa è una notifica automatica, non rispondere direttamente a questa email.</p>
        <p>&copy; ${new Date().getFullYear()} Jurio - Strumenti Avanzati per Professionisti Legali</p>
      </div>
    </div>
  </body>
  </html>
  `;
};

export const generaEmailInvitoVoucher = (voucherCode: string, teamName: string = "Workspace") => {
  return `
  <!DOCTYPE html>
  <html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Invito al team su Jurio</title>
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
        <p>Ciao!</p>
        <p>Hai ricevuto un invito per unirti a <strong>${teamName}</strong> su <strong>Jurio</strong>.</p>
        <p>Accedendo, potrai collaborare con il tuo team utilizzando i nostri strumenti avanzati per la <strong>ricerca giurisprudenziale</strong> e l’<strong>analisi dei documenti legali</strong>.</p>
      </div>

      <!-- Codice Invito in evidenza -->
      <div style="background-color: #f8f9fa; border: 1px dashed #ccc; padding: 25px 20px; text-align: center; margin: 30px 0; border-radius: 12px;">
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #555; text-transform: uppercase; letter-spacing: 1px;">Il tuo codice di invito personale</p>
        <h2 style="margin: 0; font-family: monospace; font-size: 28px; letter-spacing: 3px; color: #111;">${voucherCode}</h2>
      </div>

      <!-- Istruzioni -->
      <div class="feature">
        <h3>Come iniziare:</h3>
        <ol style="padding-left: 20px; color: #333; line-height: 1.8; margin-top: 10px;">
          <li>Clicca sul pulsante qui sotto per accedere o creare un account gratuito.</li>
          <li>Una volta all'interno, vai nella sezione dedicata agli abbonamenti o al team.</li>
          <li>Inserisci il tuo codice di invito per sbloccare l'accesso al Workspace.</li>
        </ol>
      </div>

      <!-- CTA -->
      <p style="text-align:center; margin-top: 35px;">
        <a href="https://jurio.it/profilo/team" class="button">Accetta l'invito</a>
      </p>

      <!-- Footer -->
      <div class="footer">
        <p>Se non conosci questo team o non hai richiesto questo invito, puoi semplicemente ignorare questa email.</p>
      </div>
    </div>
  </body>
  </html>
  `;
};

export const generaEmailBenvenutoTeam = (teamName: string = "Workspace") => {
  return `
  <!DOCTYPE html>
  <html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Benvenuto nel team su Jurio</title>
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
        <p>Ciao!</p>
        <p>Benvenuto ufficiale in <strong>${teamName}</strong>.</p>
        <p>Il tuo accesso è stato confermato. Da questo momento puoi collaborare attivamente con il tuo team, accedere ai fascicoli condivisi e utilizzare i nostri strumenti di intelligenza artificiale per l'analisi documentale.</p>
      </div>

      <!-- Feature Highlight -->
      <div class="feature" style="background-color: #f8f9fa; border-left: 4px solid #111; padding: 20px; margin: 30px 0; border-radius: 4px;">
        <h3 style="margin-top: 0; color: #111;">Cosa puoi fare ora:</h3>
        <ul style="padding-left: 20px; color: #333; line-height: 1.8; margin-bottom: 0;">
          <li>Consultare i documenti legali caricati dal team.</li>
          <li>Effettuare ricerche giurisprudenziali avanzate sui fascicoli condivisi.</li>
          <li>Gestire le tue bozze in base al ruolo che ti è stato assegnato.</li>
        </ul>
      </div>

      <!-- CTA -->
      <p style="text-align:center; margin-top: 35px;">
        <a href="https://jurio.it/profilo/team" class="button">Vai al Workspace</a>
      </p>

      <!-- Footer -->
      <div class="footer">
        <p>Se hai bisogno di assistenza o vuoi saperne di più su come utilizzare Jurio, visita il nostro centro di supporto.</p>
      </div>
    </div>
  </body>
  </html>
  `;
};

export const generaEmailRimozioneTeam = (teamName: string = "Workspace") => {
  return `
  <!DOCTYPE html>
  <html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Aggiornamento Workspace Jurio</title>
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
        <p>Ciao,</p>
        <p>Ti informiamo che il tuo accesso al workspace <strong>${teamName}</strong> è stato revocato dall'amministratore del gruppo.</p>
      </div>

      <!-- Istruzioni / Info -->
      <div class="feature" style="margin: 30px 0;">
        <p style="color: #333; line-height: 1.6;">
          A seguito di questa modifica, non hai più visibilità sui fascicoli condivisi e sui documenti legali appartenenti a questo team. I tuoi file personali o i documenti riassegnati rimarranno comunque accessibili o archiviati secondo le impostazioni scelte dal team.
        </p>
      </div>

      <!-- CTA -->
      <p style="text-align:center; margin-top: 35px;">
        <a href="https://jurio.it/profilo" class="button">Vai alla tua Dashboard</a>
      </p>

      <!-- Footer -->
      <div class="footer">
        <p>Se ritieni che si tratti di un errore, ti invitiamo a contattare direttamente l'amministratore del team <strong>${teamName}</strong>.</p>
      </div>
    </div>
  </body>
  </html>
  `;
};

export const generaEmailChiusuraTeam = (teamName: string = "Workspace") => {
  return `
  <!DOCTYPE html>
  <html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Chiusura Workspace Jurio</title>
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
        <p>Ciao,</p>
        <p>Ti informiamo che il workspace <strong>${teamName}</strong> è stato chiuso definitivamente e rimosso dalla piattaforma.</p>
      </div>

      <!-- Feature Highlight / Warning -->
      <div style="background-color: #fff3f3; border: 1px solid #ffcdd2; padding: 20px; text-align: center; margin: 30px 0; border-radius: 8px;">
        <p style="margin: 0; font-size: 14px; color: #c62828; line-height: 1.6;">
          <strong>L'ambiente condiviso non è più attivo.</strong><br>
          Tutti i membri del team sono stati svincolati dal gruppo. I documenti e i fascicoli legali sono stati trasferiti al proprietario del workspace.
        </p>
      </div>

      <!-- CTA -->
      <p style="text-align:center; margin-top: 35px;">
        <a href="https://jurio.it/" class="button">Torna a Jurio</a>
      </p>

      <!-- Footer -->
      <div class="footer">
        <p>Il tuo account personale rimane attivo e puoi continuare a utilizzare Jurio o creare un nuovo Workspace in qualsiasi momento.</p>
      </div>
    </div>
  </body>
  </html>
  `;
};

export const generaEmailReportMensile = (data: MonthlyUsageReportData) => {
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
        <h3>Analisi Documentale</h3>
        <p>Hai analizzato <strong>${data.analisi.count}</strong> documenti, recuperando <strong>${data.analisi.timeSavedMinutes} minuti</strong> di tempo prezioso.</p>
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