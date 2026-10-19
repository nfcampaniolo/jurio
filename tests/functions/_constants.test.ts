import { describe, it, expect } from "vitest";
import {
  JURIO_USAGE_LIMITS,
  ALLOWED_PLANS,
  ALLOWED_ORIGINS,
  MAX_INPUT_CHARS_DOCUMENT,
  SEZIONI_CASSAZIONE_CIVILE,
  SEZIONI_CASSAZIONE_PENALE,
  AREE,
  areeString,
  macroString,
  type JurioFeatureType,
} from "@functions/_constants";

describe("Jurio Constants & Usage Limits Test Suite", () => {
  describe("JURIO_USAGE_LIMITS", () => {
    // Lista di tutte le feature definite nel tipo JurioFeatureType
    const expectedFeatures: JurioFeatureType[] = [
      "research",
      "web",
      "legal_agent",
      "speech_to_text",
      "reasoning",
      "support_public",
      "prompting",
      "prompt_enhancer",
      "admin",
      "feedback",
      "embedding",
      "register",
      "stripe_checkout",
      "deep_analysis",
      "extract_document",
      "apply_coupon",
      "teams",
      "cloud_files",
    ];

    it("dovrebbe contenere una configurazione per ogni JurioFeatureType", () => {
      expectedFeatures.forEach((feature) => {
        expect(JURIO_USAGE_LIMITS).toHaveProperty(feature);
        expect(JURIO_USAGE_LIMITS[feature]).toBeDefined();
        expect(typeof JURIO_USAGE_LIMITS[feature]).toBe("object");
      });
    });

    it("ogni limite definito deve avere valori numerici positivi per perMinute e perDay", () => {
      Object.entries(JURIO_USAGE_LIMITS).forEach(([feature, plans]) => {
        Object.entries(plans).forEach(([plan, limits]) => {
          expect(limits).toBeDefined();
          expect(typeof limits?.perMinute).toBe("number");
          expect(typeof limits?.perDay).toBe("number");

          expect(limits!.perMinute, `Error in ${feature}.${plan}.perMinute`).toBeGreaterThan(0);
          expect(limits!.perDay, `Error in ${feature}.${plan}.perDay`).toBeGreaterThan(0);
        });
      });
    });

    it("i piani specificati nelle feature dovrebbero appartenere a ALLOWED_PLANS o essere 'global'", () => {
      Object.entries(JURIO_USAGE_LIMITS).forEach(([, plans]) => {
        Object.keys(plans).forEach((planKey) => {
          if (planKey !== "global") {
            expect(
              ALLOWED_PLANS.has(planKey),
              `Il piano '${planKey}' non è presente in ALLOWED_PLANS`
            ).toBe(true);
          }
        });
      });
    });
  });

  describe("ALLOWED_PLANS & ALLOWED_ORIGINS", () => {
    it("ALLOWED_PLANS deve essere un Set non vuoto e contenere i piani base", () => {
      expect(ALLOWED_PLANS).toBeInstanceOf(Set);
      expect(ALLOWED_PLANS.size).toBeGreaterThan(0);
      expect(ALLOWED_PLANS.has("prova")).toBe(true);
      expect(ALLOWED_PLANS.has("admin")).toBe(true);
      expect(ALLOWED_PLANS.has("business")).toBe(true);
    });

    it("ALLOWED_ORIGINS deve contenere URL validi con protocollo HTTPS", () => {
      expect(Array.isArray(ALLOWED_ORIGINS)).toBe(true);
      expect(ALLOWED_ORIGINS.length).toBeGreaterThan(0);

      ALLOWED_ORIGINS.forEach((origin) => {
        expect(origin.startsWith("https://")).toBe(true);
        expect(() => new URL(origin)).not.toThrow();
      });
    });
  });

  describe("Cassazione Sezioni & General Constants", () => {
    it("MAX_INPUT_CHARS_DOCUMENT deve essere un numero positivo elevato", () => {
      expect(MAX_INPUT_CHARS_DOCUMENT).toBe(1_000_000);
    });

    it("SEZIONI_CASSAZIONE_CIVILE deve contenere le sezioni corrette e non essere vuoto", () => {
      expect(SEZIONI_CASSAZIONE_CIVILE.length).toBeGreaterThan(0);
      expect(SEZIONI_CASSAZIONE_CIVILE).toContain("SEZIONI UNITE CIVILI");
      expect(SEZIONI_CASSAZIONE_CIVILE).toContain("PRIMA SEZIONE CIVILE");
    });

    it("SEZIONI_CASSAZIONE_PENALE deve contenere le sezioni corrette e non essere vuoto", () => {
      expect(SEZIONI_CASSAZIONE_PENALE.length).toBeGreaterThan(0);
      expect(SEZIONI_CASSAZIONE_PENALE).toContain("SEZIONI UNITE PENALI");
      expect(SEZIONI_CASSAZIONE_PENALE).toContain("SEZIONE FERIALE PENALE");
    });
  });

  describe("AREE, MACROCATEGORIE & String Exports", () => {
    it("AREE deve essere un oggetto mappato con chiavi numeriche e descrizioni valide", () => {
      expect(typeof AREE).toBe("object");
      const keys = Object.keys(AREE).map(Number);

      expect(keys.length).toBeGreaterThan(0);
      expect(AREE[1]).toBe("Diritto Costituzionale e Parlamentare");
      expect(AREE[41]).toBe("Ordinamento Minorile (Civile e Penale)");

      Object.values(AREE).forEach((val) => {
        expect(typeof val).toBe("string");
        expect(val.trim().length).toBeGreaterThan(0);
      });
    });

    it("areeString e macroString devono essere stringhe concatenate separate da virgola", () => {
      expect(typeof areeString).toBe("string");
      expect(typeof macroString).toBe("string");

      expect(areeString).toContain("Diritto Costituzionale e Parlamentare");
      expect(areeString).toContain("Ordinamento Minorile (Civile e Penale)");

      expect(macroString).toContain("Separazione, Divorzio e Affidamento dei Minori");
      expect(macroString).toContain("Cripto-attività, Smart Contracts e Finanza Decentralizzata (DeFi)");

      expect(areeString.includes(", ")).toBe(true);
      expect(macroString.includes(", ")).toBe(true);
    });
  });
});