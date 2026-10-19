import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

/* ---------- mock react-icons/fi ---------- */
vi.mock("react-icons/fi", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid={`fi-${name}`} {...props} />
  );
  return {
    FiFileText: Icon("file-text"),
    FiX: Icon("x"),
  };
});

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
import { ExtractedTextModal } from "@/features/profile/components/ExtractedTextModal"; // <-- adegua il path se necessario

describe("ExtractedTextModal Component Suite", () => {
  const mockSetShowText = vi.fn<(show: boolean) => void>();
  const mockSetExtractedText = vi.fn<(text: string) => void>();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderModal = (
    props: Partial<React.ComponentProps<typeof ExtractedTextModal>> = {}
  ) => {
    const defaultProps: React.ComponentProps<typeof ExtractedTextModal> = {
      showText: true,
      setShowText: mockSetShowText,
      extractedText: "Testo estratto dalla sentenza n. 1234/2026 della Suprema Corte.",
      setExtractedText: mockSetExtractedText,
      loading: false,
      ...props,
    };

    return render(<ExtractedTextModal {...defaultProps} />);
  };

  test("non renderizza nulla quando showText è false", () => {
    const { container } = renderModal({ showText: false });
    expect(container).toBeEmptyDOMElement();
  });

  test("renderizza l'intestazione, le icone, la textarea con il testo e i pulsanti di chiusura", () => {
    renderModal();

    expect(screen.getByRole("heading", { name: "Testo Estratto", level: 3 })).toBeInTheDocument();
    expect(screen.getByTestId("fi-file-text")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chiudi modale" })).toBeInTheDocument();

    const textarea = screen.getByRole("textbox");
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue("Testo estratto dalla sentenza n. 1234/2026 della Suprema Corte.");
    expect(textarea).not.toBeDisabled();

    expect(screen.getByRole("button", { name: "Chiudi" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salva e continua" })).toBeInTheDocument();
  });

  test("gestisce il fallback a stringa vuota se extractedText è null", () => {
    renderModal({ extractedText: null });

    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveValue("");
  });

  test("invoca setExtractedText alla modifica del testo nella textarea", () => {
    renderModal();

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, {
      target: { value: "Testo corretto manualmente dall'utente." },
    });

    expect(mockSetExtractedText).toHaveBeenCalledTimes(1);
    expect(mockSetExtractedText).toHaveBeenCalledWith("Testo corretto manualmente dall'utente.");
  });

  test("disabilita la textarea quando loading è true", () => {
    renderModal({ loading: true });

    const textarea = screen.getByRole("textbox");
    expect(textarea).toBeDisabled();
  });

  test("chiude la modale al click sul pulsante 'Chiudi modale' in testata", () => {
    renderModal();

    const closeHeaderBtn = screen.getByRole("button", { name: "Chiudi modale" });
    fireEvent.click(closeHeaderBtn);

    expect(mockSetShowText).toHaveBeenCalledTimes(1);
    expect(mockSetShowText).toHaveBeenCalledWith(false);
  });

  test("chiude la modale al click sul pulsante 'Chiudi' nel footer", () => {
    renderModal();

    const closeFooterBtn = screen.getByRole("button", { name: "Chiudi" });
    fireEvent.click(closeFooterBtn);

    expect(mockSetShowText).toHaveBeenCalledTimes(1);
    expect(mockSetShowText).toHaveBeenCalledWith(false);
  });

  test("chiude la modale al click sul pulsante 'Salva e continua'", () => {
    renderModal();

    const saveBtn = screen.getByRole("button", { name: "Salva e continua" });
    fireEvent.click(saveBtn);

    expect(mockSetShowText).toHaveBeenCalledTimes(1);
    expect(mockSetShowText).toHaveBeenCalledWith(false);
  });

  test("chiude la modale cliccando sul backdrop esterno", () => {
    const { container } = renderModal();

    const backdrop = container.firstElementChild as HTMLElement;
    fireEvent.click(backdrop);

    expect(mockSetShowText).toHaveBeenCalledTimes(1);
    expect(mockSetShowText).toHaveBeenCalledWith(false);
  });
});