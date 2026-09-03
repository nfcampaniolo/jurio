// tests/components/Info/Header.test.tsx
import React from "react";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/* ---------- tipi mock firestore & auth ---------- */
interface AuthUser {
  uid: string;
}

interface AuthContextValue {
  user: AuthUser | null;
}

interface MockDocSnapshot {
  exists: () => boolean;
  data: () => { readBroadcasts?: string[] };
}

interface MockQuerySnapshot {
  empty?: boolean;
  docs?: Array<{ id: string }>;
}

type MockSnapshot = MockDocSnapshot & MockQuerySnapshot;
type MockSnapshotCallback = (snapshot: MockSnapshot) => void;

interface MockCollectionRef {
  _type: "col";
  path: string;
}

interface MockDocRef {
  _type: "doc";
  col: string;
  id: string;
}

type MockTargetRef = MockCollectionRef | MockDocRef;

/* ---------- hoisted mocks ---------- */
const {
  navigateMock,
  useAuthMock,
  useReducedMotionMock,
  getDbMock,
  snapshotListeners,
} = vi.hoisted(() => ({
  navigateMock: vi.fn<(to: string) => void>(),
  useAuthMock: vi.fn<() => AuthContextValue>(),
  useReducedMotionMock: vi.fn<() => boolean>(() => false),
  getDbMock: vi.fn<() => Promise<Record<string, unknown>>>(() => Promise.resolve({})),
  snapshotListeners: new Map<string, MockSnapshotCallback>(),
}));

/* ---------- partial mock react-router-dom ---------- */
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

/* ---------- mock useAuth ---------- */
vi.mock("@/context/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

/* ---------- mock ButtonCTA (alias e relativo) ---------- */
vi.mock("@/shared/components/ButtonCTA", () => ({
  ButtonCTA: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
}));

vi.mock("../ButtonCTA", () => ({
  ButtonCTA: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
}));

/* ---------- mock react-icons/fi ---------- */
vi.mock("react-icons/fi", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid={`fi-${name}`} {...props} />
  );
  return {
    FiMenu: Icon("menu"),
    FiX: Icon("x"),
    FiBell: Icon("bell"),
    FiBookOpen: Icon("book-open"),
  };
});

/* ---------- mock framer-motion con passthrough ---------- */
vi.mock("framer-motion", async () => {
  const ReactActual = await import("react");
  type Props = React.PropsWithChildren<Record<string, unknown>>;

  const passthrough =
    (Tag: string) =>
    ({ children, ...props }: Props) =>
      ReactActual.createElement(Tag, props, children);

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      nav: passthrough("nav"),
      div: passthrough("div"),
      button: passthrough("button"),
    },
    useReducedMotion: () => useReducedMotionMock(),
  };
});

/* ---------- mock db & firestore ---------- */
vi.mock("@/infrastructure/db", () => ({
  getDb: () => getDbMock(),
}));

vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, path: string): MockCollectionRef => ({ _type: "col", path }),
  doc: (_db: unknown, col: string, id: string): MockDocRef => ({ _type: "doc", col, id }),
  query: (target: MockTargetRef) => target,
  where: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn((target: MockTargetRef, cb: MockSnapshotCallback) => {
    if (target._type === "col") {
      snapshotListeners.set(target.path, cb);
    } else if (target._type === "doc") {
      snapshotListeners.set(`${target.col}/${target.id}`, cb);
    }
    return vi.fn();
  }),
}));

/* ---------- component ---------- */
import { Header } from "@/shared/components/Header";

const renderHeader = () =>
  render(
    <MemoryRouter>
      <Header />
    </MemoryRouter>
  );

describe("Header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    snapshotListeners.clear();
    navigateMock.mockReset();
    useAuthMock.mockReset();
    useReducedMotionMock.mockReset();
    getDbMock.mockReset();

    useAuthMock.mockReturnValue({ user: null });
    useReducedMotionMock.mockReturnValue(false);
    getDbMock.mockImplementation(() => Promise.resolve({}));
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("logo click → chiude il menu mobile se aperto", () => {
    renderHeader();

    fireEvent.click(screen.getByRole("button", { name: "Apri menu" }));
    expect(screen.getByRole("navigation", { name: "Menu mobile" })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Vai alla home"));
    expect(screen.queryByRole("navigation", { name: "Menu mobile" })).toBeNull();
  });

  test("toggle mobile: Apri/Chiudi menu", () => {
    renderHeader();

    const toggleOpen = screen.getByRole("button", { name: "Apri menu" });
    expect(toggleOpen).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggleOpen);

    const toggleClose = screen.getByRole("button", { name: "Chiudi menu" });
    expect(toggleClose).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("navigation", { name: "Menu mobile" })).toBeInTheDocument();

    fireEvent.click(toggleClose);
    expect(screen.queryByRole("navigation", { name: "Menu mobile" })).toBeNull();
  });

  test("click su voce nav mobile → chiude il menu", () => {
    renderHeader();

    fireEvent.click(screen.getByRole("button", { name: "Apri menu" }));
    const mobileNav = screen.getByRole("navigation", { name: "Menu mobile" });

    fireEvent.click(within(mobileNav).getByRole("link", { name: "Ricerca Giurisprudenza" }));
    expect(screen.queryByRole("navigation", { name: "Menu mobile" })).toBeNull();
  });

  test("CTA: user null → naviga /login e chiude menu", () => {
    useAuthMock.mockReturnValue({ user: null });

    renderHeader();

    fireEvent.click(screen.getByRole("button", { name: "Apri menu" }));
    const mobileNav = screen.getByRole("navigation", { name: "Menu mobile" });

    fireEvent.click(within(mobileNav).getByRole("button", { name: "Accedi" }));

    expect(navigateMock).toHaveBeenCalledWith("/login");
    expect(screen.queryByRole("navigation", { name: "Menu mobile" })).toBeNull();
  });

  test("CTA: user presente → naviga /profilo, mostra guida/notifiche e chiude menu", async () => {
    useAuthMock.mockReturnValue({ user: { uid: "user-123" } });

    renderHeader();

    await waitFor(() => {
      expect(snapshotListeners.has("notification")).toBe(true);
    });

    const desktopNav = screen.getByLabelText("Navigazione principale");
    const guidaLink = within(desktopNav).getByRole("link", { name: /Guida Utente/i });
    expect(guidaLink).toHaveAttribute("href", "/guida");
    expect(guidaLink).toHaveAttribute("target", "_blank");

    fireEvent.click(screen.getByRole("button", { name: "Apri menu" }));
    const mobileNav = screen.getByRole("navigation", { name: "Menu mobile" });

    fireEvent.click(within(mobileNav).getByRole("button", { name: "Il tuo profilo" }));

    expect(navigateMock).toHaveBeenCalledWith("/profilo");
    expect(screen.queryByRole("navigation", { name: "Menu mobile" })).toBeNull();
  });

  test("Escape quando menu aperto → chiude menu e rimette focus sul toggle", () => {
    renderHeader();

    const toggle = screen.getByRole("button", { name: "Apri menu" });
    fireEvent.click(toggle);

    const mobileNav = screen.getByRole("navigation", { name: "Menu mobile" });
    const link = within(mobileNav).getByRole("link", { name: "Ricerca Giurisprudenza" });
    link.focus();
    expect(document.activeElement).toBe(link);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("navigation", { name: "Menu mobile" })).toBeNull();
    expect(document.activeElement).toBe(toggle);
  });

  test("notifiche personali real-time: accende e spegne il badge ping", async () => {
    useAuthMock.mockReturnValue({ user: { uid: "user-realtime" } });

    const { container } = renderHeader();

    await waitFor(() => {
      expect(snapshotListeners.has("notification")).toBe(true);
    });

    expect(container.querySelector(".animate-ping")).toBeNull();

    // Arrivo notifica non letta
    act(() => {
      const notifyCb = snapshotListeners.get("notification");
      notifyCb?.({ empty: false, exists: () => true, data: () => ({}) });
    });
    expect(container.querySelector(".animate-ping")).toBeInTheDocument();

    // Lettura notifiche
    act(() => {
      const notifyCb = snapshotListeners.get("notification");
      notifyCb?.({ empty: true, exists: () => true, data: () => ({}) });
    });
    expect(container.querySelector(".animate-ping")).toBeNull();
  });

  test("notifiche broadcast real-time: accende il badge se presente un ID non letto", async () => {
    useAuthMock.mockReturnValue({ user: { uid: "user-broad" } });

    const { container } = renderHeader();

    await waitFor(() => {
      expect(snapshotListeners.has("users/user-broad")).toBe(true);
      expect(snapshotListeners.has("broadcast")).toBe(true);
    });

    act(() => {
      const userCb = snapshotListeners.get("users/user-broad");
      userCb?.({
        exists: () => true,
        data: () => ({ readBroadcasts: ["b1"] }),
      });
    });

    act(() => {
      const broadCb = snapshotListeners.get("broadcast");
      broadCb?.({
        exists: () => true,
        data: () => ({}),
        docs: [{ id: "b1" }, { id: "b2" }],
      });
    });

    expect(container.querySelector(".animate-ping")).toBeInTheDocument();
  });
});