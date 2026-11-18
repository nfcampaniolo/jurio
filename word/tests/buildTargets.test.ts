import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { TARGETS, resolveTarget, transformManifest } = require("../build-targets") as typeof import("../build-targets");

const manifest = readFileSync(resolve(__dirname, "../manifest.xml"), "utf8");

describe("ambienti di build", () => {
  it("sceglie l'ambiente da --env target, altrimenti dalla modalità", () => {
    expect(resolveTarget({}, "development").name).toBe("development");
    expect(resolveTarget({}, "production").name).toBe("production");
    expect(resolveTarget({ target: "staging" }, "production").name).toBe("staging");
    expect(() => resolveTarget({ target: "qa" }, "production")).toThrow(/Ambiente sconosciuto/);
    expect(() => resolveTarget({ target: "staging" }, "development")).toThrow(/modalità production/);
  });

  it.each(["staging", "production"] as const)("il manifest %s ha Id, nome e URL del proprio ambiente", (name) => {
    const t = TARGETS[name];
    const out = transformManifest(manifest, t);
    expect(out).not.toContain("localhost");
    expect(out).toContain(`<Id>${t.manifestId}</Id>`);
    expect(out).toContain(`<DisplayName DefaultValue="${t.displayName}"/>`);
    expect(out).toContain(`<SourceLocation DefaultValue="${t.url}/taskpane.html"/>`);
    expect(out).toContain(`${t.url}/assets/icon-64.png`);
  });

  it("development lascia il manifest sorgente invariato", () => {
    expect(transformManifest(manifest, TARGETS.development)).toBe(manifest);
  });
});
