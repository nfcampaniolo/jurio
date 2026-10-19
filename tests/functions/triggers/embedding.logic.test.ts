import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const mocks = vi.hoisted(() => {
  const update = vi.fn();
  const batchUpdate = vi.fn();
  const batchSet = vi.fn();
  const commit = vi.fn();
  const create = vi.fn();
  const client = { embeddings: { create } };
  const db = {
    batch: vi.fn(() => ({ update: batchUpdate, set: batchSet, commit })),
    collection: vi.fn(() => ({ doc: vi.fn((id: string) => ({ id })) })),
  };
  return {
    update, batchUpdate, batchSet, commit, create, client, db,
    getDb: vi.fn(() => db),
    applyTeamVisibility: vi.fn(),
    vector: vi.fn((value: number[]) => ({ vector: value })),
    serverTimestamp: vi.fn(() => "server-time"),
    delete: vi.fn(() => "delete-field"),
  };
});

vi.mock("@functions/_deps", () => ({ getDb: mocks.getDb }));
vi.mock("@functions/triggers/_helper", () => ({ applyTeamVisibility: mocks.applyTeamVisibility }));

const sourceRequire = createRequire(resolve(process.cwd(), "functions/src/triggers/embedding.logic.ts"));
const firestoreModule = sourceRequire("firebase-admin/firestore");
void firestoreModule;
const firestorePath = resolve(
  sourceRequire.resolve("firebase-admin/firestore").replace("/lib/firestore/index.js", "/lib/esm/firestore/index.js"),
);
vi.doMock(firestorePath, async () => {
  const actual = await vi.importActual<typeof firestoreModule>(firestorePath);
  const fieldValue = Object.create(actual.FieldValue);
  Object.assign(fieldValue, {
    vector: mocks.vector,
    serverTimestamp: mocks.serverTimestamp,
    delete: mocks.delete,
  });
  return { ...actual, FieldValue: fieldValue };
});
const openaiPath = resolve(sourceRequire.resolve("openai").replace("/index.js", "/index.mjs"));
vi.doMock(openaiPath, () => ({
  default: class { constructor() { return mocks.client; } },
}));
const {
  handleChunkEmbedding,
  handleEmbeddingCreation,
  handleEmbeddingDocumentCreation,
  handleEmbeddingManualCreation,
} = await import("@functions/triggers/embedding.logic");

function snapshot(data: Record<string, unknown>, id = "doc-1", exists = true) {
  return { exists, data: () => data, ref: { id, update: mocks.update } };
}

describe("embedding trigger handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue({ data: [{ embedding: [0.1, 0.2] }] });
    mocks.commit.mockResolvedValue(undefined);
    mocks.update.mockResolvedValue(undefined);
    mocks.applyTeamVisibility.mockResolvedValue(undefined);
  });

  it("skips absent, missing, completed, or failed sentence snapshots", async () => {
    // Arrange
    const event = (data: unknown) => ({ data, params: { docId: "sentence-1" } });

    // Act
    await handleEmbeddingCreation(event(undefined) as never);
    await handleEmbeddingCreation(event(snapshot({}, "sentence-1", false)) as never);
    await handleEmbeddingCreation(event(snapshot({ isEmbeddingFinished: true })) as never);
    await handleEmbeddingCreation(event(snapshot({ isEmbeddingFailed: true })) as never);

    // Assert
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("marks empty sentence text complete without calling OpenAI", async () => {
    // Arrange
    const snap = snapshot({ summary: "   " });

    // Act
    await handleEmbeddingCreation({ data: snap, params: { docId: "sentence-2" } } as never);

    // Assert
    expect(mocks.update).toHaveBeenCalledWith({ isEmbeddingFinished: true });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("embeds the selected sentence text and removes an existing text array", async () => {
    // Arrange
    const snap = snapshot({ summary: "  A summary  ", testo_integrale: ["private text"] });

    // Act
    await handleEmbeddingCreation({ data: snap, params: { docId: "sentence-3" } } as never);

    // Assert
    expect(mocks.create).toHaveBeenCalledWith({
      model: "text-embedding-3-small", input: "A summary", dimensions: 1536,
    });
    expect(mocks.update).toHaveBeenCalledWith({
      isEmbeddingFinished: true,
      embedding: { vector: [0.1, 0.2] },
      lastVectorizedAt: "server-time",
      testo_integrale: "delete-field",
    });
    expect(mocks.vector).toHaveBeenCalledWith([0.1, 0.2]);
  });

  it("marks embedding failures for both ordinary and manual sentence embeddings", async () => {
    // Arrange
    const failure = new Error("OpenAI unavailable");
    mocks.create.mockRejectedValue(failure);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const regular = snapshot({ massima: "legal text" });
    const manual = snapshot({ text: "manual text" });

    // Act
    await handleEmbeddingCreation({ data: regular, params: { docId: "regular" } } as never);
    await handleEmbeddingManualCreation({ data: manual, params: { docId: "manual" } } as never);

    // Assert
    expect(mocks.update).toHaveBeenNthCalledWith(1, { isEmbeddingFailed: true });
    expect(mocks.update).toHaveBeenNthCalledWith(2, { isEmbeddingFailed: true });
    expect(error).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });

  it("embeds manual text and marks blank or absent manual text complete", async () => {
    // Arrange
    const valid = snapshot({ text: "  manually entered  " });
    const blank = snapshot({ text: " " });

    // Act
    await handleEmbeddingManualCreation({ data: valid, params: { docId: "manual-1" } } as never);
    await handleEmbeddingManualCreation({ data: blank, params: { docId: "manual-2" } } as never);

    // Assert
    expect(mocks.create).toHaveBeenCalledWith({
      model: "text-embedding-3-small", input: "manually entered", dimensions: 1536,
    });
    expect(mocks.update).toHaveBeenNthCalledWith(1, {
      isEmbeddingFinished: true, embedding: { vector: [0.1, 0.2] }, lastVectorizedAt: "server-time",
    });
    expect(mocks.update).toHaveBeenNthCalledWith(2, { isEmbeddingFinished: true });
  });

  it("embeds document metadata and creates a chunk for every text segment in one batch", async () => {
    // Arrange
    const data = {
      summary: " Main text ",
      testo_integrale: ["chunk one", "chunk two"],
      urn: "urn:1",
      user: "user-1",
      tipo_documento: "sentenza",
    };
    const snap = snapshot(data, "parent-1");
    mocks.create.mockResolvedValue({
      data: [{ embedding: [1] }, { embedding: [2] }, { embedding: [3] }],
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    // Act
    await handleEmbeddingDocumentCreation({ data: snap, params: { docId: "parent-1" } } as never);

    // Assert
    expect(mocks.create).toHaveBeenCalledWith({
      model: "text-embedding-3-small",
      input: ["Main text", "chunk one", "chunk two"],
      dimensions: 1536,
    });
    expect(mocks.batchUpdate).toHaveBeenCalledWith(snap.ref, {
      isEmbeddingFinished: true,
      testo_integrale: "delete-field",
      lastVectorizedAt: "server-time",
      embedding: { vector: [1] },
    });
    expect(mocks.batchSet).toHaveBeenNthCalledWith(1, { id: "parent-1_chunk_0" }, expect.objectContaining({
      parentId: "parent-1", text: "chunk one", index: 0, embedding: { vector: [2] }, urn: "urn:1", user: "user-1",
    }));
    expect(mocks.batchSet).toHaveBeenNthCalledWith(2, { id: "parent-1_chunk_1" }, expect.objectContaining({
      parentId: "parent-1", text: "chunk two", index: 1, embedding: { vector: [3] },
    }));
    expect(mocks.commit).toHaveBeenCalledOnce();
    expect(mocks.applyTeamVisibility).toHaveBeenCalledWith(snap.ref, data, "user");
    log.mockRestore();
  });

  it("completes empty documents and marks failed batch calls for retry monitoring", async () => {
    // Arrange
    const empty = snapshot({});
    const failure = new Error("batch failed");
    const failed = snapshot({ text: "has content" }, "failed-parent");
    mocks.create.mockRejectedValue(failure);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    // Act
    await handleEmbeddingDocumentCreation({ data: empty, params: { docId: "empty" } } as never);
    await handleEmbeddingDocumentCreation({ data: failed, params: { docId: "failed-parent" } } as never);

    // Assert
    expect(mocks.update).toHaveBeenCalledWith({ isEmbeddingFinished: true });
    expect(mocks.update).toHaveBeenCalledWith({ isEmbeddingFailed: true });
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
  });

  it("skips deleted or already processed chunks and rejects chunks without text", async () => {
    // Arrange
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Act
    await handleChunkEmbedding({ data: undefined, params: { docId: "deleted" } } as never);
    await handleChunkEmbedding({ data: { after: snapshot({}, "done") }, params: { docId: "done" } } as never);
    await handleChunkEmbedding({ data: { after: snapshot({ isEmbeddingFailed: true }) }, params: { docId: "failed" } } as never);
    await handleChunkEmbedding({ data: { after: snapshot({ text: 42 }) }, params: { docId: "bad" } } as never);

    // Assert
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("stores chunk vectors, clears stale failure flags, and records failures safely", async () => {
    // Arrange
    const snap = snapshot({ text: "chunk text", user: "u1" });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    // Act
    await handleChunkEmbedding({ data: { after: snap }, params: { docId: "chunk-1" } } as never);

    // Assert
    expect(mocks.create).toHaveBeenCalledWith({
      model: "text-embedding-3-small", input: "chunk text", dimensions: 1536,
    });
    expect(mocks.update).toHaveBeenCalledWith({
      embedding: { vector: [0.1, 0.2] },
      processedAt: "server-time",
      isEmbeddingFailed: "delete-field",
    });
    expect(mocks.applyTeamVisibility).toHaveBeenCalledWith(snap.ref, { text: "chunk text", user: "u1" }, "user");
    log.mockRestore();

    // Arrange
    const failure = new Error("embedding unavailable");
    mocks.create.mockRejectedValue(failure);
    const failedSnap = snapshot({ text: "bad text" });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    // Act
    await handleChunkEmbedding({ data: { after: failedSnap }, params: { docId: "chunk-2" } } as never);

    // Assert
    expect(mocks.update).toHaveBeenLastCalledWith({
      isEmbeddingFailed: true, errorDetails: "embedding unavailable",
    });
    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
  });
});
