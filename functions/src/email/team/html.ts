import {
  SITE_URL,
  button,
  callout,
  codeBox,
  escapeHtml,
  featureList,
  paragraph,
  renderEmailLayout,
} from "../_layout";

export const generateVoucherInviteEmail = (voucherCode: string, teamName: string = "Workspace") => {
  const team = escapeHtml(teamName);
  return renderEmailLayout({
    title: "Invito al team su Jurio",
    preheader: `Sei stato invitato a unirti a ${teamName} su Jurio. Usa il codice d'invito per accedere.`,
    eyebrow: "Invito al team",
    heading: "Sei stato invitato in un workspace",
    body: `
      ${paragraph("Ciao,")}
      ${paragraph(`hai ricevuto un invito per unirti a <strong>${team}</strong> su <strong>Jurio</strong>. Una volta entrato potrai collaborare con il team su fascicoli e documenti condivisi, utilizzando gli strumenti di ricerca giurisprudenziale e analisi documentale.`)}
      ${codeBox("Il tuo codice d'invito", escapeHtml(voucherCode))}
      ${featureList([
        { title: "1. Accedi o crea un account", text: "Usa il pulsante qui sotto: la registrazione è gratuita." },
        { title: "2. Apri la sezione Team", text: "La trovi nel tuo profilo, alla voce dedicata al team." },
        { title: "3. Inserisci il codice", text: "Il codice d'invito sblocca l'accesso al workspace e alle sue risorse." },
      ])}
      ${button(`${SITE_URL}/profilo/team`, "Accetta l'invito")}
    `,
    footerNote: "Se non conosci questo team o non ti aspettavi questo invito, puoi ignorare questa email: senza il codice non verrà effettuata alcuna modifica al tuo account.",
  });
};

export const generateWelcomeEmailTeam = (teamName: string = "Workspace") => {
  const team = escapeHtml(teamName);
  return renderEmailLayout({
    title: "Benvenuto nel team su Jurio",
    preheader: `Il tuo accesso a ${teamName} è attivo.`,
    eyebrow: "Team",
    heading: `Benvenuto in ${team}`,
    body: `
      ${paragraph("Ciao,")}
      ${paragraph(`il tuo accesso è stato confermato: da ora fai parte di <strong>${team}</strong> e puoi lavorare insieme al tuo team su Jurio.`)}
      ${featureList([
        { title: "Fascicoli condivisi", text: "Consulta i fascicoli e i documenti legali condivisi dal team." },
        { title: "Ricerca sui casi del team", text: "Esegui ricerche giurisprudenziali e analisi sui fascicoli condivisi." },
        { title: "Permessi per ruolo", text: "Le azioni disponibili dipendono dal ruolo che ti è stato assegnato." },
      ])}
      ${button(`${SITE_URL}/profilo/team`, "Vai al Workspace")}
    `,
    footerNote: "Per qualsiasi dubbio sul tuo ruolo o sui permessi, rivolgiti all'amministratore del team.",
  });
};

export const generateTeamRemovalEmail = (teamName: string = "Workspace") => {
  const team = escapeHtml(teamName);
  return renderEmailLayout({
    title: "Aggiornamento Workspace Jurio",
    preheader: "Il tuo accesso a un workspace Jurio è stato revocato.",
    eyebrow: "Team",
    heading: "Aggiornamento sul tuo accesso",
    body: `
      ${paragraph("Ciao,")}
      ${paragraph(`ti informiamo che l'amministratore ha revocato il tuo accesso al workspace <strong>${team}</strong>.`)}
      ${callout("Da questo momento non hai più accesso ai fascicoli e ai documenti condivisi del team. Il tuo account personale resta attivo, insieme ai tuoi documenti personali.", "neutral")}
      ${button(`${SITE_URL}/profilo`, "Vai al tuo profilo")}
    `,
    footerNote: `Se ritieni che si tratti di un errore, contatta direttamente l'amministratore del team <strong>${team}</strong>.`,
  });
};

export const generateTeamClosureEmail = (teamName: string = "Workspace") => {
  const team = escapeHtml(teamName);
  return renderEmailLayout({
    title: "Chiusura Workspace Jurio",
    preheader: "Un workspace di cui facevi parte è stato chiuso.",
    eyebrow: "Team",
    heading: "Il workspace è stato chiuso",
    body: `
      ${paragraph("Ciao,")}
      ${paragraph(`ti informiamo che il workspace <strong>${team}</strong> è stato chiuso definitivamente e rimosso dalla piattaforma.`)}
      ${callout("<strong>L'ambiente condiviso non è più attivo.</strong> Tutti i membri sono stati rimossi dal team; i fascicoli e i documenti sono stati trasferiti al titolare del workspace.", "danger")}
      ${button(SITE_URL, "Torna a Jurio")}
    `,
    footerNote: "Il tuo account personale resta attivo: puoi continuare a utilizzare Jurio o creare un nuovo workspace in qualsiasi momento.",
  });
};
