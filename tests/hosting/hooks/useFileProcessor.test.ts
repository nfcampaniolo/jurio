import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { User } from "firebase/auth";
import type { AttachedDocument } from "@/interfaces/interfaces";
import type { FileProcessorProps } from "@/features/chat/hooks/useFileProcessor"; // <-- adegua il path di import se necessario

/* ---------- hoisted mocks ---------- */
const {
  mockToast,
  mockFetchWithSecurity,
  mockCheckDuplicateDocument,
  mockLoadMaxima,
  mockLoadSentence,
  mockExtractTextFromMedia,
  mockExtractTextFromFile,
  mockCreateWorker,
  mockTrackEvent,
  mockWithTrace,
} = vi.hoisted(() => {
  const toastMock = {
    loading: vi.fn().mockReturnValue("toast-proc-id"),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  };

  const workerMock = {
    setParameters: vi.fn().mockResolvedValue(undefined),
    recognize: vi.fn().mockResolvedValue({
      data: {
        text: "Testo estratto tramite OCR completo e leggibile superiore a cinquanta caratteri minimi di soglia.",
      },
    }),
    terminate: vi.fn().mockResolvedValue(undefined),
  };

  return {
    mockToast: toastMock,
    mockFetchWithSecurity: vi.fn(),
    mockCheckDuplicateDocument: vi.fn().mockResolvedValue(false),
    mockLoadMaxima: vi.fn().mockResolvedValue(undefined),
    mockLoadSentence: vi.fn().mockResolvedValue(undefined),
    mockExtractTextFromMedia: vi.fn().mockResolvedValue("Trascrizione da audio registrazione udienza."),
    mockExtractTextFromFile: vi.fn().mockResolvedValue("Contenuto completo dell'atto di citazione pervenuto in giudizio con motivazioni in diritto."),
    mockCreateWorker: vi.fn().mockResolvedValue(workerMock),
    mockTrackEvent: vi.fn(),
    mockWithTrace: vi.fn(async (_name: string, _meta: unknown, fn: () => Promise<unknown>) => fn()),
  };
});

/* ---------- mock global uuid & env ---------- */
let uuidCount = 0;
vi.mock("uuid", () => ({
  v4: () => `uuid-file-${++uuidCount}`,
}));

vi.mock("@/config/env", () => ({
  __esModule: true,
  getReasonUrl: () => "https://api.jurio.it/reason",
}));

vi.mock("react-hot-toast", () => ({
  toast: mockToast,
}));

vi.mock("@/infrastructure/perf", () => ({
  __esModule: true,
  withTrace: (...args: unknown[]) =>
    mockWithTrace(args[0] as string, args[1], args[2] as () => Promise<unknown>),
}));

vi.mock("@/infrastructure/analytics", () => ({
  __esModule: true,
  trackEvent: (event: string, payload?: Record<string, unknown>) =>
    mockTrackEvent(event, payload),
}));

/* ---------- mock dynamic dependencies ---------- */
vi.mock("@/config/apiClient", () => ({
  __esModule: true,
  fetchWithSecurity: (...args: unknown[]) => mockFetchWithSecurity(...args),
}));

vi.mock("@/shared/services/document", () => ({
  __esModule: true,
  checkDuplicateDocument: (uid: string, name: string) =>
    mockCheckDuplicateDocument(uid, name),
  loadMaxima: (...args: unknown[]) => mockLoadMaxima(...args),
}));

vi.mock("@/shared/services/storage", () => ({
  __esModule: true,
  loadSentence: (...args: unknown[]) => mockLoadSentence(...args),
}));

vi.mock("@/shared/services/extractors", () => ({
  __esModule: true,
  extractTextFromMedia: (file: File) => mockExtractTextFromMedia(file),
  extractTextFromFile: (file: File) => mockExtractTextFromFile(file),
}));

vi.mock("tesseract.js", () => ({
  __esModule: true,
  createWorker: (...args: unknown[]) => mockCreateWorker(...args),
  PSM: { AUTO: 3 },
}));

/* ---------- subject under test ---------- */
import { useFileProcessor } from "@/features/chat/hooks/useFileProcessor";

describe("useFileProcessor Hook Suite", () => {
  let attachedDocsState: AttachedDocument[] = [];
  let archiveDocsState: AttachedDocument[] = [];

  const setupProps = (overrideUser: User | null = { uid: "usr_flv_2026" } as User): FileProcessorProps => ({
    user: overrideUser,
    setIsProcessingFiles: vi.fn(),
    setAttachedDocs: vi.fn((update) => {
      attachedDocsState = typeof update === "function" ? update(attachedDocsState) : update;
    }),
    setArchiveDocs: vi.fn((update) => {
      archiveDocsState = typeof update === "function" ? update(archiveDocsState) : update;
    }),
    setDenyOpen: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    uuidCount = 0;
    attachedDocsState = [];
    archiveDocsState = [];
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Guardie Preliminari", () => {
    test("interrompe immediatamente l'elaborazione se l'utente non è autenticato", async () => {
      const props = setupProps(null);
      const { result } = renderHook(() => useFileProcessor(props));

      const file = new File(["testo"], "ricorso.pdf", { type: "application/pdf" });
      await act(async () => {
        await result.current.processFilesParallel([file], "default");
      });

      expect(props.setIsProcessingFiles).not.toHaveBeenCalled();
      expect(mockToast.loading).not.toHaveBeenCalled();
      expect(mockExtractTextFromFile).not.toHaveBeenCalled();
    });

    test("interrompe l'elaborazione se l'array dei file è vuoto", async () => {
      const props = setupProps();
      const { result } = renderHook(() => useFileProcessor(props));

      await act(async () => {
        await result.current.processFilesParallel([], "default");
      });

      expect(props.setIsProcessingFiles).not.toHaveBeenCalled();
      expect(mockToast.loading).not.toHaveBeenCalled();
    });
  });

  describe("Rilevamento Duplicati", () => {
    test("segnala errore con toast e ignora il file se già archiviato", async () => {
      mockCheckDuplicateDocument.mockResolvedValueOnce(true);

      const props = setupProps();
      const { result } = renderHook(() => useFileProcessor(props));

      const file = new File(["testo"], "sentenza_duplicata.pdf", { type: "application/pdf" });

      await act(async () => {
        await result.current.processFilesParallel([file], "default");
      });

      expect(mockToast.error).toHaveBeenCalledWith(
        'Il file "sentenza_duplicata.pdf" è già presente nell\'archivio. Verrà ignorato.'
      );
      expect(mockFetchWithSecurity).not.toHaveBeenCalled();
      expect(mockToast.dismiss).toHaveBeenCalledWith("toast-proc-id");
      expect(props.setIsProcessingFiles).toHaveBeenCalledWith(false);
    });
  });

  describe("Strategia di Estrazione Testuale", () => {
    test("instrada i file multimediali verso extractTextFromMedia", async () => {
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockResolvedValue({
          message: JSON.stringify({ tipo_documento: "Audio Registrazione", massima: "Registrazione udienza" }),
        }),
      });

      const props = setupProps();
      const { result } = renderHook(() => useFileProcessor(props));

      const audioFile = new File(["audio-bytes"], "udienza.mp3", { type: "audio/mpeg" });

      await act(async () => {
        await result.current.processFilesParallel([audioFile], "default");
      });

      expect(mockExtractTextFromMedia).toHaveBeenCalledWith(audioFile);
      expect(mockExtractTextFromFile).not.toHaveBeenCalled();
    });

    test("attiva l'OCR con Tesseract quando il testo estratto da documento è inferiore o uguale a 50 caratteri", async () => {
      mockExtractTextFromFile.mockResolvedValueOnce("Poco testo"); // <= 50 caratteri (scansione)

      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockResolvedValue({
          message: JSON.stringify({ tipo_documento: "Sentenza", massima: "Massima estratta da scansione" }),
        }),
      });

      const props = setupProps();
      const { result } = renderHook(() => useFileProcessor(props));

      const scanFile = new File(["img-bytes"], "scansione.pdf", { type: "application/pdf" });

      await act(async () => {
        await result.current.processFilesParallel([scanFile], "default");
      });

      expect(mockCreateWorker).toHaveBeenCalledWith("ita");
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "sentenze_ocr",
        expect.objectContaining({ success: true })
      );
    });

    test("blocca il documento e traccia errore se supera il limite di 1.000.000 di caratteri", async () => {
      const hugeText = "A".repeat(1_000_001);
      mockExtractTextFromFile.mockResolvedValueOnce(hugeText);

      const props = setupProps();
      const { result } = renderHook(() => useFileProcessor(props));

      const hugeFile = new File(["bytes"], "documento_enorme.docx");

      await act(async () => {
        await result.current.processFilesParallel([hugeFile], "default");
      });

      expect(mockToast.error).toHaveBeenCalledWith(
        'Il file "documento_enorme.docx" supera il limite di caratteri.',
        { duration: 6000 }
      );
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "document_uploaded",
        expect.objectContaining({ success: false, error_type: "max_chars_exceeded" })
      );
      expect(mockFetchWithSecurity).not.toHaveBeenCalled();
    });
  });

  describe("Elaborazione Reason e Persistenza Dati", () => {
    test("inoltra promptId specifico e salva con successo su Firestore e Cloud Storage", async () => {
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockResolvedValue({
          message: JSON.stringify({
            tipo_documento: "Sentenza",
            massima: "La clausola risolutiva espressa esige manifestazione inequivoca.",
            dataSentenza: "2026-04-12",
          }),
        }),
      });

      const props = setupProps();
      const { result } = renderHook(() => useFileProcessor(props));

      const file = new File(["dati-atto"], "sentenza.pdf", { type: "application/pdf" });

      await act(async () => {
        await result.current.processFilesParallel([file], "prompt-specializzato", "fsc_contrattuale");
      });

      expect(mockFetchWithSecurity).toHaveBeenCalledWith(
        "https://api.jurio.it/reason",
        expect.objectContaining({
          promptId: "prompt-specializzato",
          question: expect.any(String),
        })
      );

      expect(mockLoadMaxima).toHaveBeenCalledWith(
        "uuid-file-1",
        expect.objectContaining({
          nome_file: "sentenza.pdf",
          fascicoloIds: ["fsc_contrattuale"],
          tipo_documento: "Sentenza",
        }),
        "usr_flv_2026",
        "documents",
        expect.any(String)
      );

      expect(mockLoadSentence).toHaveBeenCalledWith(
        file,
        "uuid-file-1",
        "users/usr_flv_2026/documents"
      );

      expect(attachedDocsState).toHaveLength(1);
      expect(attachedDocsState[0]).toMatchObject({
        id: "uuid-file-1",
        name: "sentenza.pdf",
        type: "pdf",
        dataSentenza: "2026-04-12",
        fascicoloIds: ["fsc_contrattuale"],
      });

      expect(mockToast.success).toHaveBeenCalledWith("1 documenti aggiunti!", { id: "toast-proc-id" });
      expect(props.setIsProcessingFiles).toHaveBeenCalledWith(false);
    });

    test("intercetta il warning 'input_non_sentenza' e scarta il documento senza salvarlo", async () => {
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockResolvedValue({
          message: JSON.stringify({
            warning: "input_non_sentenza",
          }),
        }),
      });

      const props = setupProps();
      const { result } = renderHook(() => useFileProcessor(props));

      const nonLegalFile = new File(["testo"], "fattura_spesa.pdf", { type: "application/pdf" });

      await act(async () => {
        await result.current.processFilesParallel([nonLegalFile], "default");
      });

      expect(mockTrackEvent).toHaveBeenCalledWith(
        "sentence_processed",
        expect.objectContaining({ success: false, error_type: "input_non_sentenza" })
      );
      expect(mockLoadMaxima).not.toHaveBeenCalled();
      expect(mockLoadSentence).not.toHaveBeenCalled();
      expect(attachedDocsState).toHaveLength(0);
    });
  });

  describe("Gestione degli Errori e Controllo Accessi", () => {
    test("apre il modale di upgrade (setDenyOpen) e mostra errore su stato HTTP 403", async () => {
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockResolvedValue({}),
      });

      const props = setupProps();
      const { result } = renderHook(() => useFileProcessor(props));

      const file = new File(["bytes"], "documento.pdf", { type: "application/pdf" });

      await act(async () => {
        await result.current.processFilesParallel([file], "default");
      });

      expect(props.setDenyOpen).toHaveBeenCalledWith(true);
      expect(mockToast.error).toHaveBeenCalledWith("Mancata autorizzazione.", { id: "toast-proc-id" });
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "sentence_processed",
        expect.objectContaining({ error_type: "forbidden_403" })
      );
      expect(props.setIsProcessingFiles).toHaveBeenCalledWith(false);
    });

    test("gestisce errore 500 del server chiudendo lo stato di elaborazione", async () => {
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockResolvedValue({}),
      });

      const props = setupProps();
      const { result } = renderHook(() => useFileProcessor(props));

      const file = new File(["bytes"], "documento.pdf", { type: "application/pdf" });

      await act(async () => {
        await result.current.processFilesParallel([file], "default");
      });

      expect(mockToast.error).toHaveBeenCalledWith("Errore critico durante l'elaborazione.", {
        id: "toast-proc-id",
      });
      expect(props.setIsProcessingFiles).toHaveBeenCalledWith(false);
    });
  });
});