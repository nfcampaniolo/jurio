import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MonthlyUsageReportData } from "../../../../functions/src/email/_interfaces";
import {
  generateDowngradeEmail,
  generateMonthlyReportEmail,
  generatePurchaseEmail,
} from "../../../../functions/src/email/plans/html";

describe("plans email HTML", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("genera l'avviso di scadenza includendo il nome e il collegamento ai piani", () => {
    // Arrange
    const name = "Ada";

    // Act
    const result = generateDowngradeEmail(name);

    // Assert
    expect(result).toContain("<title>Piano scaduto | Jurio</title>");
    expect(result).toContain(`Ciao ${name},`);
    expect(result).toContain("piano gratuito");
    expect(result).toContain("https://jurio.it/pricing");
  });

  it("include i dettagli essenziali dell'acquisto senza righe opzionali", () => {
    // Arrange
    const args = ["Ada", "Premium", "19.99 EUR", "19 ottobre 2026", "19 ottobre 2027", "ORDER-42"] as const;

    // Act
    const result = generatePurchaseEmail(...args);

    // Assert
    expect(result).toContain("<title>Acquisto completato | Jurio</title>");
    expect(result).toContain("Ada");
    expect(result).toContain("Premium");
    expect(result).toContain("19.99 EUR");
    expect(result).toContain("ORDER-42");
    expect(result).not.toContain("ID transazione:");
    expect(result).not.toContain("Metodo di pagamento:");
    expect(result).not.toContain("Apri ricevuta");
    expect(result).not.toContain("Apri fattura");
  });

  it("inserisce tutte le righe opzionali di acquisto quando sono presenti", () => {
    // Arrange
    const args = [
      "Ada", "Premium", "19.99 EUR", "19 ottobre 2026", "19 ottobre 2027", "ORDER-43",
      "TX-9", "PayPal", "https://example.com/receipt", "https://example.com/invoice",
    ] as const;

    // Act
    const result = generatePurchaseEmail(...args);

    // Assert
    expect(result).toContain("ID transazione:</strong> TX-9");
    expect(result).toContain("Metodo di pagamento:</strong> PayPal");
    expect(result).toContain('<a href="https://example.com/receipt">Apri ricevuta</a>');
    expect(result).toContain('<a href="https://example.com/invoice">Apri fattura</a>');
  });

  it("mostra le sole attività usate e il blocco prompting quando è attivo", () => {
    // Arrange
    const data: MonthlyUsageReportData = {
      mese: "settembre 2026",
      haFattoPrompting: true,
      interazioniCount: 2,
      ricerca: { count: 3, timeSavedMinutes: 21 },
      analisi: { count: 0, timeSavedMinutes: 0 },
      sintesi: { count: 1, timeSavedMinutes: 15 },
      deepAnalysis: { count: 1, timeSavedMinutes: 45 },
      totalTimeSavedMinutes: 81,
    };

    // Act
    const result = generateMonthlyReportEmail(data);

    // Assert
    expect(result).toContain("settembre 2026");
    expect(result).toContain("105 minuti");
    expect(result).toContain("Ricerca Giurisprudenziale");
    expect(result).toContain("Ricerca Giurisprudenziale Approfondita");
    expect(result).toContain("Sintesi e Drafting");
    expect(result).toContain("prompting libero");
    expect(result).not.toContain("Analisi Documentale");
  });

  it("omette attività non usate e il blocco prompting quando i conteggi sono zero", () => {
    // Arrange
    const data: MonthlyUsageReportData = {
      mese: "ottobre 2026",
      haFattoPrompting: false,
      interazioniCount: 0,
      ricerca: { count: 0, timeSavedMinutes: 0 },
      analisi: { count: 0, timeSavedMinutes: 0 },
      sintesi: { count: 0, timeSavedMinutes: 0 },
      deepAnalysis: { count: 0, timeSavedMinutes: 0 },
      totalTimeSavedMinutes: 0,
    };

    // Act
    const result = generateMonthlyReportEmail(data);

    // Assert
    expect(result).toContain("ottobre 2026");
    expect(result).toContain("0 minuti");
    expect(result).not.toContain("Ricerca Giurisprudenziale");
    expect(result).not.toContain("Analisi Documentale");
    expect(result).not.toContain("Sintesi e Drafting");
    expect(result).not.toContain("prompting libero");
  });
});
