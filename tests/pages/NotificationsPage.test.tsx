import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

/* ---------- mock react-router-dom ---------- */
const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
}));

/* ---------- mock @dr.pogodin/react-helmet ---------- */
vi.mock("@dr.pogodin/react-helmet", () => ({
  __esModule: true,
  Helmet: () => null,
}));

/* ---------- mock useAuth ---------- */
let mockAuthState = {
  user: { uid: "usr_flv_2026" } as { uid: string } | null,
  loading: false,
};

vi.mock("@/context/useAuth", () => ({
  __esModule: true,
  useAuth: () => mockAuthState,
}));

/* ---------- mock firestore & db ---------- */
const mockGetDb = vi.fn().mockResolvedValue({ type: "firestore-db" });
vi.mock("@/services/db", () => ({
  __esModule: true,
  getDb: () => mockGetDb(),
}));

let personalSnapshotListener: ((snap: unknown) => void) | null = null;
let broadcastSnapshotListener: ((snap: unknown) => void) | null = null;
let userSnapshotListener: ((snap: unknown) => void) | null = null;

const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);
const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
const mockBatchUpdate = vi.fn();
const mockArrayUnion = vi.fn((...args: unknown[]) => ({ _type: "arrayUnion", elements: args }));

type MockFirestoreTarget = {
  _type?: string;
  name?: string;
  path?: string;
  coll?: string | { name?: string };
};

vi.mock("firebase/firestore", () => ({
  __esModule: true,
  initializeFirestore: vi.fn(() => ({ type: "firestore-db" })),
  getFirestore: vi.fn(() => ({ type: "firestore-db" })),
  persistentLocalCache: vi.fn(),
  persistentMultipleTabManager: vi.fn(),
  collection: vi.fn((_db, name: string) => ({ _type: "collection", name })),
  doc: vi.fn((_db, coll: string, id: string) => ({ _type: "doc", path: `${coll}/${id}`, id, coll })),
  query: vi.fn((coll: unknown) => ({ _type: "query", coll })),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  arrayUnion: (...args: unknown[]) => mockArrayUnion(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  writeBatch: () => ({
    update: mockBatchUpdate,
    commit: mockBatchCommit,
  }),
  onSnapshot: vi.fn(
    (target: MockFirestoreTarget, callback: (snap: unknown) => void) => {
      const collName =
        target.name ??
        (typeof target.coll === "object" ? target.coll?.name : target.coll) ??
        "";
      const path = target.path ?? "";

      if (collName === "notification") {
        personalSnapshotListener = callback;
      } else if (collName === "broadcast") {
        broadcastSnapshotListener = callback;
      } else if (path.startsWith("users") || collName === "users") {
        userSnapshotListener = callback;
      }
      return vi.fn();
    }
  ),
}));

/* ---------- component under test ---------- */
import NotificationsPage from "@/pages/NotificationsPage";

describe("NotificationsPage Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    personalSnapshotListener = null;
    broadcastSnapshotListener = null;
    userSnapshotListener = null;
    mockAuthState = {
      user: { uid: "usr_flv_2026" },
      loading: false,
    };
    mockGetDb.mockResolvedValue({ type: "firestore-db" });
  });

  test("mostra lo stato di caricamento quando authLoading o dbLoading è attivo", () => {
    mockAuthState.loading = true;
    render(<NotificationsPage />);

    expect(screen.getByText("Caricamento notifiche...")).toBeInTheDocument();
  });

  test("mostra il messaggio di accesso richiesto se l'utente non è autenticato", async () => {
    mockAuthState = { user: null, loading: false };
    render(<NotificationsPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Devi effettuare l'accesso per vedere le notifiche.")
      ).toBeInTheDocument();
    });
  });

  test("renderizza lo stato vuoto se non ci sono notifiche personali né avvisi globali", async () => {
    render(<NotificationsPage />);

    await waitFor(() => {
      expect(personalSnapshotListener).not.toBeNull();
    });

    act(() => {
      personalSnapshotListener?.({ docs: [] });
      broadcastSnapshotListener?.({ docs: [] });
      userSnapshotListener?.({
        exists: () => true,
        data: () => ({ readBroadcasts: [] }),
      });
    });

    expect(screen.getByRole("heading", { name: "Notifiche", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Nessuna notifica")).toBeInTheDocument();
    expect(screen.getByText("Non hai ancora ricevuto aggiornamenti.")).toBeInTheDocument();
    expect(screen.queryByText(/Segna tutte come lette/i)).not.toBeInTheDocument();
  });

  test("unisce, ordina e renderizza notifiche personali e broadcast con badge contatore", async () => {
    render(<NotificationsPage />);

    await waitFor(() => {
      expect(personalSnapshotListener).not.toBeNull();
    });

    const makeTimestamp = (millis: number) => ({
      toMillis: () => millis,
      toDate: () => new Date(millis),
    });

    act(() => {
      personalSnapshotListener?.({
        docs: [
          {
            id: "notif-1",
            data: () => ({
              title: "Fattura disponibile",
              message: "La fattura di settembre 2026 è pronta.",
              type: "billing",
              isRead: false,
              createdAt: makeTimestamp(10000),
              link: "/profilo/piani",
            }),
          },
        ],
      });

      broadcastSnapshotListener?.({
        docs: [
          {
            id: "broad-1",
            data: () => ({
              title: "Manutenzione programmata",
              message: "I server saranno in manutenzione stanotte.",
              type: "system",
              createdAt: makeTimestamp(20000),
            }),
          },
        ],
      });

      userSnapshotListener?.({
        exists: () => true,
        data: () => ({ readBroadcasts: [] }),
      });
    });

    expect(screen.getByText("2 nuove")).toBeInTheDocument();
    expect(screen.getByText("Manutenzione programmata")).toBeInTheDocument();
    expect(screen.getByText("Fattura disponibile")).toBeInTheDocument();
    expect(screen.getByText("Segna tutte come lette")).toBeInTheDocument();
  });

  test("gestisce il click su una notifica personale non letta: segna letta e naviga al link", async () => {
    render(<NotificationsPage />);

    await waitFor(() => {
      expect(personalSnapshotListener).not.toBeNull();
    });

    act(() => {
      personalSnapshotListener?.({
        docs: [
          {
            id: "notif-1",
            data: () => ({
              title: "Verifica account",
              message: "Conferma la tua email.",
              type: "account",
              isRead: false,
              link: "/impostazioni",
              createdAt: { toMillis: () => 1000, toDate: () => new Date(1000) },
            }),
          },
        ],
      });
      broadcastSnapshotListener?.({ docs: [] });
      userSnapshotListener?.({ exists: () => true, data: () => ({ readBroadcasts: [] }) });
    });

    const notifCard = screen.getByText("Verifica account").closest("div[class*='cursor-pointer']");
    expect(notifCard).not.toBeNull();

    if (notifCard) {
      fireEvent.click(notifCard);
    }

    await waitFor(() => {
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: "notification/notif-1" }),
        { isRead: true }
      );
      expect(mockNavigate).toHaveBeenCalledWith("/impostazioni");
    });
  });

  test("gestisce il click su un broadcast: salva l'ID nell'array utente", async () => {
    render(<NotificationsPage />);

    await waitFor(() => {
      expect(broadcastSnapshotListener).not.toBeNull();
    });

    act(() => {
      personalSnapshotListener?.({ docs: [] });
      broadcastSnapshotListener?.({
        docs: [
          {
            id: "broad-99",
            data: () => ({
              title: "Nuova funzione AI",
              message: "Disponibile la ricerca vettoriale.",
              type: "system",
              createdAt: { toMillis: () => 1000, toDate: () => new Date(1000) },
            }),
          },
        ],
      });
      userSnapshotListener?.({ exists: () => true, data: () => ({ readBroadcasts: [] }) });
    });

    const broadcastCard = screen.getByText("Nuova funzione AI").closest("div[class*='cursor-pointer']");
    expect(broadcastCard).not.toBeNull();

    if (broadcastCard) {
      fireEvent.click(broadcastCard);
    }

    await waitFor(() => {
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: "users/usr_flv_2026" }),
        expect.objectContaining({
          readBroadcasts: expect.objectContaining({ elements: ["broad-99"] }),
        })
      );
    });
  });

  test("esegue 'Segna tutte come lette' per notifiche personali (batch) e broadcast", async () => {
    render(<NotificationsPage />);

    await waitFor(() => {
      expect(personalSnapshotListener).not.toBeNull();
    });

    act(() => {
      personalSnapshotListener?.({
        docs: [
          {
            id: "p-1",
            data: () => ({
              title: "Notifica P1",
              message: "Msg 1",
              type: "billing",
              isRead: false,
              createdAt: { toMillis: () => 1000, toDate: () => new Date(1000) },
            }),
          },
        ],
      });
      broadcastSnapshotListener?.({
        docs: [
          {
            id: "b-1",
            data: () => ({
              title: "Broadcast B1",
              message: "Msg B1",
              type: "system",
              createdAt: { toMillis: () => 2000, toDate: () => new Date(2000) },
            }),
          },
        ],
      });
      userSnapshotListener?.({ exists: () => true, data: () => ({ readBroadcasts: [] }) });
    });

    const markAllBtn = screen.getByRole("button", { name: /Segna tutte come lette/i });
    fireEvent.click(markAllBtn);

    await waitFor(() => {
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ path: "notification/p-1" }),
        { isRead: true }
      );
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: "users/usr_flv_2026" }),
        expect.objectContaining({
          readBroadcasts: expect.objectContaining({ elements: ["b-1"] }),
        })
      );
    });
  });
});