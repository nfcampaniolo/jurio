import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import type { DueDiligenceData } from "@/features/document/components/RenderDueDiligence";

/* ---------- mock react-icons/fa ---------- */
vi.mock("react-icons/fa", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid={`fa-${name}`} {...props} />
  );
  return {
    FaShieldAlt: Icon("shield-alt"),
    FaClipboardList: Icon("clipboard-list"),
    FaSearch: Icon("search"),
    FaExclamationCircle: Icon("exclamation-circle"),
    FaBalanceScale: Icon("balance-scale"),
    FaExclamationTriangle: Icon("exclamation-triangle"),
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
    subtitle?: string;
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

vi.mock("@/features/document/components/SharedUI", () => ({
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
    subtitle?: string;
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
import { RenderDueDiligence } from "@/features/document/components/RenderDueDiligence";

describe("RenderDueDiligence Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const dummyData: DueDiligenceData = {
    oggetto_due_diligence: "Acquisizione ramo d'azienda TechCorp S.r.l.",
    summary: "Due diligence legale su contratti in essere, IP e conformità GDPR.",
    diritti: [
      {
        titolare: "Cessionaria",
        descrizione: "Diritto di opzione esclusivo per il rinnovo delle licenze software brevettate.",
      },
    ],
    obblighi: [
      {
        soggetto_obbligato: "Cedente",
        descrizione: "Consegna della documentazione contabile e dei registri dei trattamenti.",
        scadenza: "30/09/2026",
        stato: "parzialmente_adempiuto",
      },
    ],
    rischi_giuridici: [
      {
        titolo: "Contenzioso giuslavoristico pendente",
        descrizione: "Ricorso ex art. 414 c.p.c. presentato da ex dipendente per differenze retributive.",
        is_responsabilita_potenziale: true,
        soggetto_esposto: "NewCo S.p.A.",
        categoria: "Lavoro",
        livello_rilevanza: "alta",
        probabilita: "media",
        impatto: "alto",
        priorita: "urgente",
        riferimento: "RG 1234/2025",
        conseguenza_potenziale: "Esposizione debitoria stimata a € 45.000",
        azione_mitigation: "Inserimento clausola di manleva e conto escrow a garanzia.",
      },
    ],
    aspetti_da_verificare: [
      {
        oggetto: "Titolarità del codice sorgente",
        motivazione: "Verifica contratti di sviluppo conto terzi per evitare rivendicazioni di terzi.",
        priorita: "urgente",
        documentazione_necessaria: [
          "Contratti di cessione IP degli sviluppatori",
          "Quietanza di saldo e stralcio",
        ],
        verifica_raccomandata: "Audit contrattuale sui contratti dei freelancer.",
      },
      {
        oggetto: "Consensi privacy newsletter",
        motivazione: "Verificare la conformità dei consensi opt-in storici al GDPR.",
        priorita: "bassa",
        verifica_raccomandata: "Campionamento registro consensi.",
      },
    ],
  };

  test("renderizza la sintesi con icona, titolo e oggetto della due diligence", () => {
    render(<RenderDueDiligence data={{ summary: dummyData.summary, oggetto_due_diligence: dummyData.oggetto_due_diligence }} />);

    expect(screen.getByText("Sintesi Due Diligence")).toBeInTheDocument();
    expect(screen.getByText("- Acquisizione ramo d'azienda TechCorp S.r.l.")).toBeInTheDocument();
    expect(screen.getByTestId("fa-shield-alt")).toBeInTheDocument();
    expect(screen.getByText("Due diligence legale su contratti in essere, IP e conformità GDPR.")).toBeInTheDocument();
  });

  test("renderizza i diritti e gli obblighi contrattuali formattando correttamente lo stato", () => {
    render(<RenderDueDiligence data={{ diritti: dummyData.diritti, obblighi: dummyData.obblighi }} />);

    // Diritti
    expect(screen.getByText("Diritti Principali")).toBeInTheDocument();
    expect(screen.getByTestId("fa-balance-scale")).toBeInTheDocument();
    expect(screen.getByText("Cessionaria")).toBeInTheDocument();
    expect(screen.getByText("Diritto di opzione esclusivo per il rinnovo delle licenze software brevettate.")).toBeInTheDocument();

    // Obblighi
    expect(screen.getByText("Obblighi e Adempimenti")).toBeInTheDocument();
    expect(screen.getByTestId("fa-clipboard-list")).toBeInTheDocument();
    expect(screen.getByText("Cedente")).toBeInTheDocument();
    expect(screen.getByText("Consegna della documentazione contabile e dei registri dei trattamenti.")).toBeInTheDocument();
    expect(screen.getByText("parzialmente adempiuto")).toBeInTheDocument();
    expect(screen.getByText("Scadenza: 30/09/2026")).toBeInTheDocument();
  });

  test("renderizza i rischi giuridici con badge di responsabilità potenziale, metriche e azione di mitigazione", () => {
    render(<RenderDueDiligence data={{ rischi_giuridici: dummyData.rischi_giuridici }} />);

    expect(screen.getByText("Rischi Giuridici e Responsabilità")).toBeInTheDocument();
    expect(screen.getByTestId("fa-exclamation-triangle")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Contenzioso giuslavoristico pendente", level: 4 })).toBeInTheDocument();
    expect(screen.getByText("Resp. Potenziale")).toBeInTheDocument();
    expect(screen.getByText("Ricorso ex art. 414 c.p.c. presentato da ex dipendente per differenze retributive.")).toBeInTheDocument();

    expect(screen.getByText("NewCo S.p.A.")).toBeInTheDocument();
    expect(screen.getByText("alta")).toBeInTheDocument();
    expect(screen.getByText("alto")).toBeInTheDocument();
    expect(screen.getByText("urgente")).toBeInTheDocument();

    expect(screen.getByText("Mitigazione:")).toBeInTheDocument();
    expect(screen.getByText("Inserimento clausola di manleva e conto escrow a garanzia.")).toBeInTheDocument();
  });

  test("renderizza gli aspetti da verificare con badge di priorità, elenco documentale e verifica raccomandata", () => {
    render(<RenderDueDiligence data={{ aspetti_da_verificare: dummyData.aspetti_da_verificare }} />);

    expect(screen.getByText("Checklist: Aspetti da Verificare")).toBeInTheDocument();
    expect(screen.getByTestId("fa-search")).toBeInTheDocument();

    // Aspetto 1 (urgente con documentazione)
    expect(screen.getByRole("heading", { name: "Titolarità del codice sorgente", level: 4 })).toBeInTheDocument();
    expect(screen.getByText("Verifica contratti di sviluppo conto terzi per evitare rivendicazioni di terzi.")).toBeInTheDocument();
    expect(screen.getByText("Doc. Necessaria:")).toBeInTheDocument();
    expect(screen.getByText("Contratti di cessione IP degli sviluppatori")).toBeInTheDocument();
    expect(screen.getByText("Quietanza di saldo e stralcio")).toBeInTheDocument();
    expect(screen.getByText("Azione: Audit contrattuale sui contratti dei freelancer.")).toBeInTheDocument();

    // Aspetto 2 (priorità bassa senza documentazione)
    expect(screen.getByRole("heading", { name: "Consensi privacy newsletter", level: 4 })).toBeInTheDocument();
    expect(screen.getByText("Azione: Campionamento registro consensi.")).toBeInTheDocument();
  });

  test("applica stili di colore differenziati ai badge priorità in base al livello", () => {
    render(<RenderDueDiligence data={{ aspetti_da_verificare: dummyData.aspetti_da_verificare }} />);

    const badgeUrgente = screen.getByText("urgente");
    expect(badgeUrgente).toHaveClass("bg-orange-200", "text-orange-800");

    const badgeBassa = screen.getByText("bassa");
    expect(badgeBassa).toHaveClass("bg-yellow-200", "text-yellow-800");
  });

  test("non renderizza le sezioni quando i rispettivi array o campi sono vuoti", () => {
    const { container } = render(<RenderDueDiligence data={{}} />);

    expect(screen.queryByText("Sintesi Due Diligence")).toBeNull();
    expect(screen.queryByText("Diritti Principali")).toBeNull();
    expect(screen.queryByText("Obblighi e Adempimenti")).toBeNull();
    expect(screen.queryByText("Rischi Giuridici e Responsabilità")).toBeNull();
    expect(screen.queryByText("Checklist: Aspetti da Verificare")).toBeNull();
    expect(container.firstChild).toHaveClass("space-y-6");
  });
});