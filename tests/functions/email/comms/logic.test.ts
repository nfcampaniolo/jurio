import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getUserByEmail: vi.fn(),
  userGet: vi.fn(),
  dispatch: vi.fn().mockResolvedValue(undefined),
  welcomeHtml: vi.fn((name: string) => `<welcome>${name}</welcome>`),
  trialHtml: vi.fn((name: string) => `<trial>${name}</trial>`),
  requestHtml: vi.fn((name: string, id: string, subject: string, message: string) =>
    `<request>${name}|${id}|${subject}|${message}</request>`),
  db: { collection: vi.fn(() => ({ doc: vi.fn(() => ({ get: mocks.userGet })) })) },
}));

vi.mock("../../../../functions/src/_deps", () => ({
  getAdminAuth: () => ({ getUser: mocks.getUser }),
  getDb: () => mocks.db,
}));
vi.mock("../../../../functions/src/email/_helper", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../functions/src/email/_helper")>()),
  dispatchMailAndNotification: mocks.dispatch,
}));
vi.mock("../../../../functions/src/email/comms/html", () => ({
  generateWelcomeEmail: mocks.welcomeHtml,
  generateTrialEmail: mocks.trialHtml,
  generateRequestEmail: mocks.requestHtml,
}));

import {
  enqueueContactEmail,
  enqueueTrialEmail,
  enqueueWelcomeEmail,
} from "../../../../functions/src/email/comms/logic";

describe("comms email logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe.each([
    ["enqueueWelcomeEmail", enqueueWelcomeEmail, "Benvenuto su Jurio", "account", "Benvenuto su Jurio!", "Siamo felici di averti a bordo. Inizia subito a esplorare la piattaforma.", mocks.welcomeHtml],
    ["enqueueTrialEmail", enqueueTrialEmail, "Periodo di Prova Jurio", "billing", "Periodo di Prova Attivo", "Hai iniziato il tuo periodo di prova gratuito. Goditi tutte le funzionalità premium!", mocks.trialHtml],
  ])("%s", (_name, enqueue, subject, type, title, message, htmlGenerator) => {
    it("usa il nome ripulito e invia email e notifica", async () => {
      // Arrange
      mocks.getUser.mockResolvedValue({ email: "user@example.com" });
      mocks.userGet.mockResolvedValue({ exists: true, data: () => ({ name: "  Ada Lovelace  " }) });

      // Act
      await enqueue({ uid: "uid-1" });

      // Assert
      expect(mocks.db.collection).toHaveBeenCalledWith("users");
      expect(mocks.getUser).toHaveBeenCalledWith("uid-1");
      expect(htmlGenerator).toHaveBeenCalledWith("Ada Lovelace");
      expect(mocks.dispatch).toHaveBeenCalledWith({
        to: "user@example.com",
        subject,
        html: `<${type === "account" ? "welcome" : "trial"}>Ada Lovelace</${type === "account" ? "welcome" : "trial"}>`,
        notifications: {
          user: "uid-1",
          title,
          message,
          type,
          link: "/profilo",
        },
      });
    });

    it.each([
      [{ exists: false, data: () => ({ name: "unused" }) }, "utente"],
      [{ exists: true, data: () => ({ name: 7 }) }, "utente"],
      [{ exists: true, data: () => ({ name: "   " }) }, "utente"],
    ])("usa il nome di fallback per dati profilo non validi", async (profile, expectedName) => {
      // Arrange
      mocks.getUser.mockResolvedValue({ email: "user@example.com" });
      mocks.userGet.mockResolvedValue(profile);

      // Act
      await enqueue({ uid: "uid-2" });

      // Assert
      expect(htmlGenerator).toHaveBeenCalledWith(expectedName);
    });

    it("non invia se il recupero Auth fallisce o non c'è un indirizzo email", async () => {
      // Arrange
      mocks.getUser.mockRejectedValueOnce(new Error("auth error"));
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

      // Act
      await enqueue({ uid: "missing" });
      mocks.getUser.mockResolvedValueOnce({ email: null });
      await enqueue({ uid: "no-email" });

      // Assert
      expect(warn).toHaveBeenCalledOnce();
      expect(mocks.userGet).not.toHaveBeenCalled();
      expect(mocks.dispatch).not.toHaveBeenCalled();
    });
  });

  it("invia la richiesta di contatto senza lookup Auth o profilo", async () => {
    // Arrange
    const request = {
      nome: "Ada",
      id: "T-42",
      subject: "Problema accesso",
      message: "Non riesco ad accedere",
      email: "ada@example.com",
    };

    // Act
    await enqueueContactEmail(request);

    // Assert
    expect(mocks.requestHtml).toHaveBeenCalledWith("Ada", "T-42", "Problema accesso", "Non riesco ad accedere");
    expect(mocks.dispatch).toHaveBeenCalledWith({
      to: "ada@example.com",
      cc: "nicolo.flavio.campaniolo@gmail.com",
      subject: "Richiesta Jurio: T-42",
      html: "<request>Ada|T-42|Problema accesso|Non riesco ad accedere</request>",
    });
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.userGet).not.toHaveBeenCalled();
  });

  it("propaga errori di lettura profilo e di accodamento email", async () => {
    // Arrange
    mocks.getUser.mockResolvedValue({ email: "user@example.com" });
    mocks.userGet.mockRejectedValueOnce(new Error("db error"));

    // Act
    const profileResult = enqueueWelcomeEmail({ uid: "uid-3" });

    // Assert
    await expect(profileResult).rejects.toThrow("db error");
    expect(mocks.dispatch).not.toHaveBeenCalled();

    // Arrange
    mocks.userGet.mockResolvedValueOnce({ exists: false, data: () => null });
    mocks.dispatch.mockRejectedValueOnce(new Error("queue error"));

    // Act
    const dispatchResult = enqueueTrialEmail({ uid: "uid-4" });

    // Assert
    await expect(dispatchResult).rejects.toThrow("queue error");
  });

  it("propaga gli errori del servizio di accodamento delle richieste di contatto", async () => {
    // Arrange
    mocks.dispatch.mockRejectedValueOnce(new Error("queue error"));

    // Act
    const result = enqueueContactEmail({
      nome: "Ada", id: "T-44", subject: "Richiesta", message: "Aiuto", email: "ada@example.com",
    });

    // Assert
    await expect(result).rejects.toThrow("queue error");
  });
});
