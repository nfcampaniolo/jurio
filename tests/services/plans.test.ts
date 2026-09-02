import { describe, test, expect, vi, beforeEach } from "vitest";

/* ---------- hoisted mocks ---------- */
const { mockGetDb, mockGetDocs } = vi.hoisted(() => ({
  mockGetDb: vi.fn().mockResolvedValue({}),
  mockGetDocs: vi.fn(),
}));

/* ---------- mock modules ---------- */
vi.mock("@/services/db", () => ({
  getDb: () => mockGetDb(),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_, name) => name),
  query: vi.fn((col) => col),
  getDocs: () => mockGetDocs(),
}));

interface MockDoc {
  id: string;
  data: () => Record<string, unknown>;
}

interface MockSnapshot {
  docs: MockDoc[];
}

/* ---------- subject under test ---------- */
import {
  formatPriceEUR,
  getPreloadedPlans,
  fetchPlansFromDb,
} from "@/services/plans";

describe("Plans Service Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("formatPriceEUR", () => {
    test("formatta correttamente il valore numerico in valuta EUR con localizzazione italiana", () => {
      const formatted = formatPriceEUR(6.1);
      // L'output di it-IT per 6.1 con EUR restituisce solitamente "6,10 €" o "€ 6,10"
      expect(formatted).toMatch(/6,10/);
      expect(formatted).toMatch(/€/);
    });

    test("gestisce correttamente i numeri interi", () => {
      const formatted = formatPriceEUR(24);
      expect(formatted).toMatch(/24,00/);
    });
  });

  describe("getPreloadedPlans", () => {
    test("restituisce l'array predefinito dei piani con le relative proprietà", () => {
      const plans = getPreloadedPlans();
      expect(plans).toHaveLength(2);
      expect(plans[0].id).toBe("personale");
      expect(plans[0].price).toBe(6.1);
      expect(plans[0].priceLabel).toBeDefined();

      expect(plans[1].id).toBe("business");
      expect(plans[1].highlighted).toBe(true);
    });
  });

  describe("fetchPlansFromDb", () => {
    test("recupera, mappa, calcola il priceLabel e ordina i piani correttamente in base all'ordine definito", async () => {
      const mockSnapshot: MockSnapshot = {
        docs: [
          {
            id: "business",
            data: () => ({
              name: "Business",
              price: 24.4,
              durationDays: 30,
              cta: "Registrati",
              features: [],
            }),
          },
          {
            id: "personale",
            data: () => ({
              name: "Personale",
              price: 6.1,
              durationDays: 30,
              cta: "Registrati",
              features: [],
            }),
          },
          {
            id: "team",
            data: () => ({
              name: "Team",
              price: 15.0,
              durationDays: 30,
              cta: "Registrati",
              features: [],
            }),
          },
        ],
      };

      mockGetDocs.mockResolvedValueOnce(mockSnapshot);

      const plans = await fetchPlansFromDb();

      expect(mockGetDb).toHaveBeenCalledTimes(1);
      expect(plans).toHaveLength(3);

      // Verifica l'ordinamento atteso (personale: 0, team: 1, business: 2)
      expect(plans[0].id).toBe("personale");
      expect(plans[0].priceLabel).toMatch(/6,10/);

      expect(plans[1].id).toBe("team");
      expect(plans[1].priceLabel).toMatch(/15,00/);

      expect(plans[2].id).toBe("business");
      expect(plans[2].priceLabel).toMatch(/24,40/);
    });

    test("gestisce correttamente ID sconosciuti applicando il fallback di ordinamento", async () => {
      const mockSnapshot: MockSnapshot = {
        docs: [
          {
            id: "unknown_plan" as string,
            data: () => ({
              name: "Custom",
              price: 100,
              durationDays: 30,
              cta: "Contattaci",
              features: [],
            }),
          },
          {
            id: "personale",
            data: () => ({
              name: "Personale",
              price: 6.1,
              durationDays: 30,
              cta: "Registrati",
              features: [],
            }),
          },
        ],
      };

      mockGetDocs.mockResolvedValueOnce(mockSnapshot);

      const plans = await fetchPlansFromDb();

      expect(plans).toHaveLength(2);
      expect(plans[0].id).toBe("personale"); // Ordine 0
      expect(plans[1].id).toBe("unknown_plan"); // Fallback 999
    });
  });
});