import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SelectionScreen } from "@/features/chat/components/SelectionScreen"; // Adatta il path se necessario

/* ---------- hoisted mocks ---------- */
const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));

/* ---------- mock router ---------- */
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

/* ---------- mock footer ---------- */
vi.mock("@/shared/components/Footer", () => ({
  Footer: () => <footer data-testid="mock-footer">Footer Mock</footer>,
}));

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return {
    ...actual,
    motion: {
      div: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
        <div className={className}>{children}</div>
      ),
      button: ({
        children,
        className,
        onClick,
      }: {
        children?: React.ReactNode;
        className?: string;
        onClick?: () => void;
      }) => (
        <button type="button" className={className} onClick={onClick}>
          {children}
        </button>
      ),
    },
  };
});

describe("SelectionScreen Component Suite", () => {
  const defaultProps = {
    startTempChat: vi.fn(),
    startFascicoloSetup: vi.fn(),
    isLoadingData: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props = defaultProps) =>
    render(
      <MemoryRouter>
        <SelectionScreen {...props} />
      </MemoryRouter>
    );

  test("renderizza correttamente l'intestazione principale e la descrizione", () => {
    renderComponent();

    expect(
      screen.getByRole("heading", { level: 1, name: /il tuo consulente legale/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/ricerca giurisprudenziale avanzata e analisi dei tuoi documenti/i)
    ).toBeInTheDocument();
    expect(screen.getByTestId("mock-footer")).toBeInTheDocument();
  });

  test("invoca startTempChat quando l'utente clicca sulla card 'Chat Temporanea'", () => {
    const startTempChatMock = vi.fn();
    renderComponent({
      ...defaultProps,
      startTempChat: startTempChatMock,
    });

    const chatCard = screen.getByRole("button", { name: /chat temporanea/i });
    fireEvent.click(chatCard);

    expect(startTempChatMock).toHaveBeenCalledTimes(1);
  });

  test("invoca startFascicoloSetup quando l'utente clicca sulla card 'Nuovo Fascicolo'", () => {
    const startFascicoloSetupMock = vi.fn();
    renderComponent({
      ...defaultProps,
      startFascicoloSetup: startFascicoloSetupMock,
    });

    const fascicoloCard = screen.getByRole("button", { name: /nuovo fascicolo/i });
    fireEvent.click(fascicoloCard);

    expect(startFascicoloSetupMock).toHaveBeenCalledTimes(1);
  });

  test("reindirizza alla rotta '/storico' quando viene cliccato il pulsante di archivio fascicoli", () => {
    renderComponent();

    const archiveButton = screen.getByRole("button", { name: /sfoglia archivio fascicoli/i });
    fireEvent.click(archiveButton);

    expect(mockNavigate).toHaveBeenCalledWith("/storico");
  });

  test("mostra lo spinner animato quando isLoadingData è impostato su true", () => {
    const { container } = renderComponent({
      ...defaultProps,
      isLoadingData: true,
    });

    // Verifica la presenza della classe animate-spin sul Loader2
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });
});