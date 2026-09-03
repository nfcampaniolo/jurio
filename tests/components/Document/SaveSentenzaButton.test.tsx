import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

/* ---------- hoisted mock react-hot-toast ---------- */
const { mockToast } = vi.hoisted(() => {
  const toastFn = vi.fn();
  const errorFn = vi.fn();
  return {
    mockToast: Object.assign(toastFn, { error: errorFn }),
  };
});

vi.mock("react-hot-toast", () => ({
  default: mockToast,
}));

/* ---------- hoisted mock saveSentences service ---------- */
const { mockIsSentenzaSaved, mockSaveSentenza, mockRemoveSentenza } = vi.hoisted(() => ({
  mockIsSentenzaSaved: vi.fn<(userId: string, sentenzaId: string) => Promise<boolean>>(),
  mockSaveSentenza: vi.fn<(userId: string, sentenzaId: string) => Promise<void>>(),
  mockRemoveSentenza: vi.fn<(userId: string, sentenzaId: string) => Promise<void>>(),
}));

vi.mock("@/features/document/hooks/saveSentences", () => ({
  isSentenzaSaved: mockIsSentenzaSaved,
  saveSentenza: mockSaveSentenza,
  removeSentenza: mockRemoveSentenza,
}));
/* ---------- mock react-icons/fa ---------- */
vi.mock("react-icons/fa", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid={`fa-${name}`} {...props} />
  );
  return {
    FaBookmark: Icon("bookmark"),
    FaRegBookmark: Icon("reg-bookmark"),
  };
});

/* ---------- component ---------- */
import { SaveSentenzaButton } from "@/features/document/components/SaveSentenzaButton";

describe("SaveSentenzaButton Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockIsSentenzaSaved.mockResolvedValue(false);
    mockSaveSentenza.mockResolvedValue(undefined);
    mockRemoveSentenza.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderButton = (props: Partial<React.ComponentProps<typeof SaveSentenzaButton>> = {}) => {
    const defaultProps: React.ComponentProps<typeof SaveSentenzaButton> = {
      userId: "usr-100",
      sentenzaId: "sent-2026-99",
      ...props,
    };

    return render(<SaveSentenzaButton {...defaultProps} />);
  };

  test("verifica lo stato iniziale e renderizza 'Salva' quando la sentenza non è salvata", async () => {
    mockIsSentenzaSaved.mockResolvedValueOnce(false);

    renderButton();

    expect(mockIsSentenzaSaved).toHaveBeenCalledWith("usr-100", "sent-2026-99");

    const button = await screen.findByRole("button", { name: /Salva/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("fa-reg-bookmark")).toBeInTheDocument();
  });

  test("renderizza 'Rimuovi' con icona piena quando la sentenza è già salvata", async () => {
    mockIsSentenzaSaved.mockResolvedValueOnce(true);

    renderButton();

    const button = await screen.findByRole("button", { name: /Rimuovi/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("fa-bookmark")).toBeInTheDocument();
  });

  test("disabilita il pulsante e non invoca il service se userId è assente o nullo", () => {
    renderButton({ userId: null });

    const button = screen.getByRole("button", { name: /Salva/i });
    expect(button).toBeDisabled();
    expect(mockIsSentenzaSaved).not.toHaveBeenCalled();
  });

  test("esegue il salvataggio con UI ottimistica e mostra toast 'Salvato'", async () => {
    mockIsSentenzaSaved.mockResolvedValueOnce(false);
    mockSaveSentenza.mockResolvedValueOnce(undefined);

    renderButton();

    const button = await screen.findByRole("button", { name: /Salva/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockSaveSentenza).toHaveBeenCalledTimes(1);
      expect(mockSaveSentenza).toHaveBeenCalledWith("usr-100", "sent-2026-99");
      expect(mockToast).toHaveBeenCalledWith("Salvato");
    });

    expect(screen.getByRole("button", { name: /Rimuovi/i })).toBeInTheDocument();
    expect(screen.getByTestId("fa-bookmark")).toBeInTheDocument();
  });

  test("esegue la rimozione dai salvati e mostra toast 'Rimosso'", async () => {
    mockIsSentenzaSaved.mockResolvedValueOnce(true);
    mockRemoveSentenza.mockResolvedValueOnce(undefined);

    renderButton();

    const button = await screen.findByRole("button", { name: /Rimuovi/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockRemoveSentenza).toHaveBeenCalledTimes(1);
      expect(mockRemoveSentenza).toHaveBeenCalledWith("usr-100", "sent-2026-99");
      expect(mockToast).toHaveBeenCalledWith("Rimosso");
    });

    expect(screen.getByRole("button", { name: /Salva/i })).toBeInTheDocument();
    expect(screen.getByTestId("fa-reg-bookmark")).toBeInTheDocument();
  });

  test("effettua il rollback dello stato e notifica l'errore se la chiamata fallisce", async () => {
    mockIsSentenzaSaved.mockResolvedValueOnce(false);
    mockSaveSentenza.mockRejectedValueOnce(new Error("Network Error"));

    renderButton();

    const button = await screen.findByRole("button", { name: /Salva/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockSaveSentenza).toHaveBeenCalledTimes(1);
      expect(mockToast.error).toHaveBeenCalledWith("Errore");
    });

    // Rollback allo stato iniziale non salvato
    expect(screen.getByRole("button", { name: /Salva/i })).toBeInTheDocument();
    expect(screen.getByTestId("fa-reg-bookmark")).toBeInTheDocument();
  });

  test("mostra '...' e disabilita il click durante il caricamento", async () => {
    let resolveSave!: () => void;
    mockIsSentenzaSaved.mockResolvedValueOnce(false);
    mockSaveSentenza.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        })
    );

    renderButton();

    const button = await screen.findByRole("button", { name: /Salva/i });
    fireEvent.click(button);

    expect(screen.getByRole("button", { name: /\.\.\./i })).toBeDisabled();

    resolveSave();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Rimuovi/i })).toBeEnabled();
    });
  });
});