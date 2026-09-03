import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

/* ---------- mock router ---------- */
const mockUseParams = vi.fn();
vi.mock("react-router-dom", () => ({
  useParams: () => mockUseParams(),
}));

/* ---------- mock helmet ---------- */
vi.mock("@dr.pogodin/react-helmet", () => ({
  Helmet: ({ children }: { children: React.ReactNode }) => <div data-testid="helmet-mock">{children}</div>,
}));

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", async () => {
  const ReactActual = await import("react");
  const passthrough =
    (Tag: string) =>
    ({ children, ...props }: React.HTMLAttributes<HTMLElement> & { [key: string]: unknown }) =>
      ReactActual.createElement(Tag, props, children);

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      div: passthrough("div"),
    },
  };
});

/* ---------- mock hooks di contesto e feature ---------- */
const mockUseAuth = vi.fn();
vi.mock("@/context/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseDocumento = vi.fn();
vi.mock("@/features/document/hooks/useDocumento", () => ({
  useDocumento: (id: string) => mockUseDocumento(id),
}));

/* ---------- mock componenti figli ---------- */
vi.mock("@/shared/components/Header", () => ({
  Header: () => <header data-testid="mock-header">Header</header>,
}));

vi.mock("@/shared/components/Footer", () => ({
  Footer: () => <footer data-testid="mock-footer">Footer</footer>,
}));

vi.mock("@/shared/components/AccessDenied", () => ({
  AccessDenied: () => <div data-testid="mock-access-denied">Access Denied</div>,
}));

vi.mock("@/features/document/components/Massima", () => ({
  MassimaCard: (props: {
    result: unknown;
    file: string | null;
    share: boolean;
    uid: string;
    id: string;
  }) => (
    <div
      data-testid="mock-massima-card"
      data-id={props.id}
      data-uid={props.uid}
      data-share={String(props.share)}
      data-file={props.file || ""}
    >
      Massima Content
    </div>
  ),
}));

/* ---------- subject under test ---------- */
import { Documento } from "@/features/document/Documento"; // adegua il path relativo se il test si trova in un'altra cartella

describe("Documento Page Component Suite", () => {
  const dummyDoc = {
    titolo: "Sentenza Cassazione Civile n. 1234/2026",
    massima: "Principio di diritto in materia contrattuale...",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup di default
    mockUseParams.mockReturnValue({ id: "doc_test_123" });
    mockUseAuth.mockReturnValue({
      user: { uid: "usr_flv_2026" },
      loading: false,
    });
    mockUseDocumento.mockReturnValue({
      selectedDoc: dummyDoc,
      pdfUrl: "https://storage.jurio.it/docs/doc_test_123.pdf",
      loading: false,
      deny: false,
      isGiurisprudenza: true,
    });
  });

  test("mostra lo spinner di caricamento se l'autenticazione è in corso (authLoading)", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
    });

    const { container } = render(<Documento />);

    expect(screen.getByTestId("mock-header")).toBeInTheDocument();
    expect(screen.getByTestId("mock-footer")).toBeInTheDocument();
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-massima-card")).toBeNull();
    expect(screen.queryByTestId("mock-access-denied")).toBeNull();
  });

  test("mostra lo spinner di caricamento se il recupero del documento è in corso (docLoading)", () => {
    mockUseDocumento.mockReturnValue({
      selectedDoc: null,
      pdfUrl: null,
      loading: true,
      deny: false,
      isGiurisprudenza: false,
    });

    const { container } = render(<Documento />);

    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-massima-card")).toBeNull();
  });

  test("mostra il componente AccessDenied se deny è true", () => {
    mockUseDocumento.mockReturnValue({
      selectedDoc: null,
      pdfUrl: null,
      loading: false,
      deny: true,
      isGiurisprudenza: false,
    });

    render(<Documento />);

    expect(screen.getByTestId("mock-access-denied")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-massima-card")).toBeNull();
    expect(screen.queryByText("Documento non trovato o non valido.")).toBeNull();
  });

  test("mostra il messaggio di fallback se il documento non viene trovato", () => {
    mockUseDocumento.mockReturnValue({
      selectedDoc: null,
      pdfUrl: null,
      loading: false,
      deny: false,
      isGiurisprudenza: false,
    });

    render(<Documento />);

    expect(screen.getByText("Documento non trovato o non valido.")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-massima-card")).toBeNull();
    expect(screen.queryByTestId("mock-access-denied")).toBeNull();
  });

  test("renderizza correttamente MassimaCard con tutti i parametri attesi", () => {
    render(<Documento />);

    const card = screen.getByTestId("mock-massima-card");
    expect(card).toBeInTheDocument();
    expect(card).toHaveAttribute("data-id", "doc_test_123");
    expect(card).toHaveAttribute("data-uid", "usr_flv_2026");
    expect(card).toHaveAttribute("data-share", "true");
    expect(card).toHaveAttribute("data-file", "https://storage.jurio.it/docs/doc_test_123.pdf");
  });

  test("gestisce il fallback a stringa vuota se l'ID da useParams non è definito", () => {
    mockUseParams.mockReturnValue({});
    mockUseAuth.mockReturnValue({ user: null, loading: false });

    render(<Documento />);

    expect(mockUseDocumento).toHaveBeenCalledWith("");
    const card = screen.getByTestId("mock-massima-card");
    expect(card).toHaveAttribute("data-uid", "");
  });
});