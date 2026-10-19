import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useDeepAnalysisSession,
  eliminaSessione,
} from "@/features/analisi/hooks/useDeepAnalysis";
import { useAuth } from "@/context/useAuth";
import { getDb } from "@/infrastructure/db";
import { fetchWithSecurity } from "@/config/apiClient";
import { toast } from "react-hot-toast";
import {
  onSnapshot,
  updateDoc,
  addDoc,
  deleteDoc,
} from "firebase/firestore";

/* ---------- mock dei moduli esterni ---------- */

vi.mock("@/context/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/infrastructure/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("@/config/apiClient", () => ({
  fetchWithSecurity: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("firebase/firestore", () => {
  class MockTimestamp {
    static now = vi.fn(() => new MockTimestamp());
  }

  return {
    collection: vi.fn(),
    doc: vi.fn(),
    onSnapshot: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    updateDoc: vi.fn(),
    addDoc: vi.fn(),
    serverTimestamp: vi.fn(() => "mock-timestamp"),
    deleteDoc: vi.fn(),
    Timestamp: MockTimestamp,
  };
});

const mockedUseAuth = vi.mocked(useAuth);
const mockedGetDb = vi.mocked(getDb);
const mockedFetchWithSecurity = vi.mocked(fetchWithSecurity);
const mockedOnSnapshot = vi.mocked(onSnapshot);
const mockedUpdateDoc = vi.mocked(updateDoc);
const mockedAddDoc = vi.mocked(addDoc);
const mockedDeleteDoc = vi.mocked(deleteDoc);

describe("useDeepAnalysisSession Hook Suite", () => {
  const mockUser = { uid: "user-123" };
  const mockDb = {};

  beforeEach(() => {
    vi.clearAllMocks();

    mockedUseAuth.mockReturnValue({
      user: mockUser,
    } as unknown as ReturnType<typeof useAuth>);

    mockedGetDb.mockResolvedValue(
      mockDb as unknown as Awaited<ReturnType<typeof getDb>>
    );

    mockedOnSnapshot.mockImplementation((_, callback: unknown) => {
      if (typeof callback === "function") {
        (
          callback as (
            snapshot: {
              docs?: unknown[];
              exists?: () => boolean;
              id?: string;
              data?: () => unknown;
            }
          ) => void
        )({
          docs: [],
          exists: () => false,
          id: "sess-1",
          data: () => ({}),
        });
      }

      return vi.fn();
    });
  });

  test("configura i listener Firestore per la lista e la sessione attiva se l'utente è autenticato", async () => {
    mockedOnSnapshot.mockImplementation((_, callback: unknown) => {
      if (typeof callback === "function") {
        (
          callback as (
            snapshot: {
              docs?: unknown[];
              exists?: () => boolean;
              id?: string;
              data?: () => unknown;
            }
          ) => void
        )({
          docs: [
            {
              id: "sess-1",
              data: () => ({
                title: "Indagine 1",
                status: "review",
              }),
            },
          ],
          exists: () => true,
          id: "sess-1",
          data: () => ({
            title: "Indagine 1",
            status: "review",
          }),
        });
      }

      return vi.fn();
    });

    const { result } = renderHook(() =>
      useDeepAnalysisSession("sess-1")
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.sessionsList).toHaveLength(1);
    expect(result.current.sessionsList[0].title).toBe("Indagine 1");
  });

  test("gestisce il cambio di activeSessionId a null resettando la sessione attiva", async () => {
    const { result } = renderHook(() =>
      useDeepAnalysisSession(null)
    );

    await waitFor(() => {
      expect(result.current.activeSession).toBeNull();
    });
  });

  test("aggiorna correttamente il titolo della sessione attiva", async () => {
    mockedOnSnapshot.mockImplementation((_, callback: unknown) => {
      if (typeof callback === "function") {
        (
          callback as (
            snapshot: {
              docs?: unknown[];
              exists?: () => boolean;
              id?: string;
              data?: () => unknown;
            }
          ) => void
        )({
          docs: [],
          exists: () => true,
          id: "sess-1",
          data: () => ({
            title: "Vecchio Titolo",
            status: "review",
          }),
        });
      }

      return vi.fn();
    });

    const { result } = renderHook(() =>
      useDeepAnalysisSession("sess-1")
    );

    await waitFor(() => {
      expect(result.current.activeSession).not.toBeNull();
    });

    await act(async () => {
      await result.current.updateTitle("Nuovo Titolo Indagine");
    });

    expect(mockedUpdateDoc).toHaveBeenCalledTimes(1);
  });

  test("attiva e disattiva correttamente l'esclusione di un precedente nella mappa", async () => {
    mockedOnSnapshot.mockImplementation((_, callback: unknown) => {
      if (typeof callback === "function") {
        (
          callback as (
            snapshot: {
              docs?: unknown[];
              exists?: () => boolean;
              id?: string;
              data?: () => unknown;
            }
          ) => void
        )({
          docs: [],
          exists: () => true,
          id: "sess-1",
          data: () => ({
            title: "Indagine",
            mappaDialettica: {
              orientamentoFavorevole: {
                fonti: [
                  {
                    id: "cass-11",
                    fonte: "interna",
                    escluso: false,
                  },
                ],
              },
              orientamentoContrario: null,
              puntiAperti: [],
            },
          }),
        });
      }

      return vi.fn();
    });

    const { result } = renderHook(() =>
      useDeepAnalysisSession("sess-1")
    );

    await waitFor(() => {
      expect(result.current.activeSession).not.toBeNull();
    });

    await act(async () => {
      await result.current.toggleEsclusionePrecedente(
        "cass-11",
        true
      );
    });

    expect(mockedUpdateDoc).toHaveBeenCalledTimes(1);
  });

  test("avvia con successo la ricerca dei precedenti (creazione nuova sessione se ID nullo)", async () => {
    mockedAddDoc.mockResolvedValueOnce({
      id: "new-sess-99",
    } as unknown as Awaited<ReturnType<typeof addDoc>>);

    mockedFetchWithSecurity.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
      }),
    } as unknown as Response);

    const onSessionCreatedMock = vi.fn();

    const { result } = renderHook(() =>
      useDeepAnalysisSession(null)
    );

    await act(async () => {
      await result.current.avviaRicercaPrecedenti(
        "Quesito di responsabilità medica",
        {
          confidenceLevel: 80,
        } as unknown as Parameters<
          typeof result.current.avviaRicercaPrecedenti
        >[1],
        [],
        onSessionCreatedMock
      );
    });

    expect(mockedAddDoc).toHaveBeenCalledTimes(1);

    expect(onSessionCreatedMock).toHaveBeenCalledWith(
      "new-sess-99"
    );

    expect(mockedFetchWithSecurity).toHaveBeenCalledTimes(1);

    expect(toast.success).toHaveBeenCalledWith(
      "Mappa dialettica generata. Revisiona gli orientamenti."
    );
  });

  test("gestisce correttamente l'errore quota_exceeded (429) durante la ricerca", async () => {
    mockedAddDoc.mockResolvedValueOnce({
      id: "new-sess-99",
    } as unknown as Awaited<ReturnType<typeof addDoc>>);

    // Simuliamo direttamente la reiezione in modo da isolare l'errore senza affidarsi al blocco di parsing manuale (res.json)
    mockedFetchWithSecurity.mockRejectedValueOnce(new Error("QUOTA_EXCEEDED"));

    const { result } = renderHook(() =>
      useDeepAnalysisSession(null)
    );

    let caughtError: Error | null = null;

    await act(async () => {
      try {
        await result.current.avviaRicercaPrecedenti(
          "Quesito",
          {
            confidenceLevel: 80,
          } as unknown as Parameters<
            typeof result.current.avviaRicercaPrecedenti
          >[1],
          [],
          vi.fn()
        );
      } catch (err) {
        caughtError = err as Error;
      }
    });

    expect(caughtError).toBeDefined();

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("limite giornaliero"),
      expect.any(Object)
    );
  });

  test("avvia con successo l'integrazione di ricerca (HITL)", async () => {
    mockedOnSnapshot.mockImplementation((_, callback: unknown) => {
      if (typeof callback === "function") {
        (
          callback as (
            snapshot: {
              docs?: unknown[];
              exists?: () => boolean;
              id?: string;
              data?: () => unknown;
            }
          ) => void
        )({
          docs: [],
          exists: () => true,
          id: "sess-1",
          data: () => ({
            title: "Indagine",
            status: "review",
          }),
        });
      }

      return vi.fn();
    });

    mockedFetchWithSecurity.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        mappaDialettica: {},
      }),
    } as unknown as Response);

    const { result } = renderHook(() =>
      useDeepAnalysisSession("sess-1")
    );

    await waitFor(() => {
      expect(result.current.activeSession).not.toBeNull();
    });

    let data;

    await act(async () => {
      data =
        await result.current.avviaIntegrazioneRicerca(
          "Approfondisci la giurisprudenza di merito"
        );
    });

    expect(data).toBeDefined();

    expect(toast.success).toHaveBeenCalledWith(
      "Mappa dialettica aggiornata con successo!"
    );
  });

  test("avvia con successo la generazione della sintesi strategica", async () => {
    mockedOnSnapshot.mockImplementation((_, callback: unknown) => {
      if (typeof callback === "function") {
        (
          callback as (
            snapshot: {
              docs?: unknown[];
              exists?: () => boolean;
              id?: string;
              data?: () => unknown;
            }
          ) => void
        )({
          docs: [],
          exists: () => true,
          id: "sess-1",
          data: () => ({
            title: "Indagine",
            status: "review",
          }),
        });
      }

      return vi.fn();
    });

    mockedFetchWithSecurity.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
      }),
    } as unknown as Response);

    const { result } = renderHook(() =>
      useDeepAnalysisSession("sess-1")
    );

    await waitFor(() => {
      expect(result.current.activeSession).not.toBeNull();
    });

    await act(async () => {
      await result.current.avviaGenerazioneSintesi();
    });

    await waitFor(() => {
      expect(result.current.isCompleted).toBe(true);
    });

    expect(toast.success).toHaveBeenCalledWith(
      "Sintesi strategica generata con successo."
    );
  });

  test("elimina correttamente una sessione tramite eliminaSessione", async () => {
    await act(async () => {
      await eliminaSessione("sess-123");
    });

    expect(mockedDeleteDoc).toHaveBeenCalledTimes(1);
  });

  test("eliminaSessione non esegue alcuna operazione se sessionId è vuoto", async () => {
    await act(async () => {
      await eliminaSessione("");
    });

    expect(mockedDeleteDoc).not.toHaveBeenCalled();
  });
});