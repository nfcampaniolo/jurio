import { describe, test, expect } from "vitest";
import {
  formatMonth,
  calculateTimeSaved,
  type UsageDoc,
} from "@/features/profile/hooks/usageUtils"; // <-- adegua il path di import se necessario

describe("Usage Utils Suite", () => {
  describe("formatMonth", () => {
    test("converte la stringa YYYY_MM formattando mese esteso e anno in italiano con iniziale maiuscola", () => {
      expect(formatMonth("2026_07")).toBe("Luglio 2026");
      expect(formatMonth("2026_01")).toBe("Gennaio 2026");
      expect(formatMonth("2026_12")).toBe("Dicembre 2026");
      expect(formatMonth("2025_09")).toBe("Settembre 2025");
    });

    test("gestisce correttamente i mesi con numerazione a cifra singola o zero-padded", () => {
      expect(formatMonth("2026_3")).toBe("Marzo 2026");
      expect(formatMonth("2026_03")).toBe("Marzo 2026");
    });
  });

  describe("calculateTimeSaved", () => {
    test("restituisce 0 se il documento contiene solo l'id o valori azzerati", () => {
      const emptyDoc: UsageDoc = { id: "2026_09" };
      expect(calculateTimeSaved(emptyDoc)).toBe(0);

      const zeroDoc: UsageDoc = {
        id: "2026_09",
        research_agent: 0,
        research: 0,
        review_agent: 0,
        reasoning: 0,
        speech_to_text: 0,
        drafting_agent: 0,
      };
      expect(calculateTimeSaved(zeroDoc)).toBe(0);
    });

    test("calcola il moltiplicatore ricerca (10 min ciascuno per research_agent e research)", () => {
      const doc: UsageDoc = {
        id: "2026_09",
        research_agent: 3,
        research: 2,
      };
      // (3 + 2) * 10 = 50
      expect(calculateTimeSaved(doc)).toBe(50);
    });

    test("calcola il moltiplicatore analisi (30 min ciascuno per review_agent, reasoning, speech_to_text)", () => {
      const doc: UsageDoc = {
        id: "2026_09",
        review_agent: 2,
        reasoning: 1,
        speech_to_text: 3,
      };
      // (2 + 1 + 3) * 30 = 180
      expect(calculateTimeSaved(doc)).toBe(180);
    });

    test("calcola il moltiplicatore sintesi (15 min per drafting_agent)", () => {
      const doc: UsageDoc = {
        id: "2026_09",
        drafting_agent: 4,
      };
      // 4 * 15 = 60
      expect(calculateTimeSaved(doc)).toBe(60);
    });

    test("somma correttamente tutte le metriche ponderate combinate", () => {
      const fullDoc: UsageDoc = {
        id: "2026_09",
        research_agent: 2, // 20
        research: 3,       // 30 -> tot ricerca = 50
        review_agent: 1,   // 30
        reasoning: 2,      // 60
        speech_to_text: 1, // 30 -> tot analisi = 120
        drafting_agent: 4, // 60 -> tot sintesi = 60
      };

      // 50 + 120 + 60 = 230
      expect(calculateTimeSaved(fullDoc)).toBe(230);
    });

    test("ignora campi non inclusi nella formula di risparmio tempo (prompting, legal_agent)", () => {
      const docWithExtra: UsageDoc = {
        id: "2026_09",
        prompting: 100,
        legal_agent: 50,
        drafting_agent: 2, // 30
      };

      expect(calculateTimeSaved(docWithExtra)).toBe(30);
    });
  });
});