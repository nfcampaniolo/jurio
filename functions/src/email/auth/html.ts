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
