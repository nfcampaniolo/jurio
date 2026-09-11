import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { toast } from "react-hot-toast";
import ConfigurazioneClaude from "@/features/guide/components/ConfigurazioneClaude";

vi.mock("react-hot-toast", () => ({
  toast: {
    success: vi.fn(),
  },
}));

describe("ConfigurazioneClaude Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  test("renderizza correttamente l'intestazione principale e i badge", () => {
    render(<ConfigurazioneClaude />);

    expect(screen.getByText("Configurazione")).toBeInTheDocument();
    expect(screen.getByText("Integrazione Claude")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Connessione a Claude" })).toBeInTheDocument();
    expect(screen.getByText(/Questa guida illustra i passaggi/i)).toBeInTheDocument();
  });

  test("renderizza la sezione 1 e i passaggi per la creazione del connettore MCP", () => {
    render(<ConfigurazioneClaude />);

    expect(screen.getByRole("heading", { level: 2, name: "1. Creazione del connettore MCP" })).toBeInTheDocument();
    expect(screen.getByText("Accesso a Claude")).toBeInTheDocument();
    expect(screen.getByText("Navigazione nelle impostazioni")).toBeInTheDocument();
    expect(screen.getByText("Parametri Iniziali")).toBeInTheDocument();
    expect(screen.getByText("Impostazioni di Autenticazione")).toBeInTheDocument();
  });

test("mostra l'URL corretto del server MCP e ne consente la copia negli appunti", () => {
  render(<ConfigurazioneClaude />);

  // Modificato per matchare il contenuto testuale del bottone
  const copyButton = screen.getByRole("button", { name: /https:\/\/jurio\.it\/mcp/i });
  expect(copyButton).toBeInTheDocument();

  fireEvent.click(copyButton);

  expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://jurio.it/mcp");
  expect(toast.success).toHaveBeenCalledWith("URL copiato negli appunti!");
});

  test("verifica che i link esterni e di supporto siano corretti", () => {
    render(<ConfigurazioneClaude />);

    const claudeLink = screen.getByRole("link", { name: "https://claude.ai/" });
    expect(claudeLink).toHaveAttribute("href", "https://claude.ai/");
    expect(claudeLink).toHaveAttribute("target", "_blank");
    expect(claudeLink).toHaveAttribute("rel", "noopener noreferrer");

    const contactLink = screen.getByRole("link", { name: "/contatti" });
    expect(contactLink).toHaveAttribute("href", "/contatti");
  });

  test("renderizza correttamente tutte le figure e le immagini della guida", () => {
    render(<ConfigurazioneClaude />);

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(4);

    expect(images[0]).toHaveAttribute("src", "https://jurio.it/guida-image/claude_1.webp");
    expect(images[1]).toHaveAttribute("src", "https://jurio.it/guida-image/mcp_claude_1.webp");
    expect(images[2]).toHaveAttribute("src", "https://jurio.it/guida-image/mcp_claude_2.webp");
    expect(images[3]).toHaveAttribute("src", "https://jurio.it/guida-image/mcp_claude_3.webp");

    expect(screen.getByText("Figura 1: Accesso alla sezione Connettori e pulsante di aggiunta.")).toBeInTheDocument();
    expect(screen.getByText('Figura 4: Schermata finale con il pulsante "Collega" per attivare la sessione OAuth.')).toBeInTheDocument();
  });

  test("renderizza la sezione 2 sulla connessione e autorizzazione", () => {
    render(<ConfigurazioneClaude />);

    expect(screen.getByRole("heading", { level: 2, name: "2. Connessione e Autorizzazione" })).toBeInTheDocument();
    expect(screen.getByText('Il pulsante "Collega"')).toBeInTheDocument();
    expect(screen.getByText("Operatività")).toBeInTheDocument();
  });
});