
import {
  describe,
  test,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";

import { renderHook, waitFor } from "@testing-library/react";
import { Timestamp } from "firebase/firestore";
import { useOAuthLogic } from "@/features/auth/hooks/useOAuthLogic";

const { mockGetDb, mockSetDoc, mockUseAuth } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockSetDoc: vi.fn(),
  mockUseAuth: vi.fn(),
}));

vi.mock("@/context/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/infrastructure/db", () => ({
  getDb: () => mockGetDb(),
}));

vi.mock("firebase/firestore", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("firebase/firestore")>();

  return {
    ...actual,
    doc: vi.fn(
      (_db: unknown, collection: string, id: string) =>
        `${collection}/${id}`
    ),
    setDoc: (...args: unknown[]) => mockSetDoc(...args),
    serverTimestamp: vi.fn(() => "mock-server-timestamp"),
  };
});

describe("useOAuthLogic Hook Suite", () => {
  let originalLocation: Location;
  let mockReplace: ReturnType<typeof vi.fn>;

  const validCodeChallenge = "A".repeat(43);

  const validQueryString =
    "?client_id=jurio_client_app" +
    "&redirect_uri=https%3A%2F%2Fclient.external.it%2Fcallback" +
    "&state=xyz_state_123" +
    `&code_challenge=${validCodeChallenge}` +
    "&code_challenge_method=S256";

  const expectedAuthCode = "01".repeat(32);

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(console, "error").mockImplementation(() => {});

    mockGetDb.mockResolvedValue("mock-db-instance");
    mockSetDoc.mockResolvedValue(undefined);

    originalLocation = window.location;
    mockReplace = vi.fn();

    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: {
        ...originalLocation,
        search: validQueryString,
        href: "http://localhost/",
        replace: mockReplace,
      },
    });

    vi.spyOn(window.crypto, "getRandomValues").mockImplementation(
      <T extends ArrayBufferView>(array: T): T => {
        const view = new Uint8Array(
          array.buffer,
          array.byteOffset,
          array.byteLength
        );

        view.fill(1);
        return array;
      }
    );
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: originalLocation,
    });

    vi.restoreAllMocks();
  });

  test("restituisce un errore immediato se manca redirect_uri", () => {
    window.location.search = "?client_id=jurio_client_app";

    mockUseAuth.mockReturnValue({
      user: null,
      status: "unauthenticated",
    });

    const { result } = renderHook(() => useOAuthLogic());

    expect(result.current.error).toBe(
      "Richiesta non valida: manca il parametro 'redirect_uri'."
    );

    expect(result.current.authStatus).toBe("unauthenticated");
    expect(result.current.isLoading).toBe(false);
    expect(mockGetDb).not.toHaveBeenCalled();
  });

  test("imposta isLoading a true durante il caricamento dell'autenticazione", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      status: "loading",
    });

    const { result } = renderHook(() => useOAuthLogic());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.authStatus).toBe("loading");
    expect(result.current.error).toBeNull();
    expect(mockGetDb).not.toHaveBeenCalled();
  });

  test("non esegue il flusso se l'utente non è autenticato", async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      status: "unauthenticated",
    });

    const { result } = renderHook(() => useOAuthLogic());

    await waitFor(() => {
      expect(result.current.authStatus).toBe("unauthenticated");
    });

    expect(mockGetDb).not.toHaveBeenCalled();
    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test("genera il codice OAuth, lo salva su Firestore e reindirizza", async () => {
    mockUseAuth.mockReturnValue({
      user: { uid: "usr_flv_2026" },
      status: "authenticated",
    });

    const { result } = renderHook(() => useOAuthLogic());

    await waitFor(() => {
      expect(mockGetDb).toHaveBeenCalledTimes(1);

      expect(mockSetDoc).toHaveBeenCalledWith(
        `oauth_codes/${expectedAuthCode}`,
        expect.objectContaining({
          uid: "usr_flv_2026",
          client_id: "jurio_client_app",
          redirect_uri:
            "https://client.external.it/callback",
          code_challenge: validCodeChallenge,
          code_challenge_method: "S256",
          createdAt: "mock-server-timestamp",
          expiresAt: expect.any(Timestamp),
        })
      );

      expect(mockReplace).toHaveBeenCalledWith(
        `https://client.external.it/callback?code=${expectedAuthCode}&state=xyz_state_123`
      );
    });

    expect(result.current.error).toBeNull();
  });

  test("gestisce gli errori asincroni quando Firestore fallisce", async () => {
    mockUseAuth.mockReturnValue({
      user: { uid: "usr_flv_2026" },
      status: "authenticated",
    });

    mockGetDb.mockRejectedValue(
      new Error("Firestore offline")
    );

    const { result } = renderHook(() => useOAuthLogic());

    await waitFor(() => {
      expect(result.current.error).toBe(
        "Si è verificato un errore durante la connessione. Riprova più tardi."
      );
    });

    expect(result.current.isAuthorizing).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});