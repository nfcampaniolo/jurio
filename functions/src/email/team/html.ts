import emailStyles from '../emailStyles';

export const generateVoucherInviteEmail = (voucherCode: string, teamName: string = "Workspace") => {
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

export const generateWelcomeEmailTeam = (teamName: string = "Workspace") => {
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

export const generateTeamRemovalEmail = (teamName: string = "Workspace") => {
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

export const generateTeamClosureEmail = (teamName: string = "Workspace") => {
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