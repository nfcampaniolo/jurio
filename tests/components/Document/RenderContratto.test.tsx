import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import type { AnalisiContrattualeData } from "@/components/Document/RenderContratto";

/* ---------- mock react-icons/fa ---------- */
vi.mock("react-icons/fa", () => ({
  FaFileContract: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="fa-file-contract" {...props} />
  ),
  FaExclamationTriangle: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="fa-exclamation-triangle" {...props} />
  ),
  FaHandshake: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="fa-handshake" {...props} />
  ),
}));

/* ---------- mock SharedUI components ---------- */
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
  }: {
    icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    title: string;
  }) => (
    <div data-testid="mock-section-title">
      {Icon && <Icon />}
      <span>{title}</span>
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
  }: {
    icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    title: string;
  }) => (
    <div data-testid="mock-section-title">
      {Icon && <Icon />}
      <span>{title}</span>
    </div>
  ),
  SectionText: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-section-text">{children}</div>
  ),
}));

/* ---------- component ---------- */
import { RenderContratto } from "@/components/Document/RenderContratto";

describe("RenderContratto Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const dummyData: AnalisiContrattualeData = {
    summary: "Accordo di fornitura di servizi software SaaS con canone ricorrente.",
    obbligazioni: [
      {
        parte_obbligata: "Fornitore s.r.l.",
        parte_beneficiaria: "Cliente S.p.A.",
        descrizione: "Garantire uptime del 99.9% su base mensile.",
        rilevanza: "critica",
        conseguenza_inadempimento: "Penale del 5% del canone mensile per ogni ora di disservizio.",
      },
      {
        parte_obbligata: "Cliente S.p.A.",
        parte_beneficiaria: "Fornitore s.r.l.",
        descrizione: "Pagamento delle fatture a 30 giorni data emissione.",
        rilevanza: "media",
      },
    ],
    rischi_e_contenzioso: [
      {
        titolo: "Clausola risolutiva espressa generica",
        descrizione: "Mancata indicazione specifica delle obbligazioni essenziali soggette a risoluzione.",
        impatto: "alto",
        probabilita: "media",
        azione_raccomandata: "Riformulare la clausola elencando tassativamente gli articoli vincolanti.",
      },
      {
        titolo: "Assenza di limitazione di responsabilità",
        descrizione: "Esposizione a richieste risarcitorie illimitate per danni indiretti.",
        impatto: "critico",
        probabilita: "alta",
      },
    ],
  };

  test("renderizza la sintesi contrattuale quando summary è presente", () => {
    render(<RenderContratto data={{ summary: dummyData.summary }} />);

    expect(screen.getByText("Sintesi Contrattuale")).toBeInTheDocument();
    expect(screen.getByTestId("fa-file-contract")).toBeInTheDocument();
    expect(
      screen.getByText("Accordo di fornitura di servizi software SaaS con canone ricorrente.")
    ).toBeInTheDocument();
  });

  test("renderizza le obbligazioni contrattuali con parte obbligata, descrizione, badge e inadempimento", () => {
    render(<RenderContratto data={{ obbligazioni: dummyData.obbligazioni }} />);

    expect(screen.getByText("Obbligazioni Principali")).toBeInTheDocument();
    expect(screen.getByTestId("fa-handshake")).toBeInTheDocument();

    // Prima obbligazione (conseguenza presente)
    expect(screen.getByText("Fornitore s.r.l.")).toBeInTheDocument();
    expect(screen.getByText("Garantire uptime del 99.9% su base mensile.")).toBeInTheDocument();
    expect(screen.getByText("critica")).toBeInTheDocument();
    expect(screen.getByText("In caso di inadempimento:")).toBeInTheDocument();
    expect(
      screen.getByText(/Penale del 5% del canone mensile per ogni ora di disservizio/i)
    ).toBeInTheDocument();

    // Seconda obbligazione (senza conseguenza esplicita)
    expect(screen.getByText("Cliente S.p.A.")).toBeInTheDocument();
    expect(screen.getByText("Pagamento delle fatture a 30 giorni data emissione.")).toBeInTheDocument();
    expect(screen.getByText("media")).toBeInTheDocument();
  });

  test("applica la classe di evidenza per rilevanza critica/alta e la classe standard per rilevanza media/bassa", () => {
    render(<RenderContratto data={{ obbligazioni: dummyData.obbligazioni }} />);

    const badgeCritica = screen.getByText("critica");
    expect(badgeCritica).toHaveClass("bg-orange-100", "text-orange-800");

    const badgeMedia = screen.getByText("media");
    expect(badgeMedia).toHaveClass("bg-gray-100", "text-gray-700");
  });

  test("renderizza la sezione rischi e contenzioso con titolo, impatto, probabilità e azione raccomandata", () => {
    render(<RenderContratto data={{ rischi_e_contenzioso: dummyData.rischi_e_contenzioso }} />);

    expect(screen.getByText("Rischi e Profili di Contenzioso")).toBeInTheDocument();
    expect(screen.getByTestId("fa-exclamation-triangle")).toBeInTheDocument();

    // Primo rischio (con azione raccomandata)
    expect(screen.getByRole("heading", { name: "Clausola risolutiva espressa generica", level: 4 })).toBeInTheDocument();
    expect(
      screen.getByText("Mancata indicazione specifica delle obbligazioni essenziali soggette a risoluzione.")
    ).toBeInTheDocument();
    expect(screen.getByText("alto")).toBeInTheDocument();
    expect(screen.getByText("media")).toBeInTheDocument();
    expect(
      screen.getByText("→ Riformulare la clausola elencando tassativamente gli articoli vincolanti.")
    ).toBeInTheDocument();

    // Secondo rischio (senza azione raccomandata)
    expect(screen.getByRole("heading", { name: "Assenza di limitazione di responsabilità", level: 4 })).toBeInTheDocument();
    expect(screen.getByText("critico")).toBeInTheDocument();
    expect(screen.getByText("alta")).toBeInTheDocument();
  });

  test("non renderizza sezioni quando i campi sono omessi o vuoti", () => {
    const { container } = render(<RenderContratto data={{}} />);

    expect(screen.queryByText("Sintesi Contrattuale")).toBeNull();
    expect(screen.queryByText("Obbligazioni Principali")).toBeNull();
    expect(screen.queryByText("Rischi e Profili di Contenzioso")).toBeNull();
    expect(container.firstChild).toHaveClass("space-y-6");
  });
});