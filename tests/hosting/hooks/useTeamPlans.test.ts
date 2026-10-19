import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

/* ---------- hoisted mocks ---------- */
const {
  mockNavigate,
  mockToast,
  mockFirestoreDb,
  mockGetDb,
  mockCollection,
  mockDoc,
  mockQuery,
  mockWhere,
  mockGetDocs,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockToast: {
    error: vi.fn(),
    success: vi.fn(),
  },
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
  mockQuery: vi.fn((...args: unknown[]) => ({ type: "query", args })),
  mockWhere: vi.fn((field: string, op: string, val: unknown) => ({ field, op, val })),
  mockGetDocs: vi.fn(),
}));

/* ---------- mock modules ---------- */
vi.mock("react-router-dom", () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
}));

vi.mock("react-hot-toast", () => ({
  toast: mockToast,
}));

vi.mock("@/infrastructure/db", () => ({
  __esModule: true,
  getDb: () => mockGetDb(),
}));

vi.mock("firebase/firestore", () => ({
  __esModule: true,
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (field: string, op: string, val: unknown) => mockWhere(field, op, val),
  getDocs: (q: unknown) => mockGetDocs(q),
}));

/* ---------- subject under test ---------- */
import { useTeamPlans } from "@/features/teams/hooks/useTeamPlans"; // <-- adegua il path se necessario

describe("useTeamPlans Hook Suite", () => {
  const currentUid = "usr_flv_2026";
  const mockOpenPaymentForPlan = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDb.mockResolvedValue(mockFirestoreDb);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("Inizializzazione e Utente Non Autenticato", () => {
    test("inizializza lo stato con modale chiuso ed espone navigate", () => {
      const { result } = renderHook(() => useTeamPlans());

      expect(result.current.isOwnerModalOpen).toBe(false);
      expect(result.current.navigate).toBe(mockNavigate);
    });

    test("apre direttamente il checkout del piano se l'utente non è autenticato (senza interrogare il db)", async () => {
      const { result } = renderHook(() => useTeamPlans(undefined, false));

      await act(async () => {
        await result.current.handlePlanClick("team_standard", mockOpenPaymentForPlan);
      });

      expect(mockOpenPaymentForPlan).toHaveBeenCalledWith("team_standard");
      expect(mockGetDb).not.toHaveBeenCalled();
      expect(mockGetDocs).not.toHaveBeenCalled();
      expect(result.current.isOwnerModalOpen).toBe(false);
    });
  });

  describe("Utente Owner di un Team Esistente", () => {
    test("intercetta il ruolo di owner aprendo il modale di conferma senza avviare il pagamento immediato", async () => {
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [{ id: "team_existing_1", data: () => ({ owners: [currentUid] }) }],
      });

      const { result } = renderHook(() => useTeamPlans(currentUid, true));

      await act(async () => {
        await result.current.handlePlanClick("team_pro", mockOpenPaymentForPlan);
      });

      expect(mockCollection).toHaveBeenCalledWith(mockFirestoreDb, "teams");
      expect(mockWhere).toHaveBeenCalledWith("owners", "array-contains", currentUid);
      expect(result.current.isOwnerModalOpen).toBe(true);
      expect(mockOpenPaymentForPlan).not.toHaveBeenCalled();
    });

    test("handleConfirmOwnerPurchase chiude il modale e inoltra l'acquisto del piano selezionato", async () => {
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [{ id: "team_existing_1" }],
      });

      const { result } = renderHook(() => useTeamPlans(currentUid, true));

      await act(async () => {
        await result.current.handlePlanClick("team_enterprise", mockOpenPaymentForPlan);
      });

      expect(result.current.isOwnerModalOpen).toBe(true);

      act(() => {
        result.current.handleConfirmOwnerPurchase(mockOpenPaymentForPlan);
      });

      expect(result.current.isOwnerModalOpen).toBe(false);
      expect(mockOpenPaymentForPlan).toHaveBeenCalledWith("team_enterprise");
    });

    test("handleCancelOwnerPurchase chiude il modale e azzera la selezione senza procedere al pagamento", async () => {
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [{ id: "team_existing_1" }],
      });

      const { result } = renderHook(() => useTeamPlans(currentUid, true));

      await act(async () => {
        await result.current.handlePlanClick("team_enterprise", mockOpenPaymentForPlan);
      });

      expect(result.current.isOwnerModalOpen).toBe(true);

      act(() => {
        result.current.handleCancelOwnerPurchase();
      });

      expect(result.current.isOwnerModalOpen).toBe(false);
      expect(mockOpenPaymentForPlan).not.toHaveBeenCalled();

      // Conferma successiva non deve scatenare pagamenti residui
      act(() => {
        result.current.handleConfirmOwnerPurchase(mockOpenPaymentForPlan);
      });
      expect(mockOpenPaymentForPlan).not.toHaveBeenCalled();
    });
  });

  describe("Utente Membro Non-Owner (userHasTeam: true)", () => {
    test("blocca l'acquisto con toast specifico se l'utente appartiene a un team ma non ne è owner", async () => {
      mockGetDocs.mockResolvedValueOnce({
        empty: true,
        docs: [],
      });

      const { result } = renderHook(() => useTeamPlans(currentUid, true));

      await act(async () => {
        await result.current.handlePlanClick("team_starter", mockOpenPaymentForPlan);
      });

      expect(mockToast.error).toHaveBeenCalledWith(
        "Fai già parte di un Team. Devi prima lasciare il tuo team attuale per acquistarne uno nuovo.",
        {
          duration: 4000,
          position: "top-center",
        }
      );
      expect(mockOpenPaymentForPlan).not.toHaveBeenCalled();
      expect(result.current.isOwnerModalOpen).toBe(false);
    });
  });

  describe("Utente Senza Team (userHasTeam: false)", () => {
    test("procede regolarmente con il checkout se l'utente non possiede e non fa parte di alcun team", async () => {
      mockGetDocs.mockResolvedValueOnce({
        empty: true,
        docs: [],
      });

      const { result } = renderHook(() => useTeamPlans(currentUid, false));

      await act(async () => {
        await result.current.handlePlanClick("team_custom", mockOpenPaymentForPlan);
      });

      expect(mockOpenPaymentForPlan).toHaveBeenCalledWith("team_custom");
      expect(mockToast.error).not.toHaveBeenCalled();
      expect(result.current.isOwnerModalOpen).toBe(false);
    });
  });

  describe("Gestione Fallimenti Database", () => {
    test("mostra toast di errore e non apre modali né pagamenti se la query Firestore fallisce", async () => {
      mockGetDocs.mockRejectedValueOnce(new Error("Firestore permission-denied"));

      const { result } = renderHook(() => useTeamPlans(currentUid, false));

      await act(async () => {
        await result.current.handlePlanClick("team_standard", mockOpenPaymentForPlan);
      });

      expect(console.error).toHaveBeenCalledWith(
        "Errore verifica stato team:",
        expect.any(Error)
      );
      expect(mockToast.error).toHaveBeenCalledWith("Impossibile verificare lo stato del team. Riprova.");
      expect(mockOpenPaymentForPlan).not.toHaveBeenCalled();
      expect(result.current.isOwnerModalOpen).toBe(false);
    });
  });
});