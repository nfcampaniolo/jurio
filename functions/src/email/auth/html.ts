import {
  button,
  callout,
  escapeHtml,
  link,
  paragraph,
  renderEmailLayout,
} from "../_layout";

export const generateEmailVerificationEmail = (verificationUrl: string, email: string) => {
  const safeEmail = escapeHtml(email);
  return renderEmailLayout({
    title: "Conferma il tuo indirizzo email",
    preheader: "Conferma il tuo indirizzo email per completare la registrazione a Jurio.",
    eyebrow: "Account",
    heading: "Conferma il tuo indirizzo email",
    body: `
      ${paragraph("Ciao,")}
      ${paragraph(`grazie per esserti registrato su <strong>Jurio</strong>. Per completare la registrazione e attivare la tua prova gratuita, conferma che <strong>${safeEmail}</strong> è il tuo indirizzo email.`)}
      ${button(verificationUrl, "Conferma email")}
      ${callout("Il link è personale e scade dopo qualche ora. Se è scaduto, puoi richiederne uno nuovo dalla pagina di verifica su Jurio.", "neutral")}
      ${paragraph(`Se il pulsante non funziona, copia e incolla questo indirizzo nel browser:<br>${link(verificationUrl, escapeHtml(verificationUrl))}`, "font-size:13px; word-break:break-all;")}
    `,
    footerNote: "Se non hai creato un account su Jurio, puoi ignorare questa email: senza la conferma l'account non verrà attivato.",
  });
};

export const generatePasswordResetEmail = (resetUrl: string, email: string) => {
  const safeEmail = escapeHtml(email);
  return renderEmailLayout({
    title: "Reimposta la tua password",
    preheader: "Hai chiesto di reimpostare la password del tuo account Jurio.",
    eyebrow: "Sicurezza account",
    heading: "Reimposta la tua password",
    body: `
      ${paragraph("Ciao,")}
      ${paragraph(`abbiamo ricevuto una richiesta di reimpostazione della password per l'account Jurio associato a <strong>${safeEmail}</strong>. Clicca sul pulsante qui sotto per sceglierne una nuova.`)}
      ${button(resetUrl, "Reimposta password")}
      ${callout("Il link è personale, può essere usato una sola volta e scade dopo circa un'ora. Se è scaduto, puoi richiederne uno nuovo dalla pagina di accesso.", "neutral")}
      ${paragraph(`Se il pulsante non funziona, copia e incolla questo indirizzo nel browser:<br>${link(resetUrl, escapeHtml(resetUrl))}`, "font-size:13px; word-break:break-all;")}
    `,
    footerNote: "Se non hai richiesto tu la reimpostazione, ignora questa email: la tua password attuale resta valida. Se ricevi più richieste che non riconosci, contatta il supporto.",
  });
};
