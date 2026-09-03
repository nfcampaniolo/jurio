import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

/* ---------- hoisted mocks ---------- */
const {
  mockToast,
  mockFetchWithSecurity,
  mockGetAssign,
} = vi.hoisted(() => ({
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  mockFetchWithSecurity: vi.fn(),
  mockGetAssign: vi.fn(() => ({
    ASSIGN_SEAT_URL: "https://api.jurio.it/assign-seat",
    VERIFY_VOUCHER_URL: "https://api.jurio.it/verify-voucher",
  })),
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

/* ---------- subject under test ---------- */
import { useJoinTeamWithVoucher } from "@/features/teams/hooks/useJoinTeamWithVoucher"; // <-- adegua il path di import se necessario

describe("useJoinTeamWithVoucher Hook Suite", () => {
  const createMockFormEvent = () =>
    ({
      preventDefault: vi.fn(),
    }) as unknown as React.FormEvent;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("Stato iniziale e controlli setter", () => {
    test("inizializza il workflow con i valori di default corretti", () => {
      const { result } = renderHook(() => useJoinTeamWithVoucher());

      expect(result.current.step).toBe(1);
      expect(result.current.voucherCode).toBe("");
      expect(result.current.loading).toBe(false);
      expect(result.current.joining).toBe(false);
      expect(result.current.teams).toEqual([]);
      expect(result.current.selectedTeamId).toBeNull();
    });

    test("permette l'aggiornamento manuale di voucherCode, step e selectedTeamId", () => {
      const { result } = renderHook(() => useJoinTeamWithVoucher());

      act(() => {
        result.current.setVoucherCode("STUDIO-LEGAL-2026");
        result.current.setStep(2);
        result.current.setSelectedTeamId("team_alpha");
      });

      expect(result.current.voucherCode).toBe("STUDIO-LEGAL-2026");
      expect(result.current.step).toBe(2);
      expect(result.current.selectedTeamId).toBe("team_alpha");
    });
  });

  describe("handleVerifyVoucher", () => {
    test("ignora la chiamata e non invoca fetch se il codice voucher è vuoto o composto solo da spazi", async () => {
      const { result } = renderHook(() => useJoinTeamWithVoucher());
      const event = createMockFormEvent();

      await act(async () => {
        await result.current.handleVerifyVoucher(event);
      });

      expect(event.preventDefault).toHaveBeenCalledTimes(1);
      expect(mockFetchWithSecurity).not.toHaveBeenCalled();
      expect(result.current.loading).toBe(false);
    });

    test("verifica il voucher con successo, popola i team, seleziona il primo team e avanza allo step 2", async () => {
      const mockTeams = [
        { id: "team_1", name: "Dipartimento Contenzioso" },
        { id: "team_2", name: "Dipartimento Societario" },
      ];

      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ teams: mockTeams }),
      });

      const { result } = renderHook(() => useJoinTeamWithVoucher());
      const event = createMockFormEvent();

      act(() => {
        result.current.setVoucherCode("   VOUCHER-CORRETTO   ");
      });

      await act(async () => {
        await result.current.handleVerifyVoucher(event);
      });

      expect(mockFetchWithSecurity).toHaveBeenCalledWith(
        "https://api.jurio.it/verify-voucher",
        { voucher: "VOUCHER-CORRETTO" }
      );
      expect(result.current.teams).toEqual(mockTeams);
      expect(result.current.selectedTeamId).toBe("team_1");
      expect(result.current.step).toBe(2);
      expect(result.current.loading).toBe(false);
    });

    test("mostra un toast di errore se la risposta è ok ma non contiene team associati", async () => {
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ teams: [] }),
      });

      const { result } = renderHook(() => useJoinTeamWithVoucher());
      const event = createMockFormEvent();

      act(() => {
        result.current.setVoucherCode("VOUCHER-SENZA-TEAM");
      });

      await act(async () => {
        await result.current.handleVerifyVoucher(event);
      });

      expect(mockToast.error).toHaveBeenCalledWith("Nessun Workspace trovato per questo codice.");
      expect(result.current.step).toBe(1);
      expect(result.current.loading).toBe(false);
    });

    test("gestisce errore dal server (res.ok: false) mostrando il messaggio restituito dal backend", async () => {
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({ error: "Codice voucher già utilizzato." }),
      });

      const { result } = renderHook(() => useJoinTeamWithVoucher());
      const event = createMockFormEvent();

      act(() => {
        result.current.setVoucherCode("VOUCHER-ESAURITO");
      });

      await act(async () => {
        await result.current.handleVerifyVoucher(event);
      });

      expect(mockToast.error).toHaveBeenCalledWith("Codice voucher già utilizzato.");
      expect(result.current.step).toBe(1);
      expect(result.current.loading).toBe(false);
    });

    test("gestisce il fallback di errore se il server risponde non-ok senza payload di errore", async () => {
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValue({}),
      });

      const { result } = renderHook(() => useJoinTeamWithVoucher());
      const event = createMockFormEvent();

      act(() => {
        result.current.setVoucherCode("VOUCHER-ERR");
      });

      await act(async () => {
        await result.current.handleVerifyVoucher(event);
      });

      expect(mockToast.error).toHaveBeenCalledWith("Codice non valido o scaduto");
      expect(result.current.loading).toBe(false);
    });
  });

  describe("handleJoinTeam", () => {
    test("ignora la chiamata se selectedTeamId è null", async () => {
      const { result } = renderHook(() => useJoinTeamWithVoucher());

      await act(async () => {
        await result.current.handleJoinTeam();
      });

      expect(mockFetchWithSecurity).not.toHaveBeenCalled();
      expect(result.current.joining).toBe(false);
    });

    test("assegna il posto nel team, mostra toast di successo ed esegue onJoinSuccess", async () => {
      const onJoinSuccessMock = vi.fn();
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(JSON.stringify({ success: true })),
      });

      const { result } = renderHook(() =>
        useJoinTeamWithVoucher({ onJoinSuccess: onJoinSuccessMock })
      );

      act(() => {
        result.current.setVoucherCode("VOUCHER-TEAM-2026");
        result.current.setSelectedTeamId("team_legal_civile");
      });

      await act(async () => {
        await result.current.handleJoinTeam();
      });

      expect(mockFetchWithSecurity).toHaveBeenCalledWith(
        "https://api.jurio.it/assign-seat",
        {
          teamId: "team_legal_civile",
          voucher: "VOUCHER-TEAM-2026",
        }
      );
      expect(mockToast.success).toHaveBeenCalledWith("Benvenuto nel Workspace!");
      expect(onJoinSuccessMock).toHaveBeenCalledTimes(1);
      expect(result.current.joining).toBe(false);
    });

    test("gestisce errore con payload JSON dal server mostrando l'errore specifico", async () => {
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: false,
        status: 409,
        text: vi.fn().mockResolvedValue(JSON.stringify({ error: "Posti esauriti per questo Workspace." })),
      });

      const { result } = renderHook(() => useJoinTeamWithVoucher());

      act(() => {
        result.current.setVoucherCode("VOUCHER-PIENO");
        result.current.setSelectedTeamId("team_full");
      });

      await act(async () => {
        await result.current.handleJoinTeam();
      });

      expect(mockToast.error).toHaveBeenCalledWith("Posti esauriti per questo Workspace.");
      expect(result.current.joining).toBe(false);
    });

    test("gestisce risposta di errore non formattata in JSON con codice di stato HTTP", async () => {
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: vi.fn().mockResolvedValue("Bad Gateway Gateway timeout"),
      });

      const { result } = renderHook(() => useJoinTeamWithVoucher());

      act(() => {
        result.current.setVoucherCode("VOUCHER-CRASH");
        result.current.setSelectedTeamId("team_crash");
      });

      await act(async () => {
        await result.current.handleJoinTeam();
      });

      expect(mockToast.error).toHaveBeenCalledWith("Errore (502)");
      expect(result.current.joining).toBe(false);
    });

    test("intercetta eccezioni di rete mantenendo lo stato joining a false", async () => {
      mockFetchWithSecurity.mockRejectedValueOnce(new Error("Connessione persa"));

      const { result } = renderHook(() => useJoinTeamWithVoucher());

      act(() => {
        result.current.setVoucherCode("VOUCHER-RETE");
        result.current.setSelectedTeamId("team_rete");
      });

      await act(async () => {
        await result.current.handleJoinTeam();
      });

      expect(mockToast.error).toHaveBeenCalledWith("Connessione persa");
      expect(result.current.joining).toBe(false);
    });
  });
});