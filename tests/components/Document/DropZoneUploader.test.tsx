import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

/* ---------- mock lucide-react ---------- */
vi.mock("lucide-react", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid={`icon-${name}`} {...props} />
  );
  return {
    UploadCloud: Icon("upload-cloud"),
    FileText: Icon("file-text"),
    X: Icon("x"),
  };
});

/* ---------- component ---------- */
import { DropZoneUploader } from "@/components/Document/DropZoneUploader"; // <-- adegua il path se necessario

describe("DropZoneUploader Component Suite", () => {
  const mockOnDrag = vi.fn<(e: React.DragEvent) => void>();
  const mockOnDrop = vi.fn<(e: React.DragEvent) => void>();
  const mockOnFileChange = vi.fn<(e: React.ChangeEvent<HTMLInputElement>) => void>();
  const mockRemovePendingFile = vi.fn<(index: number) => void>();

  const dummyFiles: File[] = [
    new File(["dummy 1"], "Ricorso_Tribunale.pdf", { type: "application/pdf" }),
    new File(["dummy 2"], "Verbale_Udienza.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderUploader = (props: Partial<React.ComponentProps<typeof DropZoneUploader>> = {}) => {
    const defaultProps: React.ComponentProps<typeof DropZoneUploader> = {
      dragActive: false,
      isProcessing: false,
      pendingFiles: [],
      maxAllowed: 5,
      totalCount: 0,
      onDrag: mockOnDrag,
      onDrop: mockOnDrop,
      onFileChange: mockOnFileChange,
      removePendingFile: mockRemovePendingFile,
      ...props,
    };

    return render(<DropZoneUploader {...defaultProps} />);
  };

  test("renderizza l'intestazione della sezione, le istruzioni e l'input file nascosto", () => {
    const { container } = renderUploader();

    expect(screen.getByRole("heading", { name: /Carica nuovi/i, level: 3 })).toBeInTheDocument();
    expect(screen.getByText("Trascina i file qui")).toBeInTheDocument();
    expect(screen.getByText("sfoglia locale")).toBeInTheDocument();

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute(
      "accept",
      ".pdf,.docx,.txt,.mp3,.wav,.ogg,.opus,.webm,.mp4,.mov,.avi,.mkv,.m4v"
    );
    expect(fileInput).toHaveAttribute("multiple");
    expect(fileInput).not.toBeDisabled();
  });

  test("gestisce gli eventi di trascinamento (dragEnter, dragOver, dragLeave) invocando onDrag", () => {
    renderUploader({ dragActive: false });

    const dropzone = screen.getByRole("button");

    fireEvent.dragEnter(dropzone);
    expect(mockOnDrag).toHaveBeenCalledTimes(1);

    fireEvent.dragOver(dropzone);
    expect(mockOnDrag).toHaveBeenCalledTimes(2);

    fireEvent.dragLeave(dropzone);
    expect(mockOnDrag).toHaveBeenCalledTimes(3);
  });

  test("gestisce l'evento di rilascio file (drop) invocando onDrop", () => {
    renderUploader();

    const dropzone = screen.getByRole("button");
    const fakeFile = new File(["bytes"], "contratto.pdf", { type: "application/pdf" });

    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [fakeFile],
      },
    });

    expect(mockOnDrop).toHaveBeenCalledTimes(1);
  });

  test("attiva il click sull'input file nascosto al click sulla dropzone", () => {
    const { container } = renderUploader();

    const dropzone = screen.getByRole("button");
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const inputClickSpy = vi.spyOn(fileInput, "click").mockImplementation(() => {});

    fireEvent.click(dropzone);
    expect(inputClickSpy).toHaveBeenCalledTimes(1);
  });

  test("invoca onFileChange al cambio di file selezionati dall'input HTML", () => {
    const { container } = renderUploader();

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["data"], "atto.pdf", { type: "application/pdf" });

    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(mockOnFileChange).toHaveBeenCalledTimes(1);
  });

  test("disabilita interazioni e input quando isProcessing è true", () => {
    const { container } = renderUploader({ isProcessing: true });

    const dropzone = screen.getByRole("button");
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const inputClickSpy = vi.spyOn(fileInput, "click").mockImplementation(() => {});

    expect(dropzone).toHaveClass("pointer-events-none", "opacity-50");
    expect(fileInput).toBeDisabled();

    fireEvent.click(dropzone);
    expect(inputClickSpy).not.toHaveBeenCalled();
  });

  test("applica le classi di disabilitazione quando il numero totale di file raggiunge il limite maxAllowed", () => {
    renderUploader({ totalCount: 5, maxAllowed: 5 });

    const dropzone = screen.getByRole("button");
    expect(dropzone).toHaveClass("pointer-events-none", "opacity-50");
  });

  test("renderizza la coda dei file in attesa di elaborazione e permette la rimozione singola", () => {
    renderUploader({ pendingFiles: dummyFiles });

    expect(screen.getByRole("heading", { name: "In coda per l'elaborazione", level: 4 })).toBeInTheDocument();
    expect(screen.getByText("Ricorso_Tribunale.pdf")).toBeInTheDocument();
    expect(screen.getByText("Verbale_Udienza.docx")).toBeInTheDocument();

    const removeButtons = screen.getAllByRole("button", { name: "Rimuovi file in coda" });
    expect(removeButtons).toHaveLength(2);

    // Rimozione del secondo file (indice 1)
    fireEvent.click(removeButtons[1]);
    expect(mockRemovePendingFile).toHaveBeenCalledTimes(1);
    expect(mockRemovePendingFile).toHaveBeenCalledWith(1);
  });

  test("disabilita i pulsanti di rimozione dei file in coda durante l'elaborazione (isProcessing: true)", () => {
    renderUploader({ pendingFiles: dummyFiles, isProcessing: true });

    const removeButtons = screen.getAllByRole("button", { name: "Rimuovi file in coda" });
    removeButtons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  test("non renderizza la sezione della coda se pendingFiles è vuoto", () => {
    renderUploader({ pendingFiles: [] });

    expect(screen.queryByRole("heading", { name: "In coda per l'elaborazione" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Rimuovi file in coda" })).toBeNull();
  });

  describe("Accessibilità (SonarQube A11y)", () => {
    test("simula l'attivazione dell'input nascosto tramite tastiera premendo Enter", () => {
      const { container } = renderUploader();

      const dropzone = screen.getByRole("button");
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const inputClickSpy = vi.spyOn(fileInput, "click").mockImplementation(() => {});

      fireEvent.keyDown(dropzone, { key: "Enter" });

      expect(inputClickSpy).toHaveBeenCalledTimes(1);
    });

    test("simula l'attivazione dell'input nascosto tramite tastiera premendo Spazio", () => {
      const { container } = renderUploader();

      const dropzone = screen.getByRole("button");
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const inputClickSpy = vi.spyOn(fileInput, "click").mockImplementation(() => {});

      fireEvent.keyDown(dropzone, { key: " " });

      expect(inputClickSpy).toHaveBeenCalledTimes(1);
    });

    test("blocca l'attivazione dell'input tramite tastiera quando isProcessing è true", () => {
      const { container } = renderUploader({ isProcessing: true });

      const dropzone = screen.getByRole("button");
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const inputClickSpy = vi.spyOn(fileInput, "click").mockImplementation(() => {});

      fireEvent.keyDown(dropzone, { key: "Enter" });
      fireEvent.keyDown(dropzone, { key: " " });

      expect(inputClickSpy).not.toHaveBeenCalled();
    });

    test("ignora i tasti diversi da Enter o Spazio", () => {
      const { container } = renderUploader();

      const dropzone = screen.getByRole("button");
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const inputClickSpy = vi.spyOn(fileInput, "click").mockImplementation(() => {});

      fireEvent.keyDown(dropzone, { key: "Tab" });
      fireEvent.keyDown(dropzone, { key: "ArrowDown" });
      fireEvent.keyDown(dropzone, { key: "Escape" });

      expect(inputClickSpy).not.toHaveBeenCalled();
    });
  });
});