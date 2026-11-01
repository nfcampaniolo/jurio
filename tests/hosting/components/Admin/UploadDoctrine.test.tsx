import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import { UploadDoctrine } from "@/features/admin/components/UploadDoctrine";
import { useSingleDocumentUpload } from "@/features/admin/hooks/useSingleDocumentUpload";

/* ---------- mock react-icons/fi ---------- */
vi.mock("react-icons/fi", () => ({
  FiUploadCloud: () => <svg data-testid="icon-upload-cloud" />,
  FiX: () => <svg data-testid="icon-x" />,
  FiSave: () => <svg data-testid="icon-save" />,
  FiTrash2: () => <svg data-testid="icon-trash" />,
  FiFileText: () => <svg data-testid="icon-file-text" />,
  FiLink: () => <svg data-testid="icon-link" />,
}));

/* ---------- mock hook useSingleDocumentUpload ---------- */
vi.mock("@/features/admin/hooks/useSingleDocumentUpload", () => ({
  useSingleDocumentUpload: vi.fn(),
}));

const mockedUseSingleDocumentUpload = vi.mocked(useSingleDocumentUpload);

describe("UploadDoctrine Component Suite", () => {
  const mockSetUrl = vi.fn();
  const mockSetExtractedText = vi.fn();
  const mockSetDragActive = vi.fn();
  const mockHandleFileSelect = vi.fn();
  const mockRemoveFile = vi.fn();
  const mockResetForm = vi.fn();
  const mockValidateAndSubmit = vi.fn();
  const mockInputRef = createRef<HTMLInputElement>();

  const defaultHookReturn = {
    file: null as File | null,
    url: "",
    setUrl: mockSetUrl,
    extractedText: "",
    setExtractedText: mockSetExtractedText,
    dragActive: false,
    setDragActive: mockSetDragActive,
    loading: false,
    isExtracting: false,
    inputRef: mockInputRef,
    handleFileSelect: mockHandleFileSelect,
    removeFile: mockRemoveFile,
    resetForm: mockResetForm,
    validateAndSubmit: mockValidateAndSubmit,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseSingleDocumentUpload.mockReturnValue(defaultHookReturn);
  });

  test("renderizza l'intestazione, la zona di drop, gli input di URL/Testo e i pulsanti di azione in stato iniziale", () => {
    render(<UploadDoctrine />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Inserimento Dottrina Singola" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Carica un singolo documento PDF, fornisci l'URL ufficiale/i)
    ).toBeInTheDocument();

    expect(screen.getByText("Trascina qui il file PDF")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("https://www.cortedicassazione.it/...")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Il testo estratto apparirà qui automaticamente/i)
    ).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: /Elabora e Salva/i });
    expect(submitBtn).toBeDisabled();
  });

  test("gestisce gli eventi di Drag & Drop ed emette il file rilasciato tramite handleFileSelect", () => {
    render(<UploadDoctrine />);

    const dropZone = screen.getByRole("button", { name: /Trascina qui il file PDF/i });

    // Drag Enter & Over & Leave
    fireEvent.dragEnter(dropZone);
    expect(mockSetDragActive).toHaveBeenCalledWith(true);

    fireEvent.dragOver(dropZone);
    expect(mockSetDragActive).toHaveBeenCalledWith(true);

    fireEvent.dragLeave(dropZone);
    expect(mockSetDragActive).toHaveBeenCalledWith(false);

    // Drop file
    const mockFile = new File(["testo pdf"], "relazione_cassazione.pdf", {
      type: "application/pdf",
    });

    fireEvent.drop(dropZone, {
      dataTransfer: { files: [mockFile] },
    });

    expect(mockSetDragActive).toHaveBeenCalledWith(false);
    expect(mockHandleFileSelect).toHaveBeenCalledWith(mockFile);
  });

  test("triggera il click sull'input nascosto quando si clicca sulla dropzone e ne gestisce il cambio", () => {
    render(<UploadDoctrine />);

    const dropZone = screen.getByRole("button", { name: /Trascina qui il file PDF/i });
    const hiddenInput = dropZone.querySelector('input[type="file"]') as HTMLInputElement;

    const clickSpy = vi.spyOn(hiddenInput, "click");
    fireEvent.click(dropZone);
    expect(clickSpy).toHaveBeenCalled();

    const mockFile = new File(["pdf content"], "articolo_dottrina.pdf", {
      type: "application/pdf",
    });

    fireEvent.change(hiddenInput, {
      target: { files: [mockFile] },
    });

    expect(mockHandleFileSelect).toHaveBeenCalledWith(mockFile);
  });

  test("mostra il file selezionato con il nome, la dimensione e consente di rimuoverlo", () => {
    const mockFile = new File(
      ["a".repeat(2 * 1024 * 1024)],
      "dottrina_civile_2026.pdf",
      { type: "application/pdf" }
    );

    mockedUseSingleDocumentUpload.mockReturnValue({
      ...defaultHookReturn,
      file: mockFile,
    });

    render(<UploadDoctrine />);

    expect(
      screen.getByText("dottrina_civile_2026.pdf")
    ).toBeInTheDocument();

    expect(screen.getByText("2.00 MB")).toBeInTheDocument();

    const removeButtons = screen.getAllByRole("button", {
      name: /Rimuovi/i,
    });

    fireEvent.click(removeButtons[1]);

    expect(mockRemoveFile).toHaveBeenCalledTimes(1);
  });

  test("gestisce la digitazione dell'URL e del testo estratto aggiornando i rispettivi stati", () => {
    render(<UploadDoctrine />);

    const urlInput = screen.getByPlaceholderText("https://www.cortedicassazione.it/...");
    fireEvent.change(urlInput, { target: { value: "https://www.italgiure.giustizia.it/relazione.pdf" } });
    expect(mockSetUrl).toHaveBeenCalledWith("https://www.italgiure.giustizia.it/relazione.pdf");

    const textArea = screen.getByPlaceholderText(/Il testo estratto apparirà qui automaticamente/i);
    fireEvent.change(textArea, { target: { value: "Sintesi della massima dottrinale..." } });
    expect(mockSetExtractedText).toHaveBeenCalledWith("Sintesi della massima dottrinale...");
  });

  test("mostra lo stato di estrazione in corso con messaggio di attesa e disabilita gli elementi", () => {
    mockedUseSingleDocumentUpload.mockReturnValue({
      ...defaultHookReturn,
      isExtracting: true,
    });

    render(<UploadDoctrine />);

    expect(screen.getByText("Estrazione in corso...")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Attendere, sto leggendo il PDF...")
    ).toBeInTheDocument();

    const urlInput = screen.getByPlaceholderText("https://www.cortedicassazione.it/...");
    expect(urlInput).toBeDisabled();
  });

  test("abilita il pulsante di salvataggio quando tutti i campi sono compilati ed esegue validateAndSubmit", () => {
    const mockFile = new File(["test"], "doc.pdf", { type: "application/pdf" });

    mockedUseSingleDocumentUpload.mockReturnValue({
      ...defaultHookReturn,
      file: mockFile,
      url: "https://www.jurio.it/fonti/doc.pdf",
      extractedText: "Testo estratto completo",
    });

    render(<UploadDoctrine />);

    const submitBtn = screen.getByRole("button", { name: /Elabora e Salva/i });
    expect(submitBtn).toBeEnabled();

    fireEvent.click(submitBtn);
    expect(mockValidateAndSubmit).toHaveBeenCalledTimes(1);
  });

  test("esegue resetForm al click su 'Svuota Campi'", () => {
    render(<UploadDoctrine />);

    const clearBtn = screen.getByRole("button", { name: /Svuota Campi/i });
    fireEvent.click(clearBtn);

    expect(mockResetForm).toHaveBeenCalledTimes(1);
  });

  test("mostra lo stato di caricamento/salvataggio in corso nel pulsante di invio", () => {
    const mockFile = new File(["test"], "doc.pdf", { type: "application/pdf" });

    mockedUseSingleDocumentUpload.mockReturnValue({
      ...defaultHookReturn,
      file: mockFile,
      url: "https://www.jurio.it/fonti/doc.pdf",
      extractedText: "Testo estratto",
      loading: true,
    });

    render(<UploadDoctrine />);

    const submitBtn = screen.getByRole("button", { name: /Elaborazione\.\.\./i });
    expect(submitBtn).toBeDisabled();
    expect(screen.getByText("Elaborazione...")).toBeInTheDocument();
  });
});