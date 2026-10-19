import emailStyles from '../emailStyles';

export const generateWelcomeEmail = (nome: string) => {
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

export const generateTrialEmail = (nome: string) => {
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

export const generateRequestEmail = (nome: string, id: string, subject: string, message: string) => {
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
