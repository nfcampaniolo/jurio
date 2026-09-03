import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

/* ---------- hoisted mocks ---------- */
const {
  mockTrackEvent,
  mockFetchWithSecurity,
  mockGetDb,
  mockDoc,
  mockGetDoc,
} = vi.hoisted(() => ({
  mockTrackEvent: vi.fn(),
  mockFetchWithSecurity: vi.fn(),
  mockGetDb: vi.fn().mockResolvedValue({ firestore: "mockDb" }),
  mockDoc: vi.fn((...args: unknown[]) => ({
    collection: args[1] as string,
    id: args[2] as string,
  })),
  mockGetDoc: vi.fn(),
}));

/* ---------- mock modules ---------- */
vi.mock("@/infrastructure/analytics", () => ({
  __esModule: true,
  trackEvent: (event: string, payload: Record<string, unknown>) =>
    mockTrackEvent(event, payload),
}));

vi.mock("@/config/apiClient", () => ({
  __esModule: true,
  fetchWithSecurity: (url: string, body: unknown) =>
    mockFetchWithSecurity(url, body),
}));

vi.mock("@/infrastructure/db", () => ({
  __esModule: true,
  getDb: () => mockGetDb(),
}));

/* ---------- mock modules ---------- */
vi.mock("firebase/firestore", () => ({
  __esModule: true,
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (ref: unknown) => mockGetDoc(ref),
}));

/* ---------- subject under test ---------- */
import { fetchApplyCoupon, fetchUserCoupon } from "@/features/plans/hooks/discount"; // <-- adegua il path del file

describe("Coupon Service Suite", () => {
  const mockApiUrl = "https://api.jurio.it/apply-discount";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_APPLY_DISCOUNT_URL", mockApiUrl);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  describe("fetchApplyCoupon", () => {
    test("restituisce i dettagli del coupon applicato con successo", async () => {
      const serverResponse = {
        status: "SUCCESS",
        coupon: {
          code: "JURIO2026",
          percentage: 20,
          durationLabel: "Per i primi 3 mesi",
        },
      };

      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(JSON.stringify(serverResponse)),
      });

      const result = await fetchApplyCoupon("JURIO2026");

      expect(mockFetchWithSecurity).toHaveBeenCalledWith(mockApiUrl, {
        couponCode: "JURIO2026",
      });
      expect(result).toEqual({
        code: "JURIO2026",
        percentage: 20,
        durationLabel: "Per i primi 3 mesi",
      });
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    test("solleva errore con messaggio specifico dal backend e traccia analytics quando la chiamata fallisce", async () => {
      const errorResponse = { error: "Codice promozionale scaduto" };

      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue(JSON.stringify(errorResponse)),
      });

      await expect(fetchApplyCoupon("EXPIRED10")).rejects.toThrow(
        "Codice promozionale scaduto"
      );

      expect(mockTrackEvent).toHaveBeenCalledWith("analytics_error", {
        name: "fetchApplyCoupon",
        reason: `applyCoupon failed (400): ${JSON.stringify(errorResponse)}`,
      });
    });

    test("utilizza il messaggio di fallback se l'errore HTTP restituisce un payload non JSON", async () => {
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue("Internal Server Error"),
      });

      await expect(fetchApplyCoupon("TEST500")).rejects.toThrow(
        "Errore durante l'applicazione del codice promozionale."
      );

      expect(mockTrackEvent).toHaveBeenCalledWith("analytics_error", {
        name: "fetchApplyCoupon",
        reason: "applyCoupon failed (500): Internal Server Error",
      });
    });

    test("solleva errore e traccia analytics se il server risponde 200 ma il formato è invalido o incompleto", async () => {
      const invalidPayload = { status: "ERROR", coupon: null };

      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(JSON.stringify(invalidPayload)),
      });

      await expect(fetchApplyCoupon("BADFORMAT")).rejects.toThrow(
        "Risposta non valida dal server"
      );

      expect(mockTrackEvent).toHaveBeenCalledWith("analytics_error", {
        name: "fetchApplyCoupon",
        reason: "Invalid format from server",
      });
    });
  });

  describe("fetchUserCoupon", () => {
    test("restituisce null immediatamente se uid è una stringa vuota", async () => {
      const result = await fetchUserCoupon("");

      expect(result).toBeNull();
      expect(mockGetDb).not.toHaveBeenCalled();
      expect(mockGetDoc).not.toHaveBeenCalled();
    });

    test("restituisce null se il documento utente non esiste su Firestore", async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      const result = await fetchUserCoupon("usr_non_existent");

      expect(mockDoc).toHaveBeenCalledWith({ firestore: "mockDb" }, "register", "usr_non_existent");
      expect(result).toBeNull();
    });

    test("restituisce null se l'utente esiste ma non possiede alcun coupon assegnato", async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ email: "flavio@jurio.it" }),
      });

      const result = await fetchUserCoupon("usr_flv_2026");

      expect(result).toBeNull();
    });

    test("restituisce i dati del coupon senza data di scadenza (sconto valido indefinitamente)", async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          coupon: {
            name: "WELCOME_JURIO",
            discount: 15,
          },
        }),
      });

      const result = await fetchUserCoupon("usr_flv_2026");

      expect(result).toEqual({
        code: "WELCOME_JURIO",
        percentage: 15,
        durationLabel: "Sconto riservato al tuo account",
      });
    });

    test("restituisce i dati del coupon con Timestamp Firestore futuro", async () => {
      const futureDate = new Date("2026-12-31T23:59:59Z");
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          coupon: {
            name: "SPECIAL_VIP",
            discount: 30,
            expire: {
              toDate: () => futureDate,
            },
          },
        }),
      });

      const result = await fetchUserCoupon("usr_flv_2026");

      expect(result).toEqual({
        code: "SPECIAL_VIP",
        percentage: 30,
        durationLabel: "Sconto riservato al tuo account",
      });
    });

    test("restituisce null se la data di scadenza del coupon è già passata", async () => {
      const pastDate = new Date("2025-01-01T00:00:00Z");
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          coupon: {
            name: "EXPIRED_OFFER",
            discount: 50,
            expire: pastDate.toISOString(),
          },
        }),
      });

      const result = await fetchUserCoupon("usr_flv_2026");

      expect(result).toBeNull();
    });

    test("applica 0 come default del percentage se discount non è presente nel coupon", async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          coupon: {
            name: "ZERO_DISCOUNT_CODE",
          },
        }),
      });

      const result = await fetchUserCoupon("usr_flv_2026");

      expect(result).toEqual({
        code: "ZERO_DISCOUNT_CODE",
        percentage: 0,
        durationLabel: "Sconto riservato al tuo account",
      });
    });

    test("intercetta errori di Firestore, registra con console.error e restituisce null", async () => {
      mockGetDoc.mockRejectedValueOnce(new Error("Firestore permission denied"));

      const result = await fetchUserCoupon("usr_flv_2026");

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        "Errore durante il caricamento del coupon dell'utente:",
        expect.any(Error)
      );
    });
  });
});