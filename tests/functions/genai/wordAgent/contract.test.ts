import { describe, expect, it } from "vitest";
import {
  JURIO_USAGE_LIMITS,
  WORD_AI_MONTHLY_LIMITS,
  wordPlanTier,
} from "@functions/_constants";

/**
 * Contratto tra executeWordAgent e validateUserPlanAndLimits: ogni azione AI dell'add-in usa una feature
 * dedicata. Se la chiave mancasse, validateUserPlanAndLimits userebbe { 0, 0 } e ogni chiamata
 * finirebbe in 429 (logic.test.ts non lo vedrebbe perché mocka validateUserPlanAndLimits).
 */
const WORD_AI_FEATURES = ["research_agent", "review_agent", "redraft_agent", "ask_agent", "case_law_agent"] as const;

describe("wordAgent – piani e limiti d'uso", () => {
  it.each(WORD_AI_FEATURES)("'%s' è disponibile a Essential, Business, prova e admin", (key) => {
    expect(Object.keys(JURIO_USAGE_LIMITS[key]).sort()).toEqual(
      ["admin", "business", "business_m", "personale", "personale_m", "prova"]
    );
  });

  it("la dettatura è disponibile a tutti i piani dell'add-in, Essential compreso", () => {
    expect(Object.keys(JURIO_USAGE_LIMITS.word_dictation).sort()).toEqual(
      ["admin", "business", "business_m", "personale", "personale_m", "prova"]
    );
  });

  it("la ricerca senza AI (feature research) è inclusa in Essential", () => {
    expect(JURIO_USAGE_LIMITS.research).toHaveProperty("personale");
    expect(JURIO_USAGE_LIMITS.research).toHaveProperty("personale_m");
  });

  it("Essential e prova hanno 10 richieste AI al mese; Business e admin nessun tetto mensile", () => {
    expect(WORD_AI_MONTHLY_LIMITS).toMatchObject({ personale: 10, personale_m: 10, prova: 10 });
    expect(WORD_AI_MONTHLY_LIMITS.business).toBeNull();
    expect(WORD_AI_MONTHLY_LIMITS.business_m).toBeNull();
    expect(WORD_AI_MONTHLY_LIMITS.admin).toBeNull();
  });

  it.each([
    ["personale", "essential"], ["personale_m", "essential"], ["business", "business"],
    ["business_m", "business"], ["prova", "prova"], ["admin", "admin"], ["nessuno", "nessuno"], ["", "nessuno"],
  ])("wordPlanTier(%s) = %s", (planId, tier) => {
    expect(wordPlanTier(planId)).toBe(tier);
  });
});
