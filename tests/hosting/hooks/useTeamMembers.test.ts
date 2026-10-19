import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { TeamMember } from "@/interfaces/interfaces";

/* ---------- hoisted mocks ---------- */
const {
  mockNavigate,
  mockToast,
  mockFetchWithSecurity,
  mockGetAssign,
  mockFirestoreDb,
  mockGetDb,
  mockCollection,
  mockDoc,
  mockGetDoc,
  mockUpdateDoc,
  mockOnSnapshot,
  mockUnsubscribe,
  mockGetAvatar,
} = vi.hoisted(() => {
  const unsubscribeSpy = vi.fn();

  return {
    mockNavigate: vi.fn(),
    mockToast: {
      success: vi.fn(),
      error: vi.fn(),
    },
    mockFetchWithSecurity: vi.fn(),
    mockGetAssign: vi.fn(() => ({
      REMOVE_MEMBER_ENDPOINT: "https://api.jurio.it/assign/remove-member",
    })),
    mockFirestoreDb: { firestore: "mockDb" },
    mockGetDb: vi.fn(),
    mockCollection: vi.fn((...args: unknown[]) => ({
      type: "collection",
      path: args.slice(1).join("/"),
    })),
    mockDoc: vi.fn((...args: unknown[]) => ({
      type: "doc",
      path: args.slice(1).join("/"),
    })),
    mockGetDoc: vi.fn(),
    mockUpdateDoc: vi.fn().mockResolvedValue(undefined),
    mockOnSnapshot: vi.fn(),
    mockUnsubscribe: unsubscribeSpy,
    mockGetAvatar: vi.fn().mockResolvedValue(undefined),
  };
});

/* ---------- mock modules ---------- */
vi.mock("react-router-dom", () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
}));

vi.mock("react-hot-toast", () => ({
  toast: mockToast,
}));

vi.mock("@/config/apiClient", () => ({
  __esModule: true,
  fetchWithSecurity: (...args: unknown[]) => mockFetchWithSecurity(...args),
}));

vi.mock("@/config/env", () => ({
  __esModule: true,
  getAssign: () => mockGetAssign(),
}));

vi.mock("@/infrastructure/db", () => ({
  __esModule: true,
  getDb: () => mockGetDb(),
}));

vi.mock("@/shared/services/storage", () => ({
  __esModule: true,
  getAvatar: (uid: string) => mockGetAvatar(uid),
}));

vi.mock("firebase/firestore", () => ({
  __esModule: true,
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (ref: unknown) => mockGetDoc(ref),
  updateDoc: (ref: unknown, data: unknown) => mockUpdateDoc(ref, data),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}));

/* ---------- subject under test ---------- */
import { useTeamMembers } from "@/features/teams/hooks/useTeamMembers"; // <-- adegua il path di import se necessario

describe("useTeamMembers Hook Suite", () => {
  const defaultTeamId = "team_alpha_2026";
  const currentUid = "usr_flv_2026";

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDb.mockResolvedValue(mockFirestoreDb);
    mockOnSnapshot.mockReturnValue(mockUnsubscribe);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  describe("Inizializzazione e Sottoscrizione Membri", () => {
    test("inizializza con loading a true e sottoscrive la subcollection members del team", async () => {
      mockOnSnapshot.mockImplementation((_col: unknown, onNext: (snap: unknown) => void) => {
        onNext({ docs: [] });
        return mockUnsubscribe;
      });

      const { result } = renderHook(() =>
        useTeamMembers({ teamId: defaultTeamId, currentUserUid: currentUid })
      );

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockCollection).toHaveBeenCalledWith(
        mockFirestoreDb,
        `teams/${defaultTeamId}/members`
      );
      expect(result.current.members).toEqual([]);
    });

    test("arricchisce i membri con nome, cognome e avatar recuperati dai servizi", async () => {
      const mockMemberDoc = {
        id: "usr_member_1",
        data: () =>
          ({
            email: "collega@studiolegale.it",
            role: "collaboratore",
          } as unknown as TeamMember),
      };

      mockOnSnapshot.mockImplementation((_col: unknown, onNext: (snap: unknown) => void) => {
        onNext({ docs: [mockMemberDoc] });
        return mockUnsubscribe;
      });

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ name: "Mario", surname: "Rossi" }),
      });
      mockGetAvatar.mockResolvedValueOnce("https://storage.jurio.it/avatars/usr_member_1.jpg");

      const { result } = renderHook(() =>
        useTeamMembers({ teamId: defaultTeamId, currentUserUid: currentUid })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockDoc).toHaveBeenCalledWith(mockFirestoreDb, "users/usr_member_1");
      expect(mockGetAvatar).toHaveBeenCalledWith("usr_member_1");

      expect(result.current.members).toHaveLength(1);
      expect(result.current.members[0]).toEqual({
        uid: "usr_member_1",
        email: "collega@studiolegale.it",
        role: "collaboratore",
        displayName: "Mario Rossi",
        avatarUrl: "https://storage.jurio.it/avatars/usr_member_1.jpg",
      });
    });

    test("utilizza email come fallback per displayName se il documento anagrafico utente non esiste", async () => {
      const mockMemberDoc = {
        id: "usr_member_no_profile",
        data: () =>
          ({
            email: "avvocato@ordine.it",
            role: "member",
          } as unknown as TeamMember),
      };

      mockOnSnapshot.mockImplementation((_col: unknown, onNext: (snap: unknown) => void) => {
        onNext({ docs: [mockMemberDoc] });
        return mockUnsubscribe;
      });

      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });
      mockGetAvatar.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() =>
        useTeamMembers({ teamId: defaultTeamId, currentUserUid: currentUid })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.members[0].displayName).toBe("avvocato@ordine.it");
      expect(result.current.members[0].avatarUrl).toBeUndefined();
    });

    test("gestisce errori durante la risoluzione del singolo utente senza interrompere l'elaborazione", async () => {
      const mockMemberDoc = {
        id: "usr_member_err",
        data: () =>
          ({
            email: "err@jurio.it",
            role: "member",
          } as unknown as TeamMember),
      };

      mockOnSnapshot.mockImplementation((_col: unknown, onNext: (snap: unknown) => void) => {
        onNext({ docs: [mockMemberDoc] });
        return mockUnsubscribe;
      });

      mockGetDoc.mockRejectedValueOnce(new Error("Errore recupero documento utente"));

      const { result } = renderHook(() =>
        useTeamMembers({ teamId: defaultTeamId, currentUserUid: currentUid })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.members[0].displayName).toBe("err@jurio.it");
      expect(console.log).toHaveBeenCalledWith(expect.any(Error));
    });

    test("gestisce errore se getDb fallisce impostando loading a false", async () => {
      mockGetDb.mockRejectedValueOnce(new Error("DB offline"));

      const { result } = renderHook(() =>
        useTeamMembers({ teamId: defaultTeamId, currentUserUid: currentUid })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(console.error).toHaveBeenCalledWith(
        "Errore nel caricamento dei membri del team:",
        expect.any(Error)
      );
    });

    test("invoca unsubscribe al momento dello smontaggio del componente", async () => {
      mockOnSnapshot.mockImplementation((_col: unknown, onNext: (snap: unknown) => void) => {
        onNext({ docs: [] });
        return mockUnsubscribe;
      });

      const { unmount } = renderHook(() =>
        useTeamMembers({ teamId: defaultTeamId, currentUserUid: currentUid })
      );

      await waitFor(() => {
        expect(mockOnSnapshot).toHaveBeenCalled();
      });

      unmount();
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe("Modifica Ruolo (handleRoleChange)", () => {
    test("blocca la modifica se l'utente tenta di modificare il proprio ruolo", async () => {
      const { result } = renderHook(() =>
        useTeamMembers({ teamId: defaultTeamId, currentUserUid: currentUid })
      );

      await act(async () => {
        await result.current.handleRoleChange(currentUid, "admin");
      });

      expect(mockToast.error).toHaveBeenCalledWith("Non puoi cambiare il tuo stesso ruolo!");
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    test("aggiorna il ruolo su Firestore per un altro membro del team", async () => {
      const targetUid = "usr_target_colleague";
      const { result } = renderHook(() =>
        useTeamMembers({ teamId: defaultTeamId, currentUserUid: currentUid })
      );

      await act(async () => {
        await result.current.handleRoleChange(targetUid, "co-owner");
      });

      expect(mockDoc).toHaveBeenCalledWith(
        mockFirestoreDb,
        `teams/${defaultTeamId}/members/${targetUid}`
      );
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: `teams/${defaultTeamId}/members/${targetUid}` }),
        { role: "co-owner" }
      );
      expect(mockToast.success).toHaveBeenCalledWith("Ruolo aggiornato con successo");
    });

    test("mostra toast di errore se updateDoc fallisce", async () => {
      mockUpdateDoc.mockRejectedValueOnce(new Error("Missing permissions"));

      const { result } = renderHook(() =>
        useTeamMembers({ teamId: defaultTeamId, currentUserUid: currentUid })
      );

      await act(async () => {
        await result.current.handleRoleChange("usr_other", "admin");
      });

      expect(mockToast.error).toHaveBeenCalledWith("Errore nell'aggiornamento. Controlla i permessi.");
      expect(console.error).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("Utility Iniziale (getInitial)", () => {
    test("restituisce la prima lettera in maiuscolo o '?' in caso di stringa vuota o assente", () => {
      const { result } = renderHook(() =>
        useTeamMembers({ teamId: defaultTeamId, currentUserUid: currentUid })
      );

      expect(result.current.getInitial("flavio")).toBe("F");
      expect(result.current.getInitial("Studio Legale")).toBe("S");
      expect(result.current.getInitial("")).toBe("?");
      expect(result.current.getInitial(undefined)).toBe("?");
    });
  });

  describe("Rimozione Membro (removeMember)", () => {
    test("rimuove il membro, aggiorna lo stato locale e non reindirizza se il membro rimosso è un altro utente", async () => {
      const mockDocs = [
        {
          id: "usr_member_to_remove",
          data: () => ({ email: "rimuovere@studio.it", role: "member" }),
        },
        {
          id: currentUid,
          data: () => ({ email: "io@studio.it", role: "owner" }),
        },
      ];

      mockOnSnapshot.mockImplementation((_col: unknown, onNext: (snap: unknown) => void) => {
        onNext({ docs: mockDocs });
        return mockUnsubscribe;
      });

      mockGetDoc.mockResolvedValue({ exists: () => false });

      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ success: true }),
      });

      const { result } = renderHook(() =>
        useTeamMembers({ teamId: defaultTeamId, currentUserUid: currentUid })
      );

      await waitFor(() => {
        expect(result.current.members).toHaveLength(2);
      });

      await act(async () => {
        await result.current.removeMember("usr_member_to_remove", true);
      });

      expect(mockFetchWithSecurity).toHaveBeenCalledWith(
        "https://api.jurio.it/assign/remove-member",
        {
          teamId: defaultTeamId,
          uidDelete: "usr_member_to_remove",
          revokeDocumentAccess: true,
        }
      );

      // Aggiornamento ottimistico dello stato
      expect(result.current.members).toHaveLength(1);
      expect(result.current.members[0].uid).toBe(currentUid);
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    test("reindirizza a /profilo se l'utente corrente rimuove se stesso (abbandono team)", async () => {
      mockOnSnapshot.mockImplementation((_col: unknown, onNext: (snap: unknown) => void) => {
        onNext({
          docs: [{ id: currentUid, data: () => ({ email: "io@studio.it", role: "member" }) }],
        });
        return mockUnsubscribe;
      });

      mockGetDoc.mockResolvedValue({ exists: () => false });

      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ success: true }),
      });

      const { result } = renderHook(() =>
        useTeamMembers({ teamId: defaultTeamId, currentUserUid: currentUid })
      );

      await waitFor(() => {
        expect(result.current.members).toHaveLength(1);
      });

      await act(async () => {
        await result.current.removeMember(currentUid, false);
      });

      expect(result.current.members).toHaveLength(0);
      expect(mockNavigate).toHaveBeenCalledWith("/profilo");
    });

    test("solleva eccezione e mostra toast se l'endpoint risponde con esito non-ok", async () => {
      mockOnSnapshot.mockImplementation((_col: unknown, onNext: (snap: unknown) => void) => {
        onNext({ docs: [] });
        return mockUnsubscribe;
      });

      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({ error: "Impossibile rimuovere l'unico proprietario" }),
      });

      const { result } = renderHook(() =>
        useTeamMembers({ teamId: defaultTeamId, currentUserUid: currentUid })
      );

      // 1. Attendi che il setup iniziale si stabilizzi
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // 2. Esegui la chiamata catturando l'errore senza interferenza di act
      let caughtError: Error | null = null;
      try {
        await result.current.removeMember(currentUid, false);
      } catch (err) {
        caughtError = err as Error;
      }

      // 3. Verifiche
      expect(caughtError).toBeInstanceOf(Error);
      expect(caughtError?.message).toBe("Impossibile rimuovere l'unico proprietario");
      expect(mockToast.error).toHaveBeenCalledWith("Impossibile completare l'operazione");
      expect(console.error).toHaveBeenCalledWith(
        "[removeMember] Error:",
        expect.any(Error)
      );
    });
  });
});