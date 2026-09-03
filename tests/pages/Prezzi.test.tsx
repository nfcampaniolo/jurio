import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import type { PlanUI } from "@/features/plans/hooks/plans";

/* ---------- mock react-router-dom ---------- */
const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
}));

/* ---------- mock useAuth ---------- */
let mockAuthState = {
  user: null as { uid: string; email: string } | null,
  loading: false,
};

vi.mock("@/context/useAuth", () => ({
  __esModule: true,
  useAuth: () => mockAuthState,
}));

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", () => ({
  __esModule: true,
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  useReducedMotion: vi.fn(() => false),
  motion: {
    div: React.forwardRef<
      HTMLDivElement,
      React.HTMLAttributes<HTMLDivElement> & {
        initial?: unknown;
        animate?: unknown;
        exit?: unknown;
        transition?: unknown;
        whileInView?: unknown;
        viewport?: unknown;
      }
    >(
      (
        {
          children,
          ...props
        },
        ref
      ) => (
        <div ref={ref} {...props}>
          {children}
        </div>
      )
    ),
  },
}));

/* ---------- mock react-tooltip ---------- */
vi.mock("react-tooltip", () => ({
  __esModule: true,
  Tooltip: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="mock-tooltip">{children}</div>
  ),
}));

/* ---------- mock ButtonCTA components ---------- */
vi.mock("@/shared/components/ButtonCTA", () => ({
  __esModule: true,
  ButtonCTA: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick} data-testid="btn-cta-primary">
      {children}
    </button>
  ),
  ButtonSecondCTA: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick} data-testid="btn-cta-secondary">
      {children}
    </button>
  ),
}));

/* ---------- mock plans data & service ---------- */
const samplePlans: PlanUI[] = [
  {
    id: "personale_m",
    name: "Personale",
    price: 19,
    initial_price: 29,
    priceLabel: "€ 19",
    cta: "Inizia con Personale",
    durationDays: 30,
    features: [
      { name: "Ricerca Giurisprudenza", description: "Accesso alle sentenze", included: true },
      { name: "Redazione Atti", description: "Bozze AI per atti", included: false },
    ],
  } as unknown as PlanUI,
  {
    id: "business_m",
    name: "Business",
    price: 49,
    initial_price: 49,
    priceLabel: "€ 49",
    cta: "Scegli Business",
    durationDays: 30,
    features: [
      { name: "Ricerca Giurisprudenza", description: "Accesso alle sentenze", included: true },
      { name: "Redazione Atti", description: "Bozze AI per atti", included: true },
    ],
  } as unknown as PlanUI,
  {
    id: "personale_y",
    name: "Personale",
    price: 190,
    initial_price: 290,
    priceLabel: "€ 190",
    cta: "Inizia con Personale Annuale",
    durationDays: 365,
    features: [
      { name: "Ricerca Giurisprudenza", description: "Accesso alle sentenze", included: true },
      { name: "Redazione Atti", description: "Bozze AI per atti", included: false },
    ],
  } as unknown as PlanUI,
  {
    id: "business_y",
    name: "Business",
    price: 490,
    initial_price: 490,
    priceLabel: "€ 490",
    cta: "Scegli Business Annuale",
    durationDays: 365,
    features: [
      { name: "Ricerca Giurisprudenza", description: "Accesso alle sentenze", included: true },
      { name: "Redazione Atti", description: "Bozze AI per atti", included: true },
    ],
  } as unknown as PlanUI,
  {
    id: "team_3",
    name: "Team da 3",
    price: 990,
    initial_price: 1200,
    priceLabel: "€ 990",
    cta: "Attiva Workspace",
    durationDays: 365,
    features: [],
  } as unknown as PlanUI,
];

const mockFetchPlansFromDb = vi.fn<() => Promise<PlanUI[]>>();
const mockGetPreloadedPlans = vi.fn<() => PlanUI[]>(() => samplePlans);

vi.mock("@/features/plans/hooks/plans", () => ({
  __esModule: true,
  fetchPlansFromDb: () => mockFetchPlansFromDb(),
  getPreloadedPlans: () => mockGetPreloadedPlans(),
}));

/* ---------- component under test ---------- */
import Prezzi from "@/features/plans/Prezzi"; // <-- adegua il path se necessario

describe("Prezzi Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState = { user: null, loading: false };
    mockFetchPlansFromDb.mockResolvedValue(samplePlans);
    mockGetPreloadedPlans.mockReturnValue(samplePlans);
  });

  test("renderizza l'intestazione, il toggle di fatturazione e la tabella comparativa desktop", async () => {
    render(<Prezzi />);

    expect(
      screen.getByRole("heading", { name: /Scegli il piano ideale/i, level: 2 })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mensile" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Annuale" })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Confronta i Servizi")).toBeInTheDocument();
      expect(screen.getAllByText("Inizia con Personale").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Scegli Business").length).toBeGreaterThan(0);
    });
  });

  test("mostra badge di sconto calcolato quando initial_price è maggiore di price", async () => {
    render(<Prezzi />);

    await waitFor(() => {
      expect(screen.getAllByText("Risparmi il 34%").length).toBeGreaterThan(0);
      expect(screen.getAllByText("€ 29,00").length).toBeGreaterThan(0);
    });
  });

  test("aggiorna i piani visualizzati al cambio di ciclo di fatturazione (Annuale)", async () => {
    render(<Prezzi />);

    const annualeBtn = screen.getByRole("button", { name: "Annuale" });
    fireEvent.click(annualeBtn);

    await waitFor(() => {
      expect(screen.getAllByText("€ 190").length).toBeGreaterThan(0);
      expect(screen.getAllByText("€ 490").length).toBeGreaterThan(0);
      expect(screen.getByText(/Prezzi all’anno · IVA inclusa/i)).toBeInTheDocument();
    });
  });

  test("mostra il messaggio di errore quando fetchPlansFromDb fallisce", async () => {
    mockGetPreloadedPlans.mockReturnValue([]);
    mockFetchPlansFromDb.mockRejectedValue(new Error("Timeout caricamento listino"));

    render(<Prezzi />);

    await waitFor(() => {
      expect(screen.getByText("Errore: Timeout caricamento listino")).toBeInTheDocument();
    });
  });

  test("reindirizza a '/login' se un utente non autenticato clicca sulle CTA dei piani o workspace", async () => {
    mockAuthState.user = null;
    render(<Prezzi />);

    await waitFor(() => {
      expect(screen.getAllByText("Inizia con Personale").length).toBeGreaterThan(0);
    });

    const planCta = screen.getAllByText("Inizia con Personale")[0];
    fireEvent.click(planCta);
    expect(mockNavigate).toHaveBeenCalledWith("/login");

    const teamCta = screen.getAllByText("Attiva Workspace")[0];
    fireEvent.click(teamCta);
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });

  test("reindirizza a '/profilo/piani' o '/profilo/piani#teams' per utenti autenticati", async () => {
    mockAuthState.user = { uid: "usr_auth_2026", email: "flavio@jurio.it" };
    render(<Prezzi />);

    await waitFor(() => {
      expect(screen.getAllByText("Scegli Business").length).toBeGreaterThan(0);
    });

    const businessCta = screen.getAllByText("Scegli Business")[0];
    fireEvent.click(businessCta);
    expect(mockNavigate).toHaveBeenCalledWith("/profilo/piani");

    const teamCta = screen.getAllByText("Attiva Workspace")[0];
    fireEvent.click(teamCta);
    expect(mockNavigate).toHaveBeenCalledWith("/profilo/piani#teams");
  });

  test("reindirizza a '/contatti' al click sulla CTA Enterprise", async () => {
    render(<Prezzi />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Parla con noi" })).toBeInTheDocument();
    });

    const enterpriseBtn = screen.getByRole("button", { name: "Parla con noi" });
    fireEvent.click(enterpriseBtn);

    expect(mockNavigate).toHaveBeenCalledWith("/contatti");
  });
});