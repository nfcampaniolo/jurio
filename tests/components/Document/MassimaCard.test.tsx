import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";

/* ---------- mock child components ---------- */
vi.mock("./MassimaHeader", () => ({
  MassimaHeader: ({
    result,
    isGenerico,
  }: {
    result: Record<string, unknown>;
    isGenerico: boolean;
  }) => (
    <div data-testid="mock-massima-header">
      <span>Header - Generico: {isGenerico ? "true" : "false"}</span>
      <span>Numero: {String(result.numero_sentenza || result.nome_file || "")}</span>
    </div>
  ),
}));

vi.mock("@/features/document/components/MassimaHeader", () => ({
  MassimaHeader: ({
    result,
    isGenerico,
  }: {
    result: Record<string, unknown>;
    isGenerico: boolean;
  }) => (
    <div data-testid="mock-massima-header">
      <span>Header - Generico: {isGenerico ? "true" : "false"}</span>
      <span>Numero: {String(result.numero_sentenza || result.nome_file || "")}</span>
    </div>
  ),
}));

vi.mock("./PdfPreviewSidebar", () => ({
  PdfPreviewSidebar: ({
    file,
    share,
    uid,
    id,
    nomeFile,
  }: {
    file: string;
    share?: boolean;
    uid?: string;
    id?: string;
    nomeFile?: string;
  }) => (
    <div data-testid="mock-pdf-preview-sidebar">
      <span>File: {file}</span>
      <span>Nome: {nomeFile || "N/A"}</span>
      <span>Share: {share ? "true" : "false"}</span>
      <span>UID: {uid}</span>
      <span>ID: {id}</span>
    </div>
  ),
}));

vi.mock("@/features/document/components/PdfPreviewSidebar", () => ({
  PdfPreviewSidebar: ({
    file,
    share,
    uid,
    id,
    nomeFile,
  }: {
    file: string;
    share?: boolean;
    uid?: string;
    id?: string;
    nomeFile?: string;
  }) => (
    <div data-testid="mock-pdf-preview-sidebar">
      <span>File: {file}</span>
      <span>Nome: {nomeFile || "N/A"}</span>
      <span>Share: {share ? "true" : "false"}</span>
      <span>UID: {uid}</span>
      <span>ID: {id}</span>
    </div>
  ),
}));

vi.mock("./RenderGiurisprudenza", () => ({
  RenderGiurisprudenza: ({
    data,
    share,
    uid,
    id,
  }: {
    data: Record<string, unknown>;
    share?: boolean;
    uid?: string;
    id?: string;
  }) => (
    <div data-testid="mock-render-giurisprudenza">
      <span>Giurisprudenza: {String(data.massima || data.ratio_decidendi || "Senza Massima")}</span>
      <span>Share: {share ? "true" : "false"}</span>
      <span>UID: {uid}</span>
      <span>ID: {id}</span>
    </div>
  ),
}));

vi.mock("@/features/document/components/RenderGiurisprudenza", () => ({
  RenderGiurisprudenza: ({
    data,
    share,
    uid,
    id,
  }: {
    data: Record<string, unknown>;
    share?: boolean;
    uid?: string;
    id?: string;
  }) => (
    <div data-testid="mock-render-giurisprudenza">
      <span>Giurisprudenza: {String(data.massima || data.ratio_decidendi || "Senza Massima")}</span>
      <span>Share: {share ? "true" : "false"}</span>
      <span>UID: {uid}</span>
      <span>ID: {id}</span>
    </div>
  ),
}));

vi.mock("./RenderContratto", () => ({
  RenderContratto: ({ data }: { data: Record<string, unknown> }) => (
    <div data-testid="mock-render-contratto">
      <span>Contratto: {Array.isArray(data.obbligazioni) ? data.obbligazioni.length : 0} obbligazioni</span>
    </div>
  ),
}));

vi.mock("@/features/document/components/RenderContratto", () => ({
  RenderContratto: ({ data }: { data: Record<string, unknown> }) => (
    <div data-testid="mock-render-contratto">
      <span>Contratto: {Array.isArray(data.obbligazioni) ? data.obbligazioni.length : 0} obbligazioni</span>
    </div>
  ),
}));

vi.mock("./RenderDueDiligence", () => ({
  RenderDueDiligence: ({ data }: { data: Record<string, unknown> }) => (
    <div data-testid="mock-render-due-diligence">
      <span>Due Diligence: {Array.isArray(data.diritti) ? data.diritti.length : 0} diritti</span>
    </div>
  ),
}));

vi.mock("@/features/document/components/RenderDueDiligence", () => ({
  RenderDueDiligence: ({ data }: { data: Record<string, unknown> }) => (
    <div data-testid="mock-render-due-diligence">
      <span>Due Diligence: {Array.isArray(data.diritti) ? data.diritti.length : 0} diritti</span>
    </div>
  ),
}));

vi.mock("./RenderPreparazioneCaso", () => ({
  RenderPreparazioneCaso: ({ data }: { data: Record<string, unknown> }) => (
    <div data-testid="mock-render-preparazione-caso">
      <span>Caso: {String(data.obiettivo_processuale || "Strategia")}</span>
    </div>
  ),
}));

vi.mock("@/features/document/components/RenderPreparazioneCaso", () => ({
  RenderPreparazioneCaso: ({ data }: { data: Record<string, unknown> }) => (
    <div data-testid="mock-render-preparazione-caso">
      <span>Caso: {String(data.obiettivo_processuale || "Strategia")}</span>
    </div>
  ),
}));

vi.mock("./RenderFallback", () => ({
  RenderFallback: () => (
    <div data-testid="mock-render-fallback">Fallback Generico</div>
  ),
}));

vi.mock("@/features/document/components/RenderFallback", () => ({
  RenderFallback: () => (
    <div data-testid="mock-render-fallback">Fallback Generico</div>
  ),
}));

/* ---------- component ---------- */
import { MassimaCard } from "@/features/document/components/Massima";

describe("MassimaCard Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("renderizza MassimaHeader e RenderGiurisprudenza quando il documento contiene 'massima' o 'ratio_decidendi'", () => {
    const giurisprudenzaDoc = {
      id: "doc-giur-1",
      tipo_documento: "sentenza",
      organo_giudicante: "Corte di Cassazione",
      numero_sentenza: "12345/2026",
      massima: "In tema di contratti, l'accordo si perfeziona con la conoscenza dell'accettazione.",
    };

    render(
      <MassimaCard
        result={giurisprudenzaDoc}
        uid="usr-1"
        id="card-1"
        share={true}
      />
    );

    expect(screen.getByTestId("mock-massima-header")).toBeInTheDocument();
    expect(screen.getByText("Header - Generico: false")).toBeInTheDocument();
    expect(screen.getByText("Numero: 12345/2026")).toBeInTheDocument();

    expect(screen.getByTestId("mock-render-giurisprudenza")).toBeInTheDocument();
    expect(screen.getByText(/In tema di contratti/i)).toBeInTheDocument();
    expect(screen.getByText("Share: true")).toBeInTheDocument();
  });

  test("renderizza RenderGiurisprudenza con isGenerico true quando tipo_documento è 'documento_giurisprudenza_generico'", () => {
    const genericDoc = {
      tipo_documento: "documento_giurisprudenza_generico",
      nome_file: "Memoria_Difensiva.pdf",
    };

    render(<MassimaCard result={genericDoc} />);

    expect(screen.getByTestId("mock-massima-header")).toBeInTheDocument();
    expect(screen.getByText("Header - Generico: true")).toBeInTheDocument();
    expect(screen.getByTestId("mock-render-giurisprudenza")).toBeInTheDocument();
  });

  test("renderizza RenderContratto quando result contiene 'obbligazioni' e 'corrispettivi'", () => {
    const contrattoDoc = {
      tipo_documento: "contratto",
      obbligazioni: ["Consegna merce", "Garanzia di conformità"],
      corrispettivi: ["€ 50.000 all'ordine"],
    };

    render(<MassimaCard result={contrattoDoc} />);

    expect(screen.getByTestId("mock-render-contratto")).toBeInTheDocument();
    expect(screen.getByText("Contratto: 2 obbligazioni")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-render-giurisprudenza")).toBeNull();
  });

  test("renderizza RenderDueDiligence quando result contiene 'diritti' e 'aspetti_da_verificare' senza 'corrispettivi'", () => {
    const dueDiligenceDoc = {
      diritti: ["Proprietà intellettuale", "Licenze software"],
      aspetti_da_verificare: ["Contenziosi pendenti"],
    };

    render(<MassimaCard result={dueDiligenceDoc} />);

    expect(screen.getByTestId("mock-render-due-diligence")).toBeInTheDocument();
    expect(screen.getByText("Due Diligence: 2 diritti")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-render-contratto")).toBeNull();
  });

  test("renderizza RenderPreparazioneCaso quando result contiene 'obiettivo_processuale' o 'punti_forza'", () => {
    const preparazioneDoc = {
      obiettivo_processuale: "Richiesta risarcimento danni ex art. 2043 c.c.",
      punti_forza: ["Perizia tecnica asseverata"],
    };

    render(<MassimaCard result={preparazioneDoc} />);

    expect(screen.getByTestId("mock-render-preparazione-caso")).toBeInTheDocument();
    expect(screen.getByText("Caso: Richiesta risarcimento danni ex art. 2043 c.c.")).toBeInTheDocument();
  });

  test("renderizza RenderFallback per payload JSON con schema sconosciuto", () => {
    const unknownDoc = {
      campo_sconosciuto: "valore_qualsiasi",
      tipo_documento: "altro",
    };

    render(<MassimaCard result={unknownDoc} />);

    expect(screen.getByTestId("mock-render-fallback")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-render-giurisprudenza")).toBeNull();
  });

  test("renderizza PdfPreviewSidebar quando file è presente e il documento ha organo_giudicante o nome_file", () => {
    const docWithFile = {
      tipo_documento: "sentenza",
      organo_giudicante: "Corte di Cassazione",
      nome_file: "Sentenza_1234_2026.pdf",
      massima: "Principio di diritto.",
    };

    render(
      <MassimaCard
        result={docWithFile}
        file="https://storage.jurio.it/docs/sentenza.pdf"
        uid="usr-100"
        id="card-200"
        share={false}
      />
    );

    const sidebar = screen.getByTestId("mock-pdf-preview-sidebar");
    expect(sidebar).toBeInTheDocument();
    expect(within(sidebar).getByText("File: https://storage.jurio.it/docs/sentenza.pdf")).toBeInTheDocument();
    expect(within(sidebar).getByText("Nome: Sentenza_1234_2026.pdf")).toBeInTheDocument();
    expect(within(sidebar).getByText("UID: usr-100")).toBeInTheDocument();
    expect(within(sidebar).getByText("ID: card-200")).toBeInTheDocument();
  });

  test("non renderizza PdfPreviewSidebar quando file non è valorizzato", () => {
    const doc = {
      tipo_documento: "sentenza",
      organo_giudicante: "Corte di Cassazione",
      massima: "Massima valida.",
    };

    render(<MassimaCard result={doc} file={null} />);

    expect(screen.queryByTestId("mock-pdf-preview-sidebar")).toBeNull();
  });
});