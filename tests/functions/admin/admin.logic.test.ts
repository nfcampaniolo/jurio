import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const registerGet = vi.fn();
  const docGet = vi.fn();
  const userGet = vi.fn();
  const docSet = vi.fn();
  const where = vi.fn();
  const queryGet = vi.fn();
  const bulkUpdate = vi.fn();
  const bulkDelete = vi.fn();
  const bulkSet = vi.fn();
  const bulkClose = vi.fn();
  const dispatch = vi.fn();
  const broadcastAdd = vi.fn();
  const collection = vi.fn();
  const db = { collection, bulkWriter: vi.fn() };
  const runCleanupDuplicates = vi.fn();
  const runUpdateFonte = vi.fn();
  const runUpdateMetadata = vi.fn();
  const validate = vi.fn();
  const secure = vi.fn();
  return {
    registerGet, docGet, userGet, docSet, where, queryGet, bulkUpdate, bulkDelete, bulkSet, bulkClose,
    dispatch, broadcastAdd, collection, db, runCleanupDuplicates, runUpdateFonte, runUpdateMetadata, validate, secure,
  };
});

vi.mock("@functions/_deps", () => ({ getDb: () => mocks.db }));
vi.mock("@functions/_utils", () => ({
  withSecureApiEndpoint: mocks.secure,
  validateUserPlanAndLimits: mocks.validate,
}));
vi.mock("@functions/admin/_helper", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@functions/admin/_helper")>()),
  runCleanupDuplicates: mocks.runCleanupDuplicates,
  runUpdateFonte: mocks.runUpdateFonte,
  runUpdateMetadata: mocks.runUpdateMetadata,
}));
vi.mock("@functions/email/_helper", () => ({ dispatchMailAndNotification: mocks.dispatch }));
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: vi.fn(() => ({ serverTimestamp: true })),
    increment: vi.fn((value: number) => ({ increment: value })),
    arrayRemove: vi.fn((value: string) => ({ remove: value })),
  },
}));

describe("admin endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.secure.mockImplementation(async (_req: unknown, _res: unknown, callback: (uid: string) => Promise<void>) => callback("admin-1"));
    mocks.validate.mockResolvedValue(undefined);
    mocks.registerGet.mockResolvedValue({ exists: true, data: () => ({ planId: "admin" }) });
    mocks.docGet.mockResolvedValue({ exists: true, data: () => ({ email: "recipient@example.test" }) });
    mocks.userGet.mockResolvedValue({ exists: true, data: () => ({ email: "recipient@example.test" }) });
    mocks.docSet.mockResolvedValue(undefined);
    mocks.queryGet.mockResolvedValue({ empty: true, docs: [], forEach: vi.fn() });
    mocks.where.mockReturnValue({
      get: mocks.queryGet,
      limit: vi.fn(() => ({ get: mocks.queryGet })),
    });
    mocks.runUpdateFonte.mockResolvedValue({ updatedSentences: 4 });
    mocks.runUpdateMetadata.mockResolvedValue({ scanned: 8 });
    mocks.runCleanupDuplicates.mockResolvedValue({ deletedCount: 2 });
    mocks.dispatch.mockResolvedValue(undefined);
    mocks.collection.mockImplementation((name: string) => ({
      doc: vi.fn((id?: string) => ({
        id,
        get: name === "register" ? mocks.registerGet : name === "users" ? mocks.userGet : mocks.docGet,
        set: mocks.docSet,
        collection: vi.fn(() => ({
          where: mocks.where,
          doc: vi.fn(() => ({ id: "new-taxonomy-ref" })),
        })),
      })),
      where: mocks.where,
      get: mocks.queryGet,
      add: mocks.broadcastAdd,
    }));
    mocks.broadcastAdd.mockResolvedValue(undefined);
    mocks.db.bulkWriter.mockReturnValue({
      update: mocks.bulkUpdate,
      delete: mocks.bulkDelete,
      set: mocks.bulkSet,
      close: mocks.bulkClose,
    });
  });

  const response = () => ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
    writableEnded: false,
  });

  it("runs maintenance tasks and emits terminal SSE statistics", async () => {
    // Arrange
    const req = { body: { newFonte: "Fonte aggiornata" } } as never;
    const res = response();
    const { executeAdminMaintenanceTask } = await import("@functions/admin/admin.logic");

    // Act
    await executeAdminMaintenanceTask(req, res as never);

    // Assert
    expect(mocks.validate).toHaveBeenCalledWith("admin-1", "admin", expect.any(Object));
    expect(mocks.runUpdateFonte).toHaveBeenCalledOnce();
    expect(mocks.runUpdateMetadata).toHaveBeenCalledOnce();
    expect(mocks.runCleanupDuplicates).toHaveBeenCalledOnce();
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('"recordDuplicatiEliminatiDalDb":2'));
    expect(res.end).toHaveBeenCalledOnce();
  });

  it("rejects maintenance when the register record is missing", async () => {
    // Arrange
    mocks.registerGet.mockResolvedValue({ exists: false });
    const { executeAdminMaintenanceTask } = await import("@functions/admin/admin.logic");
    const res = response();

    // Act
    await executeAdminMaintenanceTask({ body: {} } as never, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mocks.runUpdateFonte).not.toHaveBeenCalled();
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it("merges a requested category even when there are no sentence matches", async () => {
    // Arrange
    const req = { body: { vecchiaCategoria: "Vecchia", nuovaCategoria: "Nuova" } } as never;
    const res = response();
    const { executeAdminMergeCategoryTask } = await import("@functions/admin/admin.logic");

    // Act
    await executeAdminMergeCategoryTask(req, res as never);

    // Assert
    expect(mocks.bulkClose).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it("replaces old sentence categories and increments an existing taxonomy count", async () => {
    // Arrange
    const sentenceRef = { path: "sentences/s1" };
    const oldTaxonomyRef = { path: "meta/taxonomy/old" };
    const existingNewTaxonomyRef = { path: "meta/taxonomy/new" };
    mocks.queryGet
      .mockResolvedValueOnce({
        docs: [{ ref: sentenceRef, data: () => ({ sottocategoria: ["Vecchia", "Nuova", "altro"] }) }],
      })
      .mockResolvedValueOnce({ empty: false, docs: [{ ref: oldTaxonomyRef }] })
      .mockResolvedValueOnce({ empty: false, docs: [{ ref: existingNewTaxonomyRef }] });
    const { executeAdminMergeCategoryTask } = await import("@functions/admin/admin.logic");
    const res = response();

    // Act
    await executeAdminMergeCategoryTask({ body: { vecchiaCategoria: " Vecchia ", nuovaCategoria: "Nuova" } } as never, res as never);

    // Assert
    expect(mocks.bulkUpdate).toHaveBeenCalledWith(sentenceRef, { sottocategoria: ["Nuova", "altro"] });
    expect(mocks.bulkDelete).toHaveBeenCalledWith(oldTaxonomyRef);
    expect(mocks.bulkUpdate).toHaveBeenCalledWith(existingNewTaxonomyRef, expect.objectContaining({
      sentences: expect.anything(),
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("Modificate 1 sentenze"),
    }));
  });

  it("rejects category merges without an old category", async () => {
    // Arrange
    const { executeAdminMergeCategoryTask } = await import("@functions/admin/admin.logic");
    const res = response();

    // Act
    await executeAdminMergeCategoryTask({ body: { vecchiaCategoria: "  " } } as never, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.db.bulkWriter).not.toHaveBeenCalled();
  });

  it("validates manual content before writing and saves sanitized content", async () => {
    // Arrange
    const req = { body: { id: " doc!1 ", text: "  testo  ", links: [" https://example.test "], images: " img " } } as never;
    const res = response();
    const { executeAdminUploadManualContentTask } = await import("@functions/admin/admin.logic");

    // Act
    await executeAdminUploadManualContentTask(req, res as never);

    // Assert
    expect(mocks.docSet).toHaveBeenCalledWith(expect.objectContaining({
      text: "testo", links: ["https://example.test"], images: "img", authorId: "admin-1",
    }));
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("rejects manual content with missing fields without touching Firestore", async () => {
    // Arrange
    const req = { body: { id: "doc", text: "text", links: [], images: "image" } } as never;
    const res = response();
    const { executeAdminUploadManualContentTask } = await import("@functions/admin/admin.logic");

    // Act
    await executeAdminUploadManualContentTask(req, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.docSet).not.toHaveBeenCalled();
  });

  it("rejects notification payloads when no delivery channel is selected", async () => {
    // Arrange
    const req = { body: { targetMode: "single", uid: "user-1", title: "Avviso" } } as never;
    const res = response();
    const { executeSendAdminNotification } = await import("@functions/admin/admin.logic");

    // Act
    await executeSendAdminNotification(req, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("sends a single-user in-app and email notification", async () => {
    // Arrange
    const { executeSendAdminNotification } = await import("@functions/admin/admin.logic");
    const res = response();

    // Act
    await executeSendAdminNotification({
      body: { targetMode: "single", uid: "user-2", title: "  Avviso ", message: " testo ", sendInApp: true, sendEmail: true, emailHtml: "<p>x</p>" },
    } as never, res as never);

    // Assert
    expect(mocks.dispatch).toHaveBeenCalledWith(expect.objectContaining({
      to: "recipient@example.test",
      subject: "Avviso",
      html: "<p>x</p>",
      notifications: [{ uid: "user-2", title: "Avviso", message: "testo", type: "info", link: "" }],
    }));
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("stores an unrestricted in-app broadcast and avoids per-user notifications", async () => {
    // Arrange
    const { executeSendAdminNotification } = await import("@functions/admin/admin.logic");
    const res = response();

    // Act
    await executeSendAdminNotification({
      body: { targetMode: "broadcast", title: "Update", message: "Hello", sendInApp: true },
    } as never, res as never);

    // Assert
    expect(mocks.broadcastAdd).toHaveBeenCalledWith(expect.objectContaining({ title: "Update", message: "Hello" }));
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("Destinatari identificati: 0") }));
  });

  it("blocks requests when the caller is not an administrator", async () => {
    // Arrange
    mocks.registerGet.mockResolvedValue({ exists: true, data: () => ({ planId: "prova" }) });
    const req = { body: { id: "doc", text: "text", links: ["link"], images: "image" } } as never;
    const res = response();
    const { executeAdminUploadManualContentTask } = await import("@functions/admin/admin.logic");

    // Act
    await executeAdminUploadManualContentTask(req, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mocks.validate).not.toHaveBeenCalled();
    expect(mocks.docSet).not.toHaveBeenCalled();
  });
});
