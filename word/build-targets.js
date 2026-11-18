/**
 * Ambienti dell'add-in Word. Unica fonte per webpack, test e documentazione.
 *
 *  development → npm start / dev-server su https://localhost:3000, progetto Firebase jurio-it-dev
 *  staging     → sito Hosting "jurio-word-dev" del progetto jurio-it-dev (test di team)
 *  production  → sito Hosting "jurio-word" del progetto jurio-it, dominio word.jurio.it
 *
 * webAppUrl è la web app dello stesso progetto Firebase: l'accesso al pannello avviene lì (/word-login).
 * appCheckDebugToken: il dev server locale serve il token debug di App Check (mai nei file compilati).
 * Ogni ambiente ha un manifest con Id e nome propri, così più versioni possono convivere in Word.
 * L'Id di produzione NON va mai cambiato: identifica l'add-in presso Microsoft 365 e AppSource.
 * Le origini devono coincidere con WORD_ADDIN_*_ORIGIN in functions/src/_constants.ts (CORS).
 */
const TARGETS = {
  development: {
    url: "https://localhost:3000",
    envFile: ".env.development",
    manifestId: "4af9267c-9f67-4718-959c-c067da039f14",
    displayName: "Jurio (locale)",
    webAppUrl: "https://jurio-it-dev.web.app",
    appCheckDebugToken: true,
  },
  staging: {
    url: "https://jurio-word-dev.web.app",
    envFile: ".env.development",
    manifestId: "4944363c-f307-4c56-b0fa-a709bb4d45eb",
    displayName: "Jurio (dev)",
    webAppUrl: "https://jurio-it-dev.web.app",
    appCheckDebugToken: false,
  },
  production: {
    url: "https://word.jurio.it",
    envFile: ".env.production",
    manifestId: "313c349a-4e6d-4c23-bfa5-0c4fd0649d79",
    displayName: "Jurio",
    webAppUrl: "https://jurio.it",
    appCheckDebugToken: false,
  },
};

/** Il manifest sorgente (manifest.xml) è quello di sviluppo locale. */
const SOURCE = TARGETS.development;

/** `--env target=staging` sceglie l'ambiente; altrimenti development in dev e production in build. */
function resolveTarget(env = {}, mode = "production") {
  const name = env.target || (mode === "development" ? "development" : "production");
  if (!TARGETS[name]) {
    throw new Error(`[word] Ambiente sconosciuto "${name}". Valori ammessi: ${Object.keys(TARGETS).join(", ")}`);
  }
  if (name !== "development" && mode === "development") {
    throw new Error(`[word] L'ambiente "${name}" va compilato in modalità production.`);
  }
  return { name, ...TARGETS[name] };
}

/** Manifest per l'ambiente: URL, Id e nome visualizzato. */
function transformManifest(xml, target) {
  return xml
    .split(SOURCE.url)
    .join(target.url)
    .replace(`<Id>${SOURCE.manifestId}</Id>`, `<Id>${target.manifestId}</Id>`)
    .replace(`<DisplayName DefaultValue="${SOURCE.displayName}"/>`, `<DisplayName DefaultValue="${target.displayName}"/>`);
}

module.exports = { TARGETS, SOURCE, resolveTarget, transformManifest };
