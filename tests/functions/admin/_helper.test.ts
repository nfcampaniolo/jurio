import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const get = vi.fn();
  const where = vi.fn();
  const orderBy = vi.fn();
  const limit = vi.fn();
  const bulkDelete = vi.fn();
  const bulkUpdate = vi.fn();
  const bulkClose = vi.fn();
  const onWriteError = vi.fn();
  const batchSet = vi.fn();
  const batchUpdate = vi.fn();
  const batchCommit = vi.fn();
  const refSet = vi.fn();
  const collection = vi.fn();
  const db = {
    collection,
    bulkWriter: vi.fn(),
    batch: vi.fn(),
  };
  return {
    get, where, orderBy, limit, bulkDelete, bulkUpdate, bulkClose, onWriteError,
    batchSet, batchUpdate, batchCommit, refSet, collection, db,
  };
});

vi.mock("@functions/_deps", () => ({ getDb: () => mocks.db }));
vi.mock("firebase-admin/firestore", () => ({
  Timestamp: { fromDate: vi.fn((date: Date) => ({ date })) },
  FieldValue: {
    increment: vi.fn((amount: number) => ({ increment: amount })),
    serverTimestamp: vi.fn(() => ({ serverTimestamp: true })),
  },
}));

describe("admin maintenance helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const query = {
      where: mocks.where,
      orderBy: mocks.orderBy,
      limit: mocks.limit,
      get: mocks.get,
      startAfter: vi.fn(),
    };
    mocks.where.mockReturnValue(query);
    mocks.orderBy.mockReturnValue(query);
    mocks.limit.mockReturnValue(query);
    mocks.collection.mockImplementation((name: string) => {
      if (name === "sentences") return query;
      return {
        doc: vi.fn(() => ({
          collection: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(() => ({ get: mocks.get })),
            })),
            doc: vi.fn(() => ({ path: "metadata/new" })),
          })),
          set: mocks.refSet,
        })),
      };
    });
    mocks.db.bulkWriter.mockReturnValue({
      delete: mocks.bulkDelete,
      update: mocks.bulkUpdate,
      close: mocks.bulkClose,
      onWriteError: mocks.onWriteError,
    });
    mocks.db.batch.mockReturnValue({
      set: mocks.batchSet,
      update: mocks.batchUpdate,
      commit: mocks.batchCommit,
    });
    mocks.get.mockResolvedValue({ empty: true, docs: [], size: 0 });
    mocks.bulkClose.mockResolvedValue(undefined);
    mocks.batchCommit.mockResolvedValue(undefined);
    mocks.refSet.mockResolvedValue(undefined);
  });

  it("completes duplicate cleanup for an empty day and reports progress", async () => {
    // Arrange
    const progress = vi.fn();
    const { runCleanupDuplicates } = await import("@functions/admin/_helper");

    // Act
    const result = await runCleanupDuplicates(progress);

    // Assert
    expect(result).toEqual({ deletedCount: 0 });
    expect(mocks.bulkClose).toHaveBeenCalledOnce();
    expect(progress).toHaveBeenCalledWith("Pulizia duplicati completata.", {
      step: 2, action: "done", totalDeleted: 0,
    });
  });

  it("deletes later documents that repeat an already-seen URN or ECLI", async () => {
    // Arrange
    const firstRef = { path: "sentences/first" };
    const duplicateRef = { path: "sentences/duplicate" };
    mocks.get.mockResolvedValueOnce({
      empty: false,
      size: 2,
      docs: [
        { ref: firstRef, data: () => ({ urn: " urn:one ", ecli: "ECLI:IT:ONE" }) },
        { ref: duplicateRef, data: () => ({ urn: "urn:one", ecli: "ECLI:IT:TWO" }) },
      ],
    });
    const { runCleanupDuplicates } = await import("@functions/admin/_helper");

    // Act
    const result = await runCleanupDuplicates(vi.fn());

    // Assert
    expect(result).toEqual({ deletedCount: 1 });
    expect(mocks.bulkDelete).toHaveBeenCalledWith(duplicateRef);
  });

  it("updates selected source metadata and closes the writer", async () => {
    // Arrange
    const progress = vi.fn();
    const { runUpdateFonte } = await import("@functions/admin/_helper");

    // Act
    const result = await runUpdateFonte({ newFonte: "  Fonte nuova  " }, progress);

    // Assert
    expect(result).toEqual({ updatedSentences: 0 });
    expect(mocks.bulkClose).toHaveBeenCalledOnce();
    expect(progress).toHaveBeenCalledWith("Aggiornamento Fonte completato.", {
      step: 1, action: "done", totalUpdated: 0,
    });
  });

  it("recalculates URN/ECLI and writes changed sentence metadata", async () => {
    // Arrange
    const ref = { path: "sentences/one" };
    mocks.get.mockResolvedValueOnce({
      empty: false,
      size: 1,
      docs: [{
        ref,
        data: () => ({
          organo_giudicante: "Corte di Cassazione",
          materia: "civile",
          sezione: "Prima",
          tipo_documento: "sentenza",
          data_sentenza: "2024-03-05",
          numero_sentenza: "12",
        }),
      }],
    });
    const { runUpdateFonte } = await import("@functions/admin/_helper");

    // Act
    const result = await runUpdateFonte({ newFonte: "  Fonte nuova  " }, vi.fn());

    // Assert
    expect(result).toEqual({ updatedSentences: 1 });
    expect(mocks.bulkUpdate).toHaveBeenCalledWith(ref, expect.objectContaining({
      fonte: "Fonte nuova",
      urn: "urn:nir:corte.cassazione;civile;sezione.1:sentenza:2024-03-05;12",
      ecli: "ECLI:IT:CASS:2024:12CIV",
    }));
  });

  it("returns zero metadata counts after scanning no documents", async () => {
    // Arrange
    const progress = vi.fn();
    const { runUpdateMetadata } = await import("@functions/admin/_helper");

    // Act
    const result = await runUpdateMetadata(progress);

    // Assert
    expect(result).toEqual({ scanned: 0, newSubcats: 0, newPres: 0, newRel: 0 });
    expect(mocks.refSet).toHaveBeenCalledTimes(2);
    expect(progress).toHaveBeenCalledWith(expect.stringContaining("Aggiornamento completato."), {
      step: 2, action: "done", totalScanned: 0,
    });
  });

  it("creates taxonomy and magistrate entries from today's sentence metadata", async () => {
    // Arrange
    mocks.get
      .mockResolvedValueOnce({
        empty: false,
        size: 1,
        docs: [{
          data: () => ({ sottocategoria: ["Diritto Civile"], presidente: "Presidente A", relatore: "Relatore B" }),
        }],
      })
      .mockResolvedValue({ empty: true, docs: [] });
    const { runUpdateMetadata } = await import("@functions/admin/_helper");

    // Act
    const result = await runUpdateMetadata(vi.fn());

    // Assert
    expect(result).toEqual({ scanned: 1, newSubcats: 1, newPres: 1, newRel: 1 });
    expect(mocks.batchSet).toHaveBeenCalledWith({ path: "metadata/new" }, { nome: "diritto civile", sentences: 1 });
    expect(mocks.batchCommit).toHaveBeenCalledTimes(3);
  });

  it("propagates Firestore query failures instead of reporting a false success", async () => {
    // Arrange
    mocks.get.mockRejectedValueOnce(new Error("Firestore unavailable"));
    const { runCleanupDuplicates } = await import("@functions/admin/_helper");

    // Act / Assert
    await expect(runCleanupDuplicates(vi.fn())).rejects.toThrow("Firestore unavailable");
    expect(mocks.bulkClose).not.toHaveBeenCalled();
  });
});
