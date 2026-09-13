import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import React from "react";
import type { PlanUI } from "@/features/plans/hooks/plans";
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
import { PlansGrid } from "@/features/plans/components/PlansGrid";

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

  test("renderizza il selettore di fatturazione e gestisce il cambio ciclo mensile/annuale", () => {
    renderPlansGrid({ billing: "yearly", cycleLabel: "all'anno" });

    expect(screen.getByText("IVA inclusa")).toBeInTheDocument();

    const monthlyBtn = screen.getByRole("button", { name: "Mensile" });
    const yearlyBtn = screen.getByRole("button", { name: "Annuale" });

    fireEvent.click(monthlyBtn);
    expect(mockSetBilling).toHaveBeenCalledWith("monthly");

    fireEvent.click(yearlyBtn);
    expect(mockSetBilling).toHaveBeenCalledWith("yearly");
  });

  test("renderizza i piani con prezzi dinamici, etichette di sconto e le relative feature", () => {
    renderPlansGrid({ cycleLabel: "all'anno" });

    // 1. Verifica Card Piano Personale Essential
    const cardEssentialHeading = screen.getByRole("heading", {
      name: "Piano Personale Essential",
      level: 3,
    });
    const cardEssential = cardEssentialHeading.closest("div") as HTMLElement;
    expect(cardEssential).toBeInTheDocument();

    const scopeEssential = within(cardEssential);
    expect(scopeEssential.getByText("€ 49")).toBeInTheDocument();
    expect(scopeEssential.getByText(/IVA Inclusa/i)).toBeInTheDocument();
    expect(scopeEssential.getByText("Ricerca sentenze illimitata")).toBeInTheDocument();
    expect(scopeEssential.getByText("Assistente AI di base")).toBeInTheDocument();
    expect(scopeEssential.getByText("Funzione esclusa")).toBeInTheDocument();

    // 2. Verifica Card Piano Business Avanzato
    const cardBusinessHeading = screen.getByRole("heading", {
      name: "Piano Business Avanzato",
      level: 3,
    });
    const cardBusiness = cardBusinessHeading.closest("div") as HTMLElement;
    expect(cardBusiness).toBeInTheDocument();

    const scopeBusiness = within(cardBusiness);
    expect(scopeBusiness.getByText("€ 96")).toBeInTheDocument();
    expect(scopeBusiness.getByText("€ 120")).toHaveClass("line-through");
    expect(scopeBusiness.getByText("Risparmi il 20%")).toBeInTheDocument();
    expect(scopeBusiness.getByText("Redazione atti automatica")).toBeInTheDocument();
  });

  test("disabilita il bottone per il piano già attivo mostrando 'Piano Attuale' e consente la selezione degli altri", () => {
    renderPlansGrid({
      activePlan: dummyPlans[0],
      isTrial: false,
    });

    const activeBtn = screen.getByRole("button", { name: "Piano Attuale" });
    expect(activeBtn).toBeDisabled();

    const selectButtons = screen.getAllByRole("button", { name: "Seleziona" });
    expect(selectButtons.length).toBeGreaterThan(0);

    fireEvent.click(selectButtons[0]);
    expect(mockOpenPaymentForPlan).toHaveBeenCalledWith("Piano Business Avanzato");
  });

  test("consente la selezione del piano durante il periodo di prova (Trial)", () => {
    renderPlansGrid({
      isTrial: true,
      activePlan: null,
    });

    const selectBtns = screen.getAllByRole("button", { name: "Seleziona" });
    expect(selectBtns[0]).not.toBeDisabled();

    fireEvent.click(selectBtns[0]);
    expect(mockOpenPaymentForPlan).toHaveBeenCalledWith("Piano Personale Essential");
  });

  test("supporta shouldReduceMotion abilitato senza errori di rendering", () => {
    renderPlansGrid({ shouldReduceMotion: true });

    expect(screen.getByRole("heading", { name: "Piano Personale Essential", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Piano Business Avanzato", level: 3 })).toBeInTheDocument();
  });
});