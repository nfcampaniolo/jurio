import React from "react";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@/test/test-utils";
import { ConfirmModal } from "@/shared/components/ConfirmModal";

/* ---------- mock framer-motion (strict pass-through + hooks) ---------- */
vi.mock("framer-motion", async () => {
  const React = await import("react");
  type Props = React.PropsWithChildren<Record<string, unknown>>;

  const passthrough =
    (Tag: string) =>
    (props: Props) =>
      React.createElement(Tag, props, props.children);

  return {
    motion: {
      div: passthrough("div"),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useReducedMotion: vi.fn(() => false),
  };
});

describe("ConfirmModal Component Suite", () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnExport = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Ripristina lo stile del body per garantire l'isolamento tra i test
    document.body.style.overflow = "unset";
  });

  /* -------------------------------------------------------------------------- */
  /* VISIBILITÀ E RENDERING BASE                                                */
  /* -------------------------------------------------------------------------- */
  describe("Visibilità e Rendering Base", () => {
    test("non renderizza nulla quando isOpen=false", () => {
      render(
        <ConfirmModal
          isOpen={false}
          message="Sei sicuro di procedere?"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.queryByText("Sei sicuro di procedere?")).not.toBeInTheDocument();
      expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    });

    test("renderizza il modale con i testi di default quando isOpen=true", () => {
      render(
        <ConfirmModal
          isOpen
          message="Eliminare l'elemento selezionato?"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(
        screen.getByRole("heading", { name: "Conferma Azione" })
      ).toBeInTheDocument();
      expect(
        screen.getByText("Eliminare l'elemento selezionato?")
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Annulla" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Conferma" })).toBeInTheDocument();
      expect(document.body.style.overflow).toBe("hidden");
    });

    test("accetta titolo e testi pulsanti personalizzati", () => {
      render(
        <ConfirmModal
          isOpen
          title="Eliminazione Definitiva"
          message="Questa operazione è irreversibile."
          confirmText="Sì, elimina tutto"
          cancelText="No, torna indietro"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(
        screen.getByRole("heading", { name: "Eliminazione Definitiva" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Sì, elimina tutto" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "No, torna indietro" })
      ).toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* AZIONI DI CONFERMA E ANNULLAMENTO                                          */
  /* -------------------------------------------------------------------------- */
  describe("Azioni Base e Interazione Utente", () => {
    test("click su 'Annulla' invoca onCancel", () => {
      render(
        <ConfirmModal
          isOpen
          message="Procedere?"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
      expect(mockOnCancel).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    test("click su 'Conferma' invoca onConfirm quando non c'è confirmationPhrase", () => {
      render(
        <ConfirmModal
          isOpen
          message="Procedere?"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const confirmBtn = screen.getByRole("button", { name: "Conferma" });
      expect(confirmBtn).toBeEnabled();

      fireEvent.click(confirmBtn);
      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
      expect(mockOnCancel).not.toHaveBeenCalled();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* CHIUSURA TRAMITE OVERLAY E TASTIERA (ESCAPE)                               */
  /* -------------------------------------------------------------------------- */
  describe("Chiusura da Backdrop e Tastiera", () => {
    test("pressione del tasto Escape invoca onCancel", () => {
      render(
        <ConfirmModal
          isOpen
          message="Procedere?"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      fireEvent.keyDown(window, { key: "Escape" });
      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    test("click sul backdrop scuro invoca onCancel", () => {
      render(
        <ConfirmModal
          isOpen
          message="Procedere?"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      // Il backdrop è il contenitore con classe fixed
      const backdrop = screen.getByText("Procedere?").closest(".fixed");
      expect(backdrop).not.toBeNull();

      fireEvent.click(backdrop!);
      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    test("click all'interno del riquadro del modale non propaga il click e non chiude", () => {
      render(
        <ConfirmModal
          isOpen
          message="Procedere?"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const modalHeading = screen.getByRole("heading", { name: "Conferma Azione" });
      fireEvent.click(modalHeading);

      expect(mockOnCancel).not.toHaveBeenCalled();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* FRASE DI SICUREZZA (CONFIRMATION PHRASE)                                   */
  /* -------------------------------------------------------------------------- */
  describe("Conferma con Frase di Sicurezza", () => {
    const PHRASE = "ELIMINA_DEFINITIVAMENTE";

    test("disabilita il pulsante di conferma finché l'utente non digita la frase esatta", () => {
      render(
        <ConfirmModal
          isOpen
          message="Operazione critica: inserisci la frase di conferma."
          confirmationPhrase={PHRASE}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const confirmBtn = screen.getByRole("button", { name: "Conferma" });
      const input = screen.getByRole("textbox");

      // Inizialmente disabilitato
      expect(confirmBtn).toBeDisabled();

      // Testo parziale o errato: resta disabilitato
      fireEvent.change(input, { target: { value: "ELIMINA" } });
      expect(confirmBtn).toBeDisabled();

      // Testo esatto: abilitato
      fireEvent.change(input, { target: { value: PHRASE } });
      expect(confirmBtn).toBeEnabled();

      fireEvent.click(confirmBtn);
      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });

    test("resetta il valore dell'input quando il modale viene riaperto", () => {
      const { rerender } = render(
        <ConfirmModal
          isOpen
          message="Operazione critica"
          confirmationPhrase={PHRASE}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const input = screen.getByRole("textbox") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "TESTO_PROVVISORIO" } });
      expect(input.value).toBe("TESTO_PROVVISORIO");

      // Simula chiusura e riapertura
      rerender(
        <ConfirmModal
          isOpen={false}
          message="Operazione critica"
          confirmationPhrase={PHRASE}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      rerender(
        <ConfirmModal
          isOpen={true}
          message="Operazione critica"
          confirmationPhrase={PHRASE}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const inputRiaperto = screen.getByRole("textbox") as HTMLInputElement;
      expect(inputRiaperto.value).toBe("");
      expect(screen.getByRole("button", { name: "Conferma" })).toBeDisabled();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* ESPORTAZIONE DATI DI BACKUP                                                */
  /* -------------------------------------------------------------------------- */
  describe("Opzione Esportazione Dati", () => {
    test("mostra il pulsante di esportazione quando onExport è definito e lo invoca al click", () => {
      render(
        <ConfirmModal
          isOpen
          message="Vuoi davvero cancellare l'account?"
          onExport={mockOnExport}
          exportText="Scarica Archivio ZIP"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const exportBtn = screen.getByRole("button", { name: /scarica archivio zip/i });
      expect(exportBtn).toBeInTheDocument();

      fireEvent.click(exportBtn);
      expect(mockOnExport).toHaveBeenCalledTimes(1);
    });

    test("non mostra la sezione di esportazione se onExport non è fornito", () => {
      render(
        <ConfirmModal
          isOpen
          message="Operazione ordinaria"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(
        screen.queryByRole("button", { name: /esporta i miei dati/i })
      ).not.toBeInTheDocument();
    });
  });
});