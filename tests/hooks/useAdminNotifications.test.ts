import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useAdminNotifications,
  type NotificationPayload,
} from "@/features/admin/hooks/useAdminNotifications";
import { fetchWithSecurity } from "@/config/apiClient";
import { toast } from "react-hot-toast";

/* ---------- mock moduli esterni ---------- */
vi.mock("@/config/apiClient", () => ({
  fetchWithSecurity: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockedFetchWithSecurity = vi.mocked(fetchWithSecurity);

const createMockResponse = (ok: boolean, status: number, bodyText: string) =>
  ({
    ok,
    status,
    text: async () => bodyText,
  }) as unknown as Response;

describe("useAdminNotifications Hook Suite", () => {
  const mockEndpoint = "https://api.jurio.it/admin/notifications";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_ADMIN_NOTIFICATION", mockEndpoint);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const basePayload: NotificationPayload = {
    targetMode: "broadcast",
    consentFilter: "all",
    sendInApp: true,
    sendEmail: false,
    title: "Aggiornamento Normativo",
    message: "Nuove massime della Cassazione caricate nel sistema.",
    link: "/ricerca",
    type: "info",
  };

  test("inizializza lo stato con isSending a false", () => {
    const { result } = renderHook(() => useAdminNotifications());

    expect(result.current.isSending).toBe(false);
  });

  test("non esegue la chiamata se VITE_ADMIN_NOTIFICATION non è configurato", async () => {
    vi.stubEnv("VITE_ADMIN_NOTIFICATION", "");

    const { result } = renderHook(() => useAdminNotifications());

    await act(async () => {
      await result.current.sendNotification(basePayload);
    });

    expect(mockedFetchWithSecurity).not.toHaveBeenCalled();
    expect(result.current.isSending).toBe(false);
  });

  test("minifica l'HTML dell'email e invia la notifica con successo mostrando il messaggio dell'API", async () => {
    const responsePayload = JSON.stringify({
      success: true,
      message: "Broadcast inviato a 150 avvocati!",
    });
    mockedFetchWithSecurity.mockResolvedValueOnce(
      createMockResponse(true, 200, responsePayload)
    );

    const { result } = renderHook(() => useAdminNotifications());

    const payloadWithHtml: NotificationPayload = {
      ...basePayload,
      sendEmail: true,
      emailHtml: `
        <div>
          <!-- Commento HTML da rimuovere -->
          <h1>  Titolo con spazi  </h1>
          <p>Testo email</p>
        </div>
      `,
    };

    await act(async () => {
      await result.current.sendNotification(payloadWithHtml);
    });

    expect(mockedFetchWithSecurity).toHaveBeenCalledTimes(1);
    expect(mockedFetchWithSecurity).toHaveBeenCalledWith(mockEndpoint, {
      ...payloadWithHtml,
      emailHtml: "<div><h1> Titolo con spazi </h1><p>Testo email</p></div>",
    });

    expect(toast.success).toHaveBeenCalledWith("Broadcast inviato a 150 avvocati!");
    expect(result.current.isSending).toBe(false);
  });

  test("mostra il messaggio di successo di default se la risposta API non ha un campo message o non è JSON valido", async () => {
    mockedFetchWithSecurity.mockResolvedValueOnce(
      createMockResponse(true, 200, "OK - Testo grezzo non JSON")
    );

    const { result } = renderHook(() => useAdminNotifications());

    await act(async () => {
      await result.current.sendNotification(basePayload);
    });

    expect(toast.success).toHaveBeenCalledWith("Comunicazione inviata con successo!");
    expect(result.current.isSending).toBe(false);
  });

  test("gestisce lo stato 403 (accesso negato per utente non admin)", async () => {
    mockedFetchWithSecurity.mockResolvedValueOnce(
      createMockResponse(false, 403, JSON.stringify({ error: "Forbidden" }))
    );

    const { result } = renderHook(() => useAdminNotifications());

    await act(async () => {
      await result.current.sendNotification(basePayload);
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Accesso negato: Operazione riservata agli admin."
    );
    expect(result.current.isSending).toBe(false);
  });

  test("gestisce lo stato 429 (rate limit superato)", async () => {
    mockedFetchWithSecurity.mockResolvedValueOnce(
      createMockResponse(false, 429, JSON.stringify({ error: "Too Many Requests" }))
    );

    const { result } = renderHook(() => useAdminNotifications());

    await act(async () => {
      await result.current.sendNotification(basePayload);
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Limite di richieste superato. Riprova più tardi."
    );
    expect(result.current.isSending).toBe(false);
  });

  test("gestisce errori generici del server estraendo il messaggio di errore dal payload JSON", async () => {
    mockedFetchWithSecurity.mockResolvedValueOnce(
      createMockResponse(
        false,
        500,
        JSON.stringify({ error: "Errore durante l'invio su Firebase Cloud Messaging" })
      )
    );

    const { result } = renderHook(() => useAdminNotifications());

    await act(async () => {
      await result.current.sendNotification(basePayload);
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Si è verificato un errore: Invio fallito (500): Errore durante l'invio su Firebase Cloud Messaging"
    );
    expect(result.current.isSending).toBe(false);
  });

  test("gestisce errori di rete lanciati direttamente da fetchWithSecurity", async () => {
    mockedFetchWithSecurity.mockRejectedValueOnce(
      new Error("Connessione rifiutata dal server")
    );

    const { result } = renderHook(() => useAdminNotifications());

    await act(async () => {
      await result.current.sendNotification(basePayload);
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Si è verificato un errore: Connessione rifiutata dal server"
    );
    expect(result.current.isSending).toBe(false);
  });
});