import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import type { PlanUI } from "@/features/plans/hooks/plans";
import type { CouponData } from "@/features/plans/hooks/discount";

/* ---------- mock react-router-dom ---------- */
const mockNavigate = vi.fn();
let mockLocationHash = "";

vi.mock("react-router-dom", () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
  useLocation: () => ({
    pathname: "/profilo/piani",
    hash: mockLocationHash,
    search: "",
    state: null,
    key: "plans-key",
  }),
}));

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", () => ({
  __esModule: true,
  useReducedMotion: vi.fn(() => false),
  motion: {
    main: React.forwardRef<
      HTMLElement,
      React.HTMLAttributes<HTMLElement> & {
        variants?: unknown;
        initial?: unknown;
        animate?: unknown;
        transition?: unknown;
      }
    >(({ children, ...props }, ref) => (
      <main ref={ref} {...props}>
        {children}
      </main>
    )),
    div: React.forwardRef<
      HTMLDivElement,
      React.HTMLAttributes<HTMLDivElement> & {
        variants?: unknown;
        initial?: unknown;
        animate?: unknown;
        transition?: unknown;
      }
    >(({ children, ...props }, ref) => (
      <div ref={ref} {...props}>
        {children}
      </div>
    )),
  },
}));

/* ---------- mock useProfile ---------- */
let mockProfileState = {
  user: { uid: "usr_plans_123" } as { uid: string } | null,
  loading: false,
  planId: "personale_m",
  assignedTeamId: null as string | null,
};

vi.mock("@/features/profile/hooks/useProfile", () => ({
  __esModule: true,
  useProfile: () => mockProfileState,
}));

/* ---------- mock services & hooks ---------- */
const mockFetchPlansFromDb = vi.fn<() => Promise<PlanUI[]>>();
vi.mock("@/features/plans/hooks/plans", () => ({
  __esModule: true,
  fetchPlansFromDb: () => mockFetchPlansFromDb(),
}));

const mockFetchUserCoupon = vi.fn<(uid: string) => Promise<CouponData | null>>();
vi.mock("@/features/plans/hooks/discount", () => ({
  __esModule: true,
  fetchUserCoupon: (uid: string) => mockFetchUserCoupon(uid),
}));

let mockTrialState = {
  trialLoading: false,
  trialErr: null as string | null,
  trialLeft: 5 as number | null,
};

vi.mock("@/features/plans/hooks/usePlans", () => ({
  __esModule: true,
  useTrialInfo: () => mockTrialState,
}));

/* ---------- mock planDomain ---------- */
vi.mock("@/features/plans/hooks/planlDomain", () => ({
  __esModule: true,
  normalizeStatus: (status: string) => status ?? "nessuno",
  isTrialStatus: (status: string) => status === "prova" || status === "trial",
  getUpgradeTarget: (status: string) => (status.includes("personale") ? "business" : null),
  findPlanByStatus: (plans: PlanUI[], status: string) =>
    plans.find((p) => p.id === status || p.name.toLowerCase() === status.toLowerCase()) ?? null,
  findPlanByKey: (plans: PlanUI[], key: string) =>
    plans.find((p) => (p.id || p.name).toLowerCase().includes(key.toLowerCase())) ?? null,
}));

/* ---------- mock subcomponents ---------- */
vi.mock("@/features/plans/components/PaymentModal", () => ({
  __esModule: true,
  default: ({
    open,
    onClose,
    planName,
  }: {
    open: boolean;
    onClose: () => void;
    planName: string;
  }) =>
    open ? (
      <div data-testid="payment-modal">
        <p>Checkout: {planName}</p>
        <button type="button" onClick={onClose} data-testid="btn-close-payment">
          Chiudi Pagamento
        </button>
      </div>
    ) : null,
}));

vi.mock("@/features/plans/components/DiscountCoupon", () => ({
  __esModule: true,
  DiscountCoupon: ({
    activeCoupon,
    onApplyCoupon,
    onRemoveCoupon,
  }: {
    activeCoupon: CouponData | null;
    onApplyCoupon: (c: CouponData) => void;
    onRemoveCoupon: () => void;
  }) => (
    <div data-testid="discount-coupon-section">
      <span>{activeCoupon ? `Coupon: ${activeCoupon.code}` : "Nessun coupon applicato"}</span>
      <button
        type="button"
        data-testid="btn-apply-mock-coupon"
        onClick={() => onApplyCoupon({ code: "LEGAL20", discountPercent: 20 } as unknown as CouponData)}
      >
        Applica Coupon
      </button>
      <button type="button" data-testid="btn-remove-mock-coupon" onClick={onRemoveCoupon}>
        Rimuovi Coupon
      </button>
    </div>
  ),
}));

vi.mock("@/features/plans/components/CurrentPlanCard", () => ({
  __esModule: true,
  CurrentPlanCard: ({
    openPaymentForPlan,
    upgradePlan,
  }: {
    openPaymentForPlan: (name: string) => void;
    upgradePlan: PlanUI | null;
  }) => (
    <div data-testid="current-plan-card">
      {upgradePlan && (
        <button
          type="button"
          data-testid="btn-upgrade-plan"
          onClick={() => openPaymentForPlan(upgradePlan.name)}
        >
          Passa a {upgradePlan.name}
        </button>
      )}
    </div>
  ),
}));

vi.mock("@/features/plans/components/PlansGrid", () => ({
  __esModule: true,
  PlansGrid: ({
    billing,
    setBilling,
    openPaymentForPlan,
    orderedPlans,
  }: {
    billing: string;
    setBilling: (cycle: "monthly" | "yearly") => void;
    openPaymentForPlan: (name: string) => void;
    orderedPlans: PlanUI[];
  }) => (
    <div data-testid="plans-grid">
      <span data-testid="current-billing-cycle">{billing}</span>
      <button
        type="button"
        data-testid="btn-toggle-yearly"
        onClick={() => setBilling("yearly")}
      >
        Annuale
      </button>
      {orderedPlans.map((plan) => (
        <button
          key={plan.id}
          type="button"
          data-testid={`btn-select-${plan.id}`}
          onClick={() => openPaymentForPlan(plan.name)}
        >
          Seleziona {plan.name}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("@/features/plans/components/TeamPlansSection", () => ({
  __esModule: true,
  TeamPlansSection: ({
    userHasTeam,
    teamsRef,
  }: {
    userHasTeam: boolean;
    teamsRef?: React.Ref<HTMLDivElement>;
  }) => (
    <div
      ref={teamsRef}
      data-testid="team-plans-section"
      data-has-team={userHasTeam}
    />
  ),
}));

vi.mock("@/features/plans/components/PaymentHistory", () => ({
  __esModule: true,
  PaymentHistory: ({ uid }: { uid: string }) => (
    <div data-testid="payment-history" data-uid={uid}>
      Storico Pagamenti Utente
    </div>
  ),
}));

/* ---------- mock plans data ---------- */
const samplePlans: PlanUI[] = [
  {
    id: "personale_m",
    name: "Personale Mensile",
    price: 29,
    initial_price: 29,
    durationDays: 30,
    features: ["Accesso AI illimitato"],
  } as unknown as PlanUI,
  {
    id: "business_m",
    name: "Business Mensile",
    price: 79,
    initial_price: 79,
    durationDays: 30,
    features: ["Accesso Team + AI"],
  } as unknown as PlanUI,
  {
    id: "personale_y",
    name: "Personale Annuale",
    price: 290,
    initial_price: 290,
    durationDays: 365,
    features: ["Accesso AI Annuale"],
  } as unknown as PlanUI,
  {
    id: "business_y",
    name: "Business Annuale",
    price: 790,
    initial_price: 790,
    durationDays: 365,
    features: ["Accesso Team Annuale"],
  } as unknown as PlanUI,
];

/* ---------- component under test ---------- */
import { Plans } from "@/features/plans/Plans";

describe("Plans Page Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocationHash = "";
    mockProfileState = {
      user: { uid: "usr_plans_123" },
      loading: false,
      planId: "personale_m",
      assignedTeamId: null,
    };
    mockTrialState = {
      trialLoading: false,
      trialErr: null,
      trialLeft: 5,
    };
    mockFetchPlansFromDb.mockResolvedValue(samplePlans);
    mockFetchUserCoupon.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("mostra lo spinner di caricamento globale quando useProfile è in loading o l'utente è assente", async () => {
    mockProfileState.loading = true;
    const { unmount } = render(<Plans />);

    expect(screen.getByText("Caricamento in corso...")).toBeInTheDocument();
    unmount();

    mockProfileState.loading = false;
    mockProfileState.user = null;
    render(<Plans />);

    expect(screen.getByText("Caricamento in corso...")).toBeInTheDocument();
  });

  test("mostra lo stato di caricamento dei piani e poi renderizza la struttura completa", async () => {
    render(<Plans />);

    expect(screen.getByRole("status")).toHaveTextContent("Caricamento piani…");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Il tuo Piano", level: 1 })).toBeInTheDocument();
      expect(screen.getByTestId("current-plan-card")).toBeInTheDocument();
      expect(screen.getByTestId("discount-coupon-section")).toBeInTheDocument();
      expect(screen.getByTestId("plans-grid")).toBeInTheDocument();
      expect(screen.getByTestId("team-plans-section")).toBeInTheDocument();
      expect(screen.getByTestId("payment-history")).toBeInTheDocument();
    });
  });

  test("mostra un alert di errore se fetchPlansFromDb fallisce", async () => {
    mockFetchPlansFromDb.mockRejectedValue(new Error("Errore di rete database piani"));
    render(<Plans />);

    await waitFor(() => {
      const alertEl = screen.getByRole("alert");
      expect(alertEl).toBeInTheDocument();
      expect(alertEl).toHaveTextContent("Errore caricamento piani: Errore di rete database piani");
    });
  });

  test("gestisce il banner periodo di prova e i giorni rimanenti", async () => {
    mockProfileState.planId = "prova";
    mockTrialState.trialLeft = 3;

    const { rerender } = render(<Plans />);

    await waitFor(() => {
      expect(screen.getByText(/Periodo di prova attivo \(7 giorni\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Mancano/i)).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    // Prova terminata (0 giorni)
    mockTrialState.trialLeft = 0;
    rerender(<Plans />);
    expect(screen.getByText("La prova è terminata.")).toBeInTheDocument();

    // Errore prova
    mockTrialState.trialErr = "Errore lettura scadenza trial";
    rerender(<Plans />);
    expect(screen.getByText("Errore lettura scadenza trial")).toBeInTheDocument();
  });

  test("naviga indietro al profilo al click sul pulsante header", async () => {
    render(<Plans />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Torna al profilo" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Torna al profilo" }));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  test("carica automaticamente il coupon utente all'avvio e consente applicazione/rimozione manuale", async () => {
    mockFetchUserCoupon.mockResolvedValue({
      code: "WELCOME50",
      discountPercent: 50,
    } as unknown as CouponData);

    render(<Plans />);

    await waitFor(() => {
      expect(mockFetchUserCoupon).toHaveBeenCalledWith("usr_plans_123");
      expect(screen.getByText("Coupon: WELCOME50")).toBeInTheDocument();
    });

    // Rimuovi coupon
    fireEvent.click(screen.getByTestId("btn-remove-mock-coupon"));
    expect(screen.getByText("Nessun coupon applicato")).toBeInTheDocument();

    // Applica coupon
    fireEvent.click(screen.getByTestId("btn-apply-mock-coupon"));
    expect(screen.getByText("Coupon: LEGAL20")).toBeInTheDocument();
  });

  test("apre e chiude il PaymentModal alla selezione di un piano", async () => {
    render(<Plans />);

    await waitFor(() => {
      expect(screen.getByTestId("btn-select-personale_m")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("btn-select-personale_m"));

    expect(screen.getByTestId("payment-modal")).toBeInTheDocument();
    expect(screen.getByText("Checkout: Personale Mensile")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("btn-close-payment"));
    expect(screen.queryByTestId("payment-modal")).not.toBeInTheDocument();
  });

  test("cambia ciclo di fatturazione aggiornando i piani visualizzati nel PlansGrid", async () => {
    render(<Plans />);

    await waitFor(() => {
      expect(screen.getByTestId("current-billing-cycle")).toHaveTextContent("monthly");
    });

    fireEvent.click(screen.getByTestId("btn-toggle-yearly"));
    expect(screen.getByTestId("current-billing-cycle")).toHaveTextContent("yearly");
  });

  test("esegue lo scroll automatico verso la sezione teams se hash corrisponde a '#teams'", async () => {
    mockLocationHash = "#teams";

    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    render(<Plans />);

    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    }, { timeout: 1500 });
  });
});