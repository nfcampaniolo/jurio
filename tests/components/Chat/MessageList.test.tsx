import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React, { createRef } from "react";

/* ---------- mock lucide-react ---------- */
vi.mock("lucide-react", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid={`icon-${name}`} {...props} />
  );
  return {
    Scale: Icon("scale"),
    Globe: Icon("globe"),
    BookOpen: Icon("book-open"),
  };
});

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", async () => ({
  motion: {
    div: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & { [key: string]: unknown }) => (
      <div {...props}>{children}</div>
    ),
  },
}));

/* ---------- mock Typewriter ---------- */
vi.mock("@/components/Typewriter", () => ({
  Typewriter: ({ text, animate }: { text: string; animate: boolean }) => (
    <div data-testid="typewriter" data-animate={animate ? "true" : "false"}>
      {text}
    </div>
  ),
}));

/* ---------- mock FeedbackComponent ---------- */
vi.mock("@/components/FeedbackComponent", () => ({
  FeedbackComponent: ({ sourceIds }: { sourceIds: string[] }) => (
    <div data-testid="feedback-component" data-source-ids={sourceIds.join(",")}>
      Feedback Mock
    </div>
  ),
}));

/* ---------- component ---------- */
import { MessageList } from "@/components/Chat/MessageList";
import type { Message, Source } from "@/interfaces/interfaces";

describe("MessageList", () => {
  const mockSetActiveSourceId = vi.fn();
  const mockHandleSourceClick = vi.fn();
  const mockMessagesEndRef = createRef<HTMLDivElement>();

  const defaultProps = {
    messages: [] as Message[],
    isStreaming: false,
    agentStatusText: "",
    messagesEndRef: mockMessagesEndRef,
    activeSourceId: null as string | null,
    setActiveSourceId: mockSetActiveSourceId,
    handleSourceClick: mockHandleSourceClick,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza stato vuoto quando non sono presenti messaggi", () => {
    render(<MessageList {...defaultProps} messages={[]} />);

    expect(screen.getByTestId("icon-scale")).toBeInTheDocument();
    expect(
      screen.getByText("Inizia descrivendo la fattispecie o ponendo una domanda giuridica.")
    ).toBeInTheDocument();
  });

  test("renderizza messaggi utente e modello con Typewriter e Feedback", () => {
    const messages: Message[] = [
      {
        id: "msg-user-1",
        role: "user",
        content: "Quesito sul contratto di locazione ad uso commerciale.",
      } as Message,
      {
        id: "msg-model-1",
        role: "model",
        content: "La disciplina dell'art. 27 L. 392/1978 prevede una durata minima di 6 anni.",
        isHistorical: false,
      } as Message,
    ];

    render(<MessageList {...defaultProps} messages={messages} />);

    // Messaggio utente
    expect(
      screen.getByText("Quesito sul contratto di locazione ad uso commerciale.")
    ).toBeInTheDocument();

    // Messaggio modello con Typewriter (ultimo messaggio -> animate = true)
    const typewriter = screen.getByTestId("typewriter");
    expect(typewriter).toBeInTheDocument();
    expect(typewriter).toHaveAttribute("data-animate", "true");
    expect(
      screen.getByText("La disciplina dell'art. 27 L. 392/1978 prevede una durata minima di 6 anni.")
    ).toBeInTheDocument();

    // Sezione feedback
    expect(screen.getByText("Valuta questa risposta")).toBeInTheDocument();
    expect(screen.getByTestId("feedback-component")).toBeInTheDocument();
  });

  test("renderizza lo stato di streaming per il modello senza contenuto", () => {
    const streamingMessage: Message = {
      id: "msg-stream-1",
      role: "model",
      content: "",
    } as Message;

    // 1. Con agentStatusText personalizzato
    const { rerender } = render(
      <MessageList
        {...defaultProps}
        messages={[streamingMessage]}
        isStreaming={true}
        agentStatusText="Ricerca giurisprudenza in corso..."
      />
    );

    expect(screen.getByText("Ricerca giurisprudenza in corso...")).toBeInTheDocument();
    expect(screen.queryByTestId("typewriter")).not.toBeInTheDocument();

    // 2. Fallback su "Elaborazione in corso..." se agentStatusText è vuoto
    rerender(
      <MessageList
        {...defaultProps}
        messages={[streamingMessage]}
        isStreaming={true}
        agentStatusText=""
      />
    );

    expect(screen.getByText("Elaborazione in corso...")).toBeInTheDocument();
  });

  test("disabilita animazione Typewriter per messaggi storici o non ultimi", () => {
    const messages: Message[] = [
      {
        id: "msg-model-historical",
        role: "model",
        content: "Risposta storica caricata.",
        isHistorical: true,
      } as Message,
      {
        id: "msg-user-2",
        role: "user",
        content: "Altra domanda successiva.",
      } as Message,
    ];

    render(<MessageList {...defaultProps} messages={messages} />);

    // Il messaggio storico del modello non è l'ultimo ed è marcato isHistorical -> data-animate="false"
    const typewriter = screen.getByTestId("typewriter");
    expect(typewriter).toHaveAttribute("data-animate", "false");
  });

  test("renderizza fonti web e giurisprudenziali gestendo click, hover e stato attivo", () => {
    const sources: Source[] = [
      {
        _type: "web_search",
        fonte_web: "Normattiva",
        url_riferimento: "https://www.normattiva.it",
      } as Source,
      {
        documento_id: "doc-cass-1",
        organo_giudicante: "Cass. Civ.",
        identificativo: "Ordinanza 1024/2026",
      } as Source,
    ];

    const modelMessage: Message = {
      id: "msg-with-sources",
      role: "model",
      content: "Risposta supportata da riferimenti.",
      sources,
    } as Message;

    render(
      <MessageList
        {...defaultProps}
        messages={[modelMessage]}
        activeSourceId="https://www.normattiva.it"
      />
    );

    // Fonti renderizzate
    expect(screen.getByText("Normattiva")).toBeInTheDocument();
    expect(screen.getByTestId("icon-globe")).toBeInTheDocument();

    expect(screen.getByText("Cass. Civ.: Ordinanza 1024/2026")).toBeInTheDocument();
    expect(screen.getByTestId("icon-book-open")).toBeInTheDocument();

    // Verifica Feedback con sourceIds corretti
    const feedback = screen.getByTestId("feedback-component");
    expect(feedback).toHaveAttribute("data-source-ids", "https://www.normattiva.it,doc-cass-1");

    // Click sulla prima fonte
    const webSourceBtn = screen.getByRole("button", { name: /Normattiva/i });
    fireEvent.click(webSourceBtn);
    expect(mockHandleSourceClick).toHaveBeenCalledWith(expect.anything(), sources[0]);

    // Hover mouse enter ed exit
    fireEvent.mouseEnter(webSourceBtn);
    expect(mockSetActiveSourceId).toHaveBeenCalledWith("https://www.normattiva.it");

    fireEvent.mouseLeave(webSourceBtn);
    expect(mockSetActiveSourceId).toHaveBeenCalledWith(null);
  });

  test("copre tutti i rami di fallback per titoli e identificatori delle fonti", () => {
    const fallbackSources: Source[] = [
      // Web search con solo 'fonte'
      { _type: "web_search", fonte: "Altalex", _id_interno: "id-altalex" } as Source,
      // Web search senza fonte specifica -> 'Web'
      { _type: "web_search", link: "https://example.com" } as Source,
      // Giurisprudenza con solo numero_sentenza senza organo
      { documento_id: "doc-sent-only", numero_sentenza: "5544/2025" } as Source,
      // Giurisprudenza con organo_giudicante e numero_sentenza
      { documento_id: "doc-sent-organo", organo_giudicante: "CdS", numero_sentenza: "123" } as Source,
      // Giurisprudenza senza identificativo né numero
      { documento_id: "doc-empty-title" } as Source,
    ];

    const message: Message = {
      id: "msg-fallbacks",
      role: "model",
      content: "Contenuto con fonti fallback.",
      sources: fallbackSources,
    } as Message;

    render(<MessageList {...defaultProps} messages={[message]} />);

    expect(screen.getByText("Altalex")).toBeInTheDocument();
    expect(screen.getByText("Web")).toBeInTheDocument();
    expect(screen.getByText("Sent. n. 5544/2025")).toBeInTheDocument();
    expect(screen.getByText("CdS: n. 123")).toBeInTheDocument();
  });
});