import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import type { AttachedDocument } from "@/interfaces/interfaces";

/* ---------- mock lucide-react ---------- */
vi.mock("lucide-react", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid={`icon-${name}`} {...props} />
  );
  return {
    Loader2: Icon("loader-2"),
  };
});

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      className,
      onClick,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & { [key: string]: unknown }) => (
      <div className={className} onClick={onClick} {...props}>
        {children}
      </div>
    ),
  },
}));

/* ---------- component ---------- */
import { DocumentModals } from "@/components/Document/DocumentModals"; // <-- adegua il path se necessario

describe("DocumentModals Component Suite", () => {
  const mockSetNewName = vi.fn<(name: string) => void>();
  const mockCloseRenameModal = vi.fn<() => void>();
  const mockCloseDeleteModal = vi.fn<() => void>();
  const mockHandleRenameSubmit = vi.fn<(e: React.FormEvent) => Promise<void>>().mockImplementation(async (e) => {
    e.preventDefault();
  });
  const mockHandleDeleteConfirm = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

  const dummyDoc: AttachedDocument = {
    id: "doc-123",
    name: "Memoria_Difensiva_2026.pdf",
    user: "user-abc",
  } as unknown as AttachedDocument;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderModals = (props: Partial<React.ComponentProps<typeof DocumentModals>> = {}) => {
    const defaultProps: React.ComponentProps<typeof DocumentModals> = {
      isRenameOpen: false,
      isDeleteOpen: false,
      isDeleting: false,
      itemToRename: dummyDoc,
      itemToDelete: dummyDoc,
      newName: "Memoria_Difensiva_2026_v2.pdf",
      setNewName: mockSetNewName,
      closeRenameModal: mockCloseRenameModal,
      closeDeleteModal: mockCloseDeleteModal,
      handleRenameSubmit: mockHandleRenameSubmit,
      handleDeleteConfirm: mockHandleDeleteConfirm,
      ...props,
    };

    return render(<DocumentModals {...defaultProps} />);
  };

  test("non renderizza nulla se sia isRenameOpen che isDeleteOpen sono false", () => {
    const { container } = renderModals({ isRenameOpen: false, isDeleteOpen: false });
    expect(container).toBeEmptyDOMElement();
  });

  test("renderizza la modale di rinomina con titolo, input e pulsanti di azione", () => {
    renderModals({ isRenameOpen: true });

    expect(screen.getByRole("heading", { name: "Rinomina documento", level: 2 })).toBeInTheDocument();
    expect(screen.getByLabelText("Nuovo nome")).toHaveValue("Memoria_Difensiva_2026_v2.pdf");
    expect(screen.getByRole("button", { name: "Annulla" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salva modifiche" })).toBeEnabled();
  });

  test("invoca setNewName alla digitazione nel campo di testo del nuovo nome", () => {
    renderModals({ isRenameOpen: true });

    const input = screen.getByLabelText("Nuovo nome");
    fireEvent.change(input, { target: { value: "Nuovo_Atto.pdf" } });

    expect(mockSetNewName).toHaveBeenCalledTimes(1);
    expect(mockSetNewName).toHaveBeenCalledWith("Nuovo_Atto.pdf");
  });

  test("disabilita il pulsante di salvataggio se il nome è vuoto o invariato rispetto all'originale", () => {
    // 1. Nome identico all'originale
    const { rerender } = renderModals({
      isRenameOpen: true,
      newName: "Memoria_Difensiva_2026.pdf",
      itemToRename: dummyDoc,
    });
    expect(screen.getByRole("button", { name: "Salva modifiche" })).toBeDisabled();

    // 2. Nome solo spazi
    rerender(
      <DocumentModals
        isRenameOpen={true}
        isDeleteOpen={false}
        isDeleting={false}
        itemToRename={dummyDoc}
        itemToDelete={null}
        newName="   "
        setNewName={mockSetNewName}
        closeRenameModal={mockCloseRenameModal}
        closeDeleteModal={mockCloseDeleteModal}
        handleRenameSubmit={mockHandleRenameSubmit}
        handleDeleteConfirm={mockHandleDeleteConfirm}
      />
    );
    expect(screen.getByRole("button", { name: "Salva modifiche" })).toBeDisabled();
  });

  test("invia il form e invoca handleRenameSubmit al submit", () => {
    renderModals({ isRenameOpen: true });

    const submitBtn = screen.getByRole("button", { name: "Salva modifiche" });
    fireEvent.click(submitBtn);

    expect(mockHandleRenameSubmit).toHaveBeenCalledTimes(1);
  });

  test("chiude la modale di rinomina cliccando su Annulla", () => {
    renderModals({ isRenameOpen: true });

    const cancelBtn = screen.getByRole("button", { name: "Annulla" });
    fireEvent.click(cancelBtn);

    expect(mockCloseRenameModal).toHaveBeenCalledTimes(1);
  });

  test("renderizza la modale di eliminazione con il nome del documento e le avvertenze", () => {
    renderModals({ isDeleteOpen: true });

    expect(screen.getByRole("heading", { name: "Elimina documento", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("Sei sicuro di voler eliminare:")).toBeInTheDocument();
    expect(screen.getByText("Memoria_Difensiva_2026.pdf")).toBeInTheDocument();
    expect(screen.getByText("Questa operazione non può essere annullata.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Elimina" })).toBeEnabled();
  });

  test("conferma l'eliminazione invocando handleDeleteConfirm", () => {
    renderModals({ isDeleteOpen: true });

    const deleteBtn = screen.getByRole("button", { name: "Elimina" });
    fireEvent.click(deleteBtn);

    expect(mockHandleDeleteConfirm).toHaveBeenCalledTimes(1);
  });

  test("chiude la modale di eliminazione cliccando su Annulla", () => {
    renderModals({ isDeleteOpen: true });

    const cancelBtn = screen.getByRole("button", { name: "Annulla" });
    fireEvent.click(cancelBtn);

    expect(mockCloseDeleteModal).toHaveBeenCalledTimes(1);
  });

  test("mostra lo spinner e disabilita i pulsanti durante l'eliminazione (isDeleting: true)", () => {
    renderModals({ isDeleteOpen: true, isDeleting: true });

    expect(screen.getByRole("button", { name: /Elimina/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Annulla" })).toBeDisabled();
    expect(screen.getByTestId("icon-loader-2")).toBeInTheDocument();
  });

  test("chiude la modale al click sul backdrop esterno ma non durante l'eliminazione", () => {
    // 1. Chiusura rinomina al click su backdrop
    const { container, rerender } = renderModals({ isRenameOpen: true });
    const backdrop = container.firstElementChild as HTMLElement;
    fireEvent.click(backdrop);
    expect(mockCloseRenameModal).toHaveBeenCalledTimes(1);

    // 2. Chiusura eliminazione al click su backdrop
    rerender(
      <DocumentModals
        isRenameOpen={false}
        isDeleteOpen={true}
        isDeleting={false}
        itemToRename={null}
        itemToDelete={dummyDoc}
        newName=""
        setNewName={mockSetNewName}
        closeRenameModal={mockCloseRenameModal}
        closeDeleteModal={mockCloseDeleteModal}
        handleRenameSubmit={mockHandleRenameSubmit}
        handleDeleteConfirm={mockHandleDeleteConfirm}
      />
    );
    fireEvent.click(backdrop);
    expect(mockCloseDeleteModal).toHaveBeenCalledTimes(1);

    // 3. Con isDeleting true, il backdrop click è inibito
    rerender(
      <DocumentModals
        isRenameOpen={false}
        isDeleteOpen={true}
        isDeleting={true}
        itemToRename={null}
        itemToDelete={dummyDoc}
        newName=""
        setNewName={mockSetNewName}
        closeRenameModal={mockCloseRenameModal}
        closeDeleteModal={mockCloseDeleteModal}
        handleRenameSubmit={mockHandleRenameSubmit}
        handleDeleteConfirm={mockHandleDeleteConfirm}
      />
    );
    fireEvent.click(backdrop);
    expect(mockCloseDeleteModal).toHaveBeenCalledTimes(1); // Non invocato una seconda volta
  });

  test("non chiude la modale se il click avviene all'interno del contenitore della modale", () => {
    renderModals({ isRenameOpen: true });

    const modalDialog = screen.getByRole("heading", { name: "Rinomina documento" }).closest("div")!;
    fireEvent.click(modalDialog);

    expect(mockCloseRenameModal).not.toHaveBeenCalled();
    expect(mockCloseDeleteModal).not.toHaveBeenCalled();
  });
});