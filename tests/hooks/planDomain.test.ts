import { describe, test, expect, vi } from "vitest";

/* ---------- mock firebase/firestore Timestamp ---------- */
vi.mock("firebase/firestore", () => {
  class MockTimestamp {
    seconds: number;
    nanoseconds: number;

    constructor(seconds: number, nanoseconds: number) {
      this.seconds = seconds;
      this.nanoseconds = nanoseconds;
    }

    toDate(): Date {
      return new Date(this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6));
    }

    static fromDate(date: Date): MockTimestamp {
      const seconds = Math.floor(date.getTime() / 1000);
      const nanoseconds = (date.getTime() % 1000) * 1e6;
      return new MockTimestamp(seconds, nanoseconds);
    }
  }

  return {
    Timestamp: MockTimestamp,
  };
});

import { Timestamp } from "firebase/firestore";
import {
  isTimestampLike,
  toStartDate,
  trialDaysLeft,
  normalizeStatus,
  isTrialStatus,
  getUpgradeTarget,
  findPlanByStatus,
  findPlanByKey,
  planCellClass,
} from "@/hooks/planlDomain"; // <-- adegua il path se necessario

describe("Subscription Utilities Suite", () => {
  describe("isTimestampLike", () => {
    test("riconosce oggetti con metodo toDate valido", () => {
      expect(isTimestampLike({ toDate: () => new Date() })).toBe(true);
    });

    test("restituisce false per valori null, primitivi o oggetti senza toDate", () => {
      expect(isTimestampLike(null)).toBe(false);
      expect(isTimestampLike(undefined)).toBe(false);
      expect(isTimestampLike("2026-09-02")).toBe(false);
      expect(isTimestampLike(1725264000000)).toBe(false);
      expect(isTimestampLike({})).toBe(false);
      expect(isTimestampLike({ toDate: "non-una-funzione" })).toBe(false);
    });
  });

  describe("toStartDate", () => {
    test("restituisce null per valori falsy", () => {
      expect(toStartDate(null)).toBeNull();
      expect(toStartDate(undefined)).toBeNull();
      expect(toStartDate("")).toBeNull();
    });

    test("converte istanze Timestamp di Firestore", () => {
      const targetDate = new Date("2026-03-01T10:00:00.000Z");
      const ts = Timestamp.fromDate(targetDate);

      expect(toStartDate(ts)).toEqual(targetDate);
    }); 
    
    test("converte oggetti timestamp-like con toDate", () => {
      const targetDate = new Date("2026-04-15T08:30:00Z");
      const customTs = { toDate: () => targetDate };

      expect(toStartDate(customTs)).toEqual(targetDate);
    });

    test("gestisce in sicurezza toDate che solleva eccezioni restituendo null", () => {
      const throwingTs = {
        toDate: () => {
          throw new Error("Corrupted timestamp");
        },
      };

      expect(toStartDate(throwingTs)).toBeNull();
    });

    test("parsa stringhe di data valide e scarta formati non validi", () => {
      const validIso = "2026-05-20T12:00:00.000Z";
      expect(toStartDate(validIso)).toEqual(new Date(validIso));
      expect(toStartDate("data-non-valida")).toBeNull();
    });

    test("parsa millisecondi numerici ed esclude NaN", () => {
      const nowMs = 1772611200000;
      expect(toStartDate(nowMs)).toEqual(new Date(nowMs));
      expect(toStartDate(NaN)).toBeNull();
    });
  });

  describe("trialDaysLeft", () => {
    test("calcola i giorni rimanenti del periodo di prova di 7 giorni", () => {
      const start = new Date("2026-09-01T00:00:00Z");
      const dayOne = new Date("2026-09-02T00:00:00Z"); // 1 giorno trascorso
      const daySix = new Date("2026-09-07T00:00:00Z"); // 6 giorni trascorsi

      expect(trialDaysLeft(start, start)).toBe(7);
      expect(trialDaysLeft(start, dayOne)).toBe(6);
      expect(trialDaysLeft(start, daySix)).toBe(1);
    });

    test("non restituisce mai numeri negativi se il periodo è scaduto", () => {
      const start = new Date("2026-08-01T00:00:00Z");
      const expiredNow = new Date("2026-08-15T00:00:00Z"); // 14 giorni trascorsi

      expect(trialDaysLeft(start, expiredNow)).toBe(0);
    });

    test("utilizza la data odierna come default se non viene passato now", () => {
      const start = new Date();
      expect(trialDaysLeft(start)).toBe(7);
    });
  });

  describe("normalizeStatus & isTrialStatus", () => {
    test("normalizza correttamente gli status validi gestendo maiuscole e spazi", () => {
      expect(normalizeStatus(" ADMIN ")).toBe("admin");
      expect(normalizeStatus("prova")).toBe("prova");
      expect(normalizeStatus("Trial")).toBe("trial");
      expect(normalizeStatus("personale")).toBe("personale");
      expect(normalizeStatus("personale_m")).toBe("personale_m");
      expect(normalizeStatus("business")).toBe("business");
      expect(normalizeStatus("business_m")).toBe("business_m");
    });

    test("mappa alias di scadenza o assenza a 'nessuno'", () => {
      expect(normalizeStatus("nessuno")).toBe("nessuno");
      expect(normalizeStatus("expired")).toBe("nessuno");
      expect(normalizeStatus("scaduto")).toBe("nessuno");
      expect(normalizeStatus("none")).toBe("nessuno");
      expect(normalizeStatus("qualsiasi-altro-stato")).toBe("nessuno");
    });

    test("restituisce null per input non stringa o stringhe vuote", () => {
      expect(normalizeStatus(null)).toBeNull();
      expect(normalizeStatus(undefined)).toBeNull();
      expect(normalizeStatus(123)).toBeNull();
      expect(normalizeStatus("   ")).toBeNull();
    });

    test("identifica correttamente se uno status è in prova", () => {
      expect(isTrialStatus("prova")).toBe(true);
      expect(isTrialStatus("trial")).toBe(true);
      expect(isTrialStatus("personale")).toBe(false);
      expect(isTrialStatus("business")).toBe(false);
      expect(isTrialStatus("admin")).toBe(false);
      expect(isTrialStatus("nessuno")).toBe(false);
      expect(isTrialStatus(null)).toBe(false);
    });
  });

  describe("getUpgradeTarget", () => {
    test("determina il target di upgrade secondo la gerarchia definita", () => {
      expect(getUpgradeTarget("prova")).toBe("personale");
      expect(getUpgradeTarget("trial")).toBe("personale");
      expect(getUpgradeTarget("personale")).toBe("business");
      expect(getUpgradeTarget("personale_m")).toBe("business_m");
      expect(getUpgradeTarget("nessuno")).toBe("personale");
      expect(getUpgradeTarget(null)).toBe("personale");
    });

    test("restituisce null per account al livello massimo (admin o business annuale)", () => {
      expect(getUpgradeTarget("admin")).toBeNull();
      expect(getUpgradeTarget("business")).toBeNull();
    });
  });

  describe("findPlanByStatus", () => {
    const samplePlans = [
      { id: "personale", name: "Piano Personale Annuale" },
      { id: "personale_m", name: "Piano Personale Mensile" },
      { id: "business", name: "Piano Business Annuale" },
      { id: "business_m", name: "Piano Business Mensile" },
    ];

    test("restituisce null se lo status è falsy, trial, admin o nessuno", () => {
      expect(findPlanByStatus(samplePlans, null)).toBeNull();
      expect(findPlanByStatus(samplePlans, "nessuno")).toBeNull();
      expect(findPlanByStatus(samplePlans, "admin")).toBeNull();
      expect(findPlanByStatus(samplePlans, "prova")).toBeNull();
      expect(findPlanByStatus(samplePlans, "trial")).toBeNull();
    });

    test("priorità 1: risolve corrispondenza esatta per id", () => {
      const match = findPlanByStatus(samplePlans, "personale_m");
      expect(match?.id).toBe("personale_m");
    });

    test("priorità 2: risolve corrispondenza se l'id inizia con lo status", () => {
      const customPlans = [
        { id: "business_custom_tier", name: "Custom Business" },
      ];
      const match = findPlanByStatus(customPlans, "business");
      expect(match?.id).toBe("business_custom_tier");
    });

    test("priorità 3: risolve corrispondenza nel nome se l'id è scorrelato", () => {
      const plansWithGenericId = [
        { id: "plan_tier_02", name: "Offerta Personale Special" },
      ];
      const match = findPlanByStatus(plansWithGenericId, "personale");
      expect(match?.id).toBe("plan_tier_02");
    });

    test("restituisce null se nessun piano soddisfa i criteri di ricerca", () => {
      expect(findPlanByStatus([], "personale")).toBeNull();
    });
  });

  describe("findPlanByKey", () => {
    const samplePlans = [
      { id: "plan_personale_yearly", name: "Personale Annuale" },
      { id: "plan_business_monthly", name: "Business Mensile" },
    ];

    test("trova il piano se l'id contiene la chiave ricercata (case-insensitive)", () => {
      expect(findPlanByKey(samplePlans, "PERSONALE")?.id).toBe("plan_personale_yearly");
      expect(findPlanByKey(samplePlans, "monthly")?.id).toBe("plan_business_monthly");
    });

    test("restituisce null se la chiave non compare in alcun id", () => {
      expect(findPlanByKey(samplePlans, "enterprise")).toBeNull();
    });
  });

  describe("planCellClass", () => {
    test("applica la classe di background solo quando highlighted è true", () => {
      const defaultClasses = planCellClass();
      const highlightedClasses = planCellClass(true);

      expect(defaultClasses).toContain("font-normal p-4 border-l border-[var(--color-border)]");
      expect(defaultClasses).not.toContain("bg-[var(--color-surface)]");

      expect(highlightedClasses).toContain("bg-[var(--color-surface)]");
    });
  });
});