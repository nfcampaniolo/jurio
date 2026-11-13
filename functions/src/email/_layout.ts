import emailStyles, { emailTheme as t } from "./emailStyles";

/**
 * Componenti condivisi per le email transazionali Jurio.
 * Layout a tabelle con stili inline per la massima compatibilità tra client (Gmail, Outlook, Apple Mail).
 */

export const SITE_URL = "https://jurio.it";
const LOGO_URL = "https://jurio-it.web.app/image.png";

export const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const P_STYLE = `margin:0 0 14px 0; font-size:15px; line-height:1.65; color:${t.text};`;

/** Paragrafo di testo; il contenuto è HTML già sicuro. */
export const paragraph = (html: string, extraStyle = ""): string =>
  `<p style="${P_STYLE}${extraStyle}">${html}</p>`;

export const link = (href: string, label: string): string =>
  `<a href="${escapeHtml(href)}" style="color:${t.primary}; text-decoration:underline; text-underline-offset:2px;">${label}</a>`;

export const button = (href: string, label: string): string => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px 0;">
    <tr>
      <td style="border-radius:8px; background-color:${t.primary};">
        <a href="${escapeHtml(href)}" class="button" style="display:inline-block; padding:13px 26px; font-family:${t.fontSans}; font-size:15px; font-weight:600; line-height:1.2; color:#ffffff; text-decoration:none; border-radius:8px; background-color:${t.primary};">${label}&nbsp;&rarr;</a>
      </td>
    </tr>
  </table>`;

/** Etichetta di sezione in maiuscoletto. */
export const sectionLabel = (label: string): string =>
  `<p style="margin:28px 0 10px 0; font-size:12px; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:${t.muted};">${label}</p>`;

/** Elenco di punti con titolo e descrizione, separati da filetti. */
export const featureList = (items: Array<{ title: string; text: string }>): string => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 8px 0; border-top:1px solid ${t.border};">
    ${items.map((item) => `
    <tr>
      <td class="feature" width="22" valign="top" style="padding:16px 0 16px 0; border-bottom:1px solid ${t.border};">
        <div style="width:8px; height:8px; margin-top:7px; border-radius:2px; background-color:${t.accent};"></div>
      </td>
      <td class="feature" valign="top" style="padding:14px 0 14px 0; border-bottom:1px solid ${t.border};">
        <h3 style="margin:0 0 4px 0; font-family:${t.fontSans}; font-size:15px; font-weight:600; line-height:1.4; color:${t.text};">${item.title}</h3>
        <p style="margin:0; font-size:14px; line-height:1.6; color:${t.muted};">${item.text}</p>
      </td>
    </tr>`).join("")}
  </table>`;

/** Tabella chiave/valore (riepiloghi d'ordine, dati ticket). I valori sono HTML già sicuro. */
export const detailsTable = (rows: Array<[string, string]>): string => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 8px 0; border:1px solid ${t.border}; border-radius:10px; border-collapse:separate; background-color:${t.surfaceAlt};">
    ${rows.map(([label, value], index) => `
    <tr>
      <td valign="top" style="padding:12px 16px; width:40%; font-size:13px; color:${t.muted};${index ? ` border-top:1px solid ${t.border};` : ""}">${label}</td>
      <td valign="top" style="padding:12px 16px; font-size:14px; font-weight:600; color:${t.text}; word-break:break-word;${index ? ` border-top:1px solid ${t.border};` : ""}">${value}</td>
    </tr>`).join("")}
  </table>`;

/** Riquadro informativo. */
export const callout = (html: string, tone: "accent" | "neutral" | "danger" = "neutral"): string => {
  const palette = {
    accent: { bg: t.accentSoft, bar: t.accent },
    neutral: { bg: t.surfaceAlt, bar: t.border },
    danger: { bg: t.dangerSoft, bar: t.danger },
  }[tone];
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 8px 0;">
    <tr>
      <td style="padding:16px 18px; background-color:${palette.bg}; border-left:3px solid ${palette.bar}; border-radius:0 8px 8px 0; font-size:14px; line-height:1.6; color:${t.text};">${html}</td>
    </tr>
  </table>`;
};

/** Codice da copiare (voucher, ticket). */
export const codeBox = (label: string, code: string): string => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 8px 0;">
    <tr>
      <td align="center" style="padding:22px 16px; border:1px dashed ${t.accent}; border-radius:10px; background-color:${t.accentSoft};">
        <p style="margin:0 0 8px 0; font-size:12px; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:${t.muted};">${label}</p>
        <h2 style="margin:0; font-family:${t.fontMono}; font-size:24px; font-weight:700; letter-spacing:0.12em; color:${t.text};">${code}</h2>
      </td>
    </tr>
  </table>`;

/** Valore numerico in evidenza (es. tempo risparmiato). */
export const statHighlight = (value: string, caption: string): string => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 8px 0;">
    <tr>
      <td align="center" style="padding:26px 16px; border-radius:12px; background-color:${t.accentSoft};">
        <div class="stat" style="font-family:${t.fontSerif}; font-size:40px; font-weight:700; line-height:1.15; color:${t.primary};">${value}</div>
        <p style="margin:6px 0 0 0; font-size:14px; color:${t.muted};">${caption}</p>
      </td>
    </tr>
  </table>`;

export interface EmailLayoutOptions {
  /** Contenuto del tag <title>. */
  title: string;
  /** Testo di anteprima mostrato nella lista dei messaggi del client. */
  preheader: string;
  /** Etichetta breve sopra il titolo (es. "Conferma d'ordine"). */
  eyebrow?: string;
  /** Titolo principale (HTML già sicuro). */
  heading: string;
  /** Corpo dell'email (HTML già sicuro). */
  body: string;
  /** Righe aggiuntive del footer (HTML già sicuro). */
  footerNote?: string;
  /** Mostra il link alle preferenze email (comunicazioni non strettamente transazionali). */
  showPreferences?: boolean;
  /** Firma "Il team di Jurio" in chiusura (disattivabile per le notifiche interne). */
  signature?: boolean;
}

export const renderEmailLayout = ({
  title,
  preheader,
  eyebrow,
  heading,
  body,
  footerNote,
  showPreferences = false,
  signature = true,
}: EmailLayoutOptions): string => {
  const year = new Date().getFullYear();
  const footerLinks = [
    link(SITE_URL, "jurio.it"),
    link(`${SITE_URL}/contatti`, "Assistenza"),
    ...(showPreferences ? [link(`${SITE_URL}/profilo/modifica`, "Preferenze email")] : []),
  ].join(`<span style="color:${t.border};">&nbsp;&nbsp;|&nbsp;&nbsp;</span>`);

  return `<!DOCTYPE html>
<html lang="it" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Lora:wght@600;700&display=swap" rel="stylesheet" />
  <style>
    ${emailStyles}
  </style>
</head>
<body style="margin:0; padding:0; background-color:${t.bg};">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">${escapeHtml(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${t.bg};">
    <tr>
      <td align="center" style="padding:0 12px;">
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px; font-family:${t.fontSans};">
          <tr>
            <td class="header" style="padding:32px 8px 20px 8px;">
              <a href="${SITE_URL}" style="text-decoration:none;">
                <img src="${LOGO_URL}" width="34" height="34" alt="Jurio" style="display:inline-block; vertical-align:middle; width:34px; height:34px; border-radius:50%;" />
                <span style="display:inline-block; vertical-align:middle; margin-left:10px; font-family:${t.fontSerif}; font-size:22px; font-weight:700; color:${t.text};">Jurio</span>
              </a>
            </td>
          </tr>
          <tr>
            <td style="background-color:${t.surface}; border:1px solid ${t.border}; border-radius:14px; overflow:hidden;">
              <div style="height:4px; line-height:4px; font-size:0; background-color:${t.accent}; border-radius:14px 14px 0 0;">&nbsp;</div>
              <div class="card-pad subheader" style="padding:36px 40px 36px 40px;">
                ${eyebrow ? `<p style="margin:0 0 10px 0; font-size:12px; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:${t.primary};">${eyebrow}</p>` : ""}
                <h1 class="heading" style="margin:0 0 20px 0; font-family:${t.fontSerif}; font-size:26px; font-weight:700; line-height:1.3; color:${t.text};">${heading}</h1>
                ${body}
                ${signature ? `<p style="margin:28px 0 0 0; font-size:15px; line-height:1.6; color:${t.text};">Cordiali saluti,<br /><strong>Il team di Jurio</strong></p>` : ""}
              </div>
            </td>
          </tr>
          <tr>
            <td class="footer" align="center" style="padding:24px 16px 40px 16px; font-size:12px; line-height:1.7; color:${t.muted};">
              ${footerNote ? `<p style="margin:0 0 10px 0;">${footerNote}</p>` : ""}
              <p style="margin:0 0 6px 0;">${footerLinks}</p>
              <p style="margin:0;">&copy; ${year} Jurio &middot; Strumenti di intelligenza artificiale per professionisti legali</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};
