import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import type { DocumentoGiurisprudenziale } from "@/interfaces/interfaces";

/* ---------- mock react-icons/fi ---------- */
vi.mock("react-icons/fi", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid={`fi-${name}`} {...props} />
  );
  return {
    FiUploadCloud: Icon("upload-cloud"),
    FiX: Icon("x"),
  };
});

/* ---------- component ---------- */
import { UploadDropzone } from "@/components/Profile/UploadDropzone"; // <-- adegua il path se necessario

describe("UploadDropzone Component Suite", () => {
  const mockHandleDrag = vi.fn<(e: React.SyntheticEvent) => void>();
  const mockValidateFile = vi.fn<(files: FileList) => void>();
  const mockSetFile = vi.fn<(file: File | null) => void>();
  const mockSetExtractedText = vi.fn<(text: string | null) => void>();
  const mockSetAnalysisResult = vi.fn<(res: string | null) => void>();
  const mockSetShowText = vi.fn<(show: boolean) => void>();
  const mockSetVisibleAllMatches = vi.fn<(matches: DocumentoGiurisprudenziale[]) => void>();
  const mockSetHasSearched = vi.fn<(searched: boolean) => void>();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderDropzone = (
    props: Partial<React.ComponentProps<typeof UploadDropzone>> = {}
  ) => {
    const inputRef = React.createRef<HTMLInputElement>();

    const defaultProps: React.ComponentProps<typeof UploadDropzone> = {
      file: null,
      dragActive: false,
      loading: false,
      progress: null,
      uiProgress: 0,
      inputRef,
      handleDrag: mockHandleDrag,
      validateFile: mockValidateFile,
      setFile: mockSetFile,
      setExtractedText: mockSetExtractedText,
      setAnalysisResult: mockSetAnalysisResult,
      setShowText: mockSetShowText,
      setVisibleAllMatches: mockSetVisibleAllMatches,
      setHasSearched: mockSetHasSearched,
      ...props,
    };

    return render(<UploadDropzone {...defaultProps} />);
  };

  test("renderizza lo stato iniziale vuoto con istruzioni di caricamento e icona upload", () => {
    renderDropzone();

    expect(screen.getByTestId("fi-upload-cloud")).toBeInTheDocument();
    expect(screen.getByText("Trascina qui il file")).toBeInTheDocument();
    expect(screen.getByText("seleziona un file")).toBeInTheDocument();
    expect(
      screen.getByText("Qualsiasi formato accettato • 1 file alla volta")
    ).toBeInTheDocument();

    const dropzoneBtn = screen.getByRole("button");
    expect(dropzoneBtn).toHaveAttribute("tabIndex", "0");
  });

  test("gestisce gli eventi di trascinamento (dragEnter, dragOver, dragLeave) invocando handleDrag", () => {
    renderDropzone({ dragActive: false });

    const dropzone = screen.getByRole("button");

    fireEvent.dragEnter(dropzone);
    expect(mockHandleDrag).toHaveBeenCalledTimes(1);

    fireEvent.dragOver(dropzone);
    expect(mockHandleDrag).toHaveBeenCalledTimes(2);

    fireEvent.dragLeave(dropzone);
    expect(mockHandleDrag).toHaveBeenCalledTimes(3);
  });

  test("gestisce l'evento di rilascio file (drop) invocando validateFile con i file trasferiti", () => {
    renderDropzone();

    const dropzone = screen.getByRole("button");
    const fakeFile = new File(["dummy content"], "ricorso.pdf", { type: "application/pdf" });
    const fileList = [fakeFile] as unknown as FileList;

    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: fileList,
      },
    });

    expect(mockValidateFile).toHaveBeenCalledWith(fileList);
  });

  test("attiva il click sull'input nascosto al click o alla pressione dei tasti Invio / Spazio sulla dropzone", () => {
    const { container } = renderDropzone();

    const dropzone = screen.getByRole("button");
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const inputClickSpy = vi.spyOn(fileInput, "click").mockImplementation(() => {});

    // 1. Click del mouse
    fireEvent.click(dropzone);
    expect(inputClickSpy).toHaveBeenCalledTimes(1);

    // 2. Tasto Invio
    fireEvent.keyDown(dropzone, { key: "Enter" });
    expect(inputClickSpy).toHaveBeenCalledTimes(2);

    // 3. Tasto Spazio
    fireEvent.keyDown(dropzone, { key: " " });
    expect(inputClickSpy).toHaveBeenCalledTimes(3);
  });

  test("renderizza i dettagli del file caricato (nome e dimensione formattata in KB) e il pulsante di rimozione", () => {
    const dummyFile = new File(["test-content-bytes"], "Atto_Citazione_2026.pdf", {
      type: "application/pdf",
    });
    Object.defineProperty(dummyFile, "size", { value: 204800 }); // 200 KB

    renderDropzone({ file: dummyFile });

    expect(screen.getByText("Atto_Citazione_2026.pdf")).toBeInTheDocument();
    expect(screen.getByText("200.0 KB")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rimuovi file" })).toBeInTheDocument();
  });

  test("cancella il file e resetta tutti gli stati associati al click sul pulsante di rimozione", () => {
    const dummyFile = new File(["content"], "memoria.docx", { type: "application/msword" });

    renderDropzone({ file: dummyFile });

    const removeBtn = screen.getByRole("button", { name: "Rimuovi file" });
    fireEvent.click(removeBtn);

    expect(mockSetFile).toHaveBeenCalledWith(null);
    expect(mockSetExtractedText).toHaveBeenCalledWith(null);
    expect(mockSetAnalysisResult).toHaveBeenCalledWith(null);
    expect(mockSetShowText).toHaveBeenCalledWith(false);
    expect(mockSetVisibleAllMatches).toHaveBeenCalledWith([]);
    expect(mockSetHasSearched).toHaveBeenCalledWith(false);
  });

  test("mostra la barra di avanzamento, la percentuale e il messaggio di stato durante il caricamento (loading: true)", () => {
    renderDropzone({
      loading: true,
      progress: "Estrazione entità legali...",
      uiProgress: 65,
    });

    const dropzone = screen.getByRole("button");
    expect(dropzone).toHaveAttribute("tabIndex", "-1");
    expect(dropzone).toHaveClass("cursor-not-allowed");

    expect(screen.getByText("Estrazione entità legali...")).toBeInTheDocument();
    expect(screen.getByText("65%")).toBeInTheDocument();
  });

  test("utilizza 'Analisi in corso…' come messaggio di fallback se la prop progress è null", () => {
    renderDropzone({
      loading: true,
      progress: null,
      uiProgress: 15,
    });

    expect(screen.getByText("Analisi in corso…")).toBeInTheDocument();
    expect(screen.getByText("15%")).toBeInTheDocument();
  });

  test("blocca interazioni, click, drop e drag quando il componente è in stato loading", () => {
    const { container } = renderDropzone({ loading: true });

    const dropzone = container.querySelector('[role="button"]') as HTMLElement;
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const inputClickSpy = vi.spyOn(fileInput, "click").mockImplementation(() => {});

    fireEvent.click(dropzone);
    fireEvent.keyDown(dropzone, { key: "Enter" });
    fireEvent.dragEnter(dropzone);
    fireEvent.drop(dropzone, { dataTransfer: { files: [] } });

    expect(inputClickSpy).not.toHaveBeenCalled();
    expect(mockHandleDrag).not.toHaveBeenCalled();
    expect(mockValidateFile).not.toHaveBeenCalled();
  });

  test("invoca validateFile al cambio di selezione file dall'input HTML nascosto", () => {
    const { container } = renderDropzone();

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeInTheDocument();

    const file = new File(["data"], "contratto.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(mockValidateFile).toHaveBeenCalledTimes(1);
  });
});