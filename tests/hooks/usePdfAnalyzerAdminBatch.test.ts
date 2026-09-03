import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { User } from "firebase/auth";

/* ---------- hoisted mocks & env fallback ---------- */
const {
  mockAuthState,
  mockToast,
  mockFetchWithSecurity,
  mockLoadMaxima,
  mockLoadSentence,
  mockExtractTextFromFile,
  mockGetFileType,
  mockOcrFileWithTesseract,
  mockCreateWorker,
  mockTrackEvent,
} = vi.hoisted(() => {
  if (!import.meta.env.VITE_REASON_ADMIN_ENDPOINT) {
    import.meta.env.VITE_REASON_ADMIN_ENDPOINT = "https://reasoningadmin-vqoobrenua-ew.a.run.app";
  }

  const workerInstance = {
    setParameters: vi.fn().mockResolvedValue(undefined),
    terminate: vi.fn().mockResolvedValue(undefined),
  };

  return {
    mockAuthState: {
      user: null as User | null,
    },
    mockToast: Object.assign(vi.fn(), {
      error: vi.fn(),
      success: vi.fn(),
    }),
    mockFetchWithSecurity: vi.fn(),
    mockLoadMaxima: vi.fn().mockResolvedValue(undefined),
    mockLoadSentence: vi.fn().mockResolvedValue(undefined),
    mockExtractTextFromFile: vi.fn().mockResolvedValue("Testo valido estratto dalla sentenza eccedente cinquanta caratteri minimi."),
    mockGetFileType: vi.fn().mockReturnValue("pdf"),
    mockOcrFileWithTesseract: vi.fn().mockResolvedValue("Testo estratto via OCR che supera ampiamente la soglia minima di caratteri."),
    mockCreateWorker: vi.fn().mockResolvedValue(workerInstance),
    mockTrackEvent: vi.fn(),
  };
});

/* ---------- mock global uuid ---------- */
let uuidCounter = 0;
vi.mock("uuid", () => ({
  v4: () => `batch-uuid-${++uuidCounter}`,
}));

/* ---------- mock dependencies ---------- */
vi.mock("react-hot-toast", () => ({
  toast: mockToast,
}));

vi.mock("@/context/useAuth", () => ({
  __esModule: true,
  useAuth: () => mockAuthState,
}));

vi.mock("@/infrastructure/analytics", () => ({
  __esModule: true,
  trackEvent: (name: string, payload?: Record<string, unknown>) => mockTrackEvent(name, payload),
}));

vi.mock("@/infrastructure/perf", () => ({
  __esModule: true,
  withTrace: async (_name: string, _meta: unknown, fn: () => Promise<unknown>) => fn(),
}));

vi.mock("@/config/apiClient", () => ({
  __esModule: true,
  fetchWithSecurity: (...args: unknown[]) => mockFetchWithSecurity(...args),
}));

vi.mock("@/shared/services/extractors", () => ({
  __esModule: true,
  SUPPORTED_FORMATS_MSG: "Formato documento non supportato.",
  extractTextFromFile: (file: File) => mockExtractTextFromFile(file),
  getFileType: (file: File) => mockGetFileType(file),
  ocrFileWithTesseract: (...args: unknown[]) => mockOcrFileWithTesseract(...args),
}));

vi.mock("tesseract.js", () => ({
  __esModule: true,
  createWorker: (...args: unknown[]) => mockCreateWorker(...args),
  PSM: { AUTO: 3 },
}));

vi.mock("@/shared/services/document", () => ({
  __esModule: true,
  loadMaxima: (...args: unknown[]) => mockLoadMaxima(...args),
}));

vi.mock("@/shared/services/storage", () => ({
  __esModule: true,
  loadSentence: (...args: unknown[]) => mockLoadSentence(...args),
}));

/* ---------- helper per simulare FileList del browser ---------- */
const createMockFileList = (files: File[]): FileList => {
  return {
    ...files,
    length: files.length,
    item: (index: number) => files[index] || null,
    [Symbol.iterator]: function* () {
      yield* files;
    },
  } as unknown as FileList;
};

/* ---------- subject under test ---------- */
import { usePdfAnalyzerAdminBatch } from "@/features/admin/hooks/usePdfAnalyzerBatch";

describe("usePdfAnalyzerAdminBatch Hook Suite", () => {
  let objectUrlCount = 0;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
    objectUrlCount = 0;
    mockAuthState.user = { uid: "usr_admin_2026" } as User;

    URL.createObjectURL = vi.fn((file: File) => `blob:jurio/${file.name}_${++objectUrlCount}`);
    URL.revokeObjectURL = vi.fn();

    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.useRealTimers();
  });

  describe("Inizializzazione e Validazione Coda (validateAndQueue)", () => {
    test("inizializza gli stati con valori predefiniti e totali a zero", () => {
      const { result } = renderHook(() => usePdfAnalyzerAdminBatch());

      expect(result.current.items).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.dragActive).toBe(false);
      expect(result.current.progress).toBeNull();
      expect(result.current.currentIndex).toBe(-1);
      expect(result.current.totals).toEqual({ total: 0, done: 0, error: 0, skipped: 0 });
    });

    test("validateAndQueue rifiuta un FileList vuoto", () => {
      const { result } = renderHook(() => usePdfAnalyzerAdminBatch());
      const emptyFileList = createMockFileList([]);

      let success = false;
      act(() => {
        success = result.current.validateAndQueue(emptyFileList);
      });

      expect(success).toBe(false);
      expect(result.current.items).toHaveLength(0);
      expect(mockToast.error).not.toHaveBeenCalled();
    });

    test("validateAndQueue rifiuta code che superano il limite massimo di 100 documenti", () => {
      const { result } = renderHook(() => usePdfAnalyzerAdminBatch());
      const filesOverLimit = Array.from(
        { length: 101 },
        (_, i) => new File(["test"], `sentenza_${i}.pdf`, { type: "application/pdf" })
      );
      const fileList = createMockFileList(filesOverLimit);

      let success = false;
      act(() => {
        success = result.current.validateAndQueue(fileList);
      });

      expect(success).toBe(false);
      expect(mockToast.error).toHaveBeenCalledWith("Puoi caricare massimo 100 documenti per volta.");
      expect(result.current.items).toHaveLength(0);
    });

    test("validateAndQueue blocca il caricamento se almeno un file ha formato non supportato", () => {
      mockGetFileType.mockImplementation((file: File) =>
        file.name.endsWith(".exe") ? "unsupported" : "pdf"
      );

      const { result } = renderHook(() => usePdfAnalyzerAdminBatch());
      const fileList = createMockFileList([
        new File(["pdf"], "ricorso.pdf", { type: "application/pdf" }),
        new File(["bin"], "eseguibile.exe", { type: "application/octet-stream" }),
      ]);

      let success = false;
      act(() => {
        success = result.current.validateAndQueue(fileList);
      });

      expect(success).toBe(false);
      expect(mockToast.error).toHaveBeenCalledWith("Formato documento non supportato.");
      expect(result.current.items).toHaveLength(0);
    });

    test("accetta file validi, genera blob URL e imposta gli elementi in stato 'queued'", () => {
      mockGetFileType.mockReturnValue("pdf");

      const { result } = renderHook(() => usePdfAnalyzerAdminBatch());
      const fileList = createMockFileList([
        new File(["pdf1"], "sentenza_1.pdf", { type: "application/pdf" }),
        new File(["pdf2"], "sentenza_2.pdf", { type: "application/pdf" }),
      ]);

      let success = false;
      act(() => {
        success = result.current.validateAndQueue(fileList);
      });

      expect(success).toBe(true);
      expect(result.current.items).toHaveLength(2);
      expect(result.current.items[0]).toMatchObject({
        id: "batch-uuid-1",
        status: "queued",
        fileUrl: "blob:jurio/sentenza_1.pdf_1",
      });
      expect(result.current.totals).toEqual({ total: 2, done: 0, error: 0, skipped: 0 });
      expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    });
  });

  describe("Gestione degli Elementi in Coda (removeItem, clearFailedAndSkipped, reset, getFileUrlFor)", () => {
    test("removeItem rimuove il singolo elemento e revoca il relativo URL", () => {
      const { result } = renderHook(() => usePdfAnalyzerAdminBatch());
      const fileList = createMockFileList([
        new File(["1"], "doc1.pdf", { type: "application/pdf" }),
        new File(["2"], "doc2.pdf", { type: "application/pdf" }),
      ]);

      act(() => {
        result.current.validateAndQueue(fileList);
      });

      const firstItemId = result.current.items[0].id;
      const firstItemUrl = result.current.items[0].fileUrl;

      act(() => {
        result.current.removeItem(firstItemId);
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].file.name).toBe("doc2.pdf");
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(firstItemUrl);
    });

    test("getFileUrlFor restituisce il blob URL per un ID specifico o null", () => {
      const { result } = renderHook(() => usePdfAnalyzerAdminBatch());
      const fileList = createMockFileList([new File(["1"], "doc.pdf", { type: "application/pdf" })]);

      act(() => {
        result.current.validateAndQueue(fileList);
      });

      const itemId = result.current.items[0].id;
      expect(result.current.getFileUrlFor(itemId)).toBe(result.current.items[0].fileUrl);
      expect(result.current.getFileUrlFor("non-existent-id")).toBeNull();
    });

    test("reset ripulisce tutta la coda revocando tutti gli URL attivi", () => {
      const { result } = renderHook(() => usePdfAnalyzerAdminBatch());
      const fileList = createMockFileList([
        new File(["1"], "doc1.pdf", { type: "application/pdf" }),
        new File(["2"], "doc2.pdf", { type: "application/pdf" }),
      ]);

      act(() => {
        result.current.validateAndQueue(fileList);
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.items).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.currentIndex).toBe(-1);
      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    });

    test("clearFailedAndSkipped rimuove solo gli elementi con stato 'error' o 'skipped'", () => {
      const { result } = renderHook(() => usePdfAnalyzerAdminBatch());
      const fileList = createMockFileList([
        new File(["1"], "doc1.pdf", { type: "application/pdf" }),
        new File(["2"], "doc2.pdf", { type: "application/pdf" }),
        new File(["3"], "doc3.pdf", { type: "application/pdf" }),
      ]);

      act(() => {
        result.current.validateAndQueue(fileList);
      });

      act(() => {
        result.current.items[0].status = "done";
        result.current.items[1].status = "error";
        result.current.items[2].status = "skipped";
      });

      act(() => {
        result.current.clearFailedAndSkipped();
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].status).toBe("done");
      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    });
  });

  describe("Guardie Preliminari di startBatch", () => {
    test("interrompe con toast se l'utente non è autenticato", async () => {
      mockAuthState.user = null;
      const { result } = renderHook(() => usePdfAnalyzerAdminBatch());

      await act(async () => {
        await result.current.startBatch();
      });

      expect(mockToast.error).toHaveBeenCalledWith("Devi essere autenticato.");
      expect(mockCreateWorker).not.toHaveBeenCalled();
    });

    test("interrompe con toast se la coda è vuota", async () => {
      const { result } = renderHook(() => usePdfAnalyzerAdminBatch());

      await act(async () => {
        await result.current.startBatch();
      });

      expect(mockToast.error).toHaveBeenCalledWith("Nessun documento in coda.");
      expect(mockCreateWorker).not.toHaveBeenCalled();
    });
  });

  describe("Esecuzione Sequenziale di startBatch", () => {
    test("elabora con successo la sentenza, esegue il salvataggio nella collection 'sentences' e chiude il worker", async () => {
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          message: JSON.stringify({
            tipo_documento: "sentenza",
            numero_sentenza: "1234/2026",
            massima: "In tema di responsabilità bancaria...",
          }),
        }),
      });

      const { result } = renderHook(() => usePdfAnalyzerAdminBatch());
      const testFile = new File(["bytes"], "sentenza_cassazione.pdf", { type: "application/pdf" });

      act(() => {
        result.current.validateAndQueue(createMockFileList([testFile]));
      });

      await act(async () => {
        await result.current.startBatch();
      });

      expect(mockExtractTextFromFile).toHaveBeenCalledWith(testFile);
      expect(mockFetchWithSecurity).toHaveBeenCalledWith(
        expect.stringMatching(/reason/i),
        expect.objectContaining({ question: expect.any(String) })
      );
      expect(mockLoadMaxima).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          tipo_documento: "sentenza",
          numero_sentenza: "1234/2026",
        }),
        "usr_admin_2026",
        "sentences",
        expect.any(String)
      );
      expect(mockLoadSentence).toHaveBeenCalledWith(testFile, expect.any(String), "sentences");

      expect(result.current.items[0].status).toBe("done");
      expect(result.current.totals.done).toBe(1);
      expect(mockToast.success).toHaveBeenCalledWith("Batch completato. OK: 1 • Errori: 0 • Scarti: 0");
    });

    test("attiva OCR di fallback se il testo estratto inizialmente è inferiore o uguale a 50 caratteri", async () => {
      mockExtractTextFromFile.mockResolvedValueOnce("Poco");
      mockOcrFileWithTesseract.mockResolvedValueOnce("Testo recuperato via OCR che supera i cinquanta caratteri previsti dal sistema.");

      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          message: JSON.stringify({
            tipo_documento: "ordinanza",
            massima: "Ordinanza su istanza di sospensione.",
          }),
        }),
      });

      const { result } = renderHook(() => usePdfAnalyzerAdminBatch());
      const testFile = new File(["scansione"], "ordinanza_scan.pdf", { type: "application/pdf" });

      act(() => {
        result.current.validateAndQueue(createMockFileList([testFile]));
      });

      await act(async () => {
        await result.current.startBatch();
      });

      expect(mockOcrFileWithTesseract).toHaveBeenCalled();
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "sentenze_ocr",
        expect.objectContaining({ success: true })
      );
      expect(result.current.items[0].status).toBe("done");
      expect(result.current.items[0].result?.tipo_documento).toBe("ordinanza");
    });
  });

  describe("Casi di Scarto (Skip Conditions)", () => {
    test("scarta il documento se rileva la clausola di oscuramento in corso", async () => {
      mockExtractTextFromFile.mockResolvedValueOnce(
        "Attenzione: la sentenza richiesta è in fase di valutazione per oscuramento dati sensibili ex art. 52 D.Lgs 196/2003."
      );

      const { result } = renderHook(() => usePdfAnalyzerAdminBatch());
      act(() => {
        result.current.validateAndQueue(createMockFileList([new File([""], "oscurata.pdf")]));
      });

      await act(async () => {
        await result.current.startBatch();
      });

      expect(result.current.items[0].status).toBe("skipped");
      expect(result.current.items[0].skipReason).toBe("oscuramento_in_corso");
      expect(mockFetchWithSecurity).not.toHaveBeenCalled();
      expect(result.current.totals.skipped).toBe(1);
    });

    test("scarta il file se dopo estrazione e OCR il testo rimane inferiore a 50 caratteri (no_text_extracted)", async () => {
      mockExtractTextFromFile.mockResolvedValueOnce("Breve");
      mockOcrFileWithTesseract.mockResolvedValueOnce("   Vuoto   ");

      const { result } = renderHook(() => usePdfAnalyzerAdminBatch());
      act(() => {
        result.current.validateAndQueue(createMockFileList([new File([""], "bianco.pdf")]));
      });

      await act(async () => {
        await result.current.startBatch();
      });

      expect(result.current.items[0].status).toBe("skipped");
      expect(result.current.items[0].skipReason).toBe("no_text_extracted");
      expect(mockFetchWithSecurity).not.toHaveBeenCalled();
    });

    test("scarta il documento se il testo supera MAX_CHARS (1.000.000)", async () => {
      const hugeText = "Z".repeat(1_000_001);
      mockExtractTextFromFile.mockResolvedValueOnce(hugeText);

      const { result } = renderHook(() => usePdfAnalyzerAdminBatch());
      act(() => {
        result.current.validateAndQueue(createMockFileList([new File([""], "enorme.pdf")]));
      });

      await act(async () => {
        await result.current.startBatch();
      });

      expect(result.current.items[0].status).toBe("skipped");
      expect(result.current.items[0].skipReason).toBe("max_chars_exceeded");
      expect(mockFetchWithSecurity).not.toHaveBeenCalled();
    });

    test("scarta con skipReason 'input_non_sentenza' se l'AI restituisce l'apposito warning", async () => {
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          message: JSON.stringify({ warning: "input_non_sentenza" }),
        }),
      });

      const { result } = renderHook(() => usePdfAnalyzerAdminBatch());
      act(() => {
        result.current.validateAndQueue(createMockFileList([new File([""], "fattura.pdf")]));
      });

      await act(async () => {
        await result.current.startBatch();
      });

      expect(result.current.items[0].status).toBe("skipped");
      expect(result.current.items[0].skipReason).toBe("input_non_sentenza");
      expect(mockLoadMaxima).not.toHaveBeenCalled();
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "sentence_processed",
        expect.objectContaining({ error_type: "input_non_sentenza" })
      );
    });
  });

  describe("Politica di Retry su Errori Temporanei e Gestione Fallimenti", () => {
    test("esegue il retry automatico su codice 429 e completa con successo al secondo tentativo", async () => {
      vi.useFakeTimers();

      mockFetchWithSecurity
        .mockResolvedValueOnce({ ok: false, status: 429 })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({
            message: JSON.stringify({ tipo_documento: "sentenza", massima: "Massima approvata." }),
          }),
        });

      const { result } = renderHook(() => usePdfAnalyzerAdminBatch());
      act(() => {
        result.current.validateAndQueue(createMockFileList([new File([""], "retry_doc.pdf")]));
      });

      const batchPromise = act(async () => {
        await result.current.startBatch();
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2500);
      });

      await batchPromise;

      expect(mockFetchWithSecurity).toHaveBeenCalledTimes(2);
      expect(result.current.items[0].status).toBe("done");
      expect(result.current.totals.done).toBe(1);
    });

    test("contrassegna l'elemento come 'error' se i tentativi di retry vengono esauriti", async () => {
      vi.useFakeTimers();

      mockFetchWithSecurity.mockResolvedValue({ ok: false, status: 503 });

      const { result } = renderHook(() => usePdfAnalyzerAdminBatch());
      act(() => {
        result.current.validateAndQueue(createMockFileList([new File([""], "server_down.pdf")]));
      });

      const batchPromise = act(async () => {
        await result.current.startBatch();
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(7000);
      });

      await batchPromise;

      expect(result.current.items[0].status).toBe("error");
      expect(result.current.totals.error).toBe(1);
      expect(mockTrackEvent).toHaveBeenCalledWith("analytics_error", {
        name: "admin_batch_item",
        reason: expect.stringContaining("HTTP_TEMP_ERROR_503"),
      });
    });
  });

  describe("Interruzione Utente (cancel)", () => {
    test("interrompe il batch impostando gli elementi pendenti su 'skipped' con skipReason 'user_cancelled'", async () => {
      const { result } = renderHook(() => usePdfAnalyzerAdminBatch());
      const fileList = createMockFileList([
        new File(["1"], "doc1.pdf", { type: "application/pdf" }),
        new File(["2"], "doc2.pdf", { type: "application/pdf" }),
      ]);

      mockFetchWithSecurity.mockImplementationOnce(async () => {
        result.current.cancel();
        return {
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({
            message: JSON.stringify({ tipo_documento: "sentenza", massima: "Primo ok." }),
          }),
        };
      });

      act(() => {
        result.current.validateAndQueue(fileList);
      });

      await act(async () => {
        await result.current.startBatch();
      });

      expect(result.current.items[0].status).toBe("done");
      expect(result.current.items[1].status).toBe("skipped");
      expect(result.current.items[1].skipReason).toBe("user_cancelled");
      expect(mockToast).toHaveBeenCalledWith("Batch interrotto.");
    });
  });

  describe("Interazioni Drag & Drop", () => {
    test("handleDrag attiva dragActive su dragenter/dragover e disattiva su dragleave", () => {
      const { result } = renderHook(() => usePdfAnalyzerAdminBatch());

      const enterEvent = {
        type: "dragenter",
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as React.DragEvent<HTMLDivElement>;

      act(() => {
        result.current.handleDrag(enterEvent);
      });
      expect(result.current.dragActive).toBe(true);

      const leaveEvent = {
        type: "dragleave",
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as React.DragEvent<HTMLDivElement>;

      act(() => {
        result.current.handleDrag(leaveEvent);
      });
      expect(result.current.dragActive).toBe(false);
    });

    test("handleDrop disattiva dragActive e mette in coda i documenti rilasciati", () => {
      const { result } = renderHook(() => usePdfAnalyzerAdminBatch());
      const droppedFiles = [new File(["pdf"], "rilasciato.pdf", { type: "application/pdf" })];

      const dropEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        dataTransfer: {
          files: createMockFileList(droppedFiles),
        },
      } as unknown as React.DragEvent<HTMLDivElement>;

      act(() => {
        result.current.handleDrop(dropEvent);
      });

      expect(result.current.dragActive).toBe(false);
      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].file.name).toBe("rilasciato.pdf");
    });
  });
});