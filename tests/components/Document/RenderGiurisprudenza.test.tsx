import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import type { GiurisprudenzaData } from "@/components/Document/RenderGiurisprudenza";

/* ---------- mock react-icons/fa ---------- */
vi.mock("react-icons/fa", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid={`fa-${name}`} {...props} />
  );
  return {
    FaGavel: Icon("gavel"),
    FaParagraph: Icon("paragraph"),
    FaBalanceScale: Icon("balance-scale"),
    FaLink: Icon("link"),
    FaListUl: Icon("list-ul"),
    FaLightbulb: Icon("lightbulb"),
    FaStickyNote: Icon("sticky-note"),
    FaAlignLeft: Icon("align-left"),
    FaBullseye: Icon("bullseye"),
    FaCheckDouble: Icon("check-double"),
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
      {subtitle && <span data-testid="mock-subtitle">{subtitle}</span>}
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
      {subtitle && <span data-testid="mock-subtitle">{subtitle}</span>}
    </div>
  ),
  SectionText: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-section-text">{children}</div>
  ),
}));

/* ---------- mock CitationTree & RelatedDocuments ---------- */
vi.mock("@/components/Document/CitationGraph", () => ({
  default: ({ precedenti }: { precedenti: string[] }) => (
    <div data-testid="mock-citation-tree">
      <span>{precedenti.length} precedenti graficati</span>
    </div>
  ),
}));

vi.mock("@/components/Document/LinkedSentences", () => ({
  RelatedDocuments: ({
    uid,
    massima,
    riferimentiNormativi,
  }: {
    uid: string;
    massima: string;
    riferimentiNormativi?: string[];
  }) => (
    <div data-testid="mock-related-documents">
      <span>UID: {uid}</span>
      <span>Massima: {massima}</span>
      <span>Norme: {riferimentiNormativi?.join(", ")}</span>
    </div>
  ),
}));

/* ---------- component ---------- */
import { RenderGiurisprudenza } from "@/components/Document/RenderGiurisprudenza";

describe("RenderGiurisprudenza Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const dummyGiurisprudenza: GiurisprudenzaData = {
    tipo_documento: "sentenza",
    fattispecie_rilevante: "Fattispecie concreta in tema di responsabilità medica.",
    materia: "Diritto Civile",
    sottocategoria: ["Responsabilità sanitaria", "Consenso informato"],
    questione_di_diritto: "Se l'omessa acquisizione del consenso informato generi danno autonomo.",
    massima: "L'omessa acquisizione del consenso configura lesione del diritto all'autodeterminazione.",
    tipo_massima: "principio_nuovo",
    ratio_decidendi: "La violazione del consenso rileva indipendentemente dal danno alla salute.",
    obiter_dicta: "La liquidazione del danno presuppone allegazione specifica.",
    riferimenti_normativi: ["Art. 32 Cost.", "Art. 2043 c.c."],
    precedenti_richiamati: ["Cass. Civ. 28985/2019", "Cass. Civ. 11950/2013"],
    sources: ["Foro Italiano 2026, I, 120"],
    fonte: "https://www.cortedicassazione.it/sentenza-123",
    logo_fonte: "https://www.cortedicassazione.it/logo.svg",
  };

  test("renderizza le sezioni principali di una sentenza standard con mappatura corretta dei metadati", () => {
    render(<RenderGiurisprudenza data={dummyGiurisprudenza} />);

    // Fattispecie, Materia e Sottocategorie
    expect(screen.getByText("Fattispecie")).toBeInTheDocument();
    expect(screen.getByText("Diritto Civile")).toBeInTheDocument();
    expect(screen.getByText("Fattispecie concreta in tema di responsabilità medica.")).toBeInTheDocument();
    expect(screen.getByText("Responsabilità sanitaria, Consenso informato")).toBeInTheDocument();

    // Questione di diritto
    expect(screen.getByText("Questione di diritto")).toBeInTheDocument();
    expect(screen.getByText("Se l'omessa acquisizione del consenso informato generi danno autonomo.")).toBeInTheDocument();

    // Massima e Tipo Massima Mappato
    expect(screen.getByText("Massima")).toBeInTheDocument();
    expect(screen.getByText("Principio Nuovo")).toBeInTheDocument();
    expect(screen.getByText("L'omessa acquisizione del consenso configura lesione del diritto all'autodeterminazione.")).toBeInTheDocument();

    // Ratio decidendi e Obiter dicta
    expect(screen.getByText("Ratio decidendi")).toBeInTheDocument();
    expect(screen.getByText("La violazione del consenso rileva indipendentemente dal danno alla salute.")).toBeInTheDocument();
    expect(screen.getByText("Obiter dicta")).toBeInTheDocument();
    expect(screen.getByText("La liquidazione del danno presuppone allegazione specifica.")).toBeInTheDocument();

    // Riferimenti Normativi e Precedenti
    expect(screen.getByText("Riferimenti Normativi")).toBeInTheDocument();
    expect(screen.getByText("Art. 32 Cost.")).toBeInTheDocument();
    expect(screen.getByText("Art. 2043 c.c.")).toBeInTheDocument();
    expect(screen.getByText("Precedenti Richiamati")).toBeInTheDocument();
    expect(screen.getByTestId("mock-citation-tree")).toBeInTheDocument();
    expect(screen.getByText("2 precedenti graficati")).toBeInTheDocument();

    // Fonti e Logo Esterno
    expect(screen.getByText("Fonti")).toBeInTheDocument();
    expect(screen.getByText("Foro Italiano 2026, I, 120")).toBeInTheDocument();
    const linkFonte = screen.getByRole("link", { name: "https://www.cortedicassazione.it/sentenza-123" });
    expect(linkFonte).toHaveAttribute("href", "https://www.cortedicassazione.it/sentenza-123");
    expect(screen.getByAltText("https://www.cortedicassazione.it/sentenza-123")).toHaveAttribute(
      "src",
      "https://www.cortedicassazione.it/logo.svg"
    );
  });

  test("renderizza i titoli e i campi specifici per un documento generico (isGenerico: true)", () => {
    const genericDoc: GiurisprudenzaData = {
      tipo_documento: "documento_giurisprudenza_generico",
      sintesi: "Sintesi dell'atto di citazione per inadempimento.",
      fatti: "Esposizione cronologica delle transazioni commerciali.",
      nucleo: "Domanda di condanna al pagamento del corrispettivo.",
      conclusioni: "Voglia il Tribunale accogliere la domanda.",
      massima: "Questo testo non deve comparire come massima",
    };

    render(<RenderGiurisprudenza data={genericDoc} />);

    // Sintesi
    expect(screen.getByText("Sintesi Documento")).toBeInTheDocument();
    expect(screen.getByText("Sintesi dell'atto di citazione per inadempimento.")).toBeInTheDocument();

    // Esposizione dei Fatti
    expect(screen.getByText("Esposizione dei Fatti")).toBeInTheDocument();
    expect(screen.getByText("Esposizione cronologica delle transazioni commerciali.")).toBeInTheDocument();

    // Nucleo / Merito
    expect(screen.getByText("Nucleo / Merito")).toBeInTheDocument();
    expect(screen.getByText("Domanda di condanna al pagamento del corrispettivo.")).toBeInTheDocument();

    // Conclusioni
    expect(screen.getByText("Conclusioni / Richieste")).toBeInTheDocument();
    expect(screen.getByText("Voglia il Tribunale accogliere la domanda.")).toBeInTheDocument();

    // Massima non deve essere renderizzata per documenti generici
    expect(screen.queryByText("Massima")).toBeNull();
    expect(screen.queryByText("Questo testo non deve comparire come massima")).toBeNull();
  });

  test("imposta il titolo 'Sommario' quando tipo_massima è 'non_massimabile'", () => {
    const docNonMassimabile: GiurisprudenzaData = {
      tipo_documento: "ordinanza",
      massima: "Pronuncia di mero rigetto per inammissibilità formale.",
      tipo_massima: "non_massimabile",
    };

    render(<RenderGiurisprudenza data={docNonMassimabile} />);

    expect(screen.getByText("Sommario")).toBeInTheDocument();
    expect(screen.getByText("Non Massimabile")).toBeInTheDocument();
    expect(screen.getByText("Pronuncia di mero rigetto per inammissibilità formale.")).toBeInTheDocument();
  });

  test("renderizza il blocco RelatedDocuments quando share è true, non è generico ed è presente una massima", () => {
    render(
      <RenderGiurisprudenza
        data={dummyGiurisprudenza}
        share={true}
        id="sent-unique-99"
      />
    );

    expect(screen.getByText("Documenti Correlati")).toBeInTheDocument();
    expect(screen.getByTestId("mock-related-documents")).toBeInTheDocument();
    expect(screen.getByText("UID: sent-unique-99")).toBeInTheDocument();
    expect(
      screen.getByText("Massima: L'omessa acquisizione del consenso configura lesione del diritto all'autodeterminazione.")
    ).toBeInTheDocument();
    expect(screen.getByText("Norme: Art. 32 Cost., Art. 2043 c.c.")).toBeInTheDocument();
  });

  test("non renderizza RelatedDocuments quando share è false o il documento è generico", () => {
    // 1. Share false
    const { rerender } = render(
      <RenderGiurisprudenza data={dummyGiurisprudenza} share={false} id="sent-99" />
    );
    expect(screen.queryByTestId("mock-related-documents")).toBeNull();

    // 2. Documento generico
    rerender(
      <RenderGiurisprudenza
        data={{
          tipo_documento: "documento_giurisprudenza_generico",
          massima: "Test massima",
        }}
        share={true}
        id="sent-99"
      />
    );
    expect(screen.queryByTestId("mock-related-documents")).toBeNull();
  });

  test("gestisce la fonte come semplice testo quando non è un URL", () => {
    const docFonteTesto: GiurisprudenzaData = {
      tipo_documento: "sentenza",
      fonte: "Archivio Privato Studio Legale",
      logo_fonte: "Studio Associato",
    };

    render(<RenderGiurisprudenza data={docFonteTesto} />);

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("Archivio Privato Studio Legale")).toBeInTheDocument();
    expect(screen.getByText("Studio Associato")).toBeInTheDocument();
  });
});