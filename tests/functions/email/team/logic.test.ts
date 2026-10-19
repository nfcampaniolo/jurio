import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserByEmail: vi.fn(),
  dispatch: vi.fn().mockResolvedValue(undefined),
  voucherHtml: vi.fn((code: string, team: string) => `<voucher>${team}:${code}</voucher>`),
  welcomeHtml: vi.fn((team: string) => `<welcome>${team}</welcome>`),
  removalHtml: vi.fn((team: string) => `<removal>${team}</removal>`),
  closureHtml: vi.fn((team: string) => `<closure>${team}</closure>`),
}));

vi.mock("../../../../functions/src/_deps", () => ({
  getAdminAuth: () => ({ getUserByEmail: mocks.getUserByEmail }),
}));
vi.mock("../../../../functions/src/email/_helper", () => ({
  dispatchMailAndNotification: mocks.dispatch,
}));
vi.mock("../../../../functions/src/email/team/html", () => ({
  generateVoucherInviteEmail: mocks.voucherHtml,
  generateWelcomeEmailTeam: mocks.welcomeHtml,
  generateTeamRemovalEmail: mocks.removalHtml,
  generateTeamClosureEmail: mocks.closureHtml,
}));

import {
  enqueueCloseTeamEmail,
  enqueueRemoveTeamEmail,
  enqueueVoucherEmail,
  enqueueWelcomeTeamEmail,
} from "../../../../functions/src/email/team/logic";

describe("team email logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("enqueueVoucherEmail", () => {
    it.each([
      [{ email: "", voucherCode: "CODE" }, "email vuota"],
      [{ email: "user@example.com", voucherCode: "" }, "codice vuoto"],
    ])("non accoda con dati incompleti (%s)", async (args) => {
      // Arrange
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

      // Act
      await enqueueVoucherEmail(args);

      // Assert
      expect(warn).toHaveBeenCalledOnce();
      expect(mocks.getUserByEmail).not.toHaveBeenCalled();
      expect(mocks.dispatch).not.toHaveBeenCalled();
    });

    it("accoda invito e notifica personalizzati per un utente registrato", async () => {
      // Arrange
      mocks.getUserByEmail.mockResolvedValue({ uid: "uid-1" });

      // Act
      await enqueueVoucherEmail({ email: "user@example.com", voucherCode: "AB12", teamName: "Studio Alfa" });

      // Assert
      expect(mocks.voucherHtml).toHaveBeenCalledWith("AB12", "Studio Alfa");
      expect(mocks.dispatch).toHaveBeenCalledWith({
        to: "user@example.com",
        subject: "Invito a unirti a Studio Alfa su Jurio",
        html: "<voucher>Studio Alfa:AB12</voucher>",
        notifications: [{
          uid: "uid-1",
          title: "Nuovo Invito",
          message: "Sei stato invitato a unirti a Studio Alfa. Usa il codice AB12.",
          type: "team",
          link: "/profilo/team",
        }],
      });
    });

    it("usa il subject generico e accoda comunque quando l'utente non è registrato", async () => {
      // Arrange
      mocks.getUserByEmail.mockRejectedValue(new Error("utente sconosciuto"));
      const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

      // Act
      await enqueueVoucherEmail({ email: "new@example.com", voucherCode: "XYZ" });

      // Assert
      expect(log).toHaveBeenCalledOnce();
      expect(mocks.dispatch).toHaveBeenCalledWith({
        to: "new@example.com",
        subject: "Invito a unirti a un Workspace su Jurio",
        html: "<voucher>un Workspace:XYZ</voucher>",
        notifications: undefined,
      });
    });
  });

  describe("enqueueWelcomeTeamEmail", () => {
    it("ignora email mancante e altrimenti invia i contenuti predefiniti", async () => {
      // Arrange
      mocks.getUserByEmail.mockResolvedValue({ uid: "uid-2" });

      // Act
      await enqueueWelcomeTeamEmail({ email: "" });
      await enqueueWelcomeTeamEmail({ email: "user@example.com" });

      // Assert
      expect(mocks.getUserByEmail).toHaveBeenCalledOnce();
      expect(mocks.welcomeHtml).toHaveBeenCalledWith("Workspace");
      expect(mocks.dispatch).toHaveBeenCalledOnce();
      expect(mocks.dispatch).toHaveBeenCalledWith({
        to: "user@example.com",
        subject: "Benvenuto nel tuo nuovo Workspace su Jurio",
        html: "<welcome>Workspace</welcome>",
        notifications: [{
          uid: "uid-2",
          title: "Benvenuto nel Workspace!",
          message: "Ora fai parte del workspace Workspace.",
          type: "team",
          link: "/profilo",
        }],
      });
    });

    it("accoda email senza notifica se il recupero Auth fallisce", async () => {
      // Arrange
      mocks.getUserByEmail.mockRejectedValue(new Error("auth error"));

      // Act
      await enqueueWelcomeTeamEmail({ email: "user@example.com", teamName: "Team Beta" });

      // Assert
      expect(mocks.dispatch).toHaveBeenCalledWith(expect.objectContaining({
        subject: "Benvenuto in Team Beta su Jurio",
        notifications: undefined,
      }));
    });
  });

  describe("enqueueRemoveTeamEmail", () => {
    it("ignora email mancante e invia rimozione con notifica al membro registrato", async () => {
      // Arrange
      mocks.getUserByEmail.mockResolvedValue({ uid: "uid-3" });

      // Act
      await enqueueRemoveTeamEmail({ email: "" });
      await enqueueRemoveTeamEmail({ email: "removed@example.com", teamName: "Team Gamma" });

      // Assert
      expect(mocks.getUserByEmail).toHaveBeenCalledOnce();
      expect(mocks.removalHtml).toHaveBeenCalledWith("Team Gamma");
      expect(mocks.dispatch).toHaveBeenCalledOnce();
      expect(mocks.dispatch).toHaveBeenCalledWith({
        to: "removed@example.com",
        subject: "Aggiornamento sul tuo accesso a Team Gamma",
        html: "<removal>Team Gamma</removal>",
        notifications: [{
          uid: "uid-3",
          title: "Accesso revocato",
          message: "Non hai più accesso al workspace Team Gamma.",
          type: "team",
        }],
      });
    });

    it("usa il subject Workspace e omette la notifica se Auth non trova l'utente", async () => {
      // Arrange
      mocks.getUserByEmail.mockRejectedValue(new Error("auth error"));

      // Act
      await enqueueRemoveTeamEmail({ email: "removed@example.com" });

      // Assert
      expect(mocks.dispatch).toHaveBeenCalledWith(expect.objectContaining({
        subject: "Aggiornamento sul tuo accesso al Workspace",
        notifications: undefined,
      }));
    });
  });

  describe("enqueueCloseTeamEmail", () => {
    it("ignora email vuote e gli array vuoti senza accodare", async () => {
      // Arrange
      const input: Array<string | string[]> = ["", []];

      // Act
      await enqueueCloseTeamEmail({ email: input[0] as string });
      await enqueueCloseTeamEmail({ email: input[1] as string[] });

      // Assert
      expect(mocks.dispatch).not.toHaveBeenCalled();
      expect(mocks.getUserByEmail).not.toHaveBeenCalled();
    });

    it("usa BCC, subject predefinito e raccoglie solo le notifiche degli utenti esistenti", async () => {
      // Arrange
      mocks.getUserByEmail
        .mockResolvedValueOnce({ uid: "uid-a" })
        .mockRejectedValueOnce(new Error("not registered"))
        .mockResolvedValueOnce({ uid: "uid-c" });
      const recipients = ["a@example.com", "unknown@example.com", "c@example.com"];

      // Act
      await enqueueCloseTeamEmail({ email: recipients });

      // Assert
      expect(mocks.closureHtml).toHaveBeenCalledWith("Workspace");
      expect(mocks.getUserByEmail).toHaveBeenCalledTimes(3);
      expect(mocks.dispatch).toHaveBeenCalledWith({
        bcc: recipients,
        subject: "Chiusura del Workspace su Jurio",
        html: "<closure>Workspace</closure>",
        notifications: expect.arrayContaining([
          expect.objectContaining({ uid: "uid-a", title: "Workspace Chiuso", type: "team" }),
          expect.objectContaining({ uid: "uid-c", title: "Workspace Chiuso", type: "team" }),
        ]),
      });
      expect(mocks.dispatch.mock.calls[0][0].notifications).toHaveLength(2);
    });

    it("accoda con subject personalizzato e senza notifiche se nessun destinatario è registrato", async () => {
      // Arrange
      mocks.getUserByEmail.mockRejectedValue(new Error("not registered"));

      // Act
      await enqueueCloseTeamEmail({ email: "unknown@example.com", teamName: "Team Delta" });

      // Assert
      expect(mocks.dispatch).toHaveBeenCalledWith({
        bcc: ["unknown@example.com"],
        subject: "Chiusura del workspace Team Delta",
        html: "<closure>Team Delta</closure>",
        notifications: undefined,
      });
    });

    it("propaga gli errori del servizio di accodamento per tutti i tipi di email team", async () => {
      // Arrange
      mocks.getUserByEmail.mockResolvedValue({ uid: "registered-user" });
      const enqueueOperations = [
        () => enqueueVoucherEmail({ email: "user@example.com", voucherCode: "CODE" }),
        () => enqueueWelcomeTeamEmail({ email: "user@example.com" }),
        () => enqueueRemoveTeamEmail({ email: "user@example.com" }),
        () => enqueueCloseTeamEmail({ email: "user@example.com" }),
      ];

      // Act
      for (const enqueue of enqueueOperations) {
        mocks.dispatch.mockRejectedValueOnce(new Error("queue error"));
        await expect(enqueue()).rejects.toThrow("queue error");
      }

      // Assert
      expect(mocks.dispatch).toHaveBeenCalledTimes(enqueueOperations.length);
    });
  });
});
