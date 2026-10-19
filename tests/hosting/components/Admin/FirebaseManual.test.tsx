import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

/* ---------- mock lucide-react ---------- */
vi.mock("lucide-react", () => ({
  Loader2: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="loader2-icon" {...props} />
  ),
}));

/* ---------- mock useContentUploader ---------- */
const mockSetId = vi.fn();
const mockSetText = vi.fn();
const mockSetLinksText = vi.fn();
const mockSetImages = vi.fn();
const mockHandleUpload = vi.fn();

const mockUseContentUploader = vi.fn();

vi.mock("@/features/admin/hooks/admin", () => ({
  useContentUploader: () => mockUseContentUploader(),
}));

/* ---------- component ---------- */
import FirebaseManual from "@/features/admin/components/FirebaseManual"; // <-- aggiorna il path se necessario

describe("FirebaseManual", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza i campi, gestisce l'input e lo stato idle", () => {
    mockUseContentUploader.mockReturnValue({
      id: "doc-123",
      setId: mockSetId,
      text: "Testo di prova",
      setText: mockSetText,
      linksText: "https://link1.com",
      setLinksText: mockSetLinksText,
      images: "https://img.com/pic.png",
      setImages: mockSetImages,
      status: "idle",
      errorMessage: null,
      handleUpload: mockHandleUpload,
    });

    render(<FirebaseManual />);

    // Intestazione e descrizione
    expect(
      screen.getByRole("heading", { name: "Nuovo Elemento Manuale", level: 2 })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Compila tutti i campi sottostanti/i)
    ).toBeInTheDocument();

    // Input ID
    const inputId = screen.getByPlaceholderText("es. doc-analisi-123");
    expect(inputId).toHaveValue("doc-123");
    fireEvent.change(inputId, { target: { value: "nuovo-id" } });
    expect(mockSetId).toHaveBeenCalledWith("nuovo-id");

    // Textarea Text
    const textareaText = screen.getByPlaceholderText("Inserisci il testo qui...");
    expect(textareaText).toHaveValue("Testo di prova");
    fireEvent.change(textareaText, { target: { value: "Nuovo testo" } });
    expect(mockSetText).toHaveBeenCalledWith("Nuovo testo");

    // Textarea Links
    const textareaLinks = screen.getByPlaceholderText(/https:\/\/esempio\.com\/1/i);
    expect(textareaLinks).toHaveValue("https://link1.com");
    fireEvent.change(textareaLinks, { target: { value: "https://link2.com" } });
    expect(mockSetLinksText).toHaveBeenCalledWith("https://link2.com");

    // Input Images
    const inputImages = screen.getByPlaceholderText("https://...");
    expect(inputImages).toHaveValue("https://img.com/pic.png");
    fireEvent.change(inputImages, { target: { value: "https://nuova-img.com" } });
    expect(mockSetImages).toHaveBeenCalledWith("https://nuova-img.com");

    // Bottone di invio stato idle
    const submitBtn = screen.getByRole("button", { name: "Salva Contenuto" });
    expect(submitBtn).toBeEnabled();
    expect(submitBtn).toHaveClass("bg-(--color-text)", "hover:opacity-90", "cursor-pointer");
    expect(screen.queryByTestId("loader2-icon")).not.toBeInTheDocument();

    fireEvent.click(submitBtn);
    expect(mockHandleUpload).toHaveBeenCalledTimes(1);

    // Nessun feedback di successo o errore
    expect(screen.queryByText(/Attenzione:/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Dati processati e salvati correttamente!")).not.toBeInTheDocument();
  });

  test("gestisce lo stato 'loading'", () => {
    mockUseContentUploader.mockReturnValue({
      id: "",
      setId: mockSetId,
      text: "",
      setText: mockSetText,
      linksText: "",
      setLinksText: mockSetLinksText,
      images: "",
      setImages: mockSetImages,
      status: "loading",
      errorMessage: null,
      handleUpload: mockHandleUpload,
    });

    render(<FirebaseManual />);

    const submitBtn = screen.getByRole("button", { name: /Caricamento\.\.\./i });
    expect(submitBtn).toBeDisabled();
    expect(submitBtn).toHaveClass("opacity-50", "cursor-not-allowed");
    expect(screen.getByTestId("loader2-icon")).toBeInTheDocument();
    expect(screen.getByTestId("loader2-icon")).toHaveClass("animate-spin");
  });

  test("gestisce lo stato 'success'", () => {
    mockUseContentUploader.mockReturnValue({
      id: "doc-1",
      setId: mockSetId,
      text: "Testo",
      setText: mockSetText,
      linksText: "",
      setLinksText: mockSetLinksText,
      images: "",
      setImages: mockSetImages,
      status: "success",
      errorMessage: null,
      handleUpload: mockHandleUpload,
    });

    render(<FirebaseManual />);

    const submitBtn = screen.getByRole("button", { name: "✓ Salvato" });
    expect(submitBtn).toBeDisabled();
    expect(submitBtn).toHaveClass("bg-emerald-600", "cursor-default");
    expect(
      screen.getByText("Dati processati e salvati correttamente!")
    ).toBeInTheDocument();
  });

  test("gestisce lo stato 'error' con messaggio dedicato e riprova", () => {
    mockUseContentUploader.mockReturnValue({
      id: "doc-1",
      setId: mockSetId,
      text: "Testo",
      setText: mockSetText,
      linksText: "",
      setLinksText: mockSetLinksText,
      images: "",
      setImages: mockSetImages,
      status: "error",
      errorMessage: "Errore durante il salvataggio dei dati nel database",
      handleUpload: mockHandleUpload,
    });

    render(<FirebaseManual />);

    const submitBtn = screen.getByRole("button", { name: "Riprova" });
    expect(submitBtn).toBeEnabled();
    expect(submitBtn).toHaveClass("bg-red-600", "cursor-pointer");

    // Verifica messaggio di errore
    expect(screen.getByText("Attenzione:")).toBeInTheDocument();
    expect(
      screen.getByText("Errore durante il salvataggio dei dati nel database")
    ).toBeInTheDocument();

    fireEvent.click(submitBtn);
    expect(mockHandleUpload).toHaveBeenCalledTimes(1);
  });
});