import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import type { UsageDoc } from "@/features/profile/hooks/usageUtils";

/* ---------- hoisted mocks ---------- */
const { mockNavigate, mockAuthState, mockGetDocs } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockAuthState: {
    user: { uid: "usr_flv_2026" } as { uid: string; email?: string } | null,
  },
  mockGetDocs: vi.fn(),
}));

/* ---------- mock react-router-dom ---------- */
vi.mock("react-router-dom", () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
}));

/* ---------- mock @/context/useAuth ---------- */
vi.mock("@/context/useAuth", () => ({
  __esModule: true,
  useAuth: () => mockAuthState,
}));

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", () => {
  const passthroughComponent = (tag: string) =>
    React.forwardRef<
      HTMLElement,
      React.HTMLAttributes<HTMLElement> & {
        variants?: unknown;
        initial?: unknown;
        animate?: unknown;
        transition?: unknown;
      }
    >(({ children, ...props }, ref) =>
      React.createElement(tag, { ...props, ref }, children)
    );

  return {
    __esModule: true,
    motion: {
      div: passthroughComponent("div"),
      h1: passthroughComponent("h1"),
      p: passthroughComponent("p"),
    },
  };
});

/* ---------- mock usageUtils ---------- */
vi.mock("@/features/profile/hooks/usageUtils", () => ({
  __esModule: true,
  formatMonth: (id: string) => {
    if (id === "2026_08") return "Agosto 2026";
    if (id === "2026_07") return "Luglio 2026";
    return id;
  },
  calculateTimeSaved: (usage: Partial<UsageDoc>) => {
    const total =
      (usage.research_agent || 0) * 15 +
      (usage.drafting_agent || 0) * 30 +
      (usage.legal_agent || 0) * 10;
    return total;
  },
}));

/* ---------- mock firestore & db ---------- */
const mockGetDb = vi.fn().mockResolvedValue({ type: "firestore-db" });

vi.mock("@/infrastructure/db", () => ({
  __esModule: true,
  getDb: () => mockGetDb(),
}));

vi.mock("firebase/firestore", () => ({
  __esModule: true,
  collection: vi.fn((_db, ...pathSegments: string[]) => ({
    _type: "collection",
    path: pathSegments.join("/"),
  })),
  query: vi.fn((coll: unknown) => ({
    _type: "query",
    coll,
  })),
  orderBy: vi.fn((field: string, dir: string) => ({ _type: "orderBy", field, dir })),
  getDocs: () => mockGetDocs(),
}));

/* ---------- mock data ---------- */
const sampleUsageData: Array<{ id: string } & Partial<UsageDoc>> = [
  {
    id: "2026_08",
    research_agent: 10,
    research: 5,
    review_agent: 3,
    reasoning: 2,
    speech_to_text: 1,
    drafting_agent: 4,
    legal_agent: 12,
    prompting: 2,
  },
  {
    id: "2026_07",
    research_agent: 4,
    research: 2,
    review_agent: 1,
    reasoning: 0,
    speech_to_text: 0,
    drafting_agent: 1,
    legal_agent: 5,
    prompting: 0,
  },
];

/* ---------- component under test ---------- */
import UserUsage from "@/features/profile/UserUsage";

describe("UserUsage Page Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockAuthState.user = { uid: "usr_flv_2026" };
    mockGetDocs.mockResolvedValue({
      docs: sampleUsageData.map((item) => ({
        id: item.id,
        data: () => {
          const { ...rest } = item;
          return rest;
        },
      })),
    });
  });

  test("mostra lo stato di caricamento quando uid è assente o il recupero è in corso", () => {
    mockAuthState.user = null;
    render(<UserUsage />);

    expect(screen.getByText("Caricamento statistiche...")).toBeInTheDocument();
  });

  test("mostra il box di errore se il fetch Firestore fallisce", async () => {
    mockGetDocs.mockRejectedValue(new Error("Network connection error"));
    render(<UserUsage />);

    await waitFor(() => {
      expect(
        screen.getByText("Si è verificato un errore nel caricamento dei dati di utilizzo.")
      ).toBeInTheDocument();
    });
  });

  test("mostra la schermata di stato vuoto quando non ci sono record di utilizzo registrati", async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    render(<UserUsage />);

    await waitFor(() => {
      expect(screen.getByText("Nessuna statistica disponibile")).toBeInTheDocument();
      expect(
        screen.getByText("Attualmente non ci sono dati di utilizzo registrati per il tuo profilo.")
      ).toBeInTheDocument();
    });
  });

  test("renderizza le metriche calcolate del mese più recente e il badge prompting se presente", async () => {
    render(<UserUsage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "I tuoi utilizzi", level: 1 })).toBeInTheDocument();
    });

    const select = screen.getByLabelText("Periodo:") as HTMLSelectElement;
    expect(select.value).toBe("2026_08");
    expect(screen.getByRole("option", { name: "Agosto 2026" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Luglio 2026" })).toBeInTheDocument();

    // Tempo risparmiato: 10*15 + 4*30 + 12*10 = 390 minuti
    expect(screen.getByText("390")).toBeInTheDocument();
    expect(screen.getByText("minuti")).toBeInTheDocument();

    // Ricerche: 10 + 5 = 15 sessioni
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getByText("sessioni")).toBeInTheDocument();

    // Analisi Documentale: 3 + 2 + 1 = 6 documenti
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("documenti")).toBeInTheDocument();

    // Sintesi: 4 bozze
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("bozze")).toBeInTheDocument();

    // Conversazioni Legal Agent: 12
    expect(screen.getByText("12")).toBeInTheDocument();

    // Prompting > 0 presente per Agosto 2026
    expect(screen.getByText("Prompting Libero Attivo")).toBeInTheDocument();
  });

  test("aggiorna le metriche e nasconde il badge prompting al cambio del mese nel selettore", async () => {
    render(<UserUsage />);

    await waitFor(() => {
      expect(screen.getByLabelText("Periodo:")).toBeInTheDocument();
    });

    const select = screen.getByLabelText("Periodo:");
    fireEvent.change(select, { target: { value: "2026_07" } });

    // Tempo risparmiato: 4*15 + 1*30 + 5*10 = 140 minuti
    expect(screen.getByText("140")).toBeInTheDocument();

    // Ricerche: 4 + 2 = 6 sessioni
    expect(screen.getByText("6")).toBeInTheDocument();

    // Analisi Documentale (1 doc) e Sintesi (1 bozza) -> 2 card con conteggio 1
    const unitCounts = screen.getAllByText("1");
    expect(unitCounts.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("documenti")).toBeInTheDocument();
    expect(screen.getByText("bozze")).toBeInTheDocument();

    // Conversazioni Legal Agent: 5
    expect(screen.getByText("5")).toBeInTheDocument();

    // Prompting è 0 per Luglio 2026 -> badge assente
    expect(screen.queryByText("Prompting Libero Attivo")).not.toBeInTheDocument();
  });

  test("esegue la navigazione alla cronologia precedente (-1) al click su 'Torna al profilo'", async () => {
    render(<UserUsage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Torna al profilo" })).toBeInTheDocument();
    });

    const backBtn = screen.getByRole("button", { name: "Torna al profilo" });
    fireEvent.click(backBtn);

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});