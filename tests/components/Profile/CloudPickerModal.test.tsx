import { describe, test, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";

/* ---------- tipi mock useGoogleDrive & toast ---------- */
type GoogleFilePickerCallback = (
  fileId: string,
  fileName: string,
  mimeType: string
) => Promise<void>;

interface MockGoogleDriveHook {
  loading: boolean;
  openPicker: Mock<(onFilePicked: GoogleFilePickerCallback) => Promise<void>>;
  downloadFile: Mock<(fileId: string, fileName: string, mimeType: string) => Promise<Blob>>;
}

interface MockToast {
  error: Mock<(msg: string) => void>;
  success: Mock<(msg: string) => void>;
}

/* ---------- hoisted mocks ---------- */
const { mockGoogleDriveState, mockToast } = vi.hoisted(() => ({
  mockGoogleDriveState: {
    loading: false,
    openPicker: vi.fn<(onFilePicked: GoogleFilePickerCallback) => Promise<void>>(),
    downloadFile: vi.fn<
      (fileId: string, fileName: string, mimeType: string) => Promise<Blob>
    >(),
  } as MockGoogleDriveHook,
  mockToast: {
    error: vi.fn<(msg: string) => void>(),
    success: vi.fn<(msg: string) => void>(),
  } as MockToast,
}));

/* ---------- mock react-hot-toast ---------- */
vi.mock("react-hot-toast", () => ({
  toast: mockToast,
}));

/* ---------- mock useGoogleDrive ---------- */
vi.mock("@/hooks/useGoogleDrive", () => ({
  useGoogleDrive: () => mockGoogleDriveState,
}));

/* ---------- mock react-icons/fa ---------- */
vi.mock("react-icons/fa", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid={`fa-${name}`} {...props} />
  );
  return {
    FaGoogleDrive: Icon("google-drive"),
    FaTimes: Icon("times"),
    FaMicrosoft: Icon("microsoft"),
    FaTools: Icon("tools"),
  };
});

/* ---------- mock lucide-react ---------- */
vi.mock("lucide-react", () => ({
  Loader2: (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid="icon-loader-2" {...props} />
  ),
}));

/* ---------- mock framer-motion con filtraggio props ---------- */
vi.mock("framer-motion", async () => {
  const ReactActual = await import("react");

  const passthrough =
    (Tag: string) =>
    ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLElement> & { [key: string]: unknown }) =>
      ReactActual.createElement(Tag, props, children);

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      div: passthrough("div"),
    },
  };
});

/* ---------- component ---------- */
import { CloudPickerModal } from "@/components/Profile/CloudPickerModal"; // <-- adegua il path se necessario

describe("CloudPickerModal Component Suite", () => {
  const mockOnClose = vi.fn<() => void>();
  const mockOnSelectFile = vi.fn<(file: { name: string; blob: Blob }) => void>();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockGoogleDriveState.loading = false;
    mockGoogleDriveState.openPicker.mockImplementation(() => Promise.resolve());
    mockGoogleDriveState.downloadFile.mockImplementation(() =>
      Promise.resolve(new Blob(["test-pdf-bytes"], { type: "application/pdf" }))
    );

    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const renderModal = (props: Partial<React.ComponentProps<typeof CloudPickerModal>> = {}) => {
    const defaultProps: React.ComponentProps<typeof CloudPickerModal> = {
      isOpen: true,
      onClose: mockOnClose,
      onSelectFile: mockOnSelectFile,
      ...props,
    };

    return render(<CloudPickerModal {...defaultProps} />);
  };

  test("non renderizza nulla nel DOM quando la prop isOpen è false", () => {
    renderModal({ isOpen: false });

    expect(screen.queryByRole("heading", { name: "Importa dal Cloud" })).toBeNull();
  });

  test("renderizza il modale con header, tabs e la schermata iniziale di Google Drive", () => {
    renderModal();

    expect(screen.getByRole("heading", { name: "Importa dal Cloud", level: 2 })).toBeInTheDocument();
    
    // Matcher univoci per i tab dell'header
    expect(screen.getByRole("button", { name: /^Google Drive$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^OneDrive$/i })).toBeInTheDocument();

    expect(
      screen.getByText(
        "Sfoglia in modo sicuro i tuoi documenti su Google Drive e seleziona il file da analizzare."
      )
    ).toBeInTheDocument();

    // Matcher del pulsante di azione
    expect(screen.getByRole("button", { name: "Sfoglia Google Drive" })).toBeInTheDocument();
    expect(screen.getByText("I tuoi file rimangono privati.")).toBeInTheDocument();
  });

  test("gestisce la chiusura del modale tramite il pulsante X nell'header", () => {
    const { container } = renderModal();

    const closeBtn = container.querySelector("button:has(svg[data-testid='fa-times'])");
    expect(closeBtn).toBeInTheDocument();

    fireEvent.click(closeBtn!);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test("permette di passare al tab OneDrive visualizzando lo stato 'Sezione in lavorazione'", () => {
    renderModal();

    const oneDriveTabBtn = screen.getByRole("button", { name: /^OneDrive$/i });
    fireEvent.click(oneDriveTabBtn);

    expect(screen.getByRole("heading", { name: "Sezione in lavorazione", level: 3 })).toBeInTheDocument();
    expect(screen.getByTestId("fa-tools")).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "Sfoglia Google Drive" })).toBeNull();
  });

  test("mostra lo spinner di caricamento se l'hook di Google Drive si trova nello stato loading", () => {
    mockGoogleDriveState.loading = true;

    renderModal();

    expect(screen.getByTestId("icon-loader-2")).toBeInTheDocument();
    expect(screen.getByText("Scaricamento in corso...")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sfoglia Google Drive" })).toBeNull();
  });

  test("apre il picker di Google Drive e chiude il modale al click su 'Sfoglia Google Drive'", async () => {
    renderModal();

    const browseBtn = screen.getByRole("button", { name: "Sfoglia Google Drive" });
    fireEvent.click(browseBtn);

    expect(mockOnClose).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.runAllTimers();
    });

    expect(mockGoogleDriveState.openPicker).toHaveBeenCalledTimes(1);
    expect(mockGoogleDriveState.openPicker).toHaveBeenCalledWith(expect.any(Function));
  });

  test("scarica con successo il file selezionato dal picker e lo inoltra a onSelectFile", async () => {
    let capturedPickerCallback: GoogleFilePickerCallback | undefined;

    mockGoogleDriveState.openPicker.mockImplementation(async (callback) => {
      capturedPickerCallback = callback;
    });

    const dummyBlob = new Blob(["fascicolo-legale-pdf"], { type: "application/pdf" });
    mockGoogleDriveState.downloadFile.mockResolvedValueOnce(dummyBlob);

    renderModal();

    const browseBtn = screen.getByRole("button", { name: "Sfoglia Google Drive" });
    fireEvent.click(browseBtn);

    await act(async () => {
      vi.runAllTimers();
    });

    expect(capturedPickerCallback).toBeDefined();

    await act(async () => {
      await capturedPickerCallback!("file-id-456", "Contratto_Locazione.pdf", "application/pdf");
    });

    expect(mockGoogleDriveState.downloadFile).toHaveBeenCalledWith(
      "file-id-456",
      "Contratto_Locazione.pdf",
      "application/pdf"
    );

    expect(mockOnSelectFile).toHaveBeenCalledWith({
      name: "Contratto_Locazione.pdf",
      blob: dummyBlob,
    });

    expect(mockOnClose).toHaveBeenCalledTimes(2);
  });

  test("mostra notifica toast di errore se il download del file da Google Drive fallisce", async () => {
    let capturedPickerCallback: GoogleFilePickerCallback | undefined;

    mockGoogleDriveState.openPicker.mockImplementation(async (callback) => {
      capturedPickerCallback = callback;
    });

    mockGoogleDriveState.downloadFile.mockRejectedValueOnce(
      new Error("Errore autorizzazione token Google")
    );

    renderModal();

    const browseBtn = screen.getByRole("button", { name: "Sfoglia Google Drive" });
    fireEvent.click(browseBtn);

    await act(async () => {
      vi.runAllTimers();
    });

    await act(async () => {
      await capturedPickerCallback!("file-id-error", "Atto_Citazione.pdf", "application/pdf");
    });

    expect(mockToast.error).toHaveBeenCalledWith("Impossibile scaricare il file. Riprova.");
    expect(mockOnSelectFile).not.toHaveBeenCalled();
  });
});