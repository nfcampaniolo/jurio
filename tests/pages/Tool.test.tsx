import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";

/* ---------- hoisted mocks ---------- */
const { mockNavigate, mockAuthState, mockDocumentoState, mockRouterParams } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockAuthState: {
    user: null as { uid: string; email: string } | null,
    loading: false,
  },
  mockDocumentoState: {
    selectedDoc: null as { id: string; title?: string } | null,
    pdfUrl: "" as string | null,
    loading: false,
    deny: false,
    isGiurisprudenza: true,
  },
  mockRouterParams: {
    id: undefined as string | undefined,
  },
}));

/* ---------- mock react-router-dom ---------- */
vi.mock("react-router-dom", () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
  useParams: () => mockRouterParams,
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

/* ---------- mock @dr.pogodin/react-helmet ---------- */
vi.mock("@dr.pogodin/react-helmet", () => ({
  __esModule: true,
  Helmet: () => null,
}));

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", () => ({
  __esModule: true,
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  motion: {
    div: React.forwardRef<
      HTMLDivElement,
      React.HTMLAttributes<HTMLDivElement> & {
        initial?: unknown;
        animate?: unknown;
        exit?: unknown;
        transition?: unknown;
      }
    >(({ children, ...props }, ref) => (
      <div ref={ref} {...props}>
        {children}
      </div>
    )),
  },
}));

/* ---------- mock hooks ---------- */
vi.mock("@/context/useAuth", () => ({
  __esModule: true,
  useAuth: () => mockAuthState,
}));

vi.mock("@/hooks/useDocumento", () => ({
  __esModule: true,
  useDocumento: () => mockDocumentoState,
}));

/* ---------- mock core child components (con alias @) ---------- */
vi.mock("@/components/Info/Header", () => ({
  __esModule: true,
  Header: () => <header data-testid="tool-header">Header</header>,
}));

vi.mock("@/components/Info/Footer", () => ({
  __esModule: true,
  Footer: () => <footer data-testid="tool-footer">Footer</footer>,
}));

vi.mock("@/components/Search/SearchBar", () => ({
  __esModule: true,
  SearchBar: () => <div data-testid="search-bar">Search Bar Component</div>,
}));

vi.mock("@/components/AccessDenied", () => ({
  __esModule: true,
  AccessDenied: () => <div data-testid="access-denied">Access Denied Component</div>,
}));

vi.mock("@/components/Document/Massima", () => ({
  __esModule: true,
  MassimaCard: ({
    result,
    file,
    share,
    uid,
    id,
  }: {
    result: { id: string; title?: string };
    file: string | null;
    share: boolean;
    uid: string;
    id?: string;
  }) => (
    <div
      data-testid="massima-card"
      data-id={id}
      data-uid={uid}
      data-file={file}
      data-share={share}
    >
      Massima Card: {result.title || result.id}
    </div>
  ),
}));

/* ---------- mock lazy components (con alias @) ---------- */
vi.mock("@/components/Info/ComeFunziona", () => ({
  __esModule: true,
  ComeFunziona: () => <div data-testid="come-funziona">Come Funziona Component</div>,
}));

vi.mock("@/components/Info/CTASection", () => ({
  __esModule: true,
  default: () => <div data-testid="cta-section">CTA Section Component</div>,
}));

vi.mock("@/components/Info/CTADocument", () => ({
  __esModule: true,
  CTADocument: () => <div data-testid="cta-document">CTA Document Component</div>,
}));

/* ---------- component under test ---------- */
import { Tool } from "@/pages/Tool"; // <-- adegua il path se necessario

describe("Tool Page Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouterParams.id = undefined;
    mockAuthState.user = null;
    mockAuthState.loading = false;
    mockDocumentoState.selectedDoc = null;
    mockDocumentoState.pdfUrl = null;
    mockDocumentoState.loading = false;
    mockDocumentoState.deny = false;
    mockDocumentoState.isGiurisprudenza = true;
  });

  test("mostra lo spinner di caricamento quando authLoading è true", () => {
    mockAuthState.loading = true;
    render(<Tool />);

    expect(screen.getByTestId("tool-header")).toBeInTheDocument();
    expect(screen.getByTestId("tool-footer")).toBeInTheDocument();
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    expect(screen.queryByTestId("search-bar")).not.toBeInTheDocument();
  });

  test("mostra lo spinner quando id è presente e docLoading è true", () => {
    mockRouterParams.id = "doc-99";
    mockDocumentoState.loading = true;

    render(<Tool />);

    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    expect(screen.queryByTestId("massima-card")).not.toBeInTheDocument();
  });

  test("renderizza la schermata di accesso negato quando deny è true", () => {
    mockDocumentoState.deny = true;
    render(<Tool />);

    expect(screen.getByTestId("access-denied")).toBeInTheDocument();
    expect(screen.queryByTestId("search-bar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("come-funziona")).not.toBeInTheDocument();
  });

  test("renderizza la vista ospite con ComeFunziona e CTASection per utenti non autenticati", async () => {
    mockAuthState.user = null;
    render(<Tool />);

    expect(
      screen.getByRole("heading", {
        name: "Ricerca Giurisprudenziale Avanzata con Intelligenza Artificiale",
        level: 1,
      })
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("come-funziona")).toBeInTheDocument();
      expect(screen.getByTestId("cta-section")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("search-bar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cta-document")).not.toBeInTheDocument();
  });

  test("renderizza SearchBar e CTADocument per utenti autenticati", async () => {
    mockAuthState.user = { uid: "usr_flv_2026", email: "flavio@jurio.it" };
    render(<Tool />);

    await waitFor(() => {
      expect(screen.getByTestId("search-bar")).toBeInTheDocument();
      expect(screen.getByTestId("cta-document")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("come-funziona")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cta-section")).not.toBeInTheDocument();
  });

  test("renderizza MassimaCard quando id e selectedDoc sono presenti", async () => {
    mockRouterParams.id = "sentenza-cassazione-2026";
    mockAuthState.user = { uid: "usr_flv_2026", email: "flavio@jurio.it" };
    mockDocumentoState.selectedDoc = {
      id: "sentenza-cassazione-2026",
      title: "Cass. Civ. Sez. Unite 2026",
    };
    mockDocumentoState.pdfUrl = "https://jurio.it/sentenza.pdf";
    mockDocumentoState.isGiurisprudenza = true;

    render(<Tool />);

    expect(
      screen.getByRole("heading", {
        name: "Dettaglio e Analisi Documento Giurisprudenziale",
        level: 1,
      })
    ).toBeInTheDocument();

    const card = screen.getByTestId("massima-card");
    expect(card).toBeInTheDocument();
    expect(card).toHaveAttribute("data-id", "sentenza-cassazione-2026");
    expect(card).toHaveAttribute("data-uid", "usr_flv_2026");
    expect(card).toHaveAttribute("data-file", "https://jurio.it/sentenza.pdf");
    expect(card).toHaveAttribute("data-share", "true");
    expect(card).toHaveTextContent("Cass. Civ. Sez. Unite 2026");
  });

  test("mostra messaggio di documento non trovato se id è presente ma selectedDoc è assente e loading è completato", () => {
    mockRouterParams.id = "doc-inesistente";
    mockDocumentoState.selectedDoc = null;
    mockDocumentoState.loading = false;

    render(<Tool />);

    expect(
      screen.getByText("Documento non trovato o non valido.")
    ).toBeInTheDocument();
    expect(screen.queryByTestId("massima-card")).not.toBeInTheDocument();
  });
});