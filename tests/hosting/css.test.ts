import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

function readCss(): string {
  // cambia qui se il path è diverso
  const cssPath = path.resolve(process.cwd(), "src/index.css");
  return fs.readFileSync(cssPath, "utf8");
}

describe("global CSS (smoke)", () => {
  it("defines required tokens for light theme (:root vars)", () => {
    const css = readCss();

    expect(css).toContain(":root");
    expect(css).toContain("--color-bg:");
    expect(css).toContain("--color-surface:");
    expect(css).toContain("--color-text:");
    expect(css).toContain("--color-primary:");
    expect(css).toContain("--color-border:");
    expect(css).toContain("--shadow-soft:");
    expect(css).toContain("--text-base-size:");
  });

  it("has dark theme media query and overrides key vars", () => {
    const css = readCss();

    expect(css).toContain("@media (prefers-color-scheme: dark)");
    expect(css).toContain("--color-bg: #111111");
    expect(css).toContain("--color-surface: #1a1a1a");
    expect(css).toContain("--color-text: #e6e7ea");
  });

  it("has base resets and accessibility focus styles", () => {
    const css = readCss();

    expect(css).toContain("*::before");
    expect(css).toContain("box-sizing: border-box");
    expect(css).toContain("body");
    expect(css).toContain("margin: 0");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("outline:");
    expect(css).toContain("outline-offset:");
  });

  it("does not reference undefined CSS vars (catches --text-max-width)", () => {
    const css = readCss();

    const uses = css.includes("var(--text-max-width)");
    const defines = css.includes("--text-max-width:");

    // se la usi, devi definirla
    if (uses) expect(defines).toBe(true);
  });
});