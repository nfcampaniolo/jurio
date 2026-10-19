import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { DocumentRenameModal } from "@/shared/components/YourDocumentRenameModal";
import type { DocumentoGiurisprudenziale } from "@/interfaces/interfaces";

describe("DocumentRenameModal Component Suite", () => {
  const mockOnClose = vi.fn();
  const mockSetNewName = vi.fn();
  const mockSubmit = vi.fn().mockResolvedValue(undefined);

  const mockItem = {
    id: "doc_1",
    nome_file: "sentenza_originale.pdf",
  } as unknown as DocumentoGiurisprudenziale;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("non renderizza nulla quando isOpen è false", () => {
    const { container } = render(
      <DocumentRenameModal
        isOpen={false}
        itemToRename={mockItem}
        newName="nuovo_nome.pdf"
        setNewName={mockSetNewName}
        onClose={mockOnClose}
        onSubmit={mockSubmit}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  test("renderizza correttamente quando isOpen è true", () => {
    render(
      <DocumentRenameModal
        isOpen={true}
        itemToRename={mockItem}
        newName="sentenza_originale.pdf"
        setNewName={mockSetNewName}
        onClose={mockOnClose}
        onSubmit={mockSubmit}
      />
    );

    expect(screen.getByText("Rinomina documento")).toBeInTheDocument();
    expect(screen.getByDisplayValue("sentenza_originale.pdf")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Annulla" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salva modifiche" })).toBeInTheDocument();
  });

  test("aggiorna il nome digitando nell'input", () => {
    render(
      <DocumentRenameModal
        isOpen={true}
        itemToRename={mockItem}
        newName=""
        setNewName={mockSetNewName}
        onClose={mockOnClose}
        onSubmit={mockSubmit}
      />
    );

    const input = screen.getByLabelText("Nuovo nome");
    fireEvent.change(input, { target: { value: "nuovo_titolo.pdf" } });
    expect(mockSetNewName).toHaveBeenCalledWith("nuovo_titolo.pdf");
  });

  test("disabilita il pulsante di salvataggio se il nome è vuoto o identico all'originale", () => {
    const { rerender } = render(
      <DocumentRenameModal
        isOpen={true}
        itemToRename={mockItem}
        newName=""
        setNewName={mockSetNewName}
        onClose={mockOnClose}
        onSubmit={mockSubmit}
      />
    );

    const saveButton = screen.getByRole("button", { name: "Salva modifiche" });
    expect(saveButton).toBeDisabled();

    rerender(
      <DocumentRenameModal
        isOpen={true}
        itemToRename={mockItem}
        newName="sentenza_originale.pdf"
        setNewName={mockSetNewName}
        onClose={mockOnClose}
        onSubmit={mockSubmit}
      />
    );
    expect(saveButton).toBeDisabled();
  });

  test("abilita il pulsante di salvataggio quando il nome è valido e differente", () => {
    render(
      <DocumentRenameModal
        isOpen={true}
        itemToRename={mockItem}
        newName="nuovo_file.pdf"
        setNewName={mockSetNewName}
        onClose={mockOnClose}
        onSubmit={mockSubmit}
      />
    );

    const saveButton = screen.getByRole("button", { name: "Salva modifiche" });
    expect(saveButton).not.toBeDisabled();
  });

  test("chiama onClose al click sul pulsante Annulla", () => {
    render(
      <DocumentRenameModal
        isOpen={true}
        itemToRename={mockItem}
        newName="test.pdf"
        setNewName={mockSetNewName}
        onClose={mockOnClose}
        onSubmit={mockSubmit}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test("chiama onSubmit al submit del form", () => {
    render(
      <DocumentRenameModal
        isOpen={true}
        itemToRename={mockItem}
        newName="test.pdf"
        setNewName={mockSetNewName}
        onClose={mockOnClose}
        onSubmit={mockSubmit}
      />
    );

    fireEvent.submit(screen.getByRole("button", { name: "Salva modifiche" }).closest("form")!);
    expect(mockSubmit).toHaveBeenCalledTimes(1);
  });
});