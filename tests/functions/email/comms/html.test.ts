import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateRequestEmail,
  generateTrialEmail,
  generateWelcomeEmail,
} from "../../../../functions/src/email/comms/html";

describe("comms email HTML", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("compone l'email di benvenuto col nome e le funzionalità principali", () => {
    // Arrange
    const name = "Ada";

    // Act
    const result = generateWelcomeEmail(name);

    // Assert
    expect(result).toContain("<title>Benvenuto in Jurio!</title>");
    expect(result).toContain(`Ciao ${name}, benvenuto in <strong>Jurio</strong>!`);
    expect(result).toContain("Ricerca giurisprudenziale veloce");
    expect(result).toContain("disiscriverti qui");
  });

  it("compone la conferma di attivazione della prova gratuita", () => {
    // Arrange
    const name = "Ada";

    // Act
    const result = generateTrialEmail(name);

    // Assert
    expect(result).toContain("<title>Periodo di prova attivato | Jurio</title>");
    expect(result).toContain(`Ciao ${name},`);
    expect(result).toContain("periodo di prova gratuito di 7 giorni");
    expect(result).toContain("Nessun addebito automatico");
  });

  it("include i dati del ticket e mantiene integralmente messaggi fino a 300 caratteri", () => {
    // Arrange
    const message = "m".repeat(300);

    // Act
    const result = generateRequestEmail("Ada", "T-42", "Accesso", message);

    // Assert
    expect(result).toContain("<title>Ticket di Supporto Jurio</title>");
    expect(result).toContain("<strong>Ada</strong>");
    expect(result).toContain("#T-42");
    expect(result).toContain("Accesso");
    expect(result).toContain(message);
    expect(result).not.toContain(`${message}...`);
    expect(result).toContain(`${new Date().getFullYear()} Jurio`);
  });

  it("tronca i messaggi oltre 300 caratteri e aggiunge i puntini di sospensione", () => {
    // Arrange
    const message = "x".repeat(301);

    // Act
    const result = generateRequestEmail("Ada", "T-43", "Problema", message);

    // Assert
    expect(result).toContain(`${"x".repeat(300)}...`);
    expect(result).not.toContain(message);
  });
});
