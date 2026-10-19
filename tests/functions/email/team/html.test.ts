import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateTeamClosureEmail,
  generateTeamRemovalEmail,
  generateVoucherInviteEmail,
  generateWelcomeEmailTeam,
} from "../../../../functions/src/email/team/html";

describe("team email HTML", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("genera l'invito con codice e workspace predefinito", () => {
    // Arrange
    const code = "INVITE-123";

    // Act
    const result = generateVoucherInviteEmail(code);

    // Assert
    expect(result).toContain("<title>Invito al team su Jurio</title>");
    expect(result).toContain("<strong>Workspace</strong>");
    expect(result).toContain("<h2");
    expect(result).toContain(code);
    expect(result).toContain("https://jurio.it/profilo/team");
  });

  it("inserisce il nome personalizzato nell'invito e nell'email di benvenuto", () => {
    // Arrange
    const teamName = "Studio Legale Rossi";

    // Act
    const invite = generateVoucherInviteEmail("CODICE", teamName);
    const welcome = generateWelcomeEmailTeam(teamName);

    // Assert
    expect(invite).toContain(`unirti a <strong>${teamName}</strong>`);
    expect(welcome).toContain(`<strong>${teamName}</strong>`);
    expect(welcome).toContain("accesso è stato confermato");
    expect(welcome).toContain("Vai al Workspace");
  });

  it("genera avvisi di rimozione e chiusura col workspace predefinito", () => {
    // Arrange
    const teamName = "Workspace";

    // Act
    const removal = generateTeamRemovalEmail();
    const closure = generateTeamClosureEmail(teamName);

    // Assert
    expect(removal).toContain("<title>Aggiornamento Workspace Jurio</title>");
    expect(removal).toContain(`<strong>${teamName}</strong>`);
    expect(removal).toContain("accesso al workspace");
    expect(closure).toContain("<title>Chiusura Workspace Jurio</title>");
    expect(closure).toContain("chiuso definitivamente");
    expect(closure).toContain("Torna a Jurio");
  });

  it("riporta il nome personalizzato negli avvisi di rimozione e chiusura", () => {
    // Arrange
    const teamName = "Team Alfa";

    // Act
    const removal = generateTeamRemovalEmail(teamName);
    const closure = generateTeamClosureEmail(teamName);

    // Assert
    expect(removal.match(/Team Alfa/g)).toHaveLength(2);
    expect(closure).toContain(`<strong>${teamName}</strong>`);
    expect(closure).toContain("workspace <strong>Team Alfa</strong>");
  });
});
