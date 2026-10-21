import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import type { ChatMessage, SourceItem } from "@/features/chat/hooks/chatLogic";

/* ---------- tipi mock hook ---------- */
interface MockHookState {
  isOpen: boolean;
  setIsOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  messages: ChatMessage[];
  inputValue: string;
  setInputValue: (val: string) => void;
  isLoading: boolean;
  currentStatus: string | null;
  error: string | null;
  handleSend: () => void;
  clearChat: () => void;
}

/* ---------- hoisted mocks ---------- */
const mockHookState = vi.hoisted<MockHookState>(() => ({
  isOpen: false,
  setIsOpen: vi.fn(),
  messages: [],
  inputValue: "",
  setInputValue: vi.fn(),
  isLoading: false,
  currentStatus: null,
  error: null,
  handleSend: vi.fn(),
  clearChat: vi.fn(),
}));

/* ---------- mock useJurioChatbot ---------- */
vi.mock("@/features/info/hooks/useJurioChatbot", () => ({
  useJurioChatbot: () => mockHookState,
}));

/* ---------- mock lucide-react ---------- */
vi.mock("lucide-react", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid={`icon-${name}`} {...props} />
  );
  return {
    MessageSquare: Icon("message-square"),
    X: Icon("x"),
    RefreshCcw: Icon("refresh-ccw"),
    Send: Icon("send"),
    User: Icon("user"),
    Loader2: Icon("loader-2"),
    ExternalLink: Icon("external-link"),
    BookOpen: Icon("book-open"),
    Globe: Icon("globe"),
    Scale: Icon("scale"),
  };
});

/* ---------- mock react-markdown ---------- */
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="markdown-content">{children}</div>
  ),
}));

/* ---------- mock Typewriter ---------- */
vi.mock("@/shared/components/Typewriter", () => ({
  Typewriter: ({ text, animate }: { text: string; speed?: number; animate?: boolean }) => (
    <div data-testid="typewriter-content" data-animate={String(animate)}>{text}</div>
  ),
}));

/* ---------- component ---------- */
import JurioChatbot from "@/features/info/components/JurioChatbot"; // <-- adegua il path se necessario

describe("JurioChatbot Component Suite", () => {
  const scrollIntoViewMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = "";
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    mockHookState.isOpen = false;
    mockHookState.messages = [];
    mockHookState.inputValue = "";
    mockHookState.isLoading = false;
    mockHookState.currentStatus = null;
    mockHookState.error = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("renderizza il pulsante floating e nasconde il widget quando isOpen è false", () => {
    mockHookState.isOpen = false;

    render(<JurioChatbot />);

    const floatingBtn = screen.getByRole("button", { name: "Apri chat di supporto" });
    expect(floatingBtn).toBeInTheDocument();
    expect(floatingBtn).toHaveClass("opacity-100");
    expect(screen.getByTestId("icon-message-square")).toBeInTheDocument();

    expect(screen.queryByRole("heading", { name: "Jurio", level: 3 })).not.toBeInTheDocument();
  });

  test("apre il widget, mostra l'header e gestisce le azioni di chiusura e reset della chat", () => {
    mockHookState.isOpen = true;

    render(<JurioChatbot />);

    expect(screen.getByRole("heading", { name: "Jurio", level: 3 })).toBeInTheDocument();
    expect(screen.getByText("Support Agent")).toBeInTheDocument();

    const clearBtn = screen.getByTitle("Svuota chat");
    fireEvent.click(clearBtn);
    expect(mockHookState.clearChat).toHaveBeenCalledTimes(1);

    const closeBtn = screen.getByTitle("Chiudi");
    fireEvent.click(closeBtn);
    expect(mockHookState.setIsOpen).toHaveBeenCalledWith(false);
  });

  test("gestisce il toggle tramite il pulsante floating", () => {
    mockHookState.isOpen = false;

    render(<JurioChatbot />);

    const floatingBtn = screen.getByRole("button", { name: "Apri chat di supporto" });
    fireEvent.click(floatingBtn);

    expect(mockHookState.setIsOpen).toHaveBeenCalledWith(true);
  });

  test("gestisce la digitazione, l'invio con tasto Enter e previene l'invio su Shift+Enter", () => {
    mockHookState.isOpen = true;
    mockHookState.inputValue = "Qual è il principio espresso dalle Sezioni Unite?";

    render(<JurioChatbot />);

    const textarea = screen.getByPlaceholderText("Scrivi un quesito giuridico...");
    expect(textarea).toHaveValue("Qual è il principio espresso dalle Sezioni Unite?");

    fireEvent.change(textarea, { target: { value: "Nuova query" } });
    expect(mockHookState.setInputValue).toHaveBeenCalledWith("Nuova query");

    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(mockHookState.handleSend).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(mockHookState.handleSend).toHaveBeenCalledTimes(1);

    const sendBtn = screen.getByRole("button", { name: "Invia messaggio" });
    expect(sendBtn).not.toBeDisabled();
    fireEvent.click(sendBtn);
    expect(mockHookState.handleSend).toHaveBeenCalledTimes(2);
  });

  test("disabilita il pulsante di invio quando l'input è vuoto o è in corso il caricamento", () => {
    mockHookState.isOpen = true;
    mockHookState.inputValue = "   ";
    mockHookState.isLoading = false;

    const { rerender } = render(<JurioChatbot />);

    const sendBtn = screen.getByRole("button", { name: "Invia messaggio" });
    expect(sendBtn).toBeDisabled();

    mockHookState.inputValue = "Testo valido";
    mockHookState.isLoading = true;
    rerender(<JurioChatbot />);

    expect(sendBtn).toBeDisabled();
    expect(screen.getByPlaceholderText("Scrivi un quesito giuridico...")).toBeDisabled();
  });

  test("renderizza i messaggi utente e assistente, applicando Typewriter sull'ultimo messaggio assistente", () => {
    mockHookState.isOpen = true;
    mockHookState.isLoading = false;
    mockHookState.messages = [
      {
        role: "user",
        content: "Spiegami la sentenza 500/1999.",
      } as ChatMessage,
      {
        role: "assistant",
        content: "La sentenza n. 500/1999 ha sancito la risarcibilità dell'interesse legittimo.",
      } as ChatMessage,
      {
        role: "user",
        content: "Quali sono le conseguenze pratiche?",
      } as ChatMessage,
      {
        role: "assistant",
        content: "Le conseguenze riguardano la tutela risarcitoria innanzi al giudice ordinario e amministrativo.",
      } as ChatMessage,
    ];

    render(<JurioChatbot />);

    expect(screen.getByText("Spiegami la sentenza 500/1999.")).toBeInTheDocument();
    expect(screen.getByText("Quali sono le conseguenze pratiche?")).toBeInTheDocument();
    expect(screen.getAllByTestId("typewriter-content")).toHaveLength(2);
    expect(screen.getAllByTestId("typewriter-content")[1]).toHaveTextContent(
      "Le conseguenze riguardano la tutela risarcitoria innanzi al giudice ordinario e amministrativo."
    );
    expect(screen.getAllByTestId("typewriter-content")[1]).toHaveAttribute("data-animate", "false");
  });

  test("renderizza e deduplica i link delle fonti per i messaggi dell'assistente", () => {
    mockHookState.isOpen = true;
    const sourcesMock: SourceItem[] = [
      {
        id: "source-1",
        text: "Sentenza Cassazione Civile n. 500/1999",
        links: ["https://giustizia-amministrativa.it/doc1", "https://corte-costituzionale.it/doc2"],
        _type: "jurisprudence",
      },
      {
        id: "source-2",
        text: "Sentenza Consiglio di Stato n. 120/2021",
        links: ["https://giustizia-amministrativa.it/doc1"], // Duplicato per verificare la deduplicazione Set
        _type: "jurisprudence",
      },
    ];

    mockHookState.messages = [
      {
        role: "assistant",
        content: "Ecco i riferimenti normativi.",
        sources: sourcesMock,
      } as ChatMessage,
    ];

    render(<JurioChatbot />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "https://giustizia-amministrativa.it/doc1");
    expect(links[0]).toHaveAttribute("target", "_blank");
    expect(links[0]).toHaveAttribute("rel", "noopener noreferrer");
    expect(links[1]).toHaveAttribute("href", "https://corte-costituzionale.it/doc2");

    expect(screen.getAllByTestId("icon-external-link")).toHaveLength(2);
  });

  test("mostra lo stato del caricamento e il banner di errore", () => {
    mockHookState.isOpen = true;
    mockHookState.messages = [{ role: "assistant", content: "Benvenuto" }];
    mockHookState.isLoading = true;
    mockHookState.currentStatus = "Analisi massime in corso...";
    mockHookState.error = "Si è verificato un errore durante la generazione della risposta.";

    render(<JurioChatbot />);

    expect(screen.getByText("Analisi massime in corso...")).toBeInTheDocument();
    expect(document.querySelectorAll(".animate-bounce")).toHaveLength(3);

    expect(
      screen.getByText("Si è verificato un errore durante la generazione della risposta.")
    ).toBeInTheDocument();
  });

  test("mostra subito il testo parziale ricevuto mentre l'assistente sta ancora generando", () => {
    mockHookState.isOpen = true;
    mockHookState.isLoading = true;
    mockHookState.messages = [
      { role: "user", content: "Domanda" },
      { role: "assistant", content: "Jurio è l'assistente legale virtuale basato su int" },
    ];

    render(<JurioChatbot />);

    expect(screen.getByText(
      "Jurio è l'assistente legale virtuale basato su int"
    )).toBeInTheDocument();
  });

  test("mostra il messaggio di fallback se currentStatus è assente durante il caricamento", () => {
    mockHookState.isOpen = true;
    mockHookState.isLoading = true;
    mockHookState.currentStatus = null;
    mockHookState.messages = [{ role: "user", content: "Test" }];

    render(<JurioChatbot />);

    expect(screen.getByText("Consultazione archivi in corso...")).toBeInTheDocument();
  });

  test("sincronizza l'hash dell'URL (#bot) all'avvio, all'apertura e su evento hashchange", () => {
    const pushStateSpy = vi.spyOn(window.history, "pushState");

    window.location.hash = "#bot";
    render(<JurioChatbot />);
    expect(mockHookState.setIsOpen).toHaveBeenCalledWith(true);

    mockHookState.isOpen = true;
    window.location.hash = "";
    render(<JurioChatbot />);
    expect(pushStateSpy).toHaveBeenCalledWith(null, "", "#bot");

    window.location.hash = "#bot";
    fireEvent(window, new Event("hashchange"));
    expect(mockHookState.setIsOpen).toHaveBeenCalledWith(true);

    window.location.hash = "";
    fireEvent(window, new Event("hashchange"));
    expect(mockHookState.setIsOpen).toHaveBeenCalledWith(false);
  });

  test("esegue lo scroll automatico verso il basso all'apertura o ricezione messaggi", () => {
    mockHookState.isOpen = true;
    mockHookState.messages = [{ role: "user", content: "Test scroll" } as ChatMessage];

    render(<JurioChatbot />);

    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth" });
  });
});