import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import type { DocumentoGiurisprudenziale } from "@/interfaces/interfaces";

/* ---------- hoisted mocks ---------- */
const { mockToast, mockGetDocumentStorage, mockAuthUser } = vi.hoisted(() => {
  const toastSuccess = vi.fn();
  const toastError = vi.fn();
  const toastFn = Object.assign(vi.fn(), {
    success: toastSuccess,
    error: toastError,
  });

  const mockGetDocumentStorage = vi.fn<(id: string | number, path: string) => Promise<string | null>>();
  const mockAuthUser = { uid: "user-test-777" };

  return {
    mockToast: toastFn,
    mockGetDocumentStorage,
    mockAuthUser,
  };
});

/* ---------- mock react-hot-toast ---------- */
vi.mock("react-hot-toast", () => ({
  __esModule: true,
  toast: mockToast,
  default: mockToast,
}));

/* ---------- mock auth context ---------- */
vi.mock("@/context/useAuth", () => ({
  __esModule: true,
  useAuth: () => ({
    user: mockAuthUser,
  }),
}));

/* ---------- mock storage service ---------- */
vi.mock("@/services/storage", () => ({
  __esModule: true,
  getDocumentStorage: (id: string | number, path: string) => mockGetDocumentStorage(id, path),
}));

/* ---------- mock react-icons/fa (statico e sicuro contro deadlock) ---------- */
vi.mock("react-icons/fa", () => ({
  __esModule: true,
  FaTrash: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="fa-trash" {...props} />,
  FaFilePdf: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="fa-file-pdf" {...props} />,
  FaExternalLinkAlt: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="fa-external-link" {...props} />,
  FaBalanceScale: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="fa-balance-scale" {...props} />,
  FaFileAlt: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="fa-file-alt" {...props} />,
  FaPencilAlt: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="fa-pencil" {...props} />,
  FaCheck: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="fa-check" {...props} />,
  FaTimes: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="fa-times" {...props} />,
}));

/* ---------- component ---------- */
import { DocumentCard } from "@/components/Document/YourDocumentCard";

describe("DocumentCard Component Suite", () => {
  const originalOpen = window.open;
  const mockWindowOpen = vi.fn();
  const mockOnOpen = vi.fn();
  const mockOnRemove = vi.fn();
  const mockOnRename = vi.fn();

  const standardDoc: DocumentoGiurisprudenziale = {
    id: "sent-101",
    organo_giudicante: "Corte di Cassazione",
    sezione: "Sezione Lavoro",
    tipo_documento: "sentenza",
    numero_sentenza: "1234/2026",
    data_sentenza: "15/04/2026",
    massima: "In tema di licenziamento per giustificato motivo oggettivo...",
  } as unknown as DocumentoGiurisprudenziale;

  const genericDoc: DocumentoGiurisprudenziale = {
    id: "gen-202",
    nome_file: "Memoria_Difensiva_Deposito.pdf",
    tipo_documento: "documento_giurisprudenza_generico",
    sottotipo_documento: "Memoria 171-ter",
    data_riferimento_documento: "10/05/2026",
    sintesi: "Sintesi articolata delle deduzioni difensive depositate.",
  } as unknown as DocumentoGiurisprudenziale;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    window.open = mockWindowOpen;
    mockGetDocumentStorage.mockResolvedValue("https://storage.jurio.it/docs/documento.pdf");
  });

  afterEach(() => {
    window.open = originalOpen;
    vi.restoreAllMocks();
  });

  const renderCard = (
    props: Partial<React.ComponentProps<typeof DocumentCard>> = {}
  ) => {
    const defaultProps: React.ComponentProps<typeof DocumentCard> = {
      doc: standardDoc,
      isRemoving: false,
      mode: "uploaded",
      isOwner: true,
      onOpen: mockOnOpen,
      onRemove: mockOnRemove,
      onRename: mockOnRename,
      ...props,
    };

    return render(<DocumentCard {...defaultProps} />);
  };

  test("renderizza i dettagli di una sentenza standard con icona bilancia e metadati", () => {
    renderCard();

    expect(screen.getByTestId("fa-balance-scale")).toBeInTheDocument();
    expect(screen.getByText("sentenza")).toBeInTheDocument();
    expect(screen.getByText("N. 1234/2026")).toBeInTheDocument();
    expect(screen.getByText("15/04/2026")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Corte di Cassazione · Sezione Lavoro", level: 3 })).toBeInTheDocument();
    expect(screen.getByText("In tema di licenziamento per giustificato motivo oggettivo...")).toBeInTheDocument();
  });

  test("renderizza i dettagli di un documento generico con icona file e sottotipo documento", () => {
    renderCard({ doc: genericDoc });

    expect(screen.getByTestId("fa-file-alt")).toBeInTheDocument();
    expect(screen.getByText("Memoria 171-ter")).toBeInTheDocument();
    expect(screen.getByText("10/05/2026")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Memoria_Difensiva_Deposito.pdf", level: 3 })).toBeInTheDocument();
    expect(screen.getByText("Sintesi articolata delle deduzioni difensive depositate.")).toBeInTheDocument();
  });

  test("gestisce il click di apertura sull'intero contenitore e sul pulsante 'Apri'", () => {
    renderCard();

    const cardButton = screen.getByRole("button", { name: `Open document ${standardDoc.organo_giudicante}` });
    fireEvent.click(cardButton);
    expect(mockOnOpen).toHaveBeenCalledTimes(1);
    expect(mockOnOpen).toHaveBeenCalledWith(standardDoc);

    const openActionBtn = screen.getByRole("button", { name: /Apri/i });
    fireEvent.click(openActionBtn);
    expect(mockOnOpen).toHaveBeenCalledTimes(2);
  });

  test("avvia il download recuperando l'URL dal percorso storage utente in modalità 'uploaded'", async () => {
    renderCard({ mode: "uploaded" });

    const downloadBtn = screen.getByTitle("Scarica PDF");
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(mockGetDocumentStorage).toHaveBeenCalledWith("sent-101", "users/user-test-777/documents");
      expect(mockWindowOpen).toHaveBeenCalledWith("https://storage.jurio.it/docs/documento.pdf", "_blank");
    });
  });

  test("avvia il download recuperando l'URL dal bucket 'sentences' in modalità 'saved'", async () => {
    renderCard({ mode: "saved" });

    const downloadBtn = screen.getByTitle("Scarica PDF");
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(mockGetDocumentStorage).toHaveBeenCalledWith("sent-101", "sentences");
      expect(mockWindowOpen).toHaveBeenCalledWith("https://storage.jurio.it/docs/documento.pdf", "_blank");
    });
  });

  test("mostra toast.error se il file PDF non è più reperibile nello storage", async () => {
    mockGetDocumentStorage.mockResolvedValueOnce(null);

    renderCard();

    const downloadBtn = screen.getByTitle("Scarica PDF");
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Il file PDF non è più disponibile.");
    });
  });

  test("mostra toast.error se si verifica un'eccezione durante il download", async () => {
    mockGetDocumentStorage.mockRejectedValueOnce(new Error("Storage service down"));

    renderCard();

    const downloadBtn = screen.getByTitle("Scarica PDF");
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Errore durante il recupero del PDF.");
    });
  });

  test("gestisce il flusso di modifica inline del titolo (conferma con successo)", () => {
    renderCard({ isOwner: true, mode: "uploaded" });

    const renameBtn = screen.getByTitle("Rinomina");
    fireEvent.click(renameBtn);

    const input = screen.getByDisplayValue(standardDoc.organo_giudicante!);
    expect(input).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "Sentenza_Cassazione_Aggiornata.pdf" } });

    const confirmBtn = screen.getByTitle("Conferma");
    fireEvent.click(confirmBtn);

    expect(mockOnRename).toHaveBeenCalledTimes(1);
    expect(mockOnRename).toHaveBeenCalledWith(expect.any(Object), standardDoc);
    expect(screen.queryByDisplayValue("Sentenza_Cassazione_Aggiornata.pdf")).toBeNull();
  });

  test("mostra toast.error e impedisce la conferma se il titolo modificato è vuoto", () => {
    renderCard({ isOwner: true, mode: "uploaded" });

    fireEvent.click(screen.getByTitle("Rinomina"));

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "   " } });

    fireEvent.click(screen.getByTitle("Conferma"));

    expect(mockToast.error).toHaveBeenCalledWith("Il titolo non può essere vuoto.");
    expect(mockOnRename).not.toHaveBeenCalled();
  });

  test("annulla la modalità di rinomina al click su Annulla", () => {
    renderCard({ isOwner: true, mode: "uploaded" });

    fireEvent.click(screen.getByTitle("Rinomina"));
    expect(screen.getByRole("textbox")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Annulla"));
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  test("disabilita e gestisce il pulsante di eliminazione per il proprietario", () => {
    const { rerender } = renderCard({ isOwner: true, isRemoving: false, mode: "uploaded" });

    const deleteBtn = screen.getByTitle("Elimina");
    expect(deleteBtn).toBeEnabled();

    fireEvent.click(deleteBtn);
    expect(mockOnRemove).toHaveBeenCalledTimes(1);
    expect(mockOnRemove).toHaveBeenCalledWith(expect.any(Object), standardDoc);

    rerender(
      <DocumentCard
        doc={standardDoc}
        isRemoving={true}
        mode="saved"
        isOwner={true}
        onOpen={mockOnOpen}
        onRemove={mockOnRemove}
        onRename={mockOnRename}
      />
    );

    const removeBtn = screen.getByTitle("Rimuovi");
    expect(removeBtn).toBeDisabled();
  });

  test("nasconde i pulsanti di rinomina ed eliminazione quando l'utente non è il proprietario", () => {
    renderCard({ isOwner: false, mode: "uploaded" });

    expect(screen.queryByTitle("Rinomina")).toBeNull();
    expect(screen.queryByTitle("Elimina")).toBeNull();
    expect(screen.queryByTitle("Rimuovi")).toBeNull();
  });
});