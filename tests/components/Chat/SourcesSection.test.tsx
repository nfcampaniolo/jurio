import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

/* ---------- mock lucide-react ---------- */
vi.mock("lucide-react", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid={`icon-${name}`} {...props} />
  );
  return {
    BookOpen: Icon("book-open"),
    Search: Icon("search"),
  };
});

/* ---------- component ---------- */
import { SourcesSection } from "@/features/chat/components/SourcesSection"; // <-- adegua il path se necessario
import type { Message, Source } from "@/interfaces/interfaces";

/* ---------- helper mock message ---------- */
const createMockMessage = (overrides: Partial<Message>): Message =>
  ({
    id: "msg-default",
    role: "model",
    content: "",
    timestamp: new Date(),
    sources: [],
    ...overrides,
  } as unknown as Message);

describe("SourcesSection Component Suite", () => {
  const mockSetActiveSourceId = vi.fn();
  const mockOnSourceClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "open").mockImplementation(() => null);
  });

  const defaultProps = {
    messages: [] as Message[],
    activeSourceId: null as string | null,
    setActiveSourceId: mockSetActiveSourceId,
    onSourceClick: mockOnSourceClick,
  };

  test("renderizza stato vuoto quando non sono presenti fonti", () => {
    const messagesWithoutSources: Message[] = [
      createMockMessage({ id: "m1", role: "user", content: "Domanda" }),
      createMockMessage({ id: "m2", role: "model", content: "Risposta senza fonti", sources: [] }),
    ];

    render(<SourcesSection {...defaultProps} messages={messagesWithoutSources} />);

    expect(screen.getByRole("heading", { name: /Fonti Citate/i, level: 2 })).toBeInTheDocument();
    expect(screen.getByTestId("icon-book-open")).toBeInTheDocument();
    expect(screen.getByTestId("icon-search")).toBeInTheDocument();
    expect(screen.getByText("In attesa di riferimenti...")).toBeInTheDocument();
  });

  test("deduplica le fonti e mantiene quella con punteggio di rilevanza più alto", () => {
    const duplicateSources: Source[] = [
      {
        documento_id: "doc-shared-1",
        identificativo: "Cass. Sez. Un. 100/2026",
        title: "Titolo punteggio basso",
        match_percentage: 60,
      } as unknown as Source,
      {
        documento_id: "doc-shared-1",
        identificativo: "Cass. Sez. Un. 100/2026",
        title: "Titolo punteggio alto",
        match_percentage: 95,
      } as unknown as Source,
    ];

    const messages: Message[] = [
      createMockMessage({ id: "m1", role: "model", content: "Test", sources: duplicateSources }),
    ];

    render(<SourcesSection {...defaultProps} messages={messages} />);

    expect(screen.getAllByText("Cass. Sez. Un. 100/2026")).toHaveLength(1);
    expect(screen.getByText("Titolo punteggio alto")).toBeInTheDocument();
    expect(screen.queryByText("Titolo punteggio basso")).not.toBeInTheDocument();
    expect(screen.getByText("95% match")).toBeInTheDocument();
  });

  test("renderizza fonte web, gestisce stato attivo, hover e click con onSourceClick fornito", () => {
    const webSource: Source = {
      _type: "web_search",
      url_riferimento: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:1978;392",
      fonte_web: "Normattiva",
      titolo: "Legge 27 luglio 1978, n. 392",
      link: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:1978;392",
      relevance: 90,
    } as unknown as Source;

    const messages: Message[] = [
      createMockMessage({ id: "m1", role: "model", content: "Contenuto", sources: [webSource] }),
    ];

    const { container } = render(
      <SourcesSection
        {...defaultProps}
        messages={messages}
        activeSourceId={webSource.url_riferimento}
      />
    );

    expect(screen.getByText("Normattiva")).toBeInTheDocument();
    expect(screen.getByText("Legge 27 luglio 1978, n. 392")).toBeInTheDocument();
    expect(screen.getByText("90% match")).toBeInTheDocument();

    const progressBar = container.querySelector(".bg-\\(--color-text\\).transition-all");
    expect(progressBar).toHaveStyle({ width: "90%" });

    const sourceCard = screen.getByRole("button");
    expect(sourceCard).toHaveClass("border-(--color-text)");

    fireEvent.mouseEnter(sourceCard);
    expect(mockSetActiveSourceId).toHaveBeenCalledWith(webSource.url_riferimento);

    fireEvent.mouseLeave(sourceCard);
    expect(mockSetActiveSourceId).toHaveBeenCalledWith(null);

    fireEvent.click(sourceCard);
    expect(mockOnSourceClick).toHaveBeenCalledWith(expect.anything(), webSource);
  });

  test("gestisce il fallback di apertura nuova scheda per fonti web quando onSourceClick non è definito", () => {
    const webSource: Source = {
      _type: "web_search",
      link: "https://example.com/fonte-web",
      fonte: "Portale Giuridico",
      titolo: "Articolo Dottrinale",
    } as unknown as Source;

    const messages: Message[] = [
      createMockMessage({ id: "m1", role: "model", content: "Dettaglio", sources: [webSource] }),
    ];

    render(
      <SourcesSection
        messages={messages}
        activeSourceId={null}
        setActiveSourceId={mockSetActiveSourceId}
      />
    );

    expect(screen.getByText("Portale Giuridico")).toBeInTheDocument();

    const sourceCard = screen.getByRole("button");
    fireEvent.click(sourceCard);

    expect(window.open).toHaveBeenCalledWith("https://example.com/fonte-web", "_blank");
  });

  test("copre tutti i rami di visualizzazione per fonti giurisprudenziali e calcolo punteggio da _matchCount", () => {
    const sources: Source[] = [
      {
        numero_sentenza: "12345/2026",
        organo_giudicante: "Cass. Civ. Sez. III",
        _matchCount: 4,
      } as unknown as Source,
      {
        numero_sentenza: "9988",
        _type: "documento_interno",
      } as unknown as Source,
      {
        _id_interno: "custom-id-99",
        titolo: "Principio di Diritto Applicato",
      } as unknown as Source,
      {
        titolo: "Fonte Generica",
      } as unknown as Source,
    ];

    const messages: Message[] = [
      createMockMessage({ id: "m1", role: "model", content: "Dati giurisprudenziali", sources }),
    ];

    render(<SourcesSection {...defaultProps} messages={messages} />);

    expect(screen.getByText("Cass. Civ. Sez. III: n. 12345/2026")).toBeInTheDocument();
    expect(screen.getByText("Sentenza n. 12345/2026")).toBeInTheDocument();
    expect(screen.getByText("48% match")).toBeInTheDocument();

    expect(screen.getByText("Sent. n. 9988")).toBeInTheDocument();
    expect(screen.getByText("Sentenza n. 9988")).toBeInTheDocument();

    expect(screen.getAllByText("85% match")).toHaveLength(3);
  });

  test("limita il calcolo dello score da _matchCount al tetto massimo del 98%", () => {
    const sourceHighMatch: Source = {
      documento_id: "doc-high-match",
      identificativo: "Cass. Pen.",
      title: "Sentenza ad altissima rilevanza",
      _matchCount: 15,
    } as unknown as Source;

    const messages: Message[] = [
      createMockMessage({ id: "m1", role: "model", content: "High match", sources: [sourceHighMatch] }),
    ];

    render(<SourcesSection {...defaultProps} messages={messages} />);

    expect(screen.getByText("98% match")).toBeInTheDocument();
  });

  describe("Accessibilità (SonarQube A11y)", () => {
    test("simula click tramite tastiera (Enter) attivando onSourceClick", () => {
      const source: Source = {
        documento_id: "doc-keyboard-1",
        identificativo: "Cass. Sez. Lav.",
        title: "Test Tastiera",
      } as unknown as Source;
      
      const messages: Message[] = [
        createMockMessage({ id: "m1", role: "model", content: "Test", sources: [source] }),
      ];

      render(<SourcesSection {...defaultProps} messages={messages} />);

      const sourceCard = screen.getByRole("button");
      
      // Simuliamo la pressione del tasto Enter
      fireEvent.keyDown(sourceCard, { key: "Enter" });

      expect(mockOnSourceClick).toHaveBeenCalledTimes(1);
      expect(mockOnSourceClick).toHaveBeenCalledWith(expect.anything(), source);
    });

    test("simula click tramite tastiera (Spazio) aprendo la fonte web quando onSourceClick non è fornito", () => {
      const webSource: Source = {
        _type: "web_search",
        link: "https://example.com/test-tastiera",
        fonte: "Portale",
        titolo: "Test Accessibilità Web",
      } as unknown as Source;
      
      const messages: Message[] = [
        createMockMessage({ id: "m1", role: "model", content: "Test", sources: [webSource] }),
      ];

      render(
        <SourcesSection
          messages={messages}
          activeSourceId={null}
          setActiveSourceId={mockSetActiveSourceId}
          // Non passiamo onSourceClick per testare il fallback
        />
      );

      const sourceCard = screen.getByRole("button");
      
      // Simuliamo la pressione del tasto Spazio
      fireEvent.keyDown(sourceCard, { key: " " });

      expect(window.open).toHaveBeenCalledWith("https://example.com/test-tastiera", "_blank");
    });

    test("ignora i tasti diversi da Enter o Spazio e non scatena navigazioni o eventi", () => {
      const source: Source = {
        documento_id: "doc-keyboard-2",
        title: "Test Tasti Errati",
      } as unknown as Source;
      
      const messages: Message[] = [
        createMockMessage({ id: "m1", role: "model", content: "Test", sources: [source] }),
      ];

      render(<SourcesSection {...defaultProps} messages={messages} />);

      const sourceCard = screen.getByRole("button");
      
      // Simuliamo tasti che non dovrebbero fare nulla
      fireEvent.keyDown(sourceCard, { key: "Tab" });
      fireEvent.keyDown(sourceCard, { key: "ArrowDown" });
      fireEvent.keyDown(sourceCard, { key: "Escape" });

      expect(mockOnSourceClick).not.toHaveBeenCalled();
      expect(window.open).not.toHaveBeenCalled();
    });
  });
});