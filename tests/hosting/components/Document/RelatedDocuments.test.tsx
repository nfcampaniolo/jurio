import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import type { DocumentoGiurisprudenziale } from "@/interfaces/interfaces";

/* ---------- tipi mock hook useRelatedDocuments ---------- */
interface MockRelatedDocsHookReturn {
  relatedDocs: DocumentoGiurisprudenziale[];
  loading: boolean;
  error: boolean | string | null;
}

/* ---------- hoisted mocks ---------- */
const { mockHookReturn, mockUseRelatedDocuments } = vi.hoisted(() => {
  const mockHookReturn: MockRelatedDocsHookReturn = {
    relatedDocs: [],
    loading: false,
    error: null,
  };
  const mockUseRelatedDocuments = vi.fn<
    (params: {
      uid: string;
      massima: string;
      mode: "normative" | "semantic";
      selectedNorms: string[];
      shouldFetch: boolean;
    }) => MockRelatedDocsHookReturn
  >(() => mockHookReturn);

  return { mockHookReturn, mockUseRelatedDocuments };
});

/* ---------- mock useRelatedDocuments hook ---------- */
vi.mock("@/features/document/hooks/useRelatedDocuments", () => ({
  useRelatedDocuments: (params: Parameters<typeof mockUseRelatedDocuments>[0]) =>
    mockUseRelatedDocuments(params),
}));

/* ---------- mock Document child component ---------- */
vi.mock("@/features/document/components/Document", () => ({
  Document: ({ documento }: { documento: DocumentoGiurisprudenziale }) => (
    <div data-testid={`mock-document-${documento.id || documento.urn}`}>
      <span>{documento.massima || documento.id}</span>
    </div>
  ),
}));

/* ---------- mock lucide-react ---------- */
vi.mock("lucide-react", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid={`icon-${name}`} {...props} />
  );
  return {
    Loader2: Icon("loader-2"),
  };
});

/* ---------- component ---------- */
import { RelatedDocuments } from "@/features/document/components/LinkedSentences"; // <-- adegua il path se necessario

describe("RelatedDocuments Component Suite", () => {
  const originalOpen = window.open;
  const originalFocus = window.focus;
  const mockOpen = vi.fn();
  const mockFocus = vi.fn();

  const dummyDocs: DocumentoGiurisprudenziale[] = [
    {
      id: "doc-correlato-1",
      massima: "In tema di inadempimento contrattuale ex art. 1218 c.c.",
    } as unknown as DocumentoGiurisprudenziale,
    {
      id: "doc-correlato-2",
      massima: "Responsabilità extracontrattuale ex art. 2043 c.c.",
    } as unknown as DocumentoGiurisprudenziale,
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockHookReturn.relatedDocs = [];
    mockHookReturn.loading = false;
    mockHookReturn.error = null;

    window.open = mockOpen.mockReturnValue({ focus: mockFocus });
    window.focus = mockFocus;
    window.innerWidth = 1024;
  });

  afterEach(() => {
    window.open = originalOpen;
    window.focus = originalFocus;
    vi.restoreAllMocks();
  });

  const renderComponent = (
    props: Partial<React.ComponentProps<typeof RelatedDocuments>> = {}
  ) => {
    const defaultProps: React.ComponentProps<typeof RelatedDocuments> = {
      uid: "sent-parent-100",
      massima: "Massima di riferimento per la correlazione",
      riferimentiNormativi: ["Art. 1218 c.c.", "Art. 2043 c.c."],
      ...props,
    };

    return render(<RelatedDocuments {...defaultProps} />);
  };

  test("renderizza in modalità normativa di default quando sono presenti riferimenti normativi", () => {
    renderComponent({ riferimentiNormativi: ["Art. 1218 c.c.", "Art. 2043 c.c."] });

    const normTabBtn = screen.getByRole("button", { name: "Normativa (2)" });
    const semanticTabBtn = screen.getByRole("button", { name: "Semantica" });

    expect(normTabBtn).toBeInTheDocument();
    expect(normTabBtn).toBeEnabled();
    expect(semanticTabBtn).toBeInTheDocument();

    expect(screen.getByText("Seleziona le norme da incrociare:")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Art. 1218 c.c." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Art. 2043 c.c." })).toBeInTheDocument();

    // Il pulsante di ricerca è disabilitato senza norme selezionate
    const searchNormBtn = screen.getByRole("button", { name: "Cerca per queste norme" });
    expect(searchNormBtn).toBeDisabled();

    expect(
      screen.getByText("Seleziona le norme e avvia la ricerca per trovare pronunce correlate.")
    ).toBeInTheDocument();
  });

  test("passa automaticamente in modalità semantica e disabilita il tab normativa se riferimentiNormativi è vuoto", () => {
    renderComponent({ riferimentiNormativi: [] });

    const normTabBtn = screen.getByRole("button", { name: "Normativa" });
    expect(normTabBtn).toBeDisabled();

    expect(
      screen.getByText("Trova pronunce simili basate sul significato del testo, grazie all'Intelligenza Artificiale.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Avvia ricerca semantica" })
    ).toBeInTheDocument();
  });

  test("permette il passaggio manuale tra i tab Normativa e Semantica", () => {
    renderComponent({ riferimentiNormativi: ["Art. 2043 c.c."] });

    const semanticTabBtn = screen.getByRole("button", { name: "Semantica" });
    fireEvent.click(semanticTabBtn);

    expect(
      screen.getByText("Trova pronunce simili basate sul significato del testo, grazie all'Intelligenza Artificiale.")
    ).toBeInTheDocument();

    const normTabBtn = screen.getByRole("button", { name: "Normativa (1)" });
    fireEvent.click(normTabBtn);

    expect(screen.getByText("Seleziona le norme da incrociare:")).toBeInTheDocument();
  });

  test("seleziona le norme e attiva la ricerca normativa invocando l'hook con shouldFetch: true", () => {
    renderComponent({ riferimentiNormativi: ["Art. 1218 c.c.", "Art. 2043 c.c."] });

    const normBtn = screen.getByRole("button", { name: "Art. 1218 c.c." });
    fireEvent.click(normBtn);

    const searchBtn = screen.getByRole("button", { name: "Cerca per queste norme" });
    expect(searchBtn).toBeEnabled();

    fireEvent.click(searchBtn);

    expect(mockUseRelatedDocuments).toHaveBeenLastCalledWith(
      expect.objectContaining({
        uid: "sent-parent-100",
        mode: "normative",
        selectedNorms: ["Art. 1218 c.c."],
        shouldFetch: true,
      })
    );
  });

  test("avvia la ricerca semantica invocando l'hook con shouldFetch: true", () => {
    renderComponent({ riferimentiNormativi: [] });

    const searchSemanticBtn = screen.getByRole("button", { name: "Avvia ricerca semantica" });
    fireEvent.click(searchSemanticBtn);

    expect(mockUseRelatedDocuments).toHaveBeenLastCalledWith(
      expect.objectContaining({
        uid: "sent-parent-100",
        mode: "semantic",
        shouldFetch: true,
      })
    );
  });

  test("mostra lo scheletro di caricamento (skeleton) quando loading è true", () => {
    mockHookReturn.loading = true;

    const { container } = renderComponent();

    const skeletonContainer = container.querySelector(".animate-pulse");
    expect(skeletonContainer).toBeInTheDocument();
    expect(skeletonContainer?.children).toHaveLength(3);
  });

  test("mostra il box di errore quando error è presente", () => {
    mockHookReturn.error = true;

    renderComponent();

    expect(screen.getByText("Errore:")).toBeInTheDocument();
    expect(
      screen.getByText("Errore durante il caricamento dei documenti correlati.")
    ).toBeInTheDocument();
  });

  test("mostra lo stato vuoto quando la ricerca è completata senza risultati", () => {
    mockHookReturn.relatedDocs = [];
    mockHookReturn.loading = false;

    renderComponent({ riferimentiNormativi: [] });

    // Attiva la ricerca per avere shouldFetch true
    fireEvent.click(screen.getByRole("button", { name: "Avvia ricerca semantica" }));

    expect(
      screen.getByText("Nessun documento trovato per i criteri selezionati.")
    ).toBeInTheDocument();
  });

  test("renderizza i documenti correlati e apre la sentenza al click (Desktop: _blank)", () => {
    mockHookReturn.relatedDocs = dummyDocs;
    mockHookReturn.loading = false;

    renderComponent({ riferimentiNormativi: [] });

    // Attiva la ricerca per visualizzare la lista
    fireEvent.click(screen.getByRole("button", { name: "Avvia ricerca semantica" }));

    expect(screen.getByTestId("mock-document-doc-correlato-1")).toBeInTheDocument();
    expect(screen.getByTestId("mock-document-doc-correlato-2")).toBeInTheDocument();

    const firstItem = screen.getByTestId("mock-document-doc-correlato-1");
    fireEvent.click(firstItem);

    expect(mockOpen).toHaveBeenCalledWith("/giurisprudenza/doc-correlato-1", "_blank");
  });

  test("apre la sentenza nella stessa finestra su dispositivi mobili (_self)", () => {
    window.innerWidth = 480;
    mockHookReturn.relatedDocs = dummyDocs;
    mockHookReturn.loading = false;

    renderComponent({ riferimentiNormativi: [] });

    fireEvent.click(screen.getByRole("button", { name: "Avvia ricerca semantica" }));

    const firstItem = screen.getByTestId("mock-document-doc-correlato-1");
    fireEvent.click(firstItem);

    expect(mockOpen).toHaveBeenCalledWith("/giurisprudenza/doc-correlato-1", "_self");
  });
});