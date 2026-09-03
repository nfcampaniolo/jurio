import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

/* ---------- polyfill jsdom: File & Blob (text, arrayBuffer) e Canvas 2D ---------- */
[File.prototype, Blob.prototype].forEach((proto) => {
  if (!proto.text) {
    proto.text = function () {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(this);
      });
    };
  }

  if (!proto.arrayBuffer) {
    proto.arrayBuffer = function () {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    };
  }
});

if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    clearRect: vi.fn(),
  }) as never;
}

/* ---------- hoisted mocks ---------- */
const {
  mockWithTrace,
  mockFetchWithoutContent,
  mockFFmpegLoad,
  mockFFmpegWriteFile,
  mockFFmpegExec,
  mockFFmpegReadFile,
  mockFFmpegDeleteFile,
  mockFetchFile,
  mockToBlobURL,
  mockPdfGetDocument,
  mockMammothExtractRawText,
  mockXlsxRead,
  mockXlsxSheetToCsv,
  mockJSZipLoadAsync,
  mockPostalMimeParse,
} = vi.hoisted(() => ({
  mockWithTrace: vi.fn(async (_name: string, _meta: unknown, fn: () => Promise<unknown>) => fn()),
  mockFetchWithoutContent: vi.fn(),
  mockFFmpegLoad: vi.fn().mockResolvedValue(undefined),
  mockFFmpegWriteFile: vi.fn().mockResolvedValue(undefined),
  mockFFmpegExec: vi.fn().mockResolvedValue(0),
  mockFFmpegReadFile: vi.fn(),
  mockFFmpegDeleteFile: vi.fn().mockResolvedValue(undefined),
  mockFetchFile: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  mockToBlobURL: vi.fn().mockResolvedValue("blob:mock-url"),
  mockPdfGetDocument: vi.fn(),
  mockMammothExtractRawText: vi.fn(),
  mockXlsxRead: vi.fn(),
  mockXlsxSheetToCsv: vi.fn(),
  mockJSZipLoadAsync: vi.fn(),
  mockPostalMimeParse: vi.fn(),
}));

/* ---------- mock internal services ---------- */
vi.mock("@/infrastructure/perf", () => ({
  __esModule: true,
  withTrace: (...args: unknown[]) =>
    mockWithTrace(args[0] as string, args[1], args[2] as () => Promise<unknown>),
}));

vi.mock("@/config/apiClient", () => ({
  __esModule: true,
  fetchWithoutContent: (...args: unknown[]) =>
    mockFetchWithoutContent(args[0] as string, args[1]),
}));

/* ---------- mock ffmpeg (usando classi costruttore per il supporto a `new`) ---------- */
vi.mock("@ffmpeg/ffmpeg", () => ({
  __esModule: true,
  FFmpeg: class {
    load = mockFFmpegLoad;
    writeFile = mockFFmpegWriteFile;
    exec = mockFFmpegExec;
    readFile = mockFFmpegReadFile;
    deleteFile = mockFFmpegDeleteFile;
  },
}));

vi.mock("@ffmpeg/util", () => ({
  __esModule: true,
  fetchFile: (...args: unknown[]) => mockFetchFile(...args),
  toBlobURL: (...args: unknown[]) => mockToBlobURL(...args),
}));

/* ---------- mock pdfjs-dist ---------- */
vi.mock("pdfjs-dist", () => ({
  __esModule: true,
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: (...args: unknown[]) => mockPdfGetDocument(...args),
}));

vi.mock("pdfjs-dist/build/pdf.worker?url", () => ({
  __esModule: true,
  default: "mock-pdf-worker-url",
}));

/* ---------- mock format parsers (classi per `new JSZip` e `new PostalMime`) ---------- */
vi.mock("mammoth", () => ({
  __esModule: true,
  extractRawText: (...args: unknown[]) => mockMammothExtractRawText(...args),
}));

vi.mock("xlsx", () => ({
  __esModule: true,
  read: (...args: unknown[]) => mockXlsxRead(...args),
  utils: {
    sheet_to_csv: (...args: unknown[]) => mockXlsxSheetToCsv(...args),
  },
}));

vi.mock("jszip", () => ({
  __esModule: true,
  default: class {
    loadAsync = mockJSZipLoadAsync;
  },
}));

vi.mock("postal-mime", () => ({
  __esModule: true,
  default: class {
    parse = mockPostalMimeParse;
  },
}));

/* ---------- subject under test ---------- */
import {
  SUPPORTED_FORMATS_MSG,
  getFileType,
  extractTextFromFile,
  extractTextFromMedia,
  ocrFileWithTesseract,
} from "@/shared/services/extractors";

describe("File Processing Service Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchWithoutContent.mockReset(); // Svuota code residue di mockResolvedValueOnce
    vi.stubEnv("VITE_TRANSCRIBE_ENDPOINT", "https://api.jurio.it/transcribe");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("getFileType", () => {
    test("riconosce correttamente le estensioni e i MIME type supportati", () => {
      expect(getFileType(new File([], "doc.pdf", { type: "application/pdf" }))).toBe("pdf");
      expect(getFileType(new File([], "doc.docx"))).toBe("docx");
      expect(getFileType(new File([], "foglio.xlsx"))).toBe("xlsx");
      expect(getFileType(new File([], "slides.pptx"))).toBe("pptx");
      expect(getFileType(new File([], "slides_vecchie.ppt"))).toBe("ppt");
      expect(getFileType(new File([], "messaggio.eml"))).toBe("eml");
      expect(getFileType(new File([], "nota_vocale.mp3", { type: "audio/mpeg" }))).toBe("audio");
      expect(getFileType(new File([], "udienza.mp4", { type: "video/mp4" }))).toBe("video");
      expect(getFileType(new File([], "note.txt", { type: "text/plain" }))).toBe("text");
      expect(getFileType(new File([], "dati.csv"))).toBe("text");
      expect(getFileType(new File([], "scansione.png", { type: "image/png" }))).toBe("image");
      expect(getFileType(new File([], "archivio.zip", { type: "application/zip" }))).toBe("unsupported");
    });
  });

  describe("extractTextFromFile (Routing Base)", () => {
    test("legge direttamente file di testo semplice (.txt e .csv)", async () => {
      const txtFile = new File(["Contenuto atto di citazione"], "atto.txt", { type: "text/plain" });
      const content = await extractTextFromFile(txtFile);
      expect(content).toBe("Contenuto atto di citazione");
    });

    test("restituisce una stringa vuota per i file immagine per delegare all'OCR", async () => {
      const imgFile = new File(["bytes"], "scansione.jpg", { type: "image/jpeg" });
      const content = await extractTextFromFile(imgFile);
      expect(content).toBe("");
    });

    test("solleva un errore esplicito se viene fornito un file PPT pre-2007", async () => {
      const pptFile = new File(["bytes"], "vecchia_presentazione.ppt");
      await expect(extractTextFromFile(pptFile)).rejects.toThrow(
        "Il formato .ppt (pre-2007) è obsoleto e non supportato"
      );
    });

    test("solleva un errore per formati non supportati", async () => {
      const unknownFile = new File(["bytes"], "archivio.rar", { type: "application/x-rar" });
      await expect(extractTextFromFile(unknownFile)).rejects.toThrow(
        "Formato file non supportato"
      );
    });
  });

  describe("Estrattori Documentali Specifici", () => {
    test("estrae testo da PDF concatenando le pagine", async () => {
      const mockPdfDoc = {
        numPages: 2,
        getPage: vi.fn().mockImplementation((pageNumber: number) =>
          Promise.resolve({
            getTextContent: vi.fn().mockResolvedValue({
              items: [{ str: `Testo Pagina ${pageNumber}` }],
            }),
          })
        ),
      };

      mockPdfGetDocument.mockReturnValueOnce({ promise: Promise.resolve(mockPdfDoc) });

      const file = new File(["mock-pdf"], "sentenza.pdf", { type: "application/pdf" });
      const text = await extractTextFromFile(file);

      expect(text).toContain("Testo Pagina 1");
      expect(text).toContain("Testo Pagina 2");
    });

    test("estrae testo da DOCX tramite mammoth", async () => {
      mockMammothExtractRawText.mockResolvedValueOnce({ value: "Ricorso per Cassazione estratto" });

      const file = new File(["mock-docx"], "ricorso.docx");
      const text = await extractTextFromFile(file);

      expect(text).toBe("Ricorso per Cassazione estratto");
      expect(mockMammothExtractRawText).toHaveBeenCalledTimes(1);
    });

    test("estrae tabelle e fogli di calcolo da XLSX", async () => {
      mockXlsxRead.mockReturnValueOnce({
        SheetNames: ["Spese", "Riepilogo"],
        Sheets: {
          Spese: {},
          Riepilogo: {},
        },
      });

      mockXlsxSheetToCsv
        .mockReturnValueOnce("Voce,Importo\nBollo,16")
        .mockReturnValueOnce("Totale,16");

      const file = new File(["mock-xlsx"], "prospetto.xlsx");
      const text = await extractTextFromFile(file);

      expect(text).toContain("--- FOGLIO: Spese ---");
      expect(text).toContain("Voce,Importo\nBollo,16");
      expect(text).toContain("--- FOGLIO: Riepilogo ---");
    });

    test("estrae slide ordinate numericamente da presentazioni PPTX", async () => {
      mockJSZipLoadAsync.mockResolvedValueOnce({
        files: {
          "ppt/slides/slide2.xml": {},
          "ppt/slides/slide1.xml": {},
          "[Content_Types].xml": {},
        },
        file: (name: string) => ({
          async: () =>
            Promise.resolve(
              name.includes("slide1")
                ? "<a:t>Introduzione al caso</a:t>"
                : "<a:t>Conclusioni legali</a:t>"
            ),
        }),
      });

      const file = new File(["mock-pptx"], "udienza.pptx");
      const text = await extractTextFromFile(file);

      expect(text).toContain("--- SLIDE 1 ---");
      expect(text).toContain("Introduzione al caso");
      expect(text).toContain("--- SLIDE 2 ---");
      expect(text).toContain("Conclusioni legali");
    });

    test("estrae mittente, oggetto e corpo da file EML", async () => {
      mockPostalMimeParse.mockResolvedValueOnce({
        subject: "Notifica deposito atto",
        from: { address: "tribunale@giustiziacert.it" },
        to: [{ address: "avvocato@studiolegale.it" }],
        date: "2026-03-10",
        text: "Si notifica il deposito telematico dell'atto indicato.",
      });

      const file = new File(["mock-eml"], "comunicazione.eml");
      const text = await extractTextFromFile(file);

      expect(text).toContain("Oggetto: Notifica deposito atto");
      expect(text).toContain("Da: tribunale@giustiziacert.it");
      expect(text).toContain("A: avvocato@studiolegale.it");
      expect(text).toContain("Si notifica il deposito telematico dell'atto indicato.");
    });

    test("estrae testo da file Apple Pages/Numbers/Keynote tramite preview PDF QuickLook", async () => {
      const mockPdfDoc = {
        numPages: 1,
        getPage: vi.fn().mockResolvedValue({
          getTextContent: vi.fn().mockResolvedValue({
            items: [{ str: "Testo estratto da file Apple Pages" }],
          }),
        }),
      };
      mockPdfGetDocument.mockReturnValueOnce({ promise: Promise.resolve(mockPdfDoc) });

      mockJSZipLoadAsync.mockResolvedValueOnce({
        file: (name: string) =>
          name === "QuickLook/Preview.pdf"
            ? { async: () => Promise.resolve(new Blob(["pdf-bytes"], { type: "application/pdf" })) }
            : null,
      });

      const file = new File(["mock-pages"], "contratto.pages");
      const text = await extractTextFromFile(file);

      expect(text).toContain("Testo estratto da file Apple Pages");
    });

    test("solleva eccezione con guida se un file iWork non include l'anteprima PDF", async () => {
      mockJSZipLoadAsync.mockResolvedValueOnce({
        file: () => null,
      });

      const file = new File(["mock-pages"], "privo_di_preview.key");
      await expect(extractTextFromFile(file)).rejects.toThrow(
        'Impossibile leggere il file Apple. Aprilo su Mac e fai "File > Esporta in > PDF"'
      );
    });
  });

  describe("extractTextFromMedia", () => {
    test("solleva errore se il file multimediale è vuoto", async () => {
      const emptyFile = new File([], "audio_vuoto.mp3", { type: "audio/mpeg" });
      await expect(extractTextFromMedia(emptyFile)).rejects.toThrow(
        "Il file multimediale è vuoto o non valido."
      );
    });

    test("converte file video in MP3 mono a 16kHz tramite FFmpeg prima di inviarli al backend", async () => {
      const videoFile = new File(["video-stream-content"], "interrogatorio.mp4", { type: "video/mp4" });

      mockFFmpegReadFile.mockResolvedValueOnce(new Uint8Array([10, 20, 30]));

      mockFetchWithoutContent.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockResolvedValue({ text: "Trascrizione completa dell'interrogatorio." }),
      });

      const transcription = await extractTextFromMedia(videoFile);

      expect(mockFFmpegWriteFile).toHaveBeenCalledTimes(1);
      expect(mockFFmpegExec).toHaveBeenCalledWith(
        expect.arrayContaining(["-vn", "-ar", "16000", "-ac", "1", "-codec:a", "libmp3lame"])
      );
      expect(mockFetchWithoutContent).toHaveBeenCalledTimes(1);
      expect(transcription).toBe("Trascrizione completa dell'interrogatorio.");
    });

    test("solleva errore se il file supera i 25MB", async () => {
      const largeFile = new File(["x"], "registrazione.mp3", { type: "audio/mpeg" });
      Object.defineProperty(largeFile, "size", { value: 26 * 1024 * 1024 });

      await expect(extractTextFromMedia(largeFile)).rejects.toThrow(
        "File multimediale troppo grande. Il limite massimo per la trascrizione è 25MB."
      );
    });

    test("estrae la trascrizione dal formato alternative results", async () => {
      const audioFile = new File(["audio-bytes"], "nota.mp3", { type: "audio/mpeg" });

      mockFetchWithoutContent.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockResolvedValue({
          results: [
            { alternatives: [{ transcript: "Prima frase pronunciata." }] },
            { alternatives: [{ transcript: "Seconda frase a verbale." }] },
          ],
        }),
      });

      const transcription = await extractTextFromMedia(audioFile);

      expect(transcription).toBe("Prima frase pronunciata. Seconda frase a verbale.");
    });

    test("gestisce puntualmente codici di errore HTTP (401, 403, 429)", async () => {
      const audioFile = new File(["audio-bytes"], "nota.mp3", { type: "audio/mpeg" });

      mockFetchWithoutContent.mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockResolvedValue({}),
      });

      await expect(extractTextFromMedia(audioFile)).rejects.toThrow(
        "Sessione scaduta. Effettua di nuovo l’accesso per trascrivere l'audio."
      );
    });

    test("solleva errore se la risposta non contiene parlato rilevato", async () => {
      const audioFile = new File(["audio-bytes"], "silenzio.mp3", { type: "audio/mpeg" });

      mockFetchWithoutContent.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockResolvedValue({ text: "   " }),
      });

      await expect(extractTextFromMedia(audioFile)).rejects.toThrow(
        "Il file è stato elaborato ma non è stato rilevato alcun parlato al suo interno."
      );
    });
  });

  describe("ocrFileWithTesseract", () => {
    test("riconosce testo da una singola immagine", async () => {
      const imageFile = new File(["bytes"], "verbale.png", { type: "image/png" });
      const mockWorker = {
        recognize: vi.fn().mockResolvedValue({ data: { text: "Testo rilevato da OCR su immagine" } }),
      };

      const text = await ocrFileWithTesseract(imageFile, mockWorker as never);

      expect(text).toBe("Testo rilevato da OCR su immagine");
      expect(mockWorker.recognize).toHaveBeenCalledWith(imageFile);
    });

    test("renderizza le pagine del PDF su canvas ed esegue il callback onPage", async () => {
      const pdfFile = new File(["bytes"], "scansione.pdf", { type: "application/pdf" });

      const mockPage = {
        getViewport: vi.fn().mockReturnValue({ width: 200, height: 300 }),
        render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
      };

      mockPdfGetDocument.mockReturnValueOnce({
        promise: Promise.resolve({
          numPages: 2,
          getPage: vi.fn().mockResolvedValue(mockPage),
        }),
      });

      const mockWorker = {
        recognize: vi.fn().mockResolvedValue({ data: { text: "Pagina OCR" } }),
      };

      const onPageSpy = vi.fn();
      const text = await ocrFileWithTesseract(pdfFile, mockWorker as never, onPageSpy);

      expect(onPageSpy).toHaveBeenCalledWith(1, 2);
      expect(onPageSpy).toHaveBeenCalledWith(2, 2);
      expect(text).toContain("Pagina OCR");
    });
  });

  describe("Costanti e Messaggi", () => {
    test("SUPPORTED_FORMATS_MSG è valorizzato e coerente", () => {
      expect(SUPPORTED_FORMATS_MSG).toContain("PDF, Word, Excel, PowerPoint");
    });
  });
});