import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

/* ---------- hoisted mock react-hot-toast ---------- */
const { mockToast } = vi.hoisted(() => {
  const toastSuccess = vi.fn();
  const toastError = vi.fn();
  const toastFn = Object.assign(vi.fn(), {
    success: toastSuccess,
    error: toastError,
  });
  return { mockToast: toastFn };
});

vi.mock("react-hot-toast", () => ({
  __esModule: true,
  toast: mockToast,
  default: mockToast,
}));

/* ---------- mock react-icons/fi ---------- */
vi.mock("react-icons/fi", () => ({
  __esModule: true,
  FiCopy: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="fi-copy" {...props} />,
}));

/* ---------- component ---------- */
import ConfigurazioneLeChat from "@/features/guide/components/ConfigurazioneLeChat";

describe("Guida - ConfigurazioneLeChat Component Suite", () => {
  const originalClipboard = navigator.clipboard;
  const mockWriteText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: mockWriteText,
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
  });

  test("renderizza l'intestazione della guida, i badge di categoria e la descrizione del protocollo MCP", () => {
    render(<ConfigurazioneLeChat />);

    expect(screen.getByText("Configurazione")).toBeInTheDocument();
    expect(screen.getByText("Integrazione Vibe")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Connessione a Vibe", level: 1 })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /Questa guida illustra i passaggi per integrare Jurio all'interno di Vibe utilizzando il protocollo MCP/i
      )
    ).toBeInTheDocument();
  });

  test("renderizza i passaggi di creazione del connettore MCP e i parametri di configurazione del server", () => {
    render(<ConfigurazioneLeChat />);

    expect(
      screen.getByRole("heading", {
        name: "1. Creazione del connettore MCP",
        level: 2,
      })
    ).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Accesso alla Piattaforma", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Navigazione nel menu", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Parametri del Connettore", level: 3 })).toBeInTheDocument();

    const mistralLink = screen.getByRole("link", { name: "https://console.mistral.ai/" });
    expect(mistralLink).toHaveAttribute("href", "https://console.mistral.ai/");
    expect(mistralLink).toHaveAttribute("target", "_blank");

    // Fix 1: Utilizza il nuovo URL MCP
    expect(screen.getByText("https://jurio.it/mcp")).toBeInTheDocument();
  });

  test("copia l'URL MCP negli appunti e mostra il toast di conferma al click", async () => {
    render(<ConfigurazioneLeChat />);

    // Fix 2: Usa il bottone corretto (che mostra l'URL, non Authorization)
    const copyBtn = screen.getByRole("button", { name: /https:\/\/jurio\.it\/mcp/i });
    expect(copyBtn).toBeInTheDocument();
    expect(screen.getByTestId("fi-copy")).toBeInTheDocument();

    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith("https://jurio.it/mcp");
      expect(mockToast.success).toHaveBeenCalledWith("URL copiato negli appunti!");
    });
  });

  test("renderizza il collegamento ipertestuale alla pagina di supporto /contatti", () => {
    render(<ConfigurazioneLeChat />);

    // Fix 3: Rimosso il controllo del link /profilo che nel nuovo componente OAuth non esiste più
    const contactLink = screen.getByRole("link", { name: "/contatti" });
    expect(contactLink).toHaveAttribute("href", "/contatti");
  });

  test("renderizza tutte le immagini illustrative con i rispettivi attributi alt e didascalie", () => {
    render(<ConfigurazioneLeChat />);

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(3);

    // Fix 4: Aggiornate le rotte delle immagini e le caption per riflettere il componente corrente
    expect(images[0]).toHaveAttribute("src", "https://jurio.it/guida-image/mcp_vibe_1.webp");
    expect(images[1]).toHaveAttribute("src", "https://jurio.it/guida-image/mcp_vibe_2.webp");
    expect(images[2]).toHaveAttribute("src", "https://jurio.it/guida-image/vibe.webp");

    expect(
      screen.getByText(/Figura 1: Aggiunta di un nuovo connettore personalizzato dalla sezione Contesto/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Figura 2: Flusso di autenticazione e autorizzazione account/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Figura 3: Vista Vibe con connettore Jurio/i)
    ).toBeInTheDocument();
  });
});