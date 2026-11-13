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
} from "../_layout";

export const generateWelcomeEmail = (nome: string) => {
  return renderEmailLayout({
    title: "Benvenuto in Jurio!",
    preheader: "Il tuo account è pronto: ricerca giurisprudenziale, analisi dei documenti e consulente legale in un'unica piattaforma.",
    eyebrow: "Benvenuto",
    heading: "Il tuo account Jurio è pronto",
    body: `
      ${paragraph(`Ciao ${escapeHtml(nome)}, benvenuto in <strong>Jurio</strong>!`)}
      ${paragraph("Jurio è la piattaforma che affianca il professionista legale nella <strong>ricerca giurisprudenziale</strong> e nell'<strong>analisi dei documenti</strong>, con risposte sempre ancorate alle fonti.")}
      ${sectionLabel("Da dove iniziare")}
      ${featureList([
        {
          title: "Ricerca giurisprudenziale veloce",
          text: "Individua sentenze e precedenti pertinenti in pochi secondi, con filtri per autorità, sezione, anno e materia.",
        },
        {
          title: "Consulente legale",
          text: "Poni un quesito in linguaggio naturale e ricevi una risposta strutturata, con le fonti citate e verificabili.",
        },
        {
          title: "Analisi dei documenti",
          text: "Carica atti e contratti per estrarne punti chiave, riferimenti normativi e sintesi.",
        },
        {
          title: "Fascicoli",
          text: "Organizza documenti e conversazioni per pratica e condividili con il tuo team.",
        },
      ])}
      ${button(SITE_URL, "Inizia a usare Jurio")}
      ${paragraph(`Per una panoramica completa delle funzionalità puoi consultare la ${link(`${SITE_URL}/guida`, "guida")}.`, "margin-top:16px; font-size:14px; color:#5f6672;")}
    `,
    footerNote: `Hai ricevuto questa email perché hai creato un account su Jurio. Se non vuoi più ricevere comunicazioni informative, puoi ${link(`${SITE_URL}/profilo/modifica`, "disiscriverti qui")}.`,
  });
};

export const generateTrialEmail = (nome: string) => {
  return renderEmailLayout({
    title: "Periodo di prova attivato | Jurio",
    preheader: "Hai 7 giorni di accesso completo a Jurio, senza alcun rinnovo automatico.",
    eyebrow: "Periodo di prova",
    heading: "La tua prova gratuita è attiva",
    body: `
      ${paragraph(`Ciao ${escapeHtml(nome)},`)}
      ${paragraph("ti confermiamo l'attivazione del tuo <strong>periodo di prova gratuito di 7 giorni</strong> su <strong>Jurio</strong>.")}
      ${featureList([
        {
          title: "Accesso completo per 7 giorni",
          text: "Puoi utilizzare tutte le principali funzionalità: ricerca giurisprudenziale, consulente legale, analisi dei documenti e fascicoli.",
        },
        {
          title: "Mettilo alla prova sui tuoi casi",
          text: "Il modo migliore per valutare Jurio è usarlo sulle pratiche su cui stai lavorando in questi giorni.",
        },
      ])}
      ${callout("<strong>Nessun rinnovo automatico.</strong> Al termine della prova sarai tu a decidere se attivare un piano. Nessun addebito automatico.", "accent")}
      ${button(SITE_URL, "Accedi a Jurio")}
    `,
    footerNote: `Hai domande durante la prova? ${link(`${SITE_URL}/contatti`, "Contattaci")}: ti risponderemo il prima possibile.`,
  });
};

export const generateRequestEmail = (nome: string, id: string, subject: string, message: string) => {
  const shortMessage = message.length > 300 ? message.substring(0, 300) + "..." : message;

  return renderEmailLayout({
    title: "Ticket di Supporto Jurio",
    preheader: `Abbiamo ricevuto la tua richiesta #${id}. Ti risponderemo entro 24 ore lavorative.`,
    eyebrow: "Assistenza",
    heading: "Abbiamo ricevuto la tua richiesta",
    body: `
      ${paragraph(`Ciao <strong>${escapeHtml(nome)}</strong>,`)}
      ${paragraph("grazie per averci scritto. La tua richiesta è stata registrata e verrà presa in carico dal nostro team il prima possibile.")}
      ${sectionLabel("Riepilogo della richiesta")}
      ${detailsTable([
        ["Numero ticket", `<span style="font-family:'SFMono-Regular', Menlo, Consolas, monospace;">#${escapeHtml(id)}</span>`],
        ["Oggetto", escapeHtml(subject)],
        ["Messaggio", `<span style="font-weight:400; color:#5f6672;">${escapeHtml(shortMessage)}</span>`],
      ])}
      ${featureList([
        {
          title: "Tempi di risposta",
          text: "Rispondiamo di norma entro <strong>24 ore lavorative</strong>. Riceverai la risposta a questo indirizzo email.",
        },
        {
          title: "Ti serve una risposta subito?",
          text: "Nella pagina contatti trovi l'assistente virtuale, che può aiutarti in tempo reale su dubbi tecnici e sull'uso della piattaforma.",
        },
      ])}
      ${button(`${SITE_URL}/contatti`, "Vai alla pagina contatti")}
    `,
    footerNote: `Questa è una notifica automatica, ti preghiamo di non rispondere a questo messaggio. Per aggiungere informazioni apri una nuova richiesta dalla ${link(`${SITE_URL}/contatti`, "pagina contatti")} indicando il numero di ticket.`,
  });
};
