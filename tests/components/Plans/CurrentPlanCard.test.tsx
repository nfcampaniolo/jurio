import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import type { PlanUI } from "@/features/plans/hooks/plans";
import type { StatusNormalized } from "@/features/plans/hooks/planlDomain";
import type { Variants } from "framer-motion";

/* ---------- mock react-icons/fa ---------- */
vi.mock("react-icons/fa", () => ({
  FaCheck: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-check" {...props} />
  ),
}));

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
    priceLabel: "€49/mese",
    features: [
      { name: "Accesso completo alla ricerca giurisprudenziale", included: true },
      { name: "Assistente AI illimitato", included: true },
      { name: "Opzione non inclusa", included: false },
    ],
  } as unknown as PlanUI;

  const baseUpgradePlan: PlanUI = {
    id: "plan-enterprise",
    name: "Piano Enterprise",
    priceLabel: "€99/mese",
    features: [
      { name: "Analisi massime automatizzata", included: true },
      { name: "Supporto dedicato prioritario", included: true },
    ],
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
      cycleLabel: "Fatturazione annuale",
      shouldReduceMotion: false,
      openPaymentForPlan: mockOpenPaymentForPlan,
      fadeUp: dummyVariants,
      scaleIn: dummyVariants,
      ...props,
    };

    return render(<CurrentPlanCard {...defaultProps} />);
  };

  test("renderizza correttamente la card per un piano Attivo con dettagli sul rinnovo e CTA di upgrade", () => {
    renderCurrentPlanCard();

    // Badge di status
    expect(screen.getByText("Il tuo Status")).toBeInTheDocument();
    expect(screen.getByText("Attivo")).toBeInTheDocument();

    // Titolo del piano e costo rinnovo
    expect(screen.getByText("Piano Professional")).toBeInTheDocument();
    expect(screen.getByText("€49/mese")).toBeInTheDocument();
    expect(screen.getByText("(Fatturazione annuale)")).toBeInTheDocument();

    // Bottone di upgrade
    const upgradeBtn = screen.getByRole("button", { name: "Upgrade a Piano Enterprise" });
    expect(upgradeBtn).toBeInTheDocument();

    fireEvent.click(upgradeBtn);
    expect(mockOpenPaymentForPlan).toHaveBeenCalledWith("Piano Enterprise");
  });

  test("renderizza la card in stato Admin con privilegi illimitati e nessun costo rinnovo", () => {
    renderCurrentPlanCard({
      isAdmin: true,
      activePlan: null,
      upgradePlan: null,
    });

    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("Accesso Completo")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Sei un amministratore di sistema. Hai accesso illimitato a tutte le funzionalità senza restrizioni."
      )
    ).toBeInTheDocument();

    // Non mostra prezzo rinnovo
    expect(screen.queryByText(/Rinnovo:/i)).not.toBeInTheDocument();

    // Bottone disabilitato per piano massimo
    const maxPlanBtn = screen.getByRole("button", { name: "Sei al piano massimo" });
    expect(maxPlanBtn).toBeDisabled();
  });

  test("renderizza la card in stato Periodo di Prova (Trial) con lista delle feature attive e preview dell'upgrade", () => {
    renderCurrentPlanCard({
      isTrial: true,
      activePlan: baseActivePlan,
      upgradePlan: baseUpgradePlan,
    });

    expect(screen.getByText("In Prova")).toBeInTheDocument();
    expect(screen.getByText("Periodo di Prova")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Stai testando tutte le potenzialità della piattaforma. Al termine, i tuoi dati saranno conservati."
      )
    ).toBeInTheDocument();

    // Servizi attivi nel piano (mostra solo included: true)
    expect(screen.getByText("Servizi attivi nel tuo piano")).toBeInTheDocument();
    expect(screen.getByText("Accesso completo alla ricerca giurisprudenziale")).toBeInTheDocument();
    expect(screen.getByText("Assistente AI illimitato")).toBeInTheDocument();
    expect(screen.queryByText("Opzione non inclusa")).not.toBeInTheDocument();

    // Preview upgrade features
    expect(
      screen.getByText("Sblocca il potenziale completo passando a Piano Enterprise:")
    ).toBeInTheDocument();
    expect(screen.getByText("Analisi massime automatizzata")).toBeInTheDocument();
    expect(screen.getByText("Supporto dedicato prioritario")).toBeInTheDocument();
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
      screen.getByText(
        "Il tuo piano è scaduto. Scegli una delle opzioni qui sotto per riattivare i servizi."
      )
    ).toBeInTheDocument();
  });

  test("renderizza lo stato 'Da verificare' quando activePlan è null e isNone è false", () => {
    renderCurrentPlanCard({
      isNone: false,
      activePlan: null,
      upgradePlan: null,
    });

    expect(screen.getByText("Da verificare")).toBeInTheDocument();
    expect(screen.getByText("Piano non riconosciuto")).toBeInTheDocument();
  });

  test("supporta shouldReduceMotion impostato a true senza errori di rendering", () => {
    renderCurrentPlanCard({
      shouldReduceMotion: true,
    });

    expect(screen.getByText("Piano Professional")).toBeInTheDocument();
  });
});