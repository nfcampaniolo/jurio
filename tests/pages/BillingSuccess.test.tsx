import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

/* ---------- mock react-router-dom ---------- */
const mockNavigate = vi.fn();
let mockSearchParamSessionId: string | null = "cs_test_123456";

vi.mock("react-router-dom", () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
  useSearchParams: () => [
    {
      get: (key: string) => (key === "session_id" ? mockSearchParamSessionId : null),
    },
  ],
}));

/* ---------- mock useAuth ---------- */
let mockAuthUser: { uid: string; email?: string } | null = { uid: "usr_789" };

vi.mock("@/context/useAuth", () => ({
  __esModule: true,
  useAuth: () => ({ user: mockAuthUser }),
}));

/* ---------- mock services/db & firebase/firestore ---------- */
const mockGetDb = vi.fn().mockResolvedValue({ type: "firestore-db" });
vi.mock("@/services/db", () => ({
  __esModule: true,
  getDb: () => mockGetDb(),
}));

let snapshotCallback: ((snap: unknown) => void) | null = null;
let snapshotErrorCallback: ((err: unknown) => void) | null = null;
const mockUnsubscribe = vi.fn();

vi.mock("firebase/firestore", () => ({
  __esModule: true,
  doc: vi.fn((_db, collectionName, id) => ({ path: `${collectionName}/${id}` })),
  onSnapshot: vi.fn((_docRef, onNext, onError) => {
    snapshotCallback = onNext;
    snapshotErrorCallback = onError;
    return mockUnsubscribe;
  }),
}));

/* ---------- component ---------- */
import BillingSuccess from "@/pages/BillingSuccess";

describe("BillingSuccess Page Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockSearchParamSessionId = "cs_test_123456";
    mockAuthUser = { uid: "usr_789" };
    snapshotCallback = null;
    snapshotErrorCallback = null;
    mockGetDb.mockResolvedValue({ type: "firestore-db" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("renderizza lo stato iniziale di attesa (waiting) con session ID e opzioni di navigazione", async () => {
    render(<BillingSuccess />);

    expect(
      screen.getByRole("heading", { name: "Pagamento in elaborazione…", level: 1 })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Stiamo confermando il pagamento e attivando il piano\. Attendi qualche secondo\./i
      )
    ).toBeInTheDocument();
    expect(screen.getByText("cs_test_123456")).toBeInTheDocument();

    const toProfileBtn = screen.getByRole("button", { name: "Vai al profilo" });
    const toPlansBtn = screen.getByRole("button", { name: "Torna ai piani" });

    expect(toProfileBtn).toBeInTheDocument();
    expect(toPlansBtn).toBeInTheDocument();

    fireEvent.click(toProfileBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/profilo");

    fireEvent.click(toPlansBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/profilo/piani");
  });

  test("mostra placeholder '—' quando session_id non è presente nell'URL", async () => {
    mockSearchParamSessionId = null;
    render(<BillingSuccess />);

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  test("gestisce il completamento con successo del pagamento (ok) e reindirizza dopo timeout", async () => {
    render(<BillingSuccess />);

    await act(async () => {
      // Attende la risoluzione della promise getDb()
      await Promise.resolve();
    });

    expect(snapshotCallback).toBeTypeOf("function");

    // Simula arrivo snapshot valido da Firestore
    act(() => {
      snapshotCallback?.({
        exists: () => true,
        data: () => ({
          status: "active",
          provider: "stripe",
          stripeSessionId: "cs_test_123456",
        }),
      });
    });

    expect(
      screen.getByRole("heading", { name: "Pagamento completato", level: 1 })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Piano attivato\. Reindirizzamento al profilo…/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Attivazione completata\. Tra poco verrai reindirizzato automaticamente\./i)
    ).toBeInTheDocument();

    // Verifica il redirect ritardato di 1200ms
    expect(mockNavigate).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(mockNavigate).toHaveBeenCalledWith("/profilo");
  });

  test("consente il redirect immediato al profilo tramite pulsante nello stato di successo", async () => {
    render(<BillingSuccess />);

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      snapshotCallback?.({
        exists: () => true,
        data: () => ({
          status: "active",
          provider: "stripe",
          stripeSessionId: "cs_test_123456",
        }),
      });
    });

    const directBtn = screen.getByRole("button", { name: "Vai al profilo ora" });
    fireEvent.click(directBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/profilo");
  });

  test("passa allo stato di errore se lo snapshot restituisce un fallimento", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<BillingSuccess />);

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      snapshotErrorCallback?.(new Error("Permessi insufficienti su Firestore"));
    });

    expect(
      screen.getByRole("heading", { name: "Verifica non riuscita", level: 1 })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Verifica non riuscita\. Se hai già pagato, il webhook potrebbe essere in ritardo/i)
    ).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  test("passa allo stato di errore se getDb() solleva un'eccezione", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetDb.mockRejectedValue(new Error("Errore inizializzazione DB"));

    render(<BillingSuccess />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      screen.getByRole("heading", { name: "Verifica non riuscita", level: 1 })
    ).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  test("non attiva il listener se l'utente non è loggato (uid vuoto)", async () => {
    mockAuthUser = null;
    render(<BillingSuccess />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(snapshotCallback).toBeNull();
  });

  test("esegue il cleanup di unsubscribe allo smontaggio del componente", async () => {
    const { unmount } = render(<BillingSuccess />);

    await act(async () => {
      await Promise.resolve();
    });

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});