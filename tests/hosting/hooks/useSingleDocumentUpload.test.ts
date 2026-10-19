import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSingleDocumentUpload } from "@/features/admin/hooks/useSingleDocumentUpload";
import { useAuth } from "@/context/useAuth";
import { trackEvent } from "@/infrastructure/analytics";
import { fetchWithSecurity } from "@/config/apiClient";
import { extractTextFromFile } from "@/shared/services/extractors";
import { toast } from "react-hot-toast";

/* ---------- mock moduli esterni ---------- */
vi.mock("@/context/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/infrastructure/analytics", () => ({
  trackEvent: vi.fn(),
}));

vi.mock("@/infrastructure/perf", () => ({
  withTrace: vi.fn(
    async (
      _name: string,
      _meta: unknown,
      fn: () => Promise<unknown>
    ) => await fn()
  ),
}));

vi.mock("@/config/apiClient", () => ({
  fetchWithSecurity: vi.fn(),
}));

vi.mock("@/shared/services/extractors", () => ({
  extractTextFromFile: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(() => "toast-id-123"),
    dismiss: vi.fn(),
  },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedFetchWithSecurity = vi.mocked(fetchWithSecurity);
const mockedExtractTextFromFile = vi.mocked(extractTextFromFile);
const mockedTrackEvent = vi.mocked(trackEvent);

describe("useSingleDocumentUpload Hook Suite", () => {
  const mockEndpoint =
    "https://api.jurio.it/admin/doctrine/upload";

  beforeEach(() => {
    vi.clearAllMocks();

    // Il hook legge questa variabile durante l'importazione.
    // Deve quindi essere definita anche nel setup/configurazione Vitest.
    vi.stubEnv("VITE_DOCTRINE_ADMIN_ENDPOINT", mockEndpoint);

    mockedUseAuth.mockReturnValue({
      user: {
        uid: "admin-123",
        email: "admin@jurio.it",
      } as unknown,
    } as ReturnType<typeof useAuth>);

    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  test("inizializza lo stato con i valori predefiniti", () => {
    const { result } = renderHook(() => useSingleDocumentUpload());

    expect(result.current.file).toBeNull();
    expect(result.current.url).toBe("");
    expect(result.current.extractedText).toBe("");
    expect(result.current.dragActive).toBe(false);
    expect(result.current.loading).toBe(false);
    expect(result.current.isExtracting).toBe(false);
  });

  test("rifiuta i file che non sono PDF e mostra un messaggio di errore", async () => {
    const { result } = renderHook(() => useSingleDocumentUpload());

    const invalidFile = new File(["testo"], "documento.txt", {
      type: "text/plain",
    });

    await act(async () => {
      await result.current.handleFileSelect(invalidFile);
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Formato non valido. Carica solo file .pdf"
    );
    expect(result.current.file).toBeNull();
    expect(mockedExtractTextFromFile).not.toHaveBeenCalled();
  });

  test("estrae il testo da un PDF valido e aggiorna lo stato", async () => {
    const validText =
      "Questo è un testo lungo estratto da un documento di dottrina giuridica.";

    mockedExtractTextFromFile.mockResolvedValueOnce(validText);

    const { result } = renderHook(() => useSingleDocumentUpload());

    const pdfFile = new File(["pdf data"], "relazione.pdf", {
      type: "application/pdf",
    });

    await act(async () => {
      await result.current.handleFileSelect(pdfFile);
    });

    expect(mockedExtractTextFromFile).toHaveBeenCalledWith(pdfFile);
    expect(result.current.file).toBe(pdfFile);
    expect(result.current.extractedText).toBe(validText);

    expect(toast.success).toHaveBeenCalledWith(
      "Testo estratto con successo!",
      { id: "toast-id-123" }
    );

    expect(result.current.isExtracting).toBe(false);
  });

  test("gestisce il testo troppo breve durante l'estrazione PDF", async () => {
    mockedExtractTextFromFile.mockResolvedValueOnce("Breve");

    const { result } = renderHook(() => useSingleDocumentUpload());

    const pdfFile = new File(["pdf data"], "vuoto.pdf", {
      type: "application/pdf",
    });

    await act(async () => {
      await result.current.handleFileSelect(pdfFile);
    });

    expect(result.current.file).toBe(pdfFile);
    expect(result.current.extractedText).toBe("");

    expect(toast.error).toHaveBeenCalledWith(
      "Nessun testo rilevato. Puoi incollarlo manualmente.",
      {
        id: "toast-id-123",
        duration: 4000,
      }
    );

    expect(result.current.isExtracting).toBe(false);
  });

  test("gestisce un errore durante l'estrazione PDF", async () => {
    mockedExtractTextFromFile.mockRejectedValueOnce(
      new Error("Errore lettura PDF")
    );

    const { result } = renderHook(() => useSingleDocumentUpload());

    const pdfFile = new File(["pdf data"], "errore.pdf", {
      type: "application/pdf",
    });

    await act(async () => {
      await result.current.handleFileSelect(pdfFile);
    });

    expect(result.current.file).toBe(pdfFile);
    expect(result.current.extractedText).toBe("");

    expect(toast.error).toHaveBeenCalledWith(
      "Nessun testo rilevato. Puoi incollarlo manualmente.",
      {
        id: "toast-id-123",
        duration: 4000,
      }
    );

    expect(result.current.isExtracting).toBe(false);
  });

  test("removeFile e resetForm azzerano correttamente lo stato", async () => {
    mockedExtractTextFromFile.mockResolvedValueOnce(
      "Testo estratto con lunghezza sufficiente."
    );

    const { result } = renderHook(() => useSingleDocumentUpload());

    const pdfFile = new File(["pdf data"], "relazione.pdf", {
      type: "application/pdf",
    });

    await act(async () => {
      await result.current.handleFileSelect(pdfFile);
    });

    act(() => {
      result.current.setUrl(
        "https://www.cortedicassazione.it/relazione.pdf"
      );
    });

    expect(result.current.file).toBe(pdfFile);
    expect(result.current.url).toBe(
      "https://www.cortedicassazione.it/relazione.pdf"
    );

    act(() => {
      result.current.removeFile();
    });

    expect(result.current.file).toBeNull();
    expect(result.current.extractedText).toBe("");

    act(() => {
      result.current.setUrl(
        "https://www.cortedicassazione.it/relazione.pdf"
      );
      result.current.setExtractedText("Testo da cancellare");
      result.current.resetForm();
    });

    expect(result.current.file).toBeNull();
    expect(result.current.url).toBe("");
    expect(result.current.extractedText).toBe("");
  });

  test("validateAndSubmit blocca l'invio se manca l'utente", async () => {
    mockedUseAuth.mockReturnValue({
      user: null,
    } as ReturnType<typeof useAuth>);

    const { result } = renderHook(() => useSingleDocumentUpload());

    await act(async () => {
      await result.current.validateAndSubmit();
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Devi essere autenticato."
    );

    expect(mockedFetchWithSecurity).not.toHaveBeenCalled();
  });

  test("validateAndSubmit blocca l'invio se manca il file", async () => {
    const { result } = renderHook(() => useSingleDocumentUpload());

    await act(async () => {
      await result.current.validateAndSubmit();
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Devi caricare un documento PDF."
    );

    expect(mockedFetchWithSecurity).not.toHaveBeenCalled();
  });

  test("validateAndSubmit blocca l'invio se manca l'URL", async () => {
    mockedExtractTextFromFile.mockResolvedValueOnce(
      "Testo valido estratto dal PDF."
    );

    const { result } = renderHook(() => useSingleDocumentUpload());

    const pdfFile = new File(["data"], "doc.pdf", {
      type: "application/pdf",
    });

    await act(async () => {
      await result.current.handleFileSelect(pdfFile);
    });

    await act(async () => {
      await result.current.validateAndSubmit();
    });

    expect(toast.error).toHaveBeenCalledWith(
      "L'URL della fonte è obbligatorio."
    );

    expect(mockedFetchWithSecurity).not.toHaveBeenCalled();
  });

  test("validateAndSubmit blocca l'invio se manca il testo estratto", async () => {
    mockedExtractTextFromFile.mockResolvedValueOnce(
      "Testo valido estratto dal PDF."
    );

    const { result } = renderHook(() => useSingleDocumentUpload());

    const pdfFile = new File(["data"], "doc.pdf", {
      type: "application/pdf",
    });

    await act(async () => {
      await result.current.handleFileSelect(pdfFile);
    });

    act(() => {
      result.current.setUrl(
        "https://www.cortedicassazione.it/doc.pdf"
      );
      result.current.setExtractedText("");
    });

    await act(async () => {
      await result.current.validateAndSubmit();
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Il testo estratto è obbligatorio."
    );

    expect(mockedFetchWithSecurity).not.toHaveBeenCalled();
  });

  test("validateAndSubmit invia con successo il documento, traccia l'evento e resetta il form", async () => {
    mockedExtractTextFromFile.mockResolvedValueOnce(
      "Testo giurisprudenziale di prova."
    );

    mockedFetchWithSecurity.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    } as Response);

    const { result } = renderHook(() => useSingleDocumentUpload());

    const pdfFile = new File(["data"], "doc.pdf", {
      type: "application/pdf",
    });

    await act(async () => {
      await result.current.handleFileSelect(pdfFile);
    });

    act(() => {
      result.current.setUrl(
        "https://www.cortedicassazione.it/doc.pdf"
      );
    });

    await act(async () => {
      await result.current.validateAndSubmit();
    });

    expect(mockedFetchWithSecurity).toHaveBeenCalledWith(
      mockEndpoint,
      {
        sourceUrl: "https://www.cortedicassazione.it/doc.pdf",
        extractedText: "Testo giurisprudenziale di prova.",
      }
    );

    expect(mockedTrackEvent).toHaveBeenCalledWith(
      "doctrine_processed",
      expect.objectContaining({ success: true })
    );

    expect(toast.success).toHaveBeenCalledWith(
      "Documento indicizzato con successo!"
    );

    expect(result.current.file).toBeNull();
    expect(result.current.url).toBe("");
    expect(result.current.extractedText).toBe("");
    expect(result.current.loading).toBe(false);
  });

  test("validateAndSubmit mostra l'errore restituito dal backend", async () => {
    mockedExtractTextFromFile.mockResolvedValueOnce(
      "Testo giurisprudenziale di prova."
    );

    mockedFetchWithSecurity.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        details: "Errore di parsing del modello AI",
      }),
    } as Response);

    const { result } = renderHook(() => useSingleDocumentUpload());

    const pdfFile = new File(["data"], "doc.pdf", {
      type: "application/pdf",
    });

    await act(async () => {
      await result.current.handleFileSelect(pdfFile);
    });

    act(() => {
      result.current.setUrl(
        "https://www.cortedicassazione.it/doc.pdf"
      );
    });

    await act(async () => {
      await result.current.validateAndSubmit();
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Errore analisi: Errore di parsing del modello AI",
      { duration: 6000 }
    );

    expect(mockedTrackEvent).toHaveBeenCalledWith(
      "doctrine_processed",
      expect.objectContaining({
        success: false,
        error_type: "Errore di parsing del modello AI",
      })
    );

    expect(mockedTrackEvent).toHaveBeenCalledWith(
      "analytics_error",
      expect.objectContaining({
        name: "admin_doctrine_upload",
        reason: "Errore di parsing del modello AI",
      })
    );

    expect(result.current.loading).toBe(false);
  });

  test("validateAndSubmit usa lo status HTTP se il backend non fornisce dettagli", async () => {
    mockedExtractTextFromFile.mockResolvedValueOnce(
      "Testo giurisprudenziale di prova."
    );

    mockedFetchWithSecurity.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({}),
    } as Response);

    const { result } = renderHook(() => useSingleDocumentUpload());

    const pdfFile = new File(["data"], "doc.pdf", {
      type: "application/pdf",
    });

    await act(async () => {
      await result.current.handleFileSelect(pdfFile);
    });

    act(() => {
      result.current.setUrl(
        "https://www.cortedicassazione.it/doc.pdf"
      );
    });

    await act(async () => {
      await result.current.validateAndSubmit();
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Errore analisi: Errore HTTP 403",
      { duration: 6000 }
    );

    expect(result.current.loading).toBe(false);
  });
});
