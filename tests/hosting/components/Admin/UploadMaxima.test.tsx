import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

/* ---------- mock react-icons/fi ---------- */
vi.mock("react-icons/fi", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid={`fi-${name}`} {...props} />
  );
  return {
    FiUploadCloud: Icon("upload-cloud"),
    FiX: Icon("x"),
    FiPlay: Icon("play"),
    FiStopCircle: Icon("stop-circle"),
    FiTrash2: Icon("trash-2"),
  };
});

/* ---------- mock hook usePdfAnalyzerAdminBatch ---------- */
const mockValidateAndQueue = vi.fn();
const mockStartBatch = vi.fn();
const mockCancel = vi.fn();
const mockReset = vi.fn();
const mockRemoveItem = vi.fn();
const mockClearFailedAndSkipped = vi.fn();

let mockInputRef: { current: HTMLInputElement | null };

const mockUsePdfAnalyzerAdminBatch = vi.fn();

vi.mock("@/features/admin/hooks/usePdfAnalyzerBatch", () => ({
  usePdfAnalyzerAdminBatch: () => mockUsePdfAnalyzerAdminBatch(),
}));

/* ---------- subject under test ---------- */
import { UploadMaxima } from "@/features/admin/components/UploadMaxima";

describe("UploadMaxima", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInputRef = { current: null };
  });

  test("renderizza stato iniziale vuoto (items = 0, loading = false)", () => {
    mockUsePdfAnalyzerAdminBatch.mockReturnValue({
      items: [],
      dragActive: false,
      loading: false,
      progress: "",
      currentIndex: -1,
      totals: { done: 0, error: 0, skipped: 0, total: 0 },
      inputRef: mockInputRef,
      validateAndQueue: mockValidateAndQueue,
      startBatch: mockStartBatch,
      cancel: mockCancel,
      reset: mockReset,
      removeItem: mockRemoveItem,
      clearFailedAndSkipped: mockClearFailedAndSkipped,
    });

    render(<UploadMaxima />);

    expect(screen.getByRole("heading", { name: "Sezione Admin", level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Puoi caricare fino a 100 sentenze ufficiali/i)).toBeInTheDocument();
    expect(screen.getByText("Trascina qui fino a 100 file")).toBeInTheDocument();
    expect(screen.getByText("seleziona file")).toBeInTheDocument();
    expect(screen.getByTestId("fi-upload-cloud")).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: /Avvia batch/i })).not.toBeInTheDocument();
    expect(screen.queryByText("File")).not.toBeInTheDocument();
  });

  test("gestisce eventi drag & drop e click sull'area di upload", () => {
    mockUsePdfAnalyzerAdminBatch.mockReturnValue({
      items: [],
      dragActive: true,
      loading: false,
      progress: "",
      currentIndex: -1,
      totals: { done: 0, error: 0, skipped: 0, total: 0 },
      inputRef: mockInputRef,
      validateAndQueue: mockValidateAndQueue,
      startBatch: mockStartBatch,
      cancel: mockCancel,
      reset: mockReset,
      removeItem: mockRemoveItem,
      clearFailedAndSkipped: mockClearFailedAndSkipped,
    });

    render(<UploadMaxima />);

    const dropZone = screen.getByRole("button");
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const inputClickSpy = vi.spyOn(fileInput, "click").mockImplementation(() => {});
    const testFile = new File(["dummy content"], "sentenza.pdf", { type: "application/pdf" });

    fireEvent.dragEnter(dropZone);
    fireEvent.dragOver(dropZone);
    fireEvent.dragLeave(dropZone);

    fireEvent.drop(dropZone, {
      dataTransfer: { files: [testFile] },
    });
    expect(mockValidateAndQueue).toHaveBeenCalledWith([testFile]);

    fireEvent.drop(dropZone, {
      dataTransfer: { files: null },
    });

    fireEvent.click(dropZone);
    expect(inputClickSpy).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(dropZone, { key: "Enter" });
    expect(inputClickSpy).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(dropZone, { key: " " });
    expect(inputClickSpy).toHaveBeenCalledTimes(3);

    fireEvent.keyDown(dropZone, { key: "Escape" });
    expect(inputClickSpy).toHaveBeenCalledTimes(3);

    fireEvent.change(fileInput, { target: { files: [testFile] } });
    expect(mockValidateAndQueue).toHaveBeenCalledWith([testFile]);
  });

  test("ignora drag, drop, click, tastiera e input change se loading = true", () => {
    mockUsePdfAnalyzerAdminBatch.mockReturnValue({
      items: [],
      dragActive: false,
      loading: true,
      progress: "",
      currentIndex: -1,
      totals: { done: 0, error: 0, skipped: 0, total: 0 },
      inputRef: mockInputRef,
      validateAndQueue: mockValidateAndQueue,
      startBatch: mockStartBatch,
      cancel: mockCancel,
      reset: mockReset,
      removeItem: mockRemoveItem,
      clearFailedAndSkipped: mockClearFailedAndSkipped,
    });

    render(<UploadMaxima />);

    const dropZone = screen.getByRole("button");
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const inputClickSpy = vi.spyOn(fileInput, "click").mockImplementation(() => {});

    fireEvent.dragEnter(dropZone);
    fireEvent.dragOver(dropZone);
    fireEvent.dragLeave(dropZone);
    fireEvent.drop(dropZone, { dataTransfer: { files: [new File([], "test.pdf")] } });
    fireEvent.click(dropZone);
    fireEvent.keyDown(dropZone, { key: "Enter" });
    fireEvent.change(fileInput, { target: { files: [new File([], "test.pdf")] } });

    expect(mockValidateAndQueue).not.toHaveBeenCalled();
    expect(inputClickSpy).not.toHaveBeenCalled();
  });

  test("renderizza coda con elementi, tutti i badge di stato e fallback, ed esegue azioni", () => {
    const items = [
      { id: "1", file: { name: "doc1.pdf", size: 2048 }, status: "queued", progress: "In attesa" },
      { id: "2", file: { name: "doc2.pdf", size: 4096 }, status: "extracting", progress: "Estrazione testo" },
      { id: "3", file: { name: "doc3.pdf", size: 1024 }, status: "ocr", progress: "OCR in corso" },
      { id: "4", file: { name: "doc4.pdf", size: 3072 }, status: "analyzing", progress: "Analisi AI" },
      { id: "5", file: { name: "doc5.pdf", size: 5120 }, status: "saving", progress: "Salvataggio DB" },
      { id: "6", file: { name: "doc6.pdf", size: 2048 }, status: "done", progress: "" },
      { id: "7", file: { name: "doc7.pdf", size: 2048 }, status: "skipped", error: "Troppo lungo" },
      { id: "8", file: { name: "doc8.pdf", size: 2048 }, status: "error", error: "" },
      { id: "9", file: { name: "doc9.pdf", size: 2048 }, status: "unknown-status", progress: "" },
    ];

    mockUsePdfAnalyzerAdminBatch.mockReturnValue({
      items,
      dragActive: false,
      loading: false,
      progress: "",
      currentIndex: -1,
      totals: { done: 1, error: 1, skipped: 1, total: 9 },
      inputRef: mockInputRef,
      validateAndQueue: mockValidateAndQueue,
      startBatch: mockStartBatch,
      cancel: mockCancel,
      reset: mockReset,
      removeItem: mockRemoveItem,
      clearFailedAndSkipped: mockClearFailedAndSkipped,
    });

    render(<UploadMaxima />);

    expect(screen.getByText("9 file in coda")).toBeInTheDocument();
    expect(screen.getByText("Done: 1 • Errori: 1 • Scarti: 1 • Totale: 9")).toBeInTheDocument();
    expect(screen.getByText("Pronto.")).toBeInTheDocument();

    const emptyBtn = screen.getByText("Svuota").closest("button")!;
    expect(emptyBtn).toBeInTheDocument();
    fireEvent.click(emptyBtn);
    expect(mockReset).toHaveBeenCalledTimes(1);

    const startBtn = screen.getByRole("button", { name: /Avvia batch/i });
    fireEvent.click(startBtn);
    expect(mockStartBatch).toHaveBeenCalledTimes(1);

    const clearBtn = screen.getByRole("button", { name: /Pulisci errori\/scarti/i });
    fireEvent.click(clearBtn);
    expect(mockClearFailedAndSkipped).toHaveBeenCalledTimes(1);

    expect(screen.getByText("Troppo lungo")).toBeInTheDocument();
    expect(screen.getByText("Errore/Scarto")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);

    const removeButtons = screen.getAllByRole("button", { name: "Rimuovi file" });
    expect(removeButtons).toHaveLength(9);
    fireEvent.click(removeButtons[0]);
    expect(mockRemoveItem).toHaveBeenCalledWith("1");
  });

  test("gestisce lo stato loading durante l'elaborazione con barra di avanzamento e cancel", () => {
    const items = [
      { id: "1", file: { name: "sentenza_cassazione.pdf", size: 2048 }, status: "analyzing", progress: "Elaborazione in corso" },
      { id: "2", file: { name: "sentenza_cds.pdf", size: 4096 }, status: "queued", progress: "" },
    ];

    mockUsePdfAnalyzerAdminBatch.mockReturnValue({
      items,
      dragActive: false,
      loading: true,
      progress: "Progresso globale",
      currentIndex: 0,
      totals: { done: 1, error: 0, skipped: 0, total: 2 },
      inputRef: mockInputRef,
      validateAndQueue: mockValidateAndQueue,
      startBatch: mockStartBatch,
      cancel: mockCancel,
      reset: mockReset,
      removeItem: mockRemoveItem,
      clearFailedAndSkipped: mockClearFailedAndSkipped,
    });

    render(<UploadMaxima />);

    expect(screen.getByText("50%")).toBeInTheDocument();
    
    const progressTexts = screen.getAllByText("Elaborazione in corso");
    expect(progressTexts.length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText("File 1/2:")).toBeInTheDocument();
    const fileNameTexts = screen.getAllByText("sentenza_cassazione.pdf");
    expect(fileNameTexts.length).toBeGreaterThanOrEqual(1);

    const cancelBtn = screen.getByRole("button", { name: /Interrompi/i });
    fireEvent.click(cancelBtn);
    expect(mockCancel).toHaveBeenCalledTimes(1);

    expect(screen.queryByText("Svuota")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rimuovi file" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pulisci errori\/scarti/i })).toBeDisabled();
  });

  test("copre fallback di testo progress quando activeItem.progress non è presente", () => {
    const items = [
      { id: "1", file: { name: "test.pdf", size: 1024 }, status: "analyzing", progress: "" },
    ];

    mockUsePdfAnalyzerAdminBatch.mockReturnValue({
      items,
      dragActive: false,
      loading: true,
      progress: "Progresso globale di fallback",
      currentIndex: 0,
      totals: { done: 0, error: 0, skipped: 0, total: 1 },
      inputRef: mockInputRef,
      validateAndQueue: mockValidateAndQueue,
      startBatch: mockStartBatch,
      cancel: mockCancel,
      reset: mockReset,
      removeItem: mockRemoveItem,
      clearFailedAndSkipped: mockClearFailedAndSkipped,
    });

    render(<UploadMaxima />);

    expect(screen.getByText("Progresso globale di fallback")).toBeInTheDocument();
  });

  test("copre fallback 'Elaborazione batch…' quando né activeItem.progress né progress sono valorizzati", () => {
    const items = [
      { id: "1", file: { name: "test.pdf", size: 1024 }, status: "analyzing", progress: "" },
    ];

    mockUsePdfAnalyzerAdminBatch.mockReturnValue({
      items,
      dragActive: false,
      loading: true,
      progress: "",
      currentIndex: 0,
      totals: { done: 0, error: 0, skipped: 0, total: 1 },
      inputRef: mockInputRef,
      validateAndQueue: mockValidateAndQueue,
      startBatch: mockStartBatch,
      cancel: mockCancel,
      reset: mockReset,
      removeItem: mockRemoveItem,
      clearFailedAndSkipped: mockClearFailedAndSkipped,
    });

    render(<UploadMaxima />);

    expect(screen.getByText("Elaborazione batch…")).toBeInTheDocument();
  });
});