import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { User } from "firebase/auth";
import type { Team } from "@/interfaces/interfaces";

/* ---------- hoisted mocks ---------- */
const {
  mockAuthState,
  mockFirestoreDb,
  mockGetDb,
  mockCollection,
  mockDoc,
  mockGetDoc,
  mockQuery,
  mockWhere,
  mockOnSnapshot,
  mockUnsubscribe,
} = vi.hoisted(() => {
  const unsubscribeSpy = vi.fn();

  return {
    mockAuthState: {
      user: null as User | null,
    },
    mockFirestoreDb: { firestore: "mockDb" },
    mockGetDb: vi.fn(),
    mockCollection: vi.fn((...args: unknown[]) => ({ type: "collection", path: args.slice(1).join("/") })),
    mockDoc: vi.fn((...args: unknown[]) => ({ type: "doc", path: args.slice(1).join("/") })),
    mockGetDoc: vi.fn(),
    mockQuery: vi.fn((...args: unknown[]) => ({ type: "query", args })),
    mockWhere: vi.fn((field: string, op: string, val: unknown) => ({ field, op, val })),
    mockOnSnapshot: vi.fn(),
    mockUnsubscribe: unsubscribeSpy,
  };
});

/* ---------- mock modules ---------- */
vi.mock("@/context/useAuth", () => ({
  __esModule: true,
  useAuth: () => mockAuthState,
}));

vi.mock("@/services/db", () => ({
  __esModule: true,
  getDb: () => mockGetDb(),
}));

vi.mock("firebase/firestore", () => ({
  __esModule: true,
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (ref: unknown) => mockGetDoc(ref),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (field: string, op: string, val: unknown) => mockWhere(field, op, val),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}));

/* ---------- subject under test ---------- */
import { useTeamDashboard } from "@/hooks/useTeamDashboard"; // <-- adegua il path di import se necessario

describe("useTeamDashboard Hook Suite", () => {
  const mockUserInstance = {
    uid: "usr_flv_2026",
    email: "flavio@jurio.it",
  } as unknown as User;

  const sampleTeamData: Team = {
    id: "team_jurio_law",
    name: "Studio Legale Campaniolo",
    member_ids: ["usr_flv_2026", "usr_colleague_1"],
    owners: ["usr_owner_main"],
    createdAt: new Date("2026-01-01"),
  } as unknown as Team;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.user = mockUserInstance;
    mockGetDb.mockResolvedValue(mockFirestoreDb);
    mockOnSnapshot.mockReturnValue(mockUnsubscribe);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("Guardie Preliminari e Stato Iniziale", () => {
    test("imposta loading a false e non crea sottoscrizioni se l'utente non è autenticato", async () => {
      mockAuthState.user = null;

      const { result } = renderHook(() => useTeamDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.team).toBeNull();
      expect(result.current.isManager).toBe(false);
      expect(mockGetDb).not.toHaveBeenCalled();
      expect(mockOnSnapshot).not.toHaveBeenCalled();
    });

    test("imposta team a null e loading a false se l'utente non appartiene ad alcun workspace", async () => {
      mockOnSnapshot.mockImplementation((_query: unknown, onNext: (snap: unknown) => void) => {
        onNext({ empty: true, docs: [] });
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useTeamDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.team).toBeNull();
      expect(result.current.isManager).toBe(false);
      expect(mockWhere).toHaveBeenCalledWith("member_ids", "array-contains", "usr_flv_2026");
    });
  });

  describe("Sottoscrizione Team e Ruolo Utente", () => {
    test("popola il team e imposta isManager a false se il membro ha ruolo ordinario", async () => {
      mockOnSnapshot.mockImplementation((_query: unknown, onNext: (snap: unknown) => void) => {
        onNext({
          empty: false,
          docs: [
            {
              id: "team_jurio_law",
              data: () => ({
                name: "Studio Legale Campaniolo",
                member_ids: ["usr_flv_2026"],
                owners: ["other_owner_id"],
              }),
            },
          ],
        });
        return mockUnsubscribe;
      });

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ role: "member" }),
      });

      const { result } = renderHook(() => useTeamDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockDoc).toHaveBeenCalledWith(
        mockFirestoreDb,
        "teams/team_jurio_law/members/usr_flv_2026"
      );
      expect(result.current.team?.id).toBe("team_jurio_law");
      expect(result.current.team?.name).toBe("Studio Legale Campaniolo");
      expect(result.current.isManager).toBe(false);
    });

    test("imposta isManager a true se il ruolo ricavato dal sotto-documento è 'owner'", async () => {
      mockOnSnapshot.mockImplementation((_query: unknown, onNext: (snap: unknown) => void) => {
        onNext({
          empty: false,
          docs: [{ id: "team_jurio_law", data: () => sampleTeamData }],
        });
        return mockUnsubscribe;
      });

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ role: "owner" }),
      });

      const { result } = renderHook(() => useTeamDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isManager).toBe(true);
    });

    test("imposta isManager a true se il ruolo ricavato è 'co-owner'", async () => {
      mockOnSnapshot.mockImplementation((_query: unknown, onNext: (snap: unknown) => void) => {
        onNext({
          empty: false,
          docs: [{ id: "team_jurio_law", data: () => sampleTeamData }],
        });
        return mockUnsubscribe;
      });

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ role: "co-owner" }),
      });

      const { result } = renderHook(() => useTeamDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isManager).toBe(true);
    });

    test("imposta isManager a true se l'UID dell'utente compare nell'array team.owners", async () => {
      const teamWithOwnerArray = {
        ...sampleTeamData,
        owners: ["usr_flv_2026"],
      };

      mockOnSnapshot.mockImplementation((_query: unknown, onNext: (snap: unknown) => void) => {
        onNext({
          empty: false,
          docs: [{ id: "team_jurio_law", data: () => teamWithOwnerArray }],
        });
        return mockUnsubscribe;
      });

      // Il sub-documento members non esiste o ha ruolo generico
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
        data: () => ({}),
      });

      const { result } = renderHook(() => useTeamDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isManager).toBe(true);
    });
  });

  describe("Gestione Fallimenti ed Error Handling", () => {
    test("gestisce errore durante la lettura del ruolo nel sotto-documento mantenendo il team e sbloccando il loading", async () => {
      mockOnSnapshot.mockImplementation((_query: unknown, onNext: (snap: unknown) => void) => {
        onNext({
          empty: false,
          docs: [{ id: "team_jurio_law", data: () => sampleTeamData }],
        });
        return mockUnsubscribe;
      });

      mockGetDoc.mockRejectedValueOnce(new Error("Permission denied su members subcollection"));

      const { result } = renderHook(() => useTeamDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.team?.id).toBe("team_jurio_law");
      expect(result.current.isManager).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        "Errore durante la lettura del ruolo:",
        expect.any(Error)
      );
    });

    test("gestisce errore se getDb rifiuta la connessione iniziale", async () => {
      mockGetDb.mockRejectedValueOnce(new Error("Database connection unavailable"));

      const { result } = renderHook(() => useTeamDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.team).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        "Errore nell'inizializzazione del team:",
        expect.any(Error)
      );
    });
  });

  describe("Ciclo di Vita e Pulizia Listener", () => {
    test("invoca la funzione di unsubscribe al momento dello smontaggio del componente", async () => {
      mockOnSnapshot.mockImplementation((_query: unknown, onNext: (snap: unknown) => void) => {
        onNext({ empty: true, docs: [] });
        return mockUnsubscribe;
      });

      const { unmount } = renderHook(() => useTeamDashboard());

      await waitFor(() => {
        expect(mockOnSnapshot).toHaveBeenCalled();
      });

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });
  });
});