import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ConfigurazioneClaude from "@/features/guide/components/ConfigurazioneClaude"; // Modifica il path in base a dove lo collochi

describe("ConfigurazioneClaude Component Suite", () => {
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

  test("verifica che i link esterni e di supporto siano corretti", () => {
    render(<ConfigurazioneClaude />);

    // Link a claude.ai
    const claudeLink = screen.getByRole("link", { name: "https://claude.ai/" });
    expect(claudeLink).toHaveAttribute("href", "https://claude.ai/");
    expect(claudeLink).toHaveAttribute("target", "_blank");
    expect(claudeLink).toHaveAttribute("rel", "noopener noreferrer");

    // Link alla pagina contatti
    const contactLink = screen.getByRole("link", { name: "/contatti" });
    expect(contactLink).toHaveAttribute("href", "/contatti");
  });

  test("renderizza correttamente tutte le figure e le immagini della guida", () => {
    render(<ConfigurazioneClaude />);

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(4);

    expect(images[0]).toHaveAttribute("src", "https://jurio.it/guida-image/claude_1.webp");
    expect(images[1]).toHaveAttribute("src", "https://jurio.it/guida-image/claude_2.webp");
    expect(images[2]).toHaveAttribute("src", "https://jurio.it/guida-image/claude_3.webp");
    expect(images[3]).toHaveAttribute("src", "https://jurio.it/guida-image/claude_4.webp");

    expect(screen.getByText("Figura 1: Accesso alla sezione Connettori e pulsante di aggiunta.")).toBeInTheDocument();
    expect(screen.getByText("Figura 4: Schermata finale con il pulsante \"Collega\" per attivare la sessione OAuth.")).toBeInTheDocument();
  });

  test("renderizza la sezione 2 sulla connessione e autorizzazione", () => {
    render(<ConfigurazioneClaude />);

    expect(screen.getByRole("heading", { level: 2, name: "2. Connessione e Autorizzazione" })).toBeInTheDocument();
    expect(screen.getByText("Il pulsante \"Collega\"")).toBeInTheDocument();
    expect(screen.getByText("Operatività")).toBeInTheDocument();
  });
});