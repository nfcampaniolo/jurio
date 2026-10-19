import { vi } from "vitest";

/* ---------- inizializzazione preventiva ambiente di test ---------- */
vi.hoisted(() => {
  if (!import.meta.env.VITE_REASON_ENDPOINT) {
    import.meta.env.VITE_REASON_ENDPOINT = "https://api.jurio.it/reason";
  }
});

import { describe, test, expect, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { User } from "firebase/auth";

/* ---------- hoisted mocks ---------- */
const {
  mockAuthState,
  mockToast,
  mockFetchWithSecurity,
  mockCheckDuplicateDocument,
  mockLoadMaxima,
  mockDeleteDocument,
  mockLoadSentence,
  mockExtractTextFromFile,
  mockExtractTextFromMedia,
  mockGetFileType,
  mockOcrFileWithTesseract,
  mockCreateWorker,
  mockTrackEvent,
} = vi.hoisted(() => {
  const workerInstance = {
    setParameters: vi.fn().mockResolvedValue(undefined),
    terminate: vi.fn().mockResolvedValue(undefined),
  };

  return {
    mockAuthState: {
      user: null as User | null,
    },
    mockToast: {
      error: vi.fn(),
      success: vi.fn(),
    },
    mockFetchWithSecurity: vi.fn(),
    mockCheckDuplicateDocument: vi.fn().mockResolvedValue(null),
    mockLoadMaxima: vi.fn().mockResolvedValue(undefined),
    mockDeleteDocument: vi.fn().mockResolvedValue(undefined),
    mockLoadSentence: vi.fn().mockResolvedValue(undefined),
    mockExtractTextFromFile: vi.fn().mockResolvedValue("Testo valido estratto dal file eccedente cinquanta caratteri di base."),
    mockExtractTextFromMedia: vi.fn().mockResolvedValue("Trascrizione completa estratta dal file audio multimediale registrato."),
    mockGetFileType: vi.fn().mockReturnValue("pdf"),
    mockOcrFileWithTesseract: vi.fn().mockResolvedValue("Testo estratto via OCR da immagine o scansione."),
    mockCreateWorker: vi.fn().mockResolvedValue(workerInstance),
    mockTrackEvent: vi.fn(),
  };
});

/* ---------- mock global uuid ---------- */
vi.mock("uuid", () => ({
  v4: () => "mock-doc-uuid-1234",
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
  extractTextFromFile: (file: File) => mockExtractTextFromFile(file),
  extractTextFromMedia: (file: File) => mockExtractTextFromMedia(file),
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
  checkDuplicateDocument: (uid: string, name: string) => mockCheckDuplicateDocument(uid, name),
  loadMaxima: (...args: unknown[]) => mockLoadMaxima(...args),
  deleteDocument: (...args: unknown[]) => mockDeleteDocument(...args),
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
import { usePdfAnalyzer } from "@/features/profile/hooks/usePdfAnalyzer";

describe("usePdfAnalyzer Hook Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.user = { uid: "usr_flv_2026" } as User;
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  describe("Inizializzazione e Validazione File (validateFile)", () => {
    test("inizializza gli stati con i valori di default corretti", () => {
      const { result } = renderHook(() => usePdfAnalyzer());

      expect(result.current.file).toBeNull();
      expect(result.current.dragActive).toBe(false);
      expect(result.current.loading).toBe(false);
      expect(result.current.progress).toBeNull();
      expect(result.current.extractedText).toBeNull();
      expect(result.current.analysisResult).toBeNull();
      expect(result.current.fileError).toBeNull();
      expect(result.current.denyOpen).toBe(false);
      expect(result.current.isDuplicateModalOpen).toBe(false);
      expect(result.current.duplicateId).toBeNull();
    });

    test("validateFile rifiuta una lista vuota restituendo false", () => {
      const { result } = renderHook(() => usePdfAnalyzer());
      const emptyFileList = createMockFileList([]);

      let isValid = false;
      act(() => {
        isValid = result.current.validateFile(emptyFileList);
      });

      expect(isValid).toBe(false);
      expect(mockToast.error).not.toHaveBeenCalled();
    });

    test("validateFile blocca il caricamento di più di un documento alla volta", () => {
      const { result } = renderHook(() => usePdfAnalyzer());
      const fileList = createMockFileList([
        new File(["1"], "doc1.pdf", { type: "application/pdf" }),
        new File(["2"], "doc2.pdf", { type: "application/pdf" }),
      ]);

      let isValid = false;
      act(() => {
        isValid = result.current.validateFile(fileList);
      });

      expect(isValid).toBe(false);
      expect(mockToast.error).toHaveBeenCalledWith("Puoi caricare un solo documento per volta.");
    });
  });

  describe("Estrazione Testo e OCR (uploadAndAnalyze)", () => {
    test("interrompe l'analisi e traccia errore se l'utente non è autenticato", async () => {
      mockAuthState.user = null;
      const { result } = renderHook(() => usePdfAnalyzer());
      const testFile = new File(["testo"], "ricorso.pdf", { type: "application/pdf" });

      await act(async () => {
        await result.current.uploadAndAnalyze(testFile);
      });

      expect(result.current.loading).toBe(false);
      expect(mockTrackEvent).toHaveBeenCalledWith("analytics_error", {
        name: "uploadAndAnalyze",
        reason: "unauthenticated",
      });
      expect(mockExtractTextFromFile).not.toHaveBeenCalled();
    });

    test("estrae il testo tramite extractTextFromMedia per file audio o video", async () => {
      mockGetFileType.mockReturnValueOnce("audio");
      const { result } = renderHook(() => usePdfAnalyzer());
      const audioFile = new File(["audio-raw"], "registrazione.mp3", { type: "audio/mpeg" });

      await act(async () => {
        await result.current.uploadAndAnalyze(audioFile);
      });

      expect(mockExtractTextFromMedia).toHaveBeenCalledWith(audioFile);
      expect(result.current.extractedText).toBe("Trascrizione completa estratta dal file audio multimediale registrato.");
      expect(mockTrackEvent).toHaveBeenCalledWith("document_uploaded", expect.objectContaining({ file_type: "audio", success: true }));
    });

    test("esegue OCR con Tesseract per file di tipo immagine", async () => {
      mockGetFileType.mockReturnValueOnce("image");
      const { result } = renderHook(() => usePdfAnalyzer());
      const imageFile = new File(["img-bytes"], "verbale.png", { type: "image/png" });

      await act(async () => {
        await result.current.uploadAndAnalyze(imageFile);
      });

      expect(mockCreateWorker).toHaveBeenCalledWith("ita");
      expect(mockOcrFileWithTesseract).toHaveBeenCalled();
      expect(result.current.extractedText).toBe("Testo estratto via OCR da immagine o scansione.");
      expect(mockTrackEvent).toHaveBeenCalledWith("sentenze_ocr", expect.objectContaining({ success: true }));
    });

    test("attiva OCR di fallback su PDF se l'estrazione testuale produce meno di 50 caratteri", async () => {
      mockGetFileType.mockReturnValueOnce("pdf");
      mockExtractTextFromFile.mockResolvedValueOnce("Pochi char");

      const { result } = renderHook(() => usePdfAnalyzer());
      const scanPdf = new File(["pdf-bytes"], "scansione.pdf", { type: "application/pdf" });

      await act(async () => {
        await result.current.uploadAndAnalyze(scanPdf);
      });

      expect(mockExtractTextFromFile).toHaveBeenCalledWith(scanPdf);
      expect(mockCreateWorker).toHaveBeenCalledWith("ita");
      expect(mockOcrFileWithTesseract).toHaveBeenCalled();
      expect(result.current.extractedText).toBe("Testo estratto via OCR da immagine o scansione.");
    });

    test("solleva errore se un file non-PDF produce meno di 50 caratteri senza poter applicare OCR", async () => {
      mockGetFileType.mockReturnValueOnce("docx");
      mockExtractTextFromFile.mockResolvedValueOnce("Troppo corto");

      const { result } = renderHook(() => usePdfAnalyzer());
      const shortDocx = new File(["docx-bytes"], "nota.docx");

      await act(async () => {
        await result.current.uploadAndAnalyze(shortDocx);
      });

      expect(mockToast.error).toHaveBeenCalledWith(
        "Errore nell'analisi del file: Impossibile estrarre testo sufficiente da questo formato."
      );
      expect(result.current.extractedText).toBeNull();
    });

    test("blocca il caricamento e segnala errore se il testo eccede MAX_CHARS (1.000.000)", async () => {
      mockGetFileType.mockReturnValueOnce("pdf");
      const hugeText = "A".repeat(1_000_001);
      mockExtractTextFromFile.mockResolvedValueOnce(hugeText);

      const { result } = renderHook(() => usePdfAnalyzer());
      const hugePdf = new File(["huge-bytes"], "enciclopedia.pdf", { type: "application/pdf" });

      await act(async () => {
        await result.current.uploadAndAnalyze(hugePdf);
      });

      expect(mockToast.error).toHaveBeenCalledWith(
        expect.stringContaining("Il documento è troppo lungo"),
        expect.any(Object)
      );
      expect(result.current.extractedText).toBeNull();
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "document_uploaded",
        expect.objectContaining({ success: false, error_type: "max_chars_exceeded" })
      );
    });
  });

  describe("Controllo Duplicati (analyzeReason)", () => {
    test("blocca l'analisi ed apre il modale duplicati se checkDuplicateDocument restituisce un id", async () => {
      mockCheckDuplicateDocument.mockResolvedValueOnce("doc-duplicate-existing-id");

      const { result } = renderHook(() => usePdfAnalyzer());
      const file = new File(["bytes"], "ricorso.pdf", { type: "application/pdf" });

      act(() => {
        result.current.setFile(file);
        result.current.setExtractedText("Testo estratto e pronto per l'analisi giurisprudenziale.");
      });

      await act(async () => {
        await result.current.analyzeReason("prompt-standard");
      });

      expect(mockCheckDuplicateDocument).toHaveBeenCalledWith("usr_flv_2026", "ricorso.pdf");
      expect(result.current.duplicateId).toBe("doc-duplicate-existing-id");
      expect(result.current.isDuplicateModalOpen).toBe(true);
      expect(mockFetchWithSecurity).not.toHaveBeenCalled();
    });

    test("procede con executeAnalysis se il file non risulta duplicato", async () => {
      mockCheckDuplicateDocument.mockResolvedValueOnce(null);
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockResolvedValue({
          message: JSON.stringify({
            tipo_documento: "Sentenza",
            massima: "Il principio di diritto formulato è conforme...",
          }),
        }),
      });

      const { result } = renderHook(() => usePdfAnalyzer());
      const file = new File(["bytes"], "atto_unico.pdf", { type: "application/pdf" });

      act(() => {
        result.current.setFile(file);
        result.current.setExtractedText("Testo estratto valido per procedere.");
      });

      await act(async () => {
        await result.current.analyzeReason("prompt-1");
      });

      expect(result.current.isDuplicateModalOpen).toBe(false);
      expect(mockFetchWithSecurity).toHaveBeenCalled();
      expect(mockLoadMaxima).toHaveBeenCalled();
    });
  });

  describe("Invocazione API Reason ed Error Handling (executeAnalysis)", () => {
    test("gestisce HTTP 401 segnalando sessione scaduta", async () => {
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockResolvedValue({}),
      });

      const { result } = renderHook(() => usePdfAnalyzer());
      act(() => {
        result.current.setFile(new File([""], "doc.pdf"));
        result.current.setExtractedText("Testo di prova valido.");
      });

      await act(async () => {
        await result.current.executeAnalysis();
      });

      expect(mockToast.error).toHaveBeenCalledWith("Sessione scaduta. Effettua di nuovo l’accesso.");
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "sentence_processed",
        expect.objectContaining({ error_type: "unauthorized_401" })
      );
    });

    test("intercetta HTTP 403 con quota 100 documenti raggiunta", async () => {
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockResolvedValue({ error: "document_limit_reached" }),
      });

      const { result } = renderHook(() => usePdfAnalyzer());
      act(() => {
        result.current.setFile(new File([""], "doc.pdf"));
        result.current.setExtractedText("Testo di prova valido.");
      });

      await act(async () => {
        await result.current.executeAnalysis();
      });

      expect(mockToast.error).toHaveBeenCalledWith(
        expect.stringContaining("Hai raggiunto il limite massimo di 100 documenti."),
        expect.any(Object)
      );
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "sentence_processed",
        expect.objectContaining({ error_type: "document_limit_reached_403" })
      );
    });

    test("intercetta HTTP 403 con Access Denied aprendo il modale denyOpen", async () => {
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockResolvedValue({ error: "Access denied" }),
      });

      const { result } = renderHook(() => usePdfAnalyzer());
      act(() => {
        result.current.setFile(new File([""], "doc.pdf"));
        result.current.setExtractedText("Testo di prova.");
      });

      await act(async () => {
        await result.current.executeAnalysis();
      });

      expect(result.current.denyOpen).toBe(true);
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "sentence_processed",
        expect.objectContaining({ error_type: "access_denied_403" })
      );
    });

    test("gestisce HTTP 400 ed HTTP 413 con i rispettivi toast e tracking", async () => {
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: false,
        status: 413,
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockResolvedValue({}),
      });

      const { result } = renderHook(() => usePdfAnalyzer());
      act(() => {
        result.current.setFile(new File([""], "doc.pdf"));
        result.current.setExtractedText("Testo di prova.");
      });

      await act(async () => {
        await result.current.executeAnalysis();
      });

      expect(mockToast.error).toHaveBeenCalledWith("Documento troppo grande. Riduci il file e riprova.");
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "sentence_processed",
        expect.objectContaining({ error_type: "payload_too_large_413" })
      );
    });

    test("blocca l'elaborazione se la risposta contiene il warning 'input_non_sentenza'", async () => {
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockResolvedValue({
          message: JSON.stringify({ warning: "input_non_sentenza" }),
        }),
      });

      const { result } = renderHook(() => usePdfAnalyzer());
      act(() => {
        result.current.setFile(new File([""], "non_sentenza.pdf"));
        result.current.setExtractedText("Ricetta torta di mele con cannella.");
      });

      await act(async () => {
        await result.current.executeAnalysis();
      });

      expect(mockToast.error).toHaveBeenCalledWith(
        expect.stringContaining("Il testo caricato non sembra un documento giurisprudenziale."),
        expect.any(Object)
      );
      expect(mockLoadMaxima).not.toHaveBeenCalled();
      expect(mockLoadSentence).not.toHaveBeenCalled();
    });

    test("salva con successo su Firestore e Cloud Storage eliminando il vecchio duplicato se specificato", async () => {
      const serverPayload = {
        tipo_documento: "Sentenza",
        massima: "Il ricorso è inammissibile per tardività.",
        dataSentenza: "2026-05-10",
      };

      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockResolvedValue({
          message: JSON.stringify(serverPayload),
        }),
      });

      const { result } = renderHook(() => usePdfAnalyzer());
      const targetFile = new File(["bytes"], "sentenza_appello.pdf", { type: "application/pdf" });

      act(() => {
        result.current.setFile(targetFile);
        result.current.setExtractedText("Testo della sentenza di appello da analizzare.");
        result.current.setIsDuplicateModalOpen(true);
      });

      await act(async () => {
        await result.current.executeAnalysis("prompt-penale", "doc-old-duplicate-id");
      });

      expect(mockLoadMaxima).toHaveBeenCalledWith(
        "mock-doc-uuid-1234",
        expect.objectContaining({
          nome_file: "sentenza_appello.pdf",
          promptId: "prompt-penale",
          massima: "Il ricorso è inammissibile per tardività.",
        }),
        "usr_flv_2026",
        "documents",
        "Testo della sentenza di appello da analizzare."
      );
      expect(mockLoadSentence).toHaveBeenCalledWith(
        targetFile,
        "mock-doc-uuid-1234",
        "users/usr_flv_2026/documents"
      );

      expect(mockDeleteDocument).toHaveBeenCalledWith("documents", "doc-old-duplicate-id");
      expect(result.current.duplicateId).toBeNull();
      expect(mockToast.success).toHaveBeenCalledWith("Documento precedente sovrascritto con successo.");
      expect(result.current.analysisResult).toBe(JSON.stringify(serverPayload));
    });
  });

  describe("Eventi Drag & Drop", () => {
    test("handleDrag attiva o disattiva dragActive in base al tipo di evento", () => {
      const { result } = renderHook(() => usePdfAnalyzer());

      const enterEvent = {
        type: "dragenter",
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as React.DragEvent<HTMLElement>;

      act(() => {
        result.current.handleDrag(enterEvent);
      });
      expect(result.current.dragActive).toBe(true);

      const leaveEvent = {
        type: "dragleave",
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as React.DragEvent<HTMLElement>;

      act(() => {
        result.current.handleDrag(leaveEvent);
      });
      expect(result.current.dragActive).toBe(false);
    });

    test("handleDrop disattiva il drag e avvia l'elaborazione del file rilasciato", async () => {
      const { result } = renderHook(() => usePdfAnalyzer());
      const droppedFile = new File(["dropped-content"], "rilasciato.pdf", { type: "application/pdf" });

      const dropEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        dataTransfer: {
          files: [droppedFile],
        },
      } as unknown as React.DragEvent<HTMLElement>;

      await act(async () => {
        result.current.handleDrop(dropEvent);
      });

      expect(result.current.dragActive).toBe(false);
      await waitFor(() => {
        expect(result.current.file).toBe(droppedFile);
      });
    });
  });
});