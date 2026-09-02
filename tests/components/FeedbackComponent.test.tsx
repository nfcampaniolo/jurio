import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", () => ({
  __esModule: true,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
      ({ children, ...props }, ref) => (
        <div ref={ref} {...props}>
          {children}
        </div>
      )
    ),
  },
}));

/* ---------- mock lucide-react ---------- */
vi.mock("lucide-react", () => ({
  __esModule: true,
  ThumbsUp: ({ className, size }: { className?: string; size?: number }) => (
    <svg data-testid="icon-thumbs-up" className={className} width={size} height={size} />
  ),
  ThumbsDown: ({ className, size }: { className?: string; size?: number }) => (
    <svg data-testid="icon-thumbs-down" className={className} width={size} height={size} />
  ),
  X: ({ className, size }: { className?: string; size?: number }) => (
    <svg data-testid="icon-close" className={className} width={size} height={size} />
  ),
  Loader2: ({ className, size }: { className?: string; size?: number }) => (
    <svg data-testid="icon-loader" className={className} width={size} height={size} />
  ),
}));

/* ---------- mock useFeedback ---------- */
const mockSubmitFeedback = vi.fn();
const mockOpenModal = vi.fn();
const mockCloseModal = vi.fn();
const mockSetNotes = vi.fn();

let mockFeedbackState = {
  vote: null as "up" | "down" | null,
  loading: false,
  isModalOpen: false,
  notes: "",
  setNotes: mockSetNotes,
  submitFeedback: mockSubmitFeedback,
  openModal: mockOpenModal,
  closeModal: mockCloseModal,
};

vi.mock("@/hooks/useFeedback", () => ({
  __esModule: true,
  useFeedback: () => mockFeedbackState,
}));

/* ---------- component ---------- */
import { FeedbackComponent } from "@/components/FeedbackComponent"; // <-- adegua il path se necessario

describe("FeedbackComponent Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFeedbackState = {
      vote: null,
      loading: false,
      isModalOpen: false,
      notes: "",
      setNotes: mockSetNotes,
      submitFeedback: mockSubmitFeedback,
      openModal: mockOpenModal,
      closeModal: mockCloseModal,
    };
  });

  test("renderizza i pulsanti di voto positivo e negativo nello stato iniziale", () => {
    render(<FeedbackComponent sourceIds="doc-123" />);

    const upBtn = screen.getByRole("button", { name: "Valuta positivamente" });
    const downBtn = screen.getByRole("button", { name: "Valuta negativamente" });

    expect(upBtn).toBeInTheDocument();
    expect(upBtn).not.toBeDisabled();
    expect(downBtn).toBeInTheDocument();
    expect(downBtn).not.toBeDisabled();

    expect(screen.getByTestId("icon-thumbs-up")).toBeInTheDocument();
    expect(screen.getByTestId("icon-thumbs-down")).toBeInTheDocument();
  });

  test("invia feedback positivo al click sul pulsante ThumbsUp", () => {
    render(<FeedbackComponent sourceIds="doc-123" />);

    const upBtn = screen.getByRole("button", { name: "Valuta positivamente" });
    fireEvent.click(upBtn);

    expect(mockSubmitFeedback).toHaveBeenCalledTimes(1);
    expect(mockSubmitFeedback).toHaveBeenCalledWith(true);
  });

  test("apre il modal al click sul pulsante ThumbsDown", () => {
    render(<FeedbackComponent sourceIds="doc-123" />);

    const downBtn = screen.getByRole("button", { name: "Valuta negativamente" });
    fireEvent.click(downBtn);

    expect(mockOpenModal).toHaveBeenCalledTimes(1);
  });

  test("disabilita entrambi i pulsanti quando è già stato registrato un voto positivo", () => {
    mockFeedbackState.vote = "up";
    render(<FeedbackComponent sourceIds="doc-123" />);

    const upBtn = screen.getByRole("button", { name: "Valuta positivamente" });
    const downBtn = screen.getByRole("button", { name: "Valuta negativamente" });

    expect(upBtn).toBeDisabled();
    expect(downBtn).toBeDisabled();
    expect(screen.getByTestId("icon-thumbs-up")).toHaveClass("fill-current");
  });

  test("disabilita entrambi i pulsanti quando è già stato registrato un voto negativo", () => {
    mockFeedbackState.vote = "down";
    render(<FeedbackComponent sourceIds="doc-123" />);

    const upBtn = screen.getByRole("button", { name: "Valuta positivamente" });
    const downBtn = screen.getByRole("button", { name: "Valuta negativamente" });

    expect(upBtn).toBeDisabled();
    expect(downBtn).toBeDisabled();
    expect(screen.getByTestId("icon-thumbs-down")).toHaveClass("fill-current");
  });

  test("mostra il loader nel pulsante ThumbsUp durante il caricamento iniziale", () => {
    mockFeedbackState.loading = true;
    mockFeedbackState.vote = null;
    render(<FeedbackComponent sourceIds="doc-123" />);

    expect(screen.getByTestId("icon-loader")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Valuta positivamente" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Valuta negativamente" })).toBeDisabled();
  });

  test("renderizza il modal con textarea e pulsanti di gestione quando isModalOpen è true", () => {
    mockFeedbackState.isModalOpen = true;
    mockFeedbackState.notes = "Informazione poco chiara";
    render(<FeedbackComponent sourceIds="doc-123" />);

    expect(screen.getByRole("heading", { name: "Cosa non ha funzionato?", level: 3 })).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText("Aggiungi dei dettagli (opzionale)...");
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue("Informazione poco chiara");

    expect(screen.getByRole("button", { name: "Chiudi" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Annulla" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Invia Feedback" })).toBeInTheDocument();
  });

  test("aggiorna le note e invia il feedback negativo con note dal modal", () => {
    mockFeedbackState.isModalOpen = true;
    mockFeedbackState.notes = "Manca riferimento Cassazione";
    render(<FeedbackComponent sourceIds="doc-123" />);

    const textarea = screen.getByPlaceholderText("Aggiungi dei dettagli (opzionale)...");
    fireEvent.change(textarea, { target: { value: "Nuovo commento" } });
    expect(mockSetNotes).toHaveBeenCalledWith("Nuovo commento");

    const submitBtn = screen.getByRole("button", { name: "Invia Feedback" });
    fireEvent.click(submitBtn);

    expect(mockSubmitFeedback).toHaveBeenCalledTimes(1);
    expect(mockSubmitFeedback).toHaveBeenCalledWith(false, "Manca riferimento Cassazione");
  });

  test("chiude il modal tramite pulsante Chiudi o Annulla", () => {
    mockFeedbackState.isModalOpen = true;
    render(<FeedbackComponent sourceIds="doc-123" />);

    const closeIconBtn = screen.getByRole("button", { name: "Chiudi" });
    fireEvent.click(closeIconBtn);
    expect(mockCloseModal).toHaveBeenCalledTimes(1);

    const cancelBtn = screen.getByRole("button", { name: "Annulla" });
    fireEvent.click(cancelBtn);
    expect(mockCloseModal).toHaveBeenCalledTimes(2);
  });

  test("disabilita gli input del modal e mostra lo stato di invio durante il loading", () => {
    mockFeedbackState.isModalOpen = true;
    mockFeedbackState.loading = true;
    render(<FeedbackComponent sourceIds="doc-123" />);

    expect(screen.getByPlaceholderText("Aggiungi dei dettagli (opzionale)...")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Chiudi" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Annulla" })).toBeDisabled();

    const submitBtn = screen.getByRole("button", { name: /Invio\.\.\./i });
    expect(submitBtn).toBeDisabled();
    
    // Verifica la presenza del loader dentro il pulsante di submit
    const loaderInsideSubmit = submitBtn.querySelector('[data-testid="icon-loader"]');
    expect(loaderInsideSubmit).toBeInTheDocument();
  });
});