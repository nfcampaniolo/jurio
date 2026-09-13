import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import type { PlanUI } from "@/features/plans/hooks/plans";
import type { StatusNormalized } from "@/features/plans/hooks/planlDomain";
import type { Variants } from "framer-motion";

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", async () => {
  const ReactActual = await import("react");
  type Props = React.PropsWithChildren<Record<string, unknown>>;

  const passthrough =
    (Tag: string) =>
    ({ children, ...props }: Props) =>
      ReactActual.createElement(Tag, props, children);

  return {
    motion: {
      div: passthrough("div"),
    },
  };
});

/* ---------- component ---------- */
import { CurrentPlanCard } from "@/features/plans/components/CurrentPlanCard";

describe("CurrentPlanCard Component Suite", () => {
  const mockOpenPaymentForPlan = vi.fn<(planName: string) => void>();
  const dummyVariants: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1 },
  };

  const baseActivePlan: PlanUI = {
    id: "plan-pro",
    name: "Piano Professional",
    priceLabel: "€49",
    features: [],
  } as unknown as PlanUI;

  const baseUpgradePlan: PlanUI = {
    id: "plan-enterprise",
    name: "Piano Enterprise",
    priceLabel: "€99",
    features: [],
  } as unknown as PlanUI;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderCurrentPlanCard = (props: Partial<React.ComponentProps<typeof CurrentPlanCard>> = {}) => {
    const defaultProps: React.ComponentProps<typeof CurrentPlanCard> = {
      status: "active" as StatusNormalized,
      isAdmin: false,
      isTrial: false,
      isNone: false,
      activePlan: baseActivePlan,
      upgradePlan: baseUpgradePlan,
      cycleLabel: "al mese",
      shouldReduceMotion: false,
      openPaymentForPlan: mockOpenPaymentForPlan,
      fadeUp: dummyVariants,
      scaleIn: dummyVariants,
      ...props,
    };

    return render(<CurrentPlanCard {...defaultProps} />);
  };

  test("renderizza correttamente la card per un piano Attivo con dettagli sul rinnovo e CTA di upgrade", () => {
    renderCurrentPlanCard({ cycleLabel: "al mese" });

    // Eyebrow e badge di status
    expect(screen.getByText("Stato Attuale")).toBeInTheDocument();
    expect(screen.getByText("Attivo")).toBeInTheDocument();

    // Nome piano e prezzo di rinnovo formattato
    expect(screen.getByText("Piano Professional")).toBeInTheDocument();
    expect(screen.getByText("€49")).toBeInTheDocument();
    expect(screen.getByText(/\/mese/i)).toBeInTheDocument();

    // Bottone di upgrade
    const upgradeBtn = screen.getByRole("button", { name: "Esegui l'Upgrade" });
    expect(upgradeBtn).toBeInTheDocument();

    fireEvent.click(upgradeBtn);
    expect(mockOpenPaymentForPlan).toHaveBeenCalledWith("Piano Enterprise");
  });

  test("renderizza la card in stato Admin con privilegi illimitati e nessun prezzo o CTA", () => {
    renderCurrentPlanCard({
      isAdmin: true,
      activePlan: null,
      upgradePlan: null,
    });

    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("Accesso Completo")).toBeInTheDocument();
    expect(
      screen.getByText("Accesso illimitato alle funzionalità del sistema.")
    ).toBeInTheDocument();

    // Non mostra prezzo rinnovo né pulsanti di upgrade
    expect(screen.queryByText(/Rinnovo:/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Esegui l'Upgrade" })).not.toBeInTheDocument();
  });

  test("mostra il badge 'Piano Massimo Raggiunto' per utenti standard senza upgrade disponibili", () => {
    renderCurrentPlanCard({
      isAdmin: false,
      isNone: false,
      activePlan: baseActivePlan,
      upgradePlan: null,
    });

    expect(screen.getByText("Piano Massimo Raggiunto")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Esegui l'Upgrade" })).not.toBeInTheDocument();
  });

  test("renderizza la card in stato Periodo di Prova (Trial) con copy dedicato e CTA di upgrade", () => {
    renderCurrentPlanCard({
      isTrial: true,
      activePlan: baseActivePlan,
      upgradePlan: baseUpgradePlan,
    });

    expect(screen.getByText("In Prova")).toBeInTheDocument();
    expect(screen.getByText("Periodo di Prova")).toBeInTheDocument();
    expect(
      screen.getByText("Esplora tutte le potenzialità della piattaforma senza limitazioni.")
    ).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Esegui l'Upgrade" })).toBeInTheDocument();
  });

  test("renderizza lo stato Scaduto quando isNone è true e activePlan è null", () => {
    renderCurrentPlanCard({
      isNone: true,
      activePlan: null,
      upgradePlan: baseActivePlan,
    });

    expect(screen.getByText("Scaduto")).toBeInTheDocument();
    expect(screen.getByText("Nessun piano attivo")).toBeInTheDocument();
    expect(
      screen.getByText("Scegli un piano per iniziare ad operare.")
    ).toBeInTheDocument();
  });

  test("renderizza lo stato 'Verifica' quando activePlan è null e isNone è false", () => {
    renderCurrentPlanCard({
      isNone: false,
      activePlan: null,
      upgradePlan: null,
    });

    expect(screen.getByText("Verifica")).toBeInTheDocument();
    expect(screen.getByText("Non riconosciuto")).toBeInTheDocument();
  });

  test("supporta shouldReduceMotion impostato a true senza errori di rendering", () => {
    renderCurrentPlanCard({
      shouldReduceMotion: true,
    });

    expect(screen.getByText("Piano Professional")).toBeInTheDocument();
  });
});