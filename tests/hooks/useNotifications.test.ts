import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useNotifications } from "@/features/notifications/hooks/useNotifications";
import type { Timestamp } from "firebase/firestore";

/* 
  CRITICO: Forziamo il caricamento dei moduli nella cache di Vitest
  in modo che gli import dinamici (await import) all'interno dell'hook 
  ricevano ESATTAMENTE questa versione mockata e non aggirino il vi.mock.
*/
import "firebase/firestore";
import "@/infrastructure/db";

/* ---------- Setup Mocks ---------- */
const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

const mockUseAuth = vi.fn();
vi.mock("@/context/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/infrastructure/db", () => ({
  getDb: vi.fn().mockResolvedValue("mock-db"),
}));

// Uso di vi.hoisted per creare gli Spy testabili globalmente
const fsMocks = vi.hoisted(() => {
  return {
    updateDoc: vi.fn().mockResolvedValue(undefined),
    arrayUnion: vi.fn((...args: unknown[]) => args),
    batchUpdate: vi.fn(),
    batchCommit: vi.fn().mockResolvedValue(undefined),
    callbacks: {} as Record<string, (snapshot: unknown) => void>,
  };
});

vi.mock("firebase/firestore", () => ({
  __esModule: true,
  collection: vi.fn((_db: unknown, name: string) => name),
  doc: vi.fn((_db: unknown, col: string, id?: string) => (id ? `${col}-${id}` : col)),
  query: vi.fn((base: string) => `${base}-query`),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn((ref: string, cb: (snapshot: unknown) => void) => {
    fsMocks.callbacks[ref] = cb;
    return vi.fn();
  }),
  // Assegnazione DIRETTA dei vi.fn() per preservare la cronologia delle chiamate
  updateDoc: fsMocks.updateDoc,
  arrayUnion: fsMocks.arrayUnion,
  writeBatch: vi.fn(() => ({
    update: fsMocks.batchUpdate,
    commit: fsMocks.batchCommit,
  })),
}));

/* ---------- Utility di Test ---------- */
const createMockTimestamp = (timeMs: number) => ({
  toMillis: () => timeMs,
  toDate: () => new Date(timeMs),
});

describe("useNotifications Hook Suite", () => {
  const mockUser = { uid: "usr_flv_2026" };

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key in fsMocks.callbacks) delete fsMocks.callbacks[key];
    
    mockUseAuth.mockReturnValue({ user: mockUser, loading: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("gestisce lo stato di caricamento e disattiva dbLoading senza utente", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });

    const { result } = renderHook(() => useNotifications());

    expect(result.current.user).toBeNull();
    expect(result.current.authLoading).toBe(false);
    expect(result.current.dbLoading).toBe(false);
    expect(result.current.feedCompleto).toEqual([]);
  });

  test("carica, unisce e ordina correttamente notifiche personali e broadcast", async () => {
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(fsMocks.callbacks["notification-query"]).toBeDefined();
      expect(fsMocks.callbacks["broadcast-query"]).toBeDefined();
      expect(fsMocks.callbacks["users-usr_flv_2026"]).toBeDefined();
    });

    act(() => {
      fsMocks.callbacks["notification-query"]({
        docs: [
          {
            id: "notif-1",
            data: () => ({ title: "Personale 1", isRead: false, createdAt: createMockTimestamp(2000) }),
          },
        ],
      });

      fsMocks.callbacks["broadcast-query"]({
        docs: [
          { id: "broad-1", data: () => ({ title: "Globale 1", createdAt: createMockTimestamp(3000) }) },
          { id: "broad-2", data: () => ({ title: "Globale Letta", createdAt: createMockTimestamp(1000) }) },
        ],
      });

      fsMocks.callbacks["users-usr_flv_2026"]({
        exists: () => true,
        data: () => ({ readBroadcasts: ["broad-2"] }),
      });
    });

    expect(result.current.dbLoading).toBe(false);
    expect(result.current.feedCompleto).toHaveLength(3);

    expect(result.current.feedCompleto[0].id).toBe("broad-1");
    expect(result.current.feedCompleto[1].id).toBe("notif-1");
    expect(result.current.feedCompleto[2].id).toBe("broad-2");

    expect(result.current.feedCompleto[0].isRead).toBe(false);
    expect(result.current.feedCompleto[2].isRead).toBe(true); 
    expect(result.current.unreadCount).toBe(2);
  });

  test("markAllAsRead aggiorna sia i documenti personali in batch che l'array utente globale", async () => {
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => expect(fsMocks.callbacks["notification-query"]).toBeDefined());

    act(() => {
      fsMocks.callbacks["notification-query"]({
        docs: [
          { id: "pers-1", data: () => ({ isRead: false }) },
          { id: "pers-2", data: () => ({ isRead: false }) },
        ],
      });
      fsMocks.callbacks["broadcast-query"]({
        docs: [{ id: "broad-1", data: () => ({}) }],
      });
      fsMocks.callbacks["users-usr_flv_2026"]({
        exists: () => true,
        data: () => ({ readBroadcasts: [] }),
      });
    });

    expect(result.current.unreadCount).toBe(3);

    await act(async () => {
      await result.current.markAllAsRead();
    });

    expect(fsMocks.batchUpdate).toHaveBeenCalledTimes(2); 
    expect(fsMocks.batchCommit).toHaveBeenCalled();
    expect(fsMocks.updateDoc).toHaveBeenCalledWith("users-usr_flv_2026", {
      readBroadcasts: ["broad-1"],
    });
    expect(result.current.unreadCount).toBe(0);
  });

  test("formatTime restituisce la stringa di data formattata correttamente", () => {
    const { result } = renderHook(() => useNotifications());
    const fakeTimestamp = createMockTimestamp(new Date("2026-09-03T14:30:00").getTime());
    
    const formatted = result.current.formatTime(fakeTimestamp as unknown as Timestamp);

    expect(formatted).toMatch(/\d{2}\/\d{2}\/\d{4}/); 
    expect(formatted).toMatch(/\d{2}:\d{2}/); 
  });
});