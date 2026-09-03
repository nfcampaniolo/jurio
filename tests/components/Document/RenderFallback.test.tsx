import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

/* ---------- mock react-icons/fa ---------- */
vi.mock("react-icons/fa", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid={`fa-${name}`} {...props} />
  );
  return {
    FaDatabase: Icon("database"),
    FaListUl: Icon("list-ul"),
    FaChevronRight: Icon("chevron-right"),
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
import { RenderFallback } from "@/features/document/components/RenderFallback";

describe("RenderFallback Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza il banner di avviso della modalità compatibilità e l'icona database", () => {
    render(<RenderFallback data={{ note: "Dato di test" }} />);

    expect(screen.getByTestId("fa-database")).toBeInTheDocument();
    expect(
      screen.getByText("Modalità compatibilità: visualizzazione dati grezzi strutturati")
    ).toBeInTheDocument();
  });

  test("filtra ed esclude le chiavi ignorate e i valori nulli, indefiniti o array vuoti", () => {
    const rawData = {
      embedding: [0.12, 0.45, 0.89],
      isEmbeddingFinished: true,
      nome_file: "documento.pdf",
      promptId: "prompt-123",
      user: "user-abc",
      lastVectorizedAt: "2026-08-01",
      valore_nullo: null,
      valore_indefinito: undefined,
      stringa_vuota: "",
      array_vuoto: [],
      chiave_valida: "Contenuto visibile",
    };

    render(<RenderFallback data={rawData} />);

    expect(screen.getByText("chiave valida")).toBeInTheDocument();
    expect(screen.getByText("Contenuto visibile")).toBeInTheDocument();

    expect(screen.queryByText("embedding")).toBeNull();
    expect(screen.queryByText("isEmbeddingFinished")).toBeNull();
    expect(screen.queryByText("nome_file")).toBeNull();
    expect(screen.queryByText("promptId")).toBeNull();
    expect(screen.queryByText("user")).toBeNull();
    expect(screen.queryByText("lastVectorizedAt")).toBeNull();
    expect(screen.queryByText("valore_nullo")).toBeNull();
    expect(screen.queryByText("array_vuoto")).toBeNull();
  });

  test("renderizza correttamente i primitivi stringa, numero e booleano (Sì / No)", () => {
    const dataWithPrimitives = {
      titolo_atto: "Memoria difensiva",
      numero_fogli: 12,
      notifica_eseguita: true,
      deposito_telematico: false,
    };

    render(<RenderFallback data={dataWithPrimitives} />);

    expect(screen.getByText("titolo atto")).toBeInTheDocument();
    expect(screen.getByText("Memoria difensiva")).toBeInTheDocument();

    expect(screen.getByText("numero fogli")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();

    expect(screen.getByText("notifica eseguita")).toBeInTheDocument();
    expect(screen.getByText("Sì")).toBeInTheDocument();

    expect(screen.getByText("deposito telematico")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
  });

  test("converte e formatta correttamente un oggetto Firestore Timestamp", () => {
    const fakeTimestamp = {
      seconds: 1779271200, // 20 Maggio 2026
      nanoseconds: 0,
    };

    render(<RenderFallback data={{ data_udienza: fakeTimestamp }} />);

    expect(screen.getByText("data udienza")).toBeInTheDocument();

    const expectedDate = new Date(fakeTimestamp.seconds * 1000).toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    expect(screen.getByText(expectedDate)).toBeInTheDocument();
  });

  test("renderizza liste array con icona chevron e valori ricorsivi", () => {
    const dataWithArray = {
      motivi_ricorso: [
        "Violazione di legge ex art. 360 n. 3 c.p.c.",
        "Omesso esame di fatto decisivo ex art. 360 n. 5 c.p.c.",
      ],
    };

    render(<RenderFallback data={dataWithArray} />);

    expect(screen.getByText("motivi ricorso")).toBeInTheDocument();
    expect(screen.getAllByTestId("fa-chevron-right")).toHaveLength(2);
    expect(screen.getByText("Violazione di legge ex art. 360 n. 3 c.p.c.")).toBeInTheDocument();
    expect(screen.getByText("Omesso esame di fatto decisivo ex art. 360 n. 5 c.p.c.")).toBeInTheDocument();
  });

  test("renderizza oggetti nidificati formattando le chiavi e rinominando createdAt in 'Data creazione'", () => {
    const dataWithNestedObject = {
      createdAt: "2026-03-15",
      dettagli_processo: {
        foro_competente: "Torino",
        valore_lite: 25000,
        createdAt: "2026-01-10",
      },
    };

    render(<RenderFallback data={dataWithNestedObject} />);

    // Chiave root createdAt trasformata in "Data creazione"
    expect(screen.getByText("Data creazione")).toBeInTheDocument();
    expect(screen.getByText("2026-03-15")).toBeInTheDocument();

    // Oggetto nidificato
    expect(screen.getByText("dettagli processo")).toBeInTheDocument();
    expect(screen.getByText("foro competente")).toBeInTheDocument();
    expect(screen.getByText("Torino")).toBeInTheDocument();
    expect(screen.getByText("valore lite")).toBeInTheDocument();
    expect(screen.getByText("25000")).toBeInTheDocument();
    expect(screen.getByText("data creazione")).toBeInTheDocument();
  });

  test("renderizza correttamente 'Nessun dato' all'interno di un oggetto con valore vuoto o nullo", () => {
    const nestedWithNull = {
      info_generali: {
        annotazioni: "",
      },
    };

    render(<RenderFallback data={nestedWithNull} />);

    expect(screen.getByText("info generali")).toBeInTheDocument();
    expect(screen.getByText("annotazioni")).toBeInTheDocument();
    expect(screen.getByText("Nessun dato")).toBeInTheDocument();
  });
});