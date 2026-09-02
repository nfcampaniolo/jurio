import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import type { PreparazioneCasoData } from "@/components/Document/RenderPreparazioneCaso";

/* ---------- mock react-icons/fa ---------- */
vi.mock("react-icons/fa", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid={`fa-${name}`} {...props} />
  );
  return {
    FaChessKnight: Icon("chess-knight"),
    FaBullseye: Icon("bullseye"),
    FaFistRaised: Icon("fist-raised"),
    FaHeartBroken: Icon("heart-broken"),
    FaCalendarCheck: Icon("calendar-check"),
  };
});

/* ---------- mock SharedUI ---------- */
vi.mock("./SharedUI", () => ({
  SectionContainer: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="mock-section-container" className={className}>
      {children}
    </div>
  ),
  SectionTitle: ({
    icon: Icon,
    title,
    subtitle,
  }: {
    icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    title: string;
    subtitle?: React.ReactNode;
  }) => (
    <div data-testid="mock-section-title">
      {Icon && <Icon />}
      <span>{title}</span>
      {subtitle && <span>{subtitle}</span>}
    </div>
  ),
  SectionText: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-section-text">{children}</div>
  ),
}));

vi.mock("@/components/Document/SharedUI", () => ({
  SectionContainer: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="mock-section-container" className={className}>
      {children}
    </div>
  ),
  SectionTitle: ({
    icon: Icon,
    title,
    subtitle,
  }: {
    icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    title: string;
    subtitle?: React.ReactNode;
  }) => (
    <div data-testid="mock-section-title">
      {Icon && <Icon />}
      <span>{title}</span>
      {subtitle && <span>{subtitle}</span>}
    </div>
  ),
  SectionText: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-section-text">{children}</div>
  ),
}));

/* ---------- component ---------- */
import { RenderPreparazioneCaso } from "@/components/Document/RenderPreparazioneCaso";

describe("RenderPreparazioneCaso Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const dummyData: PreparazioneCasoData = {
    obiettivo_processuale: "Accertamento nullità fideiussione omnibus conforme schema ABI.",
    stato_del_caso: "Fase introduttiva - Notifica atto di citazione",
    summary: "Strategia processuale fondata su violazione antitrust ex art. 2 L. 287/1990.",
    punti_forza: [
      {
        titolo: "Provvedimento Banca d'Italia n. 55/2005",
        descrizione: "Prova privilegiata a supporto della nullità parziale delle clausole nn. 2, 6 e 8.",
        fondamento: "Cass. Sez. Unite 41994/2021",
      },
    ],
    punti_debolezza: [
      {
        titolo: "Eccezione di prescrizione decennale",
        descrizione: "Rischio prescrizione dell'azione di ripetizione dell'indebito.",
        fondamento: "Decorrenza dalla chiusura del conto corrente",
      },
    ],
    fatti: [
      {
        data: "10/01/2018",
        evento: "Sottoscrizione del contratto di fideiussione omnibus.",
        accertato: true,
        rilevanza: "alta",
      },
      {
        data: "15/05/2026",
        evento: "Richiesta stragiudiziale di escussione della garanzia da parte della banca.",
        accertato: false,
        rilevanza: "media",
      },
    ],
    azioni_successive: [
      {
        azione: "Deposito memoria ex art. 171-ter c.p.c. n. 1",
        obiettivo: "Precisazione delle domande e produzione perizia econometrica.",
        priorita: "alta",
        termine: "20/10/2026",
      },
      {
        azione: "Istanza di Consulenza Tecnica d'Ufficio (CTU)",
        obiettivo: "Ricalcolo saldo con depurazione clausole nulle.",
        priorita: "media",
      },
    ],
  };

  test("renderizza l'inquadramento strategico con obiettivo, stato attuale e sintesi", () => {
    render(<RenderPreparazioneCaso data={dummyData} />);

    expect(screen.getByText("Inquadramento Strategico")).toBeInTheDocument();
    expect(screen.getByTestId("fa-chess-knight")).toBeInTheDocument();
    expect(
      screen.getByText("Accertamento nullità fideiussione omnibus conforme schema ABI.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Fase introduttiva - Notifica atto di citazione")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Strategia processuale fondata su violazione antitrust ex art. 2 L. 287/1990.")
    ).toBeInTheDocument();
  });

  test("mostra il fallback 'Non definito' quando obiettivo processuale e stato del caso non sono valorizzati", () => {
    render(<RenderPreparazioneCaso data={{}} />);

    const fallbackElements = screen.getAllByText("Non definito");
    expect(fallbackElements).toHaveLength(2);
    expect(screen.queryByTestId("mock-section-text")).toBeNull();
  });

  test("renderizza la matrice SWOT con punti di forza e vulnerabilità", () => {
    render(<RenderPreparazioneCaso data={dummyData} />);

    // Punti di forza
    expect(screen.getByText("Punti di Forza")).toBeInTheDocument();
    expect(screen.getByTestId("fa-fist-raised")).toBeInTheDocument();
    expect(screen.getByText("Provvedimento Banca d'Italia n. 55/2005")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Prova privilegiata a supporto della nullità parziale delle clausole nn. 2, 6 e 8."
      )
    ).toBeInTheDocument();

    // Vulnerabilità
    expect(screen.getByText("Vulnerabilità")).toBeInTheDocument();
    expect(screen.getByTestId("fa-heart-broken")).toBeInTheDocument();
    expect(screen.getByText("Eccezione di prescrizione decennale")).toBeInTheDocument();
    expect(
      screen.getByText("Rischio prescrizione dell'azione di ripetizione dell'indebito.")
    ).toBeInTheDocument();
  });

  test("renderizza la timeline dei fatti evidenziando fatti accertati e allegazioni con badge dedicato", () => {
    const { container } = render(<RenderPreparazioneCaso data={{ fatti: dummyData.fatti }} />);

    expect(screen.getByText("Timeline Fatti Rilevanti")).toBeInTheDocument();
    expect(screen.getByTestId("fa-calendar-check")).toBeInTheDocument();

    // Fatto 1 (Accertato)
    expect(screen.getByText("10/01/2018")).toBeInTheDocument();
    expect(screen.getByText("Sottoscrizione del contratto di fideiussione omnibus.")).toBeInTheDocument();

    // Fatto 2 (Non accertato -> Allegazione)
    expect(screen.getByText("15/05/2026")).toBeInTheDocument();
    expect(
      screen.getByText("Richiesta stragiudiziale di escussione della garanzia da parte della banca.")
    ).toBeInTheDocument();
    expect(screen.getByText("Allegazione")).toBeInTheDocument();

    // Verifica pallini timeline
    const indicators = container.querySelectorAll(".w-2.h-2.rounded-full");
    expect(indicators[0]).toHaveClass("bg-green-500");
    expect(indicators[1]).toHaveClass("bg-gray-300");
  });

  test("renderizza la checklist delle azioni successive con e senza termine perentorio", () => {
    render(<RenderPreparazioneCaso data={{ azioni_successive: dummyData.azioni_successive }} />);

    expect(screen.getByText("To-Do: Azioni Successive")).toBeInTheDocument();
    expect(screen.getByTestId("fa-bullseye")).toBeInTheDocument();

    // Azione 1 (con termine)
    expect(
      screen.getByRole("heading", { name: "Deposito memoria ex art. 171-ter c.p.c. n. 1", level: 4 })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Precisazione delle domande e produzione perizia econometrica.")
    ).toBeInTheDocument();
    expect(screen.getByText("Entro: 20/10/2026")).toBeInTheDocument();

    // Azione 2 (senza termine)
    expect(
      screen.getByRole("heading", { name: "Istanza di Consulenza Tecnica d'Ufficio (CTU)", level: 4 })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Ricalcolo saldo con depurazione clausole nulle.")
    ).toBeInTheDocument();
  });

  test("non renderizza le sezioni opzionali quando i rispettivi array sono vuoti o omessi", () => {
    render(<RenderPreparazioneCaso data={{}} />);

    expect(screen.queryByText("Punti di Forza")).toBeNull();
    expect(screen.queryByText("Vulnerabilità")).toBeNull();
    expect(screen.queryByText("Timeline Fatti Rilevanti")).toBeNull();
    expect(screen.queryByText("To-Do: Azioni Successive")).toBeNull();
  });
});