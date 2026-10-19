import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyHighlight,
  applyHighlightWithRegex,
  calculateMatchScore,
  generateHighlightRegex,
  getKeywordStems,
  SENTENCE_MULTIPLIER,
} from "@functions/research/_utils";

describe("research search utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts useful keyword stems and exposes the sentence multiplier", () => {
    // Arrange
    const text = "Il giudice decide rapidamente nel processo civile";

    // Act
    const result = getKeywordStems(text);

    // Assert
    expect(SENTENCE_MULTIPLIER).toBe(0.95);
    expect(result.length).toBeGreaterThan(0);
    expect(result.some(({ original, stem }) => original === "giudice" && stem.length > 0)).toBe(true);
    expect(result.some(({ original }) => /^\d+$/.test(original))).toBe(false);
  });

  it("scores matching terms with authority and recency bonuses", () => {
    // Arrange
    const target = "La corte di cassazione decide sul ricorso civile";
    const keywords = [
      { original: "cassazione", stem: "cassazion" },
      { original: "ricorso", stem: "ricors" },
    ];

    // Act
    const result = calculateMatchScore(target, keywords, {
      organo_giudicante: "Corte di Cassazione - Sezioni Unite",
      data_sentenza: `${new Date().getFullYear()}-01-01`,
    });

    // Assert
    expect(result.textMatchScore).toBeGreaterThan(1);
    expect(result.authorityBonus).toBe(0.06);
    expect(result.recencyBonus).toBe(0.03);
  });

  it("returns a zero score when target text or keywords cannot be scored", () => {
    // Arrange / Act
    const empty = calculateMatchScore("testo completo", []);
    const short = calculateMatchScore("abc", [{ original: "abc", stem: "abc" }]);

    // Assert
    expect(empty).toEqual({ textMatchScore: 0, authorityBonus: 0, recencyBonus: 0 });
    expect(short).toEqual({ textMatchScore: 0, authorityBonus: 0, recencyBonus: 0 });
  });

  it("highlights longer escaped terms first and ignores short keywords", () => {
    // Arrange
    const text = "The legal term c++ applies";

    // Act
    const regex = generateHighlightRegex(["c++", "legal", "term"], []);
    const highlighted = applyHighlight(text, ["c++", "legal", "term"]);

    // Assert
    expect(regex).toBeInstanceOf(RegExp);
    expect(highlighted).toContain("<mark>legal</mark>");
    expect(highlighted).toContain("<mark>term</mark>");
    expect(highlighted).toContain("c++");
  });

  it("keeps original text when no usable keyword or regex is supplied", () => {
    // Arrange
    const text = "Some original content";

    // Act
    const noTerms = applyHighlight(text, ["abc"]);
    const noRegex = applyHighlightWithRegex(text, null);
    const regexForShortTerms = generateHighlightRegex(["abc"]);

    // Assert
    expect(noTerms).toBe(text);
    expect(noRegex).toBe(text);
    expect(regexForShortTerms).toBeNull();
  });

  it("returns an empty string for empty highlight text", () => {
    // Arrange / Act
    const result = applyHighlightWithRegex("", /term/gi);

    // Assert
    expect(result).toBe("");
  });
});
