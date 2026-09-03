import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

/* ---------- hoisted shared mocks ---------- */
const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));

/* ---------- mock react-router-dom ---------- */
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

/* ---------- mock lucide-react ---------- */
vi.mock("lucide-react", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid={`icon-${name}`} {...props} />
  );
  return {
    Scale: Icon("scale"),
    MessageSquare: Icon("message-square"),
    FolderPlus: Icon("folder-plus"),
    FolderOpen: Icon("folder-open"),
    Loader2: Icon("loader-2"),
    ChevronRight: Icon("chevron-right"),
  };
});

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", async () => ({
  motion: {
    div: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & { [key: string]: unknown }) => (
      <div {...props}>{children}</div>
    ),
    button: ({
      children,
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & { [key: string]: unknown }) => (
      <button {...props}>{children}</button>
    ),
  },
}));

/* ---------- mock Footer ---------- */
vi.mock("@/shared/components/Footer", () => ({
  Footer: () => <footer data-testid="footer-mock">Footer Mock</footer>,
}));

/* ---------- component ---------- */
import { SelectionScreen } from "@/features/chat/components/SelectionScreen"; // <-- adegua il path se necessario

describe("SelectionScreen Component Suite", () => {
  const mockStartTempChat = vi.fn();
  const mockStartFascicoloSetup = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    startTempChat: mockStartTempChat,
    startFascicoloSetup: mockStartFascicoloSetup,
    isLoadingData: false,
  };

  test("renderizza titoli, opzioni principali, icone e Footer", () => {
    render(<SelectionScreen {...defaultProps} />);

    // Titoli e descrizioni principali
    expect(screen.getByRole("heading", { name: "Nuova Consultazione", level: 1 })).toBeInTheDocument();
    expect(
      screen.getByText("Scegli come procedere con la tua analisi legale intelligente.")
    ).toBeInTheDocument();

    // Card Chat Temporanea
    expect(screen.getByRole("heading", { name: "Chat Temporanea", level: 3 })).toBeInTheDocument();
    expect(
      screen.getByText("Avvia una sessione rapida di ricerca giurisprudenziale senza salvare dati nel cloud.")
    ).toBeInTheDocument();
    expect(screen.getByTestId("icon-message-square")).toBeInTheDocument();

    // Card Nuovo Fascicolo
    expect(screen.getByRole("heading", { name: "Nuovo Fascicolo", level: 3 })).toBeInTheDocument();
    expect(
      screen.getByText("Organizza i tuoi documenti e crea una memoria persistente per analisi complesse.")
    ).toBeInTheDocument();
    expect(screen.getByTestId("icon-folder-plus")).toBeInTheDocument();

    // Icona Scale e Footer
    expect(screen.getByTestId("icon-scale")).toBeInTheDocument();
    expect(screen.getByTestId("footer-mock")).toBeInTheDocument();
  });

  test("invoca startTempChat al click sulla card Chat Temporanea", () => {
    render(<SelectionScreen {...defaultProps} />);

    const tempChatBtn = screen.getByRole("heading", { name: "Chat Temporanea" }).closest("button")!;
    fireEvent.click(tempChatBtn);

    expect(mockStartTempChat).toHaveBeenCalledTimes(1);
    expect(mockStartFascicoloSetup).not.toHaveBeenCalled();
  });

  test("invoca startFascicoloSetup al click sulla card Nuovo Fascicolo", () => {
    render(<SelectionScreen {...defaultProps} />);

    const fascicoloSetupBtn = screen.getByRole("heading", { name: "Nuovo Fascicolo" }).closest("button")!;
    fireEvent.click(fascicoloSetupBtn);

    expect(mockStartFascicoloSetup).toHaveBeenCalledTimes(1);
    expect(mockStartTempChat).not.toHaveBeenCalled();
  });

  test("naviga a '/storico' al click sul pulsante 'Sfoglia Archivio Fascicoli'", () => {
    render(<SelectionScreen {...defaultProps} />);

    const archiveBtn = screen.getByRole("button", { name: /Sfoglia Archivio Fascicoli/i });
    fireEvent.click(archiveBtn);

    expect(mockNavigate).toHaveBeenCalledWith("/storico");
  });

  test("gestisce lo stato isLoadingData mostrando lo spinner o l'icona della cartella", () => {
    // 1. isLoadingData = false -> Mostra icon-folder-open
    const { rerender } = render(<SelectionScreen {...defaultProps} isLoadingData={false} />);
    expect(screen.getByTestId("icon-folder-open")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-loader-2")).not.toBeInTheDocument();

    // 2. isLoadingData = true -> Mostra icon-loader-2 (spinner)
    rerender(<SelectionScreen {...defaultProps} isLoadingData={true} />);
    expect(screen.getByTestId("icon-loader-2")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-folder-open")).not.toBeInTheDocument();
  });
});