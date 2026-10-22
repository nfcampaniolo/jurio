import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applyTeamVisibility: vi.fn(),
  enqueueContactEmail: vi.fn(),
  getAdminStorage: vi.fn(),
  save: vi.fn(),
  makePublic: vi.fn(),
  publicUrl: vi.fn(() => "https://storage.test/dataConfig.json"),
  file: vi.fn(),
  bucket: vi.fn(),
}));

vi.mock("@functions/_deps", () => ({ getAdminStorage: mocks.getAdminStorage }));
vi.mock("@functions/triggers/_helper", () => ({ applyTeamVisibility: mocks.applyTeamVisibility }));
vi.mock("@functions/email/comms/logic", () => ({ enqueueContactEmail: mocks.enqueueContactEmail }));

import {
  handleFileCreation,
  handleGenerateStaticStatsJson,
  handleProcessContacts,
} from "@functions/triggers/triggers.logic";

describe("Firestore trigger handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.file.mockReturnValue({ save: mocks.save, makePublic: mocks.makePublic, publicUrl: mocks.publicUrl });
    mocks.bucket.mockReturnValue({ file: mocks.file });
    mocks.getAdminStorage.mockReturnValue({ bucket: mocks.bucket });
    mocks.save.mockResolvedValue(undefined);
    mocks.makePublic.mockResolvedValue(undefined);
    mocks.enqueueContactEmail.mockResolvedValue(undefined);
    mocks.applyTeamVisibility.mockResolvedValue(undefined);
  });

  it("forwards fascicolo ownership changes to team visibility and ignores missing events", async () => {
    // Arrange
    const snapshot = { exists: true, ref: { id: "f-1" }, data: () => ({ user: "u-1" }) };
    const event = { data: { before: { exists: false }, after: snapshot } };

    // Act
    await handleFileCreation(event as never);
    await handleFileCreation({ data: undefined } as never);

    // Assert
    expect(mocks.applyTeamVisibility).toHaveBeenCalledOnce();
    expect(mocks.applyTeamVisibility).toHaveBeenCalledWith(snapshot.ref, { user: "u-1" });
  });

  it("filters non-weekly stats and writes normalized weekly stats to public storage", async () => {
    // Arrange
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const ignored = { data: { data: () => ({ type: "daily" }) }, params: { docId: "daily-1" } };
    const createdAt = { toDate: () => new Date("2026-05-31T12:00:00Z") };
    const stats = {
      type: "weekly_sentences_stats",
      createdAt,
      totale_documenti: 5,
      per_anno: { "2024": 2, "2022": 1, "2023": 2 },
      per_organo: { corte_di_cassazione: 3, consiglio_di_stato: 1 },
      per_tipo: { ordinanza: 1, sentenza: 3 },
      per_materia: { civile: 4 },
      per_sezione_cassazione: { civili: { "prima": 2 }, penali: {} },
    };
    const event = { data: { data: () => stats }, params: { docId: "stats-1" } };

    // Act
    await handleGenerateStaticStatsJson(ignored as never);
    await handleGenerateStaticStatsJson(event as never);

    // Assert
    expect(mocks.getAdminStorage).toHaveBeenCalledOnce();
    expect(mocks.file).toHaveBeenCalledWith("dataConfig.json");
    const [json, options] = mocks.save.mock.calls[0];
    expect(JSON.parse(json)).toEqual({
      meta: { totale_documenti: 5, data_aggiornamento: "31 maggio 2026" },
      per_anno: { "2022": 1, "2023": 2, "2024": 2 },
      per_organo: { Cassazione: 3, "Consiglio di Stato": 1, "Corte Costituzionale": 0 },
      per_tipo: { Ordinanza: 1, Sentenza: 3, Decreto: 0 },
      per_materia: { civile: 4, penale: 0 },
      per_sezione_cassazione: { civili: { prima: 2 }, penali: {} },
    });
    expect(options).toEqual({ contentType: "application/json", metadata: { cacheControl: "public, max-age=3600" } });
    expect(mocks.makePublic).toHaveBeenCalledOnce();
    expect(mocks.save).toHaveBeenCalledOnce();
    log.mockRestore();
  });

  it("propagates storage write failures for trigger retry", async () => {
    // Arrange
    const failure = new Error("storage failed");
    mocks.save.mockRejectedValue(failure);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const event = {
      data: { data: () => ({ type: "weekly_sentences_stats" }) },
      params: { docId: "stats-2" },
    };

    // Act
    const result = handleGenerateStaticStatsJson(event as never);

    // Assert
    await expect(result).rejects.toBe(failure);
    expect(mocks.makePublic).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("ignores absent or malformed contact tickets and enqueues normalized valid contacts", async () => {
    // Arrange
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const valid = {
      name: "  Ada Lovelace ",
      email: " ADA@EXAMPLE.TEST ",
      subject: "  Help ",
      message: "  Please help. ",
    };

    // Act
    await handleProcessContacts({ data: undefined, params: { docId: "missing" } } as never);
    await handleProcessContacts({
      data: { exists: true, data: () => ({ ...valid, message: " " }) },
      params: { docId: "invalid" },
    } as never);
    await handleProcessContacts({
      data: { exists: true, data: () => valid },
      params: { docId: "ticket-1" },
    } as never);

    // Assert
    expect(mocks.enqueueContactEmail).toHaveBeenCalledOnce();
    expect(mocks.enqueueContactEmail).toHaveBeenCalledWith({
      nome: "Ada Lovelace",
      email: "ada@example.test",
      subject: "Help",
      message: "Please help.",
      id: "ticket-1",
    });
    expect(warn).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledTimes(2);
    warn.mockRestore();
    log.mockRestore();
  });

  it("rethrows contact email enqueue errors", async () => {
    // Arrange
    const failure = new Error("queue unavailable");
    mocks.enqueueContactEmail.mockRejectedValue(failure);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const event = {
      data: { exists: true, data: () => ({ name: "N", email: "e", subject: "s", message: "m" }) },
      params: { docId: "ticket-2" },
    };

    // Act
    const result = handleProcessContacts(event as never);

    // Assert
    await expect(result).rejects.toBe(failure);
    expect(error).toHaveBeenCalledWith("CONTACT_EMAIL_ENQUEUE_FAILED", { errorType: "Error" });
    error.mockRestore();
  });
});
