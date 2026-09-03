import { describe, test, expect, vi, beforeEach } from "vitest";
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

/* ---------- hoisted mocks ---------- */
const { mockGetDynamicPricing } = vi.hoisted(() => ({
  mockGetDynamicPricing: vi.fn<(plan: PlanUI, coupon: CouponData | null) => DynamicPricingResult>(),
}));

/* ---------- mock hook usePlans ---------- */
vi.mock("@/features/plans/hooks/usePlans", () => ({
  getDynamicPricing: (plan: PlanUI, coupon: CouponData | null) =>
    mockGetDynamicPricing(plan, coupon),
}));

/* ---------- mock react-icons/fa ---------- */
vi.mock("react-icons/fa", () => ({
  FaCheck: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-check" {...props} />
  ),
}));

/* ---------- mock framer-motion con filtraggio props animate/layout ---------- */
vi.mock("framer-motion", async () => {
  const ReactActual = await import("react");

  const passthrough =
    (Tag: string) =>
    ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLElement> & { [key: string]: unknown }) =>
      ReactActual.createElement(Tag, props, children);

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      div: passthrough("div"),
      button: passthrough("button"),
    },
  };
});

/* ---------- component ---------- */
import { PlansGrid } from "@/features/plans/components/PlansGrid"; // <-- adegua il path se necessario

describe("PlansGrid Component Suite", () => {
  const mockSetBilling = vi.fn<(val: "monthly" | "yearly") => void>();
  const mockOpenPaymentForPlan = vi.fn<(planName: string) => void>();

  const dummyPlans: PlanUI[] = [
    {
      id: "plan-essential",
      name: "Piano Personale Essential",
      highlighted: false,
      features: [
        { name: "Ricerca sentenze illimitata", included: true },
        { name: "Assistente AI di base", included: true },
        { name: "Funzione esclusa", included: false },
      ],
    } as unknown as PlanUI,
    {
      id: "plan-business",
      name: "Piano Business Avanzato",
      highlighted: true,
      features: [
        { name: "Tutto ciò che include Essential", included: true },
        { name: "Redazione atti automatica", included: true },
      ],
    } as unknown as PlanUI,
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockGetDynamicPricing.mockImplementation((plan: PlanUI) => {
      const isBusiness =
        plan?.id?.includes("business") || plan?.name?.toLowerCase().includes("business");

      return {
        hasDiscount: isBusiness,
        percentage: 20,
        initialPriceLabel: "€ 120",
        finalPriceLabel: isBusiness ? "€ 96" : "€ 49",
      };
    });
  });

  const renderPlansGrid = (props: Partial<React.ComponentProps<typeof PlansGrid>> = {}) => {
    const defaultProps: React.ComponentProps<typeof PlansGrid> = {
      billing: "yearly",
      setBilling: mockSetBilling,
      orderedPlans: dummyPlans,
      activePlan: null,
      isTrial: false,
      activeCoupon: null,
      shouldReduceMotion: false,
      cycleLabel: "all'anno",
      openPaymentForPlan: mockOpenPaymentForPlan,
      ...props,
    };

    return render(<PlansGrid {...defaultProps} />);
  };

  test("renderizza l'intestazione, il selettore di fatturazione e gestisce il cambio ciclo mensile/annuale", () => {
    renderPlansGrid({ billing: "yearly", cycleLabel: "all'anno" });

    expect(screen.getByRole("heading", { name: "Scegli il piano giusto per te", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("Prezzi all'anno • IVA inclusa")).toBeInTheDocument();

    const monthlyBtn = screen.getByRole("button", { name: "Mensile" });
    const yearlyBtn = screen.getByRole("button", { name: /Annuale/i });

    expect(screen.getByText("-17%")).toBeInTheDocument();

    fireEvent.click(monthlyBtn);
    expect(mockSetBilling).toHaveBeenCalledWith("monthly");

    fireEvent.click(yearlyBtn);
    expect(mockSetBilling).toHaveBeenCalledWith("yearly");
  });

  test("renderizza i piani con prezzi dinamici, etichette di sconto e solo le feature incluse", () => {
    renderPlansGrid();

    // 1. Verifica Card Piano Personale Essential
    const cardEssentialHeading = screen.getByRole("heading", {
      name: "Piano Personale Essential",
      level: 3,
    });
    const cardEssential = cardEssentialHeading.closest(".relative.flex.flex-col") as HTMLElement;
    expect(cardEssential).toBeInTheDocument();

    const scopeEssential = within(cardEssential);
    expect(scopeEssential.getByText("€ 49")).toBeInTheDocument();
    expect(scopeEssential.getByText("Ricerca sentenze illimitata")).toBeInTheDocument();
    expect(scopeEssential.getByText("Assistente AI di base")).toBeInTheDocument();
    expect(scopeEssential.queryByText("Funzione esclusa")).toBeNull();

    // 2. Verifica Card Piano Business Avanzato
    const cardBusinessHeading = screen.getByRole("heading", {
      name: "Piano Business Avanzato",
      level: 3,
    });
    const cardBusiness = cardBusinessHeading.closest(".relative.flex.flex-col") as HTMLElement;
    expect(cardBusiness).toBeInTheDocument();

    const scopeBusiness = within(cardBusiness);
    expect(scopeBusiness.getByText("€ 96")).toBeInTheDocument();
    expect(scopeBusiness.getByText("€ 120")).toHaveClass("line-through");
    expect(scopeBusiness.getByText("-20%")).toBeInTheDocument();
    expect(scopeBusiness.getByText("Redazione atti automatica")).toBeInTheDocument();

    expect(screen.getAllByTestId("icon-check")).toHaveLength(4);
  });

  test("assegna correttamente i badge 'Più scelto' e 'Attuale' in base allo stato attivo", () => {
    const { rerender } = renderPlansGrid({ activePlan: null, isTrial: false });
    expect(screen.getByText("Più scelto")).toBeInTheDocument();
    expect(screen.queryByText("Attuale")).not.toBeInTheDocument();

    rerender(
      <PlansGrid
        billing="yearly"
        setBilling={mockSetBilling}
        orderedPlans={dummyPlans}
        activePlan={dummyPlans[0]}
        isTrial={false}
        activeCoupon={null}
        shouldReduceMotion={false}
        cycleLabel="all'anno"
        openPaymentForPlan={mockOpenPaymentForPlan}
      />
    );
    expect(screen.getByText("Attuale")).toBeInTheDocument();
  });

  test("mostra il badge 'Attuale' sul piano Personale durante il periodo di prova (Trial)", () => {
    renderPlansGrid({
      isTrial: true,
      activePlan: null,
    });

    expect(screen.getByText("Attuale")).toBeInTheDocument();
  });

  test("disabilita il bottone per il piano già attivo mostrando 'Il tuo piano attuale'", () => {
    renderPlansGrid({
      activePlan: dummyPlans[0],
      isTrial: false,
    });

    const activeBtn = screen.getByRole("button", { name: "Il tuo piano attuale" });
    expect(activeBtn).toBeDisabled();

    const businessBtn = screen.getByRole("button", { name: "Passa al piano Business" });
    expect(businessBtn).not.toBeDisabled();
    fireEvent.click(businessBtn);
    expect(mockOpenPaymentForPlan).toHaveBeenCalledWith("Piano Business Avanzato");
  });

  test("imposta le diciture dei bottoni CTA a seconda del contesto (Trial, Business, Standard)", () => {
    const { rerender } = renderPlansGrid({
      isTrial: true,
      activePlan: null,
    });

    const trialBtn = screen.getByRole("button", { name: "Attiva Piano Personale" });
    expect(trialBtn).toBeInTheDocument();

    fireEvent.click(trialBtn);
    expect(mockOpenPaymentForPlan).toHaveBeenCalledWith("Piano Personale Essential");

    const genericPlan: PlanUI = {
      id: "plan-team",
      name: "Soluzione Studio Legale",
      features: [{ name: "Multi-utenza", included: true }],
    } as unknown as PlanUI;

    rerender(
      <PlansGrid
        billing="monthly"
        setBilling={mockSetBilling}
        orderedPlans={[genericPlan]}
        activePlan={null}
        isTrial={false}
        activeCoupon={null}
        shouldReduceMotion={false}
        cycleLabel="al mese"
        openPaymentForPlan={mockOpenPaymentForPlan}
      />
    );

    const genericBtn = screen.getByRole("button", { name: "Ottieni" });
    expect(genericBtn).toBeInTheDocument();

    fireEvent.click(genericBtn);
    expect(mockOpenPaymentForPlan).toHaveBeenCalledWith("Soluzione Studio Legale");
  });

  test("supporta shouldReduceMotion abilitato senza errori di rendering", () => {
    renderPlansGrid({ shouldReduceMotion: true });

    expect(screen.getByRole("heading", { name: "Scegli il piano giusto per te" })).toBeInTheDocument();
  });
});