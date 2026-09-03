import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import React from "react";
import type { PlanUI } from  "@/features/plans/hooks/plans";
import type { CouponData } from "@/features/plans/hooks/discount";

/* ---------- tipi mock pricing ---------- */
interface DynamicPricingResult {
  hasDiscount: boolean;
  percentage: number;
  initialPriceLabel: string;
  finalPriceLabel: string;
}

/* ---------- tipi mock useTeamPlans ---------- */
interface MockTeamPlansHook {
  isOwnerModalOpen: boolean;
  handlePlanClick: (planName: string, openPayment: (name: string) => void) => void;
  handleConfirmOwnerPurchase: (openPayment: (name: string) => void) => void;
  handleCancelOwnerPurchase: () => void;
  navigate: (to: string) => void;
}

/* ---------- tipi mock auth ---------- */
interface MockAuthContext {
  user: { uid: string } | null;
}

/* ---------- hoisted mocks ---------- */
const {
  mockGetDynamicPricing,
  mockUseAuth,
  mockTeamPlansState,
} = vi.hoisted(() => ({
  mockGetDynamicPricing: vi.fn<(plan: PlanUI, coupon: CouponData | null) => DynamicPricingResult>(),
  mockUseAuth: vi.fn<() => MockAuthContext>(() => ({ user: { uid: "user-test-123" } })),
  mockTeamPlansState: {
    isOwnerModalOpen: false,
    handlePlanClick: vi.fn<(planName: string, openPayment: (name: string) => void) => void>(),
    handleConfirmOwnerPurchase: vi.fn<(openPayment: (name: string) => void) => void>(),
    handleCancelOwnerPurchase: vi.fn<() => void>(),
    navigate: vi.fn<(to: string) => void>(),
  } as MockTeamPlansHook,
}));

/* ---------- mock useAuth ---------- */
vi.mock("@/context/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

/* ---------- mock useTeamPlans ---------- */
vi.mock("@/features/teams/hooks/useTeamPlans", () => ({
  useTeamPlans: () => mockTeamPlansState,
}));

/* ---------- mock hook usePlans ---------- */
vi.mock("@/features/plans/hooks/usePlans", () => ({
  getDynamicPricing: (plan: PlanUI, coupon: CouponData | null) =>
    mockGetDynamicPricing(plan, coupon),
}));

/* ---------- mock lucide-react ---------- */
vi.mock("lucide-react", () => ({
  Loader2: (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid="icon-loader-2" {...props} />
  ),
}));

/* ---------- mock ConfirmModal ---------- */
interface MockConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
}

vi.mock("@/shared/components/ConfirmModal", () => ({
  ConfirmModal: ({
    isOpen,
    title,
    message,
    confirmText,
    cancelText,
    onConfirm,
    onCancel,
  }: MockConfirmModalProps) =>
    isOpen ? (
      <div role="dialog" aria-modal="true" data-testid="mock-confirm-modal">
        <h3>{title}</h3>
        <p>{message}</p>
        <button type="button" onClick={onConfirm}>
          {confirmText}
        </button>
        <button type="button" onClick={onCancel}>
          {cancelText}
        </button>
      </div>
    ) : null,
}));

/* ---------- component ---------- */
import { TeamPlansSection } from "@/features/plans/components/TeamPlansSection"; // <-- adegua il path se necessario

describe("TeamPlansSection Component Suite", () => {
  const mockOpenPaymentForPlan = vi.fn<(planName: string) => void>();
  const dummyTeamsRef = React.createRef<HTMLDivElement>();

  const getDummyPlans = (): PlanUI[] => [
    {
      id: "plan-team-3",
      name: "team 3",
      price: 299,
      highlighted: false,
    } as unknown as PlanUI,
    {
      id: "plan-team-5",
      name: "team 5",
      price: 499,
      highlighted: false,
    } as unknown as PlanUI,
    {
      id: "plan-team-7",
      name: "team 7",
      price: 699,
      highlighted: false,
    } as unknown as PlanUI,
    {
      id: "plan-individual",
      name: "Piano Individuale Essential",
      price: 49,
      highlighted: false,
    } as unknown as PlanUI,
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockTeamPlansState.isOwnerModalOpen = false;
    mockUseAuth.mockReturnValue({ user: { uid: "user-test-123" } });

    mockGetDynamicPricing.mockImplementation((plan: PlanUI) => {
      const isTeam5 =
        (plan.name && plan.name.toLowerCase().includes("5")) ||
        (plan.id && plan.id.includes("5"));

      return {
        hasDiscount: Boolean(isTeam5),
        percentage: 15,
        initialPriceLabel: "€ 580",
        finalPriceLabel: `€ ${plan.price || 299}`,
      };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderSection = (props: Partial<React.ComponentProps<typeof TeamPlansSection>> = {}) => {
    const defaultProps: React.ComponentProps<typeof TeamPlansSection> = {
      plans: getDummyPlans(),
      activeCoupon: null,
      openPaymentForPlan: mockOpenPaymentForPlan,
      teamsRef: dummyTeamsRef,
      userHasTeam: false,
      ...props,
    };

    return render(<TeamPlansSection {...defaultProps} />);
  };

  test("renderizza lo stato di caricamento quando non vi sono piani Team disponibili nella lista", () => {
    const nonTeamPlans: PlanUI[] = [
      { id: "single-1", name: "Essential", price: 49 } as unknown as PlanUI,
    ];

    renderSection({ plans: nonTeamPlans });

    expect(screen.getByTestId("icon-loader-2")).toBeInTheDocument();
    expect(
      screen.getByText("Caricamento pacchetti studio in corso...")
    ).toBeInTheDocument();
  });

  test("filtra, ordina per prezzo crescente e formatta i nomi dei piani Team (es. 'team 3' -> 'Team da 3')", () => {
    renderSection();

    expect(screen.queryByText("Piano Individuale Essential")).toBeNull();

    expect(screen.getByRole("heading", { name: /Team da 3/i, level: 4 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Team da 5/i, level: 4 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Team da 7/i, level: 4 })).toBeInTheDocument();

    expect(screen.getByText("€ 299")).toBeInTheDocument();
    expect(screen.getByText("€ 499")).toBeInTheDocument();
    expect(screen.getByText("€ 699")).toBeInTheDocument();
  });

  test("assegna il badge 'Miglior Valore' al piano in seconda posizione o con flag highlighted", () => {
    renderSection();

    const badge = screen.getByText("Miglior Valore");
    expect(badge).toBeInTheDocument();

    const team5Heading = screen.getByRole("heading", { name: /Team da 5/i, level: 4 });
    const team5Card = team5Heading.closest(".relative.flex.flex-col") as HTMLElement;
    expect(within(team5Card).getByText("Miglior Valore")).toBeInTheDocument();
    expect(team5Card).toHaveClass("border-2");
  });

  test("mostra il dettaglio dello sconto percentuale e prezzo barrato se presente", () => {
    renderSection();

    expect(screen.getByText(/€\s*580/i)).toHaveClass("line-through");
    expect(screen.getByText(/Risparmi il 15%/i)).toBeInTheDocument();
  });

  test("invoca handlePlanClick al click sul bottone 'Attiva Workspace'", () => {
    renderSection();

    const buttons = screen.getAllByRole("button", { name: "Attiva Workspace" });
    expect(buttons).toHaveLength(3);

    fireEvent.click(buttons[0]);

    expect(mockTeamPlansState.handlePlanClick).toHaveBeenCalledWith(
      "team 3",
      mockOpenPaymentForPlan
    );
  });

  test("naviga verso la pagina /contatti al click sul bottone 'Parla con un consulente'", () => {
    renderSection();

    const consultButton = screen.getByRole("button", { name: "Parla con un consulente" });
    expect(consultButton).toBeInTheDocument();

    fireEvent.click(consultButton);

    expect(mockTeamPlansState.navigate).toHaveBeenCalledWith("/contatti");
  });

  test("renderizza e gestisce le azioni del ConfirmModal per l'utente già owner di un gruppo", () => {
    mockTeamPlansState.isOwnerModalOpen = true;

    renderSection();

    const modal = screen.getByTestId("mock-confirm-modal");
    expect(modal).toBeInTheDocument();
    expect(screen.getByText("Conferma acquisto abbonamento Team")).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "Procedi all'acquisto" });
    fireEvent.click(confirmBtn);
    expect(mockTeamPlansState.handleConfirmOwnerPurchase).toHaveBeenCalledWith(
      mockOpenPaymentForPlan
    );

    const cancelBtn = screen.getByRole("button", { name: "Annulla" });
    fireEvent.click(cancelBtn);
    expect(mockTeamPlansState.handleCancelOwnerPurchase).toHaveBeenCalledTimes(1);
  });

  test("collega correttamente l'elemento DOM al teamsRef passato nelle props", () => {
    const { container } = renderSection();

    const teamsContainer = container.querySelector("#teams");
    expect(teamsContainer).toBeInTheDocument();
    expect(dummyTeamsRef.current).toBe(teamsContainer);
  });
});