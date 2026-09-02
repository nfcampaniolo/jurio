import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { Team } from "@/interfaces/interfaces";

/* ---------- hoisted mocks ---------- */
const {
  mockToast,
  mockFetchWithSecurity,
  mockGetAssign,
  mockFirestoreDb,
  mockGetDb,
  mockDoc,
  mockUpdateDoc,
} = vi.hoisted(() => ({
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  mockFetchWithSecurity: vi.fn(),
  mockGetAssign: vi.fn(() => ({
    SHARE_ALL_URL: "https://api.jurio.it/assign/share-all",
    DELETE_TEAM_ENDPOINT: "https://api.jurio.it/assign/delete-team",
  })),
  mockFirestoreDb: { firestore: "mockDb" },
  mockGetDb: vi.fn(),
  mockDoc: vi.fn((...args: unknown[]) => ({
    type: "doc",
    path: args.slice(1).join("/"),
  })),
  mockUpdateDoc: vi.fn().mockResolvedValue(undefined),
}));

/* ---------- mock modules ---------- */
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

vi.mock("@/services/db", () => ({
  __esModule: true,
  getDb: () => mockGetDb(),
}));

vi.mock("firebase/firestore", () => ({
  __esModule: true,
  doc: (...args: unknown[]) => mockDoc(...args),
  updateDoc: (ref: unknown, data: unknown) => mockUpdateDoc(ref, data),
}));

/* ---------- subject under test ---------- */
import { useTeamSettings } from "@/hooks/useTeamSettings"; // <-- adegua il path di import se necessario

describe("useTeamSettings Hook Suite", () => {
  const sampleTeam: Team = {
    id: "team_jurio_1",
    name: "Studio Legale Campaniolo",
    visibility_default: "team",
    member_ids: ["usr_flv_2026"],
    owners: ["usr_flv_2026"],
  } as unknown as Team;

  const createMockFormEvent = () =>
    ({
      preventDefault: vi.fn(),
    }) as unknown as React.FormEvent;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDb.mockResolvedValue(mockFirestoreDb);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("Inizializzazione degli Stati", () => {
    test("popola name e isTeamDefault dai parametri iniziali del team", () => {
      const { result } = renderHook(() =>
        useTeamSettings({ team: sampleTeam, isManager: true })
      );

      expect(result.current.name).toBe("Studio Legale Campaniolo");
      expect(result.current.isTeamDefault).toBe(true);
      expect(result.current.saving).toBe(false);
      expect(result.current.isSharingAll).toBe(false);
      expect(result.current.isShareConfirmOpen).toBe(false);
    });

    test("imposta isTeamDefault a false se visibility_default non è 'team'", () => {
      const privateTeam: Team = {
        ...sampleTeam,
        visibility_default: "private",
      } as unknown as Team;

      const { result } = renderHook(() =>
        useTeamSettings({ team: privateTeam, isManager: false })
      );

      expect(result.current.isTeamDefault).toBe(false);
    });
  });

  describe("Salvataggio Impostazioni (handleSave)", () => {
    test("ignora la chiamata se l'utente non è un manager del team", async () => {
      const { result } = renderHook(() =>
        useTeamSettings({ team: sampleTeam, isManager: false })
      );
      const event = createMockFormEvent();

      await act(async () => {
        await result.current.handleSave(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      expect(mockGetDb).not.toHaveBeenCalled();
      expect(mockUpdateDoc).not.toHaveBeenCalled();
      expect(result.current.saving).toBe(false);
    });

    test("salva correttamente il nuovo nome trimmato e la visibilità predefinita su Firestore", async () => {
      const { result } = renderHook(() =>
        useTeamSettings({ team: sampleTeam, isManager: true })
      );
      const event = createMockFormEvent();

      act(() => {
        result.current.setName("   Studio Legale Associato   ");
        result.current.toggleTeamDefault(); // passa da true a false
      });

      await act(async () => {
        await result.current.handleSave(event);
      });

      expect(mockDoc).toHaveBeenCalledWith(mockFirestoreDb, "teams", "team_jurio_1");
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: "teams/team_jurio_1" }),
        {
          name: "Studio Legale Associato",
          visibility_default: "private",
        }
      );
      expect(mockToast.success).toHaveBeenCalledWith("Impostazioni salvate con successo!");
      expect(result.current.saving).toBe(false);
    });

    test("gestisce errore durante il salvataggio mostrando il relativo toast", async () => {
      mockUpdateDoc.mockRejectedValueOnce(new Error("Firestore update failed"));

      const { result } = renderHook(() =>
        useTeamSettings({ team: sampleTeam, isManager: true })
      );
      const event = createMockFormEvent();

      await act(async () => {
        await result.current.handleSave(event);
      });

      expect(mockToast.error).toHaveBeenCalledWith("Errore nel salvataggio. Riprova.");
      expect(console.error).toHaveBeenCalledWith(expect.any(Error));
      expect(result.current.saving).toBe(false);
    });
  });

  describe("Toggle Visibilità Predefinita (toggleTeamDefault)", () => {
    test("inverte lo stato se l'utente è manager e non vi sono operazioni in corso", () => {
      const { result } = renderHook(() =>
        useTeamSettings({ team: sampleTeam, isManager: true })
      );

      expect(result.current.isTeamDefault).toBe(true);

      act(() => {
        result.current.toggleTeamDefault();
      });
      expect(result.current.isTeamDefault).toBe(false);

      act(() => {
        result.current.toggleTeamDefault();
      });
      expect(result.current.isTeamDefault).toBe(true);
    });

    test("blocca il toggle se l'utente non è un manager", () => {
      const { result } = renderHook(() =>
        useTeamSettings({ team: sampleTeam, isManager: false })
      );

      act(() => {
        result.current.toggleTeamDefault();
      });

      expect(result.current.isTeamDefault).toBe(true);
    });
  });

  describe("Condivisione Massiva Documenti (handleShareAllPastDocuments & executeShareAll)", () => {
    test("handleShareAllPastDocuments apre il modale solo se l'utente è manager", () => {
      const { result: nonManagerResult } = renderHook(() =>
        useTeamSettings({ team: sampleTeam, isManager: false })
      );

      act(() => {
        nonManagerResult.current.handleShareAllPastDocuments();
      });
      expect(nonManagerResult.current.isShareConfirmOpen).toBe(false);

      const { result: managerResult } = renderHook(() =>
        useTeamSettings({ team: sampleTeam, isManager: true })
      );

      act(() => {
        managerResult.current.handleShareAllPastDocuments();
      });
      expect(managerResult.current.isShareConfirmOpen).toBe(true);

      act(() => {
        managerResult.current.closeShareConfirm();
      });
      expect(managerResult.current.isShareConfirmOpen).toBe(false);
    });

    test("executeShareAll chiude il modale, chiama l'endpoint di share massivo e mostra toast di successo", async () => {
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const { result } = renderHook(() =>
        useTeamSettings({ team: sampleTeam, isManager: true })
      );

      act(() => {
        result.current.handleShareAllPastDocuments();
      });
      expect(result.current.isShareConfirmOpen).toBe(true);

      await act(async () => {
        await result.current.executeShareAll();
      });

      expect(result.current.isShareConfirmOpen).toBe(false);
      expect(mockFetchWithSecurity).toHaveBeenCalledWith(
        "https://api.jurio.it/assign/share-all",
        { teamId: "team_jurio_1" }
      );
      expect(mockToast.success).toHaveBeenCalledWith(
        "Tutti i documenti storici sono ora visibili al team!"
      );
      expect(result.current.isSharingAll).toBe(false);
    });

    test("executeShareAll mostra toast di errore specifico se la risposta non è ok", async () => {
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { result } = renderHook(() =>
        useTeamSettings({ team: sampleTeam, isManager: true })
      );

      await act(async () => {
        await result.current.executeShareAll();
      });

      expect(mockToast.error).toHaveBeenCalledWith(
        "Errore durante la condivisione massiva: Errore durante la risposta dal server"
      );
      expect(result.current.isSharingAll).toBe(false);
    });
  });

  describe("Eliminazione Workspace (deleteTeamAction)", () => {
    test("esegue la cancellazione del team tramite fetchWithSecurity e restituisce la risposta", async () => {
      const serverResponse = { success: true, message: "Workspace eliminato" };
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(serverResponse),
      });

      const { result } = renderHook(() =>
        useTeamSettings({ team: sampleTeam, isManager: true })
      );

      let responseData: unknown;
      await act(async () => {
        responseData = await result.current.deleteTeamAction("team_jurio_1", true);
      });

      expect(mockFetchWithSecurity).toHaveBeenCalledWith(
        "https://api.jurio.it/assign/delete-team",
        {
          teamId: "team_jurio_1",
          revokeDocumentAccess: true,
        }
      );
      expect(responseData).toEqual(serverResponse);
    });

    test("solleva eccezione e registra il log su console se l'endpoint di cancellazione risponde non-ok", async () => {
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: vi.fn().mockResolvedValue({ error: "Permessi insufficienti per eliminare il team" }),
      });

      const { result } = renderHook(() =>
        useTeamSettings({ team: sampleTeam, isManager: true })
      );

      await expect(
        result.current.deleteTeamAction("team_jurio_1", false)
      ).rejects.toThrow("Permessi insufficienti per eliminare il team");

      expect(console.error).toHaveBeenCalledWith(
        "[deleteTeamAPI] Error:",
        expect.any(Error)
      );
    });
  });
});