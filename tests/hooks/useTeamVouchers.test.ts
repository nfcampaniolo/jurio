import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { Team } from "@/interfaces/interfaces";

/* ---------- hoisted mocks ---------- */
const { mockFetchWithSecurity, mockGetAssign } = vi.hoisted(() => ({
  mockFetchWithSecurity: vi.fn(),
  mockGetAssign: vi.fn(() => ({
    ASSIGN_SEAT_URL: "https://api.jurio.it/assign/seat",
    SEND_INVITE_URL: "https://api.jurio.it/assign/invite",
  })),
}));

/* ---------- mock modules ---------- */
vi.mock("@/config/apiClient", () => ({
  __esModule: true,
  fetchWithSecurity: (...args: unknown[]) => mockFetchWithSecurity(...args),
}));

vi.mock("@/config/env", () => ({
  __esModule: true,
  getAssign: () => mockGetAssign(),
}));

/* ---------- subject under test ---------- */
import { useTeamVouchers } from "@/features/teams/hooks/useTeamVouchers"; // <-- adegua il path se necessario

describe("useTeamVouchers Hook Suite", () => {
  const originalClipboard = navigator.clipboard;

const createMockTeam = (vouchers?: Array<{ id: string; code: string; used: boolean }>): Team =>
    ({
      id: "team_jurio_vouchers_1",
      name: "Studio Legale Campaniolo",
      vouchers: vouchers ?? [
        { id: "VOUCH-101", code: "VOUCH-101", used: false },
        { id: "VOUCH-102", code: "VOUCH-102", used: true },
        { id: "VOUCH-103", code: "VOUCH-103", used: false },
      ],
    } as unknown as Team);

  const createMockFormEvent = () =>
    ({
      preventDefault: vi.fn(),
    }) as unknown as React.FormEvent;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      configurable: true,
      writable: true,
    });
  });

  describe("Inizializzazione e Calcolo Voucher Disponibili", () => {
    test("inizializza gli stati ai valori predefiniti e calcola i voucher non usati", () => {
      const mockTeam = createMockTeam();
      const { result } = renderHook(() => useTeamVouchers({ team: mockTeam }));

      expect(result.current.email).toBe("");
      expect(result.current.loading).toBe(false);
      expect(result.current.voucherEmail).toBe("");
      expect(result.current.emailingVoucherId).toBeNull();
      expect(result.current.sendingVoucherId).toBeNull();
      expect(result.current.copiedId).toBeNull();
      expect(result.current.message).toBeNull();

      // Su 3 voucher, 2 hanno used: false
      expect(result.current.availableVouchers).toHaveLength(2);
      expect(result.current.availableVouchers.map((v) => v.id)).toEqual(["VOUCH-101", "VOUCH-103"]);
    });

    test("restituisce un array vuoto se la proprietà team.vouchers è undefined", () => {
      const emptyTeam = { id: "team_empty", name: "Studio Vuoto" } as unknown as Team;
      const { result } = renderHook(() => useTeamVouchers({ team: emptyTeam }));

      expect(result.current.availableVouchers).toEqual([]);
    });
  });

  describe("Assegnazione Diretta del Posto (handleAssignSeat)", () => {
    test("ignora la sottomissione se l'email è vuota o formata solo da spazi", async () => {
      const mockTeam = createMockTeam();
      const { result } = renderHook(() => useTeamVouchers({ team: mockTeam }));
      const formEvent = createMockFormEvent();

      act(() => {
        result.current.setEmail("   ");
      });

      await act(async () => {
        await result.current.handleAssignSeat(formEvent);
      });

      expect(formEvent.preventDefault).toHaveBeenCalled();
      expect(mockFetchWithSecurity).not.toHaveBeenCalled();
      expect(result.current.loading).toBe(false);
    });

    test("ignora la sottomissione se non sono presenti voucher disponibili", async () => {
      const teamNoVouchers = createMockTeam([{ id: "VOUCH-USED", code: "VOUCH-USED", used: true }]);
      const { result } = renderHook(() => useTeamVouchers({ team: teamNoVouchers }));
      const formEvent = createMockFormEvent();

      act(() => {
        result.current.setEmail("nuovomembro@studio.it");
      });

      await act(async () => {
        await result.current.handleAssignSeat(formEvent);
      });

      expect(mockFetchWithSecurity).not.toHaveBeenCalled();
      expect(result.current.loading).toBe(false);
    });

    test("assegna il posto con successo, normalizza l'email in minuscolo e resetta il campo", async () => {
      const mockTeam = createMockTeam();
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue("OK"),
      });

      const { result } = renderHook(() => useTeamVouchers({ team: mockTeam }));
      const formEvent = createMockFormEvent();

      act(() => {
        result.current.setEmail("Collaboratore@Studio.IT");
      });

      await act(async () => {
        await result.current.handleAssignSeat(formEvent);
      });

      expect(mockFetchWithSecurity).toHaveBeenCalledWith(
        "https://api.jurio.it/assign/seat",
        {
          teamId: "team_jurio_vouchers_1",
          email: "collaboratore@studio.it",
        }
      );

      expect(result.current.message).toEqual({
        type: "success",
        text: "Collaboratore@Studio.IT è stato aggiunto al Workspace con successo!",
      });
      expect(result.current.email).toBe("");
      expect(result.current.loading).toBe(false);
    });

    test("gestisce HTTP 404 con codice 'user-not-found' impostando messaggio informativo", async () => {
      const mockTeam = createMockTeam();
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: vi.fn().mockResolvedValue(JSON.stringify({ errorCode: "user-not-found" })),
      });

      const { result } = renderHook(() => useTeamVouchers({ team: mockTeam }));
      const formEvent = createMockFormEvent();

      act(() => {
        result.current.setEmail("sconosciuto@studio.it");
      });

      await act(async () => {
        await result.current.handleAssignSeat(formEvent);
      });

      expect(result.current.message).toEqual({
        type: "info",
        text: "L'utente non è ancora registrato. Puoi inviargli un codice d'invito via email dalla lista qui sotto.",
      });
      expect(result.current.loading).toBe(false);
    });

    test("gestisce HTTP 409 con codice 'already-exists' impostando messaggio di errore", async () => {
      const mockTeam = createMockTeam();
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: false,
        status: 409,
        text: vi.fn().mockResolvedValue(JSON.stringify({ errorCode: "already-exists" })),
      });

      const { result } = renderHook(() => useTeamVouchers({ team: mockTeam }));
      const formEvent = createMockFormEvent();

      act(() => {
        result.current.setEmail("gia_membro@studio.it");
      });

      await act(async () => {
        await result.current.handleAssignSeat(formEvent);
      });

      expect(result.current.message).toEqual({
        type: "error",
        text: "Questo utente fa già parte del Workspace.",
      });
      expect(result.current.loading).toBe(false);
    });

    test("gestisce errori 500 o fallimenti di rete impostando messaggio di errore generico", async () => {
      const mockTeam = createMockTeam();
      mockFetchWithSecurity.mockRejectedValueOnce(new Error("Network connection dropped"));

      const { result } = renderHook(() => useTeamVouchers({ team: mockTeam }));
      const formEvent = createMockFormEvent();

      act(() => {
        result.current.setEmail("utente@studio.it");
      });

      await act(async () => {
        await result.current.handleAssignSeat(formEvent);
      });

      expect(result.current.message).toEqual({
        type: "error",
        text: "Si è verificato un errore. Assicurati di essere connesso e riprova.",
      });
      expect(result.current.loading).toBe(false);
    });
  });

  describe("Invio Email di Invito (handleSendInviteEmail)", () => {
    test("ignora l'invocazione se voucherEmail è vuota o composta solo da spazi", async () => {
      const mockTeam = createMockTeam();
      const { result } = renderHook(() => useTeamVouchers({ team: mockTeam }));

      act(() => {
        result.current.setVoucherEmail("   ");
      });

      await act(async () => {
        await result.current.handleSendInviteEmail("VOUCH-101");
      });

      expect(mockFetchWithSecurity).not.toHaveBeenCalled();
      expect(result.current.sendingVoucherId).toBeNull();
    });

    test("invia l'email d'invito con successo, azzera voucherEmail e chiude il modulo", async () => {
      const mockTeam = createMockTeam();
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue("OK"),
      });

      const { result } = renderHook(() => useTeamVouchers({ team: mockTeam }));

      act(() => {
        result.current.openEmailForm("VOUCH-101");
        result.current.setVoucherEmail("  Avvocato.Esterno@Studio.IT  ");
      });

      await act(async () => {
        await result.current.handleSendInviteEmail("VOUCH-101");
      });

      expect(mockFetchWithSecurity).toHaveBeenCalledWith(
        "https://api.jurio.it/assign/invite",
        {
          teamId: "team_jurio_vouchers_1",
          email: "avvocato.esterno@studio.it",
          voucher: "VOUCH-101",
        }
      );

      expect(result.current.message).toEqual({
        type: "success",
        text: "Il codice d'invito è stato inviato via email a   Avvocato.Esterno@Studio.IT  !",
      });
      expect(result.current.emailingVoucherId).toBeNull();
      expect(result.current.voucherEmail).toBe("");
      expect(result.current.sendingVoucherId).toBeNull();
    });

    test("intercetta risposta HTTP non-ok con payload JSON ed estrae il messaggio di errore", async () => {
      const mockTeam = createMockTeam();
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue(JSON.stringify({ error: "Il codice voucher risulta già riscattato." })),
      });

      const { result } = renderHook(() => useTeamVouchers({ team: mockTeam }));

      act(() => {
        result.current.setVoucherEmail("test@studio.it");
      });

      await act(async () => {
        await result.current.handleSendInviteEmail("VOUCH-101");
      });

      expect(result.current.message).toEqual({
        type: "error",
        text: "Il codice voucher risulta già riscattato.",
      });
      expect(result.current.sendingVoucherId).toBeNull();
    });

    test("imposta messaggio di fallback se la fetch rigetta per errore di rete", async () => {
      const mockTeam = createMockTeam();
      mockFetchWithSecurity.mockRejectedValueOnce(new Error("Failed to fetch"));

      const { result } = renderHook(() => useTeamVouchers({ team: mockTeam }));

      act(() => {
        result.current.setVoucherEmail("test@studio.it");
      });

      await act(async () => {
        await result.current.handleSendInviteEmail("VOUCH-101");
      });

      expect(result.current.message).toEqual({
        type: "error",
        text: "Errore durante l'invio dell'email. Riprova più tardi.",
      });
      expect(result.current.sendingVoucherId).toBeNull();
    });
  });

  describe("Copia negli Appunti (copyToClipboard)", () => {
    test("copia il codice voucher e azzera copiedId dopo 2000ms", async () => {
      vi.useFakeTimers();

      const mockTeam = createMockTeam();
      const { result } = renderHook(() => useTeamVouchers({ team: mockTeam }));

      await act(async () => {
        await result.current.copyToClipboard("VOUCH-JURIO-2026");
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("VOUCH-JURIO-2026");
      expect(result.current.copiedId).toBe("VOUCH-JURIO-2026");

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.copiedId).toBeNull();
    });

    test("intercetta eccezione su navigator.clipboard.writeText senza bloccare l'esecuzione", async () => {
      vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(new Error("Clipboard denied"));

      const mockTeam = createMockTeam();
      const { result } = renderHook(() => useTeamVouchers({ team: mockTeam }));

      await act(async () => {
        await result.current.copyToClipboard("VOUCH-ERR");
      });

      expect(console.error).toHaveBeenCalledWith(
        "Errore durante la copia:",
        expect.any(Error)
      );
      expect(result.current.copiedId).toBeNull();
    });
  });

  describe("Gestione Modulo Invito (openEmailForm & closeEmailForm)", () => {
    test("openEmailForm imposta il voucher target, svuota voucherEmail e azzera messaggi residui", () => {
      const mockTeam = createMockTeam();
      const { result } = renderHook(() => useTeamVouchers({ team: mockTeam }));

      act(() => {
        result.current.setVoucherEmail("old@email.com");
      });

      act(() => {
        result.current.openEmailForm("VOUCH-TARGET-88");
      });

      expect(result.current.emailingVoucherId).toBe("VOUCH-TARGET-88");
      expect(result.current.voucherEmail).toBe("");
      expect(result.current.message).toBeNull();
    });

    test("closeEmailForm chiude il form impostando emailingVoucherId a null", () => {
      const mockTeam = createMockTeam();
      const { result } = renderHook(() => useTeamVouchers({ team: mockTeam }));

      act(() => {
        result.current.openEmailForm("VOUCH-TARGET-88");
      });
      expect(result.current.emailingVoucherId).toBe("VOUCH-TARGET-88");

      act(() => {
        result.current.closeEmailForm();
      });
      expect(result.current.emailingVoucherId).toBeNull();
    });
  });
});