import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useOAuthLogic } from "@/features/auth/hooks/useOAuthLogic";

/* ---------- hoisted mocks ---------- */
const { mockGetDb, mockSetDoc, mockUseAuth } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockSetDoc: vi.fn().mockResolvedValue(undefined),
  mockUseAuth: vi.fn(),
}));

/* ---------- mock modules ---------- */
vi.mock("@/context/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/infrastructure/db", () => ({
  getDb: () => mockGetDb(),
}));

vi.mock("firebase/firestore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("firebase/firestore")>();
  return {
    ...actual,
    doc: vi.fn((_db, collection, id) => `${collection}/${id}`),
    setDoc: (...args: unknown[]) => mockSetDoc(...args),
    serverTimestamp: vi.fn(() => "mock-server-timestamp"),
  };
});

describe("useOAuthLogic Hook Suite", () => {
  let originalLocation: Location;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});

    originalLocation = window.location;

    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        ...originalLocation,
        search: "?redirect_uri=https://client.external.it/callback&state=xyz_state_123",
        href: "http://localhost/",
      },
    });

    vi.spyOn(window.crypto, "getRandomValues").mockImplementation(<T extends ArrayBufferView>(array: T): T => {
      const uint8View = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
      uint8View.fill(1);
      return array;
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: originalLocation,
    });
    vi.restoreAllMocks();
  });

  test("restituisce un errore immediato se manca il parametro redirect_uri nell'URL", () => {
    window.location.search = "";

    mockUseAuth.mockReturnValue({
      user: null,
      status: "unauthenticated",
    });

    const { result } = renderHook(() => useOAuthLogic());

    expect(result.current.error).toBe("Richiesta non valida: manca redirect_uri. Riprova dal client esterno.");
    expect(result.current.authStatus).toBe("unauthenticated");
    expect(result.current.isLoading).toBe(false);
  });

  test("imposta isLoading a true se lo stato di autenticazione è 'loading'", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      status: "loading",
    });

    const { result } = renderHook(() => useOAuthLogic());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.authStatus).toBe("loading");
    expect(result.current.error).toBeNull();
  });

  test("non esegue il flusso di autorizzazione se l'utente non è autenticato", async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      status: "unauthenticated",
    });

    const { result } = renderHook(() => useOAuthLogic());

    await waitFor(() => {
      expect(mockGetDb).not.toHaveBeenCalled();
    });

    expect(result.current.authStatus).toBe("unauthenticated");
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test("genera il codice OAuth, lo salva su Firestore e reindirizza correttamente quando l'utente è autenticato", async () => {
    const mockUser = { uid: "usr_flv_2026" };
    mockUseAuth.mockReturnValue({
      user: mockUser,
      status: "authenticated",
    });

    mockGetDb.mockResolvedValue("mock-db-instance");

    renderHook(() => useOAuthLogic());

    await waitFor(() => {
      expect(mockGetDb).toHaveBeenCalledTimes(1);
      expect(mockSetDoc).toHaveBeenCalledWith(
        "oauth_codes/01010101010101010101010101010101",
        expect.objectContaining({
          uid: "usr_flv_2026",
          createdAt: "mock-server-timestamp",
        })
      );
    });

    expect(window.location.href).toBe(
      "https://client.external.it/callback?code=01010101010101010101010101010101&state=xyz_state_123"
    );
  });

  test("gestisce e cattura gli errori asincroni impostando asyncError se Firestore fallisce", async () => {
    const mockUser = { uid: "usr_flv_2026" };
    mockUseAuth.mockReturnValue({
      user: mockUser,
      status: "authenticated",
    });

    mockGetDb.mockRejectedValue(new Error("Firestore offline"));

    const { result } = renderHook(() => useOAuthLogic());

    await waitFor(() => {
      expect(result.current.error).toBe("Errore durante il collegamento. Riprova.");
    });

    expect(result.current.isAuthorizing).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });
});