import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import type { AttachedDocument } from "@/interfaces/interfaces";

/* ---------- hoisted mock Firebase Auth ---------- */
const { mockAuthState } = vi.hoisted(() => ({
  mockAuthState: {
    currentUser: { uid: "user-123" } as { uid: string } | null,
  },
}));

vi.mock("firebase/auth", () => ({
  getAuth: () => mockAuthState,
}));

/* ---------- mock lucide-react ---------- */
vi.mock("lucide-react", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid={`icon-${name}`} {...props} />
  );
  return {
    FileText: Icon("file-text"),
    CheckCircle2: Icon("check-circle-2"),
    Pencil: Icon("pencil"),
    Trash2: Icon("trash-2"),
    FolderPlus: Icon("folder-plus"),
    FolderMinus: Icon("folder-minus"),
  };
});

/* ---------- component ---------- */
import { DocumentCard } from "@/components/Document/DocumentCard"; // <-- adegua il path se necessario

describe("DocumentCard Component Suite", () => {
  const mockOnToggleDoc = vi.fn<(doc: AttachedDocument) => void>();
  const mockOnToggleFascicoloLink = vi.fn<(doc: AttachedDocument, fascicoloId: string, isLinking: boolean) => void>();
  const mockOpenRenameModal = vi.fn<(doc: AttachedDocument) => void>();
  const mockOpenDeleteModal = vi.fn<(doc: AttachedDocument) => void>();
  const mockOnRenameDocumento = vi.fn<(id: string, name: string) => Promise<void>>().mockResolvedValue(undefined);
  const mockOnDeleteDocumento = vi.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined);
  const mockOnErrorLimit = vi.fn<() => void>();

  const dummyDoc: AttachedDocument = {
    id: "doc-attached-01",
    name: "Atto_di_Citazione_2026.pdf",
    user: "user-123",
  } as unknown as AttachedDocument;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.currentUser = { uid: "user-123" };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderCard = (props: Partial<React.ComponentProps<typeof DocumentCard>> = {}) => {
    const defaultProps: React.ComponentProps<typeof DocumentCard> = {
      doc: dummyDoc,
      fallbackIndex: 0,
      listType: "uploaded",
      isSelected: false,
      isLinkedToCurrent: false,
      fascicoloId: "fascicolo-99",
      totalCount: 1,
      maxAllowed: 5,
      onToggleDoc: mockOnToggleDoc,
      onToggleFascicoloLink: mockOnToggleFascicoloLink,
      openRenameModal: mockOpenRenameModal,
      openDeleteModal: mockOpenDeleteModal,
      onRenameDocumento: mockOnRenameDocumento,
      onDeleteDocumento: mockOnDeleteDocumento,
      onErrorLimit: mockOnErrorLimit,
      ...props,
    };

    return render(<DocumentCard {...defaultProps} />);
  };

  test("renderizza il nome del documento, l'icona file e lo stato non selezionato", () => {
    renderCard();

    expect(screen.getByText("Atto_di_Citazione_2026.pdf")).toBeInTheDocument();
    expect(screen.getByTestId("icon-file-text")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-check-circle-2")).toBeNull();
  });

  test("mostra l'icona di spunta quando il documento è selezionato (isSelected: true)", () => {
    renderCard({ isSelected: true });

    expect(screen.getByTestId("icon-check-circle-2")).toBeInTheDocument();
  });

  test("seleziona il documento al click sulla card se il limite non è stato raggiunto", () => {
    renderCard({ isSelected: false, totalCount: 2, maxAllowed: 5 });

    fireEvent.click(screen.getByText("Atto_di_Citazione_2026.pdf"));

    expect(mockOnToggleDoc).toHaveBeenCalledTimes(1);
    expect(mockOnToggleDoc).toHaveBeenCalledWith(dummyDoc);
    expect(mockOnErrorLimit).not.toHaveBeenCalled();
  });

  test("blocca la selezione e attiva onErrorLimit se totalCount >= maxAllowed", () => {
    renderCard({ isSelected: false, totalCount: 5, maxAllowed: 5 });

    fireEvent.click(screen.getByText("Atto_di_Citazione_2026.pdf"));

    expect(mockOnErrorLimit).toHaveBeenCalledTimes(1);
    expect(mockOnToggleDoc).not.toHaveBeenCalled();
  });

  test("permette di deselezionare il documento anche se totalCount >= maxAllowed", () => {
    renderCard({ isSelected: true, totalCount: 5, maxAllowed: 5 });

    fireEvent.click(screen.getByText("Atto_di_Citazione_2026.pdf"));

    expect(mockOnToggleDoc).toHaveBeenCalledTimes(1);
    expect(mockOnErrorLimit).not.toHaveBeenCalled();
  });

  test("mostra i pulsanti di rinomina, eliminazione e collegamento fascicolo per il proprietario del documento", () => {
    renderCard();

    expect(screen.getByRole("button", { name: "Rinomina documento" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Elimina documento" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aggiungi al fascicolo" })).toBeInTheDocument();
  });

  test("nasconde i pulsanti di azione se il documento appartiene a un altro utente", () => {
    const otherUserDoc = { ...dummyDoc, user: "user-456" };
    renderCard({ doc: otherUserDoc });

    expect(screen.queryByRole("button", { name: "Rinomina documento" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Elimina documento" })).toBeNull();
    expect(screen.queryByRole("button", { name: /fascicolo/i })).toBeNull();
  });

  test("apre la modale di rinomina senza propagare il click alla card", () => {
    renderCard();

    const renameBtn = screen.getByRole("button", { name: "Rinomina documento" });
    fireEvent.click(renameBtn);

    expect(mockOpenRenameModal).toHaveBeenCalledTimes(1);
    expect(mockOpenRenameModal).toHaveBeenCalledWith(dummyDoc);
    expect(mockOnToggleDoc).not.toHaveBeenCalled();
  });

  test("apre la modale di eliminazione senza propagare il click alla card", () => {
    renderCard();

    const deleteBtn = screen.getByRole("button", { name: "Elimina documento" });
    fireEvent.click(deleteBtn);

    expect(mockOpenDeleteModal).toHaveBeenCalledTimes(1);
    expect(mockOpenDeleteModal).toHaveBeenCalledWith(dummyDoc);
    expect(mockOnToggleDoc).not.toHaveBeenCalled();
  });

  test("gestisce l'aggiunta al fascicolo quando isLinkedToCurrent è false", () => {
    renderCard({ isLinkedToCurrent: false, fascicoloId: "fasc-101" });

    const linkBtn = screen.getByRole("button", { name: "Aggiungi al fascicolo" });
    expect(screen.getByTestId("icon-folder-plus")).toBeInTheDocument();

    fireEvent.click(linkBtn);

    expect(mockOnToggleFascicoloLink).toHaveBeenCalledTimes(1);
    expect(mockOnToggleFascicoloLink).toHaveBeenCalledWith(dummyDoc, "fasc-101", true);
    expect(mockOnToggleDoc).not.toHaveBeenCalled();
  });

  test("gestisce la rimozione dal fascicolo quando isLinkedToCurrent è true", () => {
    renderCard({ isLinkedToCurrent: true, fascicoloId: "fasc-101" });

    const unlinkBtn = screen.getByRole("button", { name: "Rimuovi dal fascicolo" });
    expect(screen.getByTestId("icon-folder-minus")).toBeInTheDocument();

    fireEvent.click(unlinkBtn);

    expect(mockOnToggleFascicoloLink).toHaveBeenCalledTimes(1);
    expect(mockOnToggleFascicoloLink).toHaveBeenCalledWith(dummyDoc, "fasc-101", false);
    expect(mockOnToggleDoc).not.toHaveBeenCalled();
  });

  describe("Accessibilità (SonarQube A11y)", () => {
    test("simula la selezione della card tramite tastiera premendo Enter", () => {
      renderCard();
      const card = screen.getByText("Atto_di_Citazione_2026.pdf").closest('[role="button"]')!;
      
      fireEvent.keyDown(card, { key: "Enter" });

      expect(mockOnToggleDoc).toHaveBeenCalledTimes(1);
      expect(mockOnToggleDoc).toHaveBeenCalledWith(dummyDoc);
    });

    test("simula la selezione della card tramite tastiera premendo Spazio", () => {
      renderCard();
      const card = screen.getByText("Atto_di_Citazione_2026.pdf").closest('[role="button"]')!;
      
      fireEvent.keyDown(card, { key: " " });

      expect(mockOnToggleDoc).toHaveBeenCalledTimes(1);
      expect(mockOnToggleDoc).toHaveBeenCalledWith(dummyDoc);
    });

    test("blocca la selezione tramite tastiera e attiva onErrorLimit se totalCount >= maxAllowed", () => {
      renderCard({ isSelected: false, totalCount: 5, maxAllowed: 5 });
      const card = screen.getByText("Atto_di_Citazione_2026.pdf").closest('[role="button"]')!;
      
      fireEvent.keyDown(card, { key: "Enter" });

      expect(mockOnErrorLimit).toHaveBeenCalledTimes(1);
      expect(mockOnToggleDoc).not.toHaveBeenCalled();
    });

    test("ignora i tasti diversi da Enter o Spazio sulla card principale", () => {
      renderCard();
      const card = screen.getByText("Atto_di_Citazione_2026.pdf").closest('[role="button"]')!;
      
      fireEvent.keyDown(card, { key: "Tab" });
      fireEvent.keyDown(card, { key: "ArrowDown" });
      fireEvent.keyDown(card, { key: "Escape" });

      expect(mockOnToggleDoc).not.toHaveBeenCalled();
      expect(mockOnErrorLimit).not.toHaveBeenCalled();
    });
  });
});