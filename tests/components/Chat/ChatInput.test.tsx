import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React, { createRef } from "react";

/* ---------- mock lucide-react ---------- */
vi.mock("lucide-react", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid={`icon-${name}`} {...props} />
  );
  return {
    FileText: Icon("file-text"),
    X: Icon("x"),
    Sliders: Icon("sliders"),
    Paperclip: Icon("paperclip"),
    Loader2: Icon("loader-2"),
    Send: Icon("send"),
    Mic: Icon("mic"),
    AlertCircle: Icon("alert-circle"),
    Lock: Icon("lock"),
  };
});

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", async () => {
  return {
    motion: {
      div: ({
        children,
        ...props
      }: React.HTMLAttributes<HTMLDivElement> & { [key: string]: unknown }) => (
        <div {...props}>{children}</div>
      ),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

/* ---------- SpeechRecognition Class Mock ---------- */
class MockSpeechRecognition {
  static instance: MockSpeechRecognition | null = null;

  continuous = false;
  interimResults = false;
  lang = "";
  onresult: ((event: { results: { transcript: string }[][] }) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();

  constructor() {
    MockSpeechRecognition.instance = this;
  }
}

/* ---------- component ---------- */
import { ChatInput } from "@/components/Chat/ChatInput"; // <-- adegua il path se necessario
import type { AttachedDocument } from "@/interfaces/interfaces";

describe("ChatInput", () => {
  const mockSetInputValue = vi.fn();
  const mockHandleSendMessage = vi.fn();
  const mockRemoveAttachment = vi.fn();
  const mockClearAllAttachments = vi.fn();
  const mockSetViewMode = vi.fn();
  const mockRemoveQuote = vi.fn();
  const mockSetShowFilters = vi.fn();
  const mockSetShowDocsModal = vi.fn();
  const mockTextAreaRef = createRef<HTMLTextAreaElement>();

  let originalSpeechRecognition: unknown;
  let originalWebkitSpeechRecognition: unknown;
  let originalInnerWidth: number;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    originalInnerWidth = window.innerWidth;
    window.innerWidth = 1024; // Desktop default

    originalSpeechRecognition = (window as unknown as Record<string, unknown>).SpeechRecognition;
    originalWebkitSpeechRecognition = (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

    MockSpeechRecognition.instance = null;
    (window as unknown as Record<string, unknown>).SpeechRecognition = MockSpeechRecognition;
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = MockSpeechRecognition;

    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(window, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    window.innerWidth = originalInnerWidth;
    (window as unknown as Record<string, unknown>).SpeechRecognition = originalSpeechRecognition;
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = originalWebkitSpeechRecognition;
  });

  const defaultProps = {
    inputValue: "",
    setInputValue: mockSetInputValue,
    handleSendMessage: mockHandleSendMessage,
    attachedDocs: [] as AttachedDocument[],
    removeAttachment: mockRemoveAttachment,
    clearAllAttachments: mockClearAllAttachments,
    setViewMode: mockSetViewMode,
    viewMode: "chat" as const,
    activeQuote: [] as string[],
    removeQuote: mockRemoveQuote,
    setShowFilters: mockSetShowFilters,
    activeFiltersCount: 0,
    setShowDocsModal: mockSetShowDocsModal,
    isProcessingFiles: false,
    isStreaming: false,
    textAreaRef: mockTextAreaRef,
    isReadOnly: false,
  };

  test("renderizza textarea, filtri, allegati e invia messaggio", () => {
    render(<ChatInput {...defaultProps} inputValue="Come redigere un ricorso?" />);

    const textarea = screen.getByPlaceholderText("Inserisci il tuo quesito giuridico...");
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue("Come redigere un ricorso?");

    // Digitazione
    fireEvent.change(textarea, { target: { value: "Nuovo testo" } });
    expect(mockSetInputValue).toHaveBeenCalledWith("Nuovo testo");

    // Click su tasto invio
    const sendBtn = screen.getByTestId("icon-send").closest("button")!;
    fireEvent.click(sendBtn);
    expect(mockHandleSendMessage).toHaveBeenCalledTimes(1);

    // Invio con tasto Enter (Desktop)
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(mockHandleSendMessage).toHaveBeenCalledTimes(2);

    // Enter con Shift non invia
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(mockHandleSendMessage).toHaveBeenCalledTimes(2);

    // Altro tasto non invia
    fireEvent.keyDown(textarea, { key: "Tab" });
    expect(mockHandleSendMessage).toHaveBeenCalledTimes(2);
  });

  test("gestisce onKeyDown su viewport mobile (innerWidth < 768)", () => {
    window.innerWidth = 500;
    render(<ChatInput {...defaultProps} inputValue="Messaggio mobile" />);

    const textarea = screen.getByPlaceholderText("Inserisci il tuo quesito giuridico...");
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    // Su mobile la pressione di Enter non invia automaticamente
    expect(mockHandleSendMessage).not.toHaveBeenCalled();
  });

  test("gestisce stati speciali del placeholder e rendering alternativo (workspace, processing, streaming, readOnly)", () => {
    // 1. Modalità workspace
    const { rerender } = render(<ChatInput {...defaultProps} viewMode="workspace" />);
    expect(screen.getByPlaceholderText("Fai una domanda sul documento analizzato...")).toBeInTheDocument();

    // 2. Elaborazione file in corso
    rerender(<ChatInput {...defaultProps} isProcessingFiles={true} />);
    expect(screen.getByPlaceholderText("Elaborazione in corso...")).toBeInTheDocument();
    expect(screen.getByTestId("icon-loader-2")).toBeInTheDocument();

    // 3. Generazione streaming in corso
    rerender(<ChatInput {...defaultProps} isStreaming={true} />);
    expect(screen.getByPlaceholderText("Generazione risposta in corso...")).toBeInTheDocument();

    // 4. Modalità sola lettura
    rerender(<ChatInput {...defaultProps} isReadOnly={true} />);
    expect(screen.getByPlaceholderText("Fascicolo in sola lettura (non sei il proprietario)")).toBeInTheDocument();
    expect(screen.getByText("Sola lettura")).toBeInTheDocument();
    expect(screen.getByTestId("icon-lock")).toBeInTheDocument();
  });

  test("gestisce i pulsanti laterali Filtri (con indicatore attivo) e Paperclip", () => {
    const { rerender } = render(<ChatInput {...defaultProps} activeFiltersCount={0} />);

    // Click Paperclip (modal documenti)
    const paperclipBtn = screen.getByTestId("icon-paperclip").closest("button")!;
    fireEvent.click(paperclipBtn);
    expect(mockSetShowDocsModal).toHaveBeenCalledWith(true);

    // Click Filtri (senza filtri attivi)
    const filtersBtn = screen.getByTestId("icon-sliders").closest("button")!;
    fireEvent.click(filtersBtn);
    expect(mockSetShowFilters).toHaveBeenCalledWith(true);

    // Filtri con conteggio attivo > 0 (stile e ping indicator)
    rerender(<ChatInput {...defaultProps} activeFiltersCount={3} />);
    const activeFiltersBtn = screen.getByTestId("icon-sliders").closest("button")!;
    expect(activeFiltersBtn).toHaveClass("bg-(--color-text)");
  });

  test("gestisce la lista documenti allegati e relative azioni (inclusa accessibilità tastiera)", () => {
    const attachedDocs: AttachedDocument[] = [
      { id: "doc-1", name: "contratto.pdf" } as AttachedDocument,
      { id: "doc-2", name: "sentenza.docx" } as AttachedDocument,
    ];

    render(<ChatInput {...defaultProps} attachedDocs={attachedDocs} />);

    const doc1 = screen.getByText("contratto.pdf");
    expect(doc1).toBeInTheDocument();
    expect(screen.getByText("sentenza.docx")).toBeInTheDocument();

    const doc1Container = doc1.closest('span[role="button"]')!;

    // 1. Click del mouse sull'allegato per passare alla modalità studio/workspace
    fireEvent.click(doc1Container);
    expect(mockSetViewMode).toHaveBeenCalledWith("workspace");

    mockSetViewMode.mockClear();

    // 2. Navigazione da tastiera: Pressione del tasto Enter (Risoluzione SonarQube)
    fireEvent.keyDown(doc1Container, { key: "Enter" });
    expect(mockSetViewMode).toHaveBeenCalledWith("workspace");

    mockSetViewMode.mockClear();

    // 3. Navigazione da tastiera: Pressione del tasto Spazio (Risoluzione SonarQube)
    fireEvent.keyDown(doc1Container, { key: " " });
    expect(mockSetViewMode).toHaveBeenCalledWith("workspace");

    // 4. Rimozione del singolo allegato tramite la "X"
    const removeBtns = screen.getAllByTestId("icon-x");
    fireEvent.click(removeBtns[0].closest("button")!);
    expect(mockRemoveAttachment).toHaveBeenCalledWith("doc-1");

    // 5. Click su "Rimuovi tutti"
    const clearAllBtn = screen.getByRole("button", { name: "Rimuovi tutti" });
    fireEvent.click(clearAllBtn);
    expect(mockClearAllAttachments).toHaveBeenCalledTimes(1);
  });

  test("gestisce la lista delle citazioni attive e relativa rimozione", () => {
    const activeQuote = ["Massima rilevante 2026", "Principio di diritto espresso"];

    render(<ChatInput {...defaultProps} activeQuote={activeQuote} />);

    expect(screen.getByText('"Massima rilevante 2026"')).toBeInTheDocument();
    expect(screen.getByText('"Principio di diritto espresso"')).toBeInTheDocument();

    const quoteRemoveBtns = screen.getAllByTestId("icon-x");
    fireEvent.click(quoteRemoveBtns[0].closest("button")!);
    expect(mockRemoveQuote).toHaveBeenCalledWith(0);
  });

  test("mostra alert quando il browser non supporta il riconoscimento vocale", () => {
    delete (window as unknown as Record<string, unknown>).SpeechRecognition;
    delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

    render(<ChatInput {...defaultProps} />);

    const micBtn = screen.getByTitle(/Dettatura vocale/i);
    fireEvent.click(micBtn);

    expect(window.alert).toHaveBeenCalledWith(
      "Il tuo browser non supporta il riconoscimento vocale nativo."
    );
  });

  test("gestisce il ciclo di registrazione vocale: avvio, interruzione manuale, errore ed end", () => {
    render(<ChatInput {...defaultProps} />);

    const micBtn = screen.getByTitle(/Dettatura vocale/i);

    // 1. Avvia registrazione
    fireEvent.click(micBtn);
    expect(MockSpeechRecognition.instance!.start).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Ascolto in corso...")).toBeInTheDocument();

    // 2. Ferma registrazione cliccando nuovamente
    fireEvent.click(micBtn);
    expect(MockSpeechRecognition.instance!.stop).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Ascolto in corso...")).not.toBeInTheDocument();

    // 3. Simula evento onerror
    fireEvent.click(micBtn); // Riavvia
    expect(screen.getByText("Ascolto in corso...")).toBeInTheDocument();
    act(() => {
      MockSpeechRecognition.instance!.onerror!({ error: "audio-capture" });
    });
    expect(console.error).toHaveBeenCalledWith("Errore riconoscimento vocale:", "audio-capture");
    expect(screen.queryByText("Ascolto in corso...")).not.toBeInTheDocument();

    // 4. Simula evento onend
    fireEvent.click(micBtn);
    act(() => {
      MockSpeechRecognition.instance!.onend!();
    });
    expect(screen.queryByText("Ascolto in corso...")).not.toBeInTheDocument();

    // 5. Simula eccezione lanciata da start()
    MockSpeechRecognition.instance!.start = vi.fn().mockImplementation(() => {
      throw new Error("Device busy");
    });
    fireEvent.click(micBtn);
    expect(console.error).toHaveBeenCalledWith(
      "Microfono già in uso o errore di avvio",
      expect.any(Error)
    );
  });

  test("gestisce il risultato vocale: trascrizione su input vuoto e trigger di invio rapido", () => {
    const { rerender } = render(<ChatInput {...defaultProps} inputValue="" />);

    // 1. Trascrizione testuale standard
    act(() => {
      MockSpeechRecognition.instance!.onresult!({
        results: [[{ transcript: "  quesito legale sulla prelazione agraria  " }]],
      });
    });
    expect(mockSetInputValue).toHaveBeenCalledWith("quesito legale sulla prelazione agraria");

    // 2. Trigger ("invia") su input vuoto -> ignorato
    mockSetInputValue.mockClear();
    act(() => {
      MockSpeechRecognition.instance!.onresult!({
        results: [[{ transcript: "invia!" }]],
      });
    });
    expect(mockSetInputValue).not.toHaveBeenCalled();
    expect(mockHandleSendMessage).not.toHaveBeenCalled();

    // 3. Trigger ("manda") con input già valorizzato -> invio immediato
    rerender(<ChatInput {...defaultProps} inputValue="Testo digitato in precedenza" />);
    act(() => {
      MockSpeechRecognition.instance!.onresult!({
        results: [[{ transcript: "  manda  " }]],
      });
    });
    expect(mockHandleSendMessage).toHaveBeenCalledTimes(1);
  });

  test("gestisce la risoluzione dei conflitti vocali (sostituisci, aggiungi, annulla)", () => {
    const { rerender } = render(<ChatInput {...defaultProps} inputValue="Prima parte." />);

    // Risultato vocale senza trigger con testo già presente -> apertura pannello di conflitto
    act(() => {
      MockSpeechRecognition.instance!.onresult!({
        results: [[{ transcript: "Seconda parte dettata" }]],
      });
    });

    expect(screen.getByText('Hai detto: "Seconda parte dettata"')).toBeInTheDocument();

    // Azione 1: Aggiungi
    const appendBtn = screen.getByRole("button", { name: "Aggiungi" });
    fireEvent.click(appendBtn);
    expect(mockSetInputValue).toHaveBeenCalledWith("Prima parte. Seconda parte dettata");
    expect(screen.queryByText(/Hai detto:/i)).not.toBeInTheDocument();

    // Azione 2: Sostituisci (con trigger invio post-timeout)
    act(() => {
      MockSpeechRecognition.instance!.onresult!({
        results: [[{ transcript: "Testo sostitutivo" }]],
      });
    });
    const replaceBtn = screen.getByRole("button", { name: "Sostituisci" });
    fireEvent.click(replaceBtn);
    expect(mockSetInputValue).toHaveBeenCalledWith("Testo sostitutivo");

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(mockHandleSendMessage).toHaveBeenCalledTimes(1);

    // Azione 3: Annulla conflitto
    act(() => {
      MockSpeechRecognition.instance!.onresult!({
        results: [[{ transcript: "Dettato da scartare" }]],
      });
    });
    const cancelConflictBtn = screen
      .getByTestId("icon-alert-circle")
      .closest("div")!
      .parentElement!.querySelector("button:last-child")!;
    fireEvent.click(cancelConflictBtn);
    expect(screen.queryByText(/Hai detto:/i)).not.toBeInTheDocument();

    // Copertura branch append quando inputValue è vuoto
    rerender(<ChatInput {...defaultProps} inputValue="" />);
    act(() => {
      MockSpeechRecognition.instance!.onresult!({
        results: [[{ transcript: "Testo append vuoto" }]],
      });
    });
  });

  test("modalità isReadOnly: disabilita comandi vocali, blocca azioni e nasconde pulsanti", () => {
    render(<ChatInput {...defaultProps} isReadOnly={true} inputValue="Fascicolo bloccato" />);

    // Trigger vocale ignorato in read-only
    act(() => {
      MockSpeechRecognition.instance!.onresult!({
        results: [[{ transcript: "invia" }]],
      });
    });
    expect(mockHandleSendMessage).not.toHaveBeenCalled();

    // Nessun pulsante microfono renderizzato
    expect(screen.queryByTitle(/Dettatura vocale/i)).not.toBeInTheDocument();
  });
});