/**
 * Controlli di prontezza al rilascio — `npm run test:release`.
 * Questa suite DEVE fallire finché l'add-in non è pronto per la produzione / AppSource:
 * ogni test rosso è un'attività bloccante della checklist di pubblicazione.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  JURIO_USAGE_LIMITS,
  WORD_ADDIN_DEV_ORIGIN,
  WORD_ADDIN_PROD_ORIGIN,
  WORD_ADDIN_STAGING_ORIGIN,
} from "../../../functions/src/_constants";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { TARGETS } = require("../../build-targets") as typeof import("../../build-targets");

const root = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

const manifest = read("manifest.xml");
const webpack = read("webpack.config.js");
const sourceLocation = manifest.match(/<SourceLocation DefaultValue="([^"]+)"/)![1];
const urlProd = TARGETS.production.url;
const firebaseJson = JSON.parse(read("../firebase.json"));
const firebaserc = JSON.parse(read("../.firebaserc"));
const wordHosting = (firebaseJson.hosting as { target: string; [k: string]: unknown }[]).find((h) => h.target === "word");

/** File sorgente del pannello (ts/tsx), percorsi relativi alla cartella word/. */
function sourceFiles(dir = "src"): string[] {
  return readdirSync(resolve(root, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? sourceFiles(`${dir}/${e.name}`)
      : /\.(ts|tsx)$/.test(e.name) && !e.name.endsWith(".d.ts")
        ? [`${dir}/${e.name}`]
        : []
  );
}

describe("Manifest di produzione", () => {
  it("l'URL di produzione (build-targets.js) non è il segnaposto contoso.com", () => {
    expect(urlProd).not.toMatch(/contoso/);
  });

  it("le URL di produzione puntano a un dominio Jurio", () => {
    expect(new URL(urlProd).hostname).toMatch(/(^|\.)jurio\.it$/);
  });

  it("non contiene testi del template Microsoft", () => {
    expect(manifest).not.toMatch(/sample add-in|Click to Show a Task Pane|Show Task Pane/i);
    expect(manifest).not.toContain("go.microsoft.com/fwlink/?LinkId=276812");
  });

  it("ha un'icona ad alta risoluzione dedicata (64x64 o 128x128)", () => {
    const hi = manifest.match(/<HighResolutionIconUrl DefaultValue="([^"]+)"/)![1];
    expect(hi).toMatch(/(64|128)/);
  });

  it("la build in dist/ (staging o produzione) non contiene localhost e punta al proprio sito", () => {
    if (!existsSync(resolve(root, "dist/manifest.xml"))) return;
    const built = read("dist/manifest.xml");
    const id = built.match(/<Id>([^<]+)<\/Id>/)![1];
    const target = Object.values(TARGETS).find((t) => t.manifestId === id);
    expect(target, `Id ${id} non corrisponde a nessun ambiente`).toBeDefined();
    if (target!.url.includes("localhost")) return; // build di sviluppo
    expect(built).not.toContain("localhost");
    expect(built).toContain(`${target!.url}/taskpane.html`);
    expect(built).toContain(`<DisplayName DefaultValue="${target!.displayName}"/>`);
  });

  it("ogni ambiente ha un Id di manifest diverso e il manifest sorgente è quello locale", () => {
    const ids = Object.values(TARGETS).map((t) => t.manifestId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(manifest).toContain(`<Id>${TARGETS.development.manifestId}</Id>`);
    expect(manifest).toContain(`<DisplayName DefaultValue="${TARGETS.development.displayName}"/>`);
  });

  it("le icone non sono i segnaposto del template", () => {
    // le icone del template Office pesano ~1–3 KB e riportano la scritta "Logo"; verifichiamo che siano state rigenerate
    const icon = readFileSync(resolve(root, "assets/icon-80.png"));
    expect(icon.length).toBeGreaterThan(0);
    expect(existsSync(resolve(root, "assets/logo-filled.png"))).toBe(false);
  });
});

describe("Codice sorgente – URL e segreti", () => {
  it("l'accesso non ha indirizzi cablati: web app e wordAuth arrivano dalla configurazione dell'ambiente", () => {
    for (const f of ["src/auth/useLogin.ts", "src/auth/browserLogin.ts", "src/auth/LoginPage.tsx"]) {
      expect(read(f), f).not.toMatch(/https:\/\/(localhost|jurio\.it|jurio-it-dev)/);
    }
    expect(TARGETS.production.webAppUrl).toBe("https://jurio.it");
    expect(TARGETS.staging.webAppUrl).toMatch(/jurio-it-dev/);
  });

  it("il vecchio login Google nella finestra di Office è stato rimosso", () => {
    expect(existsSync(resolve(root, "src/taskpane/google-auth.ts"))).toBe(false);
    expect(webpack).not.toMatch(/google-auth|__\/auth/);
  });

  it("il token debug di App Check non viene iniettato nella build di produzione", () => {
    expect(webpack).toMatch(/__APPCHECK_DEBUG_TOKEN__:\s*JSON\.stringify\(\s*dev && target\.appCheckDebugToken\s*\?/);
    // solo il dev server locale può usarlo; i siti pubblicati (staging e produzione) mai
    expect(TARGETS.staging.appCheckDebugToken).toBe(false);
    expect(TARGETS.production.appCheckDebugToken).toBe(false);
  });

  it("la build esistente in dist/ non contiene il token debug App Check né source map", () => {
    if (!existsSync(resolve(root, "dist"))) return;
    const tokens = [".env.development", ".env.production"]
      .map((f) => resolve(root, "..", f))
      .filter(existsSync)
      .map((f) => readFileSync(f, "utf8").match(/^VITE_APPCHECK_DEBUG_TOKEN=["']?([^"'\n]+)/m)?.[1]?.trim())
      .filter((t): t is string => Boolean(t));
    const files = readdirSync(resolve(root, "dist"));
    expect(files.filter((f) => f.endsWith(".map"))).toEqual([]);
    for (const f of files.filter((f) => f.endsWith(".js"))) {
      const content = read(`dist/${f}`);
      for (const token of tokens) expect(content.includes(token), `${f} contiene il token debug`).toBe(false);
    }
  });

  it("le source map non sono pubblicate in produzione", () => {
    expect(webpack).not.toMatch(/devtool:\s*"source-map"/);
  });

  it("l'endpoint wordAgent non è cablato in 3 componenti (configurazione centralizzata)", () => {
    const files = ["src/tools/Review.tsx", "src/tools/Search.tsx", "src/tools/Redrafting.tsx"];
    const hardcoded = files.filter((f) => read(f).includes("wordagent-vqoobrenua-ew.a.run.app"));
    expect(hardcoded).toEqual([]);
  });
});

describe("Contratto con il backend (functions)", () => {
  it("CORS: le origini dei tre ambienti coincidono con quelle ammesse dal backend", () => {
    expect(WORD_ADDIN_PROD_ORIGIN).toBe(new URL(TARGETS.production.url).origin);
    expect(WORD_ADDIN_STAGING_ORIGIN).toBe(new URL(TARGETS.staging.url).origin);
    expect(WORD_ADDIN_DEV_ORIGIN).toBe(new URL(TARGETS.development.url).origin);
    expect(new URL(sourceLocation).origin).toBe(WORD_ADDIN_DEV_ORIGIN);
  });

  it.each(["research_agent", "review_agent", "redraft_agent", "ask_agent", "case_law_agent"])(
    "esiste un limite d'uso per la feature '%s' (altrimenti ogni chiamata → 429)",
    (key) => {
      expect(Object.keys(JURIO_USAGE_LIMITS)).toContain(key);
    }
  );

  it("ogni azione inviata dal pannello è gestita dal backend", () => {
    const logic =
      readFileSync(resolve(root, "../functions/src/genai/wordAgent/logic.ts"), "utf8") +
      readFileSync(resolve(root, "../functions/src/auth/wordLogin.logic.ts"), "utf8");
    const sent = new Set<string>();
    for (const file of sourceFiles()) {
      for (const m of read(file).matchAll(/action:\s*"([a-z_]+)"/g)) sent.add(m[1]);
    }
    expect(sent.size).toBeGreaterThan(5);
    for (const action of sent) {
      expect(logic, `azione '${action}'`).toMatch(new RegExp(`(\\b${action}:\\s*"|"${action}")`));
    }
  });

  it("le review hanno un tetto alla dimensione dell'input (costo/DoS)", () => {
    const logic = readFileSync(resolve(root, "../functions/src/genai/wordAgent/logic.ts"), "utf8");
    expect(logic).toMatch(/reviewTotalChars/);
  });
});

describe("Riservatezza", () => {
  it("nessun componente scrive nello storage del browser (il testo dei documenti resta in memoria)", () => {
    for (const f of sourceFiles()) {
      expect(read(f), f).not.toMatch(/(localStorage|sessionStorage)\.setItem/);
    }
  });

  it("la telemetria Genkit non esporta input e output dei flow (testi dei documenti)", () => {
    const tools = readFileSync(resolve(root, "../functions/src/genai/tools/index.ts"), "utf8");
    expect(tools).toMatch(/enableFirebaseTelemetry\(\{\s*disableLoggingInputAndOutput:\s*true\s*\}\)/);
  });

  it("l'informativa di riservatezza è visibile nel pannello", () => {
    expect(read("src/tools/ToolHome.tsx")).toMatch(/<PrivacyNote \/>/);
  });
});

describe("Hosting", () => {
  it("il sito 'word' pubblica word/dist ed è collegato ai siti giusti di prod e dev", () => {
    expect(wordHosting?.public).toBe("word/dist");
    expect(firebaserc.targets["jurio-it"].hosting.word).toEqual(["jurio-word"]);
    expect(firebaserc.targets["jurio-it-dev"].hosting.word).toEqual(["jurio-word-dev"]);
    // la web app resta sul sito predefinito di ciascun progetto
    expect(firebaserc.targets["jurio-it"].hosting.app).toEqual(["jurio-it"]);
    expect(firebaserc.targets["jurio-it-dev"].hosting.app).toEqual(["jurio-it-dev"]);
  });

  it("l'URL di staging è il sito Hosting di dev", () => {
    expect(new URL(TARGETS.staging.url).hostname).toBe(`${firebaserc.targets["jurio-it-dev"].hosting.word[0]}.web.app`);
  });

  it("HTML e manifest non vanno in cache; nessun X-Frame-Options (Word sul web usa un iframe)", () => {
    const headers = JSON.stringify(wordHosting?.headers ?? []);
    expect(headers).not.toMatch(/X-Frame-Options/i);
    const rules = wordHosting!.headers as { source: string; headers: { key: string; value: string }[] }[];
    const noCache = rules.find((r) => r.source === "**/*.@(html|xml)");
    expect(noCache?.headers).toContainEqual({ key: "Cache-Control", value: "no-cache" });
  });

  it("il sito ha una pagina principale con il manifest e una pagina 404", () => {
    expect(read("src/site/index.html")).toContain('href="manifest.xml"');
    if (existsSync(resolve(root, "dist/index.html"))) {
      expect(read("dist/index.html"), "segnaposto non sostituiti").not.toMatch(/__[A-Z_]+__/);
    }
    expect(existsSync(resolve(root, "src/site/404.html"))).toBe(true);
    expect(webpack).toMatch(/filename: "index\.html"/);
    expect(webpack).toMatch(/filename: "404\.html"/);
  });

  it("i bundle di produzione hanno l'hash nel nome (cache lunga senza versioni vecchie)", () => {
    expect(read("webpack.config.js")).toMatch(/\[name\]\.\[contenthash/);
  });
});
