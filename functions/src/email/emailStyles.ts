/**
 * Design token delle email, allineati al tema dell'app (src/index.css).
 * Gli stili principali sono inline nei componenti di _layout.ts (unico modo affidabile su Gmail/Outlook);
 * questo foglio aggiunge solo reset e adattamenti per mobile, dove i client li supportano.
 */
export const emailTheme = {
  bg: "#f5f6f7",
  surface: "#ffffff",
  surfaceAlt: "#fafaf8",
  text: "#1a1d21",
  muted: "#5f6672",
  border: "#e4e6ea",
  primary: "#8a5c16",
  primaryHover: "#70470f",
  accent: "#e3a535",
  accentSoft: "#fbf4e6",
  danger: "#b42318",
  dangerSoft: "#fef3f2",
  fontSans: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  fontSerif: "Lora, Georgia, 'Times New Roman', serif",
  fontMono: "'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace",
} as const;

const emailStyles = `
  body {
    margin: 0;
    padding: 0;
    width: 100% !important;
    background-color: ${emailTheme.bg};
    color: ${emailTheme.text};
    font-family: ${emailTheme.fontSans};
    -webkit-text-size-adjust: 100%;
    -ms-text-size-adjust: 100%;
    -webkit-font-smoothing: antialiased;
  }
  table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
  a { color: ${emailTheme.primary}; }

  .container { width: 100%; max-width: 600px; }
  .header { padding: 32px 8px 20px 8px; }
  .subheader { color: ${emailTheme.text}; }
  .feature { border-bottom: 1px solid ${emailTheme.border}; }
  .button:hover { background-color: ${emailTheme.primaryHover} !important; }
  .footer { color: ${emailTheme.muted}; }

  @media (max-width: 600px) {
    .container { width: 100% !important; }
    .card-pad { padding: 28px 20px !important; }
    .header { padding: 24px 16px 16px 16px !important; }
    .heading { font-size: 23px !important; }
    .stat { font-size: 34px !important; }
    .button { display: block !important; width: 100% !important; box-sizing: border-box; }
  }
`;

export default emailStyles;
