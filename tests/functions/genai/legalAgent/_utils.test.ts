import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: { batch: vi.fn(), collection: vi.fn() },
  batch: { set: vi.fn(), update: vi.fn(), delete: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) },
  docRef: { id: "doc-1" },
  chunkDoc: { ref: { id: "chunk-1" } },
}));
vi.mock("@functions/_deps", () => ({ getDb: () => mocks.db, sanitize: (value: unknown) => value }));

import {
  migrateChatToFascicolo, persistLegalAgentConversation, processFascicoloDocs, sendLegalAgentSse, sendLegalAgentSseRaw,
  setupLegalAgentSse,
} from "@functions/genai/legalAgent/_utils";

describe("legal-agent response helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.batch.mockReturnValue(mocks.batch);
    mocks.batch.commit.mockResolvedValue(undefined);
  });

  it("sets SSE headers and writes JSON or raw event payloads only while open", () => {
    const res = { setHeader: vi.fn(), flushHeaders: vi.fn(), writableEnded: false, write: vi.fn() };
    setupLegalAgentSse(res as never);
    sendLegalAgentSse(res as never, { message: "ok" });
    sendLegalAgentSseRaw(res as never, "[DONE]");
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/event-stream");
    expect(res.flushHeaders).toHaveBeenCalledOnce();
    expect(res.write).toHaveBeenNthCalledWith(1, 'data: {"message":"ok"}\n\n');
    res.writableEnded = true;
    sendLegalAgentSse(res as never, "ignored");
    sendLegalAgentSseRaw(res as never, "ignored");
    expect(res.write).toHaveBeenCalledTimes(2);
  });

  it("persists user and assistant messages plus the parent timestamp in one batch", async () => {
    const messages = { doc: vi.fn(() => ({ id: "message" })) };
    const chatRef = { set: vi.fn() };
    const collection = {
      doc: vi.fn(() => ({
        collection: vi.fn(() => ({ doc: vi.fn(() => ({ id: "message" })) })),
        ...chatRef,
      })),
    };
    mocks.db.collection.mockReturnValue(collection);
    await persistLegalAgentConversation({
      uid: "u1", prompt: "Question", result: { risposta: "Answer", fonti: [{ id: "s1" }] },
      messagesRef: messages as never, parentId: "chat-1", isFascicolo: false,
      threadId: null, isFirstMessage: false,
    });
    expect(mocks.batch.set).toHaveBeenCalledTimes(3);
    expect(mocks.batch.commit).toHaveBeenCalledOnce();
  });

  it("persists generated titles on new fascicolo threads and retains a caller's parent title", async () => {
    const threadRef = { id: "thread-1" };
    const fascicoloRef = {
      collection: vi.fn(() => ({ doc: vi.fn(() => threadRef) })),
    };
    mocks.db.collection.mockReturnValue({ doc: vi.fn(() => fascicoloRef) });
    await persistLegalAgentConversation({
      uid: "u1", prompt: "Question", result: { risposta: "Answer", titoloGenerato: "Generated title" },
      messagesRef: { doc: vi.fn(() => ({ id: "message" })) } as never,
      parentId: "case-1", isFascicolo: true, threadId: "thread-1", isFirstMessage: true,
      contextTitle: "  Existing case title ",
    });
    expect(mocks.batch.set).toHaveBeenCalledWith(threadRef, expect.objectContaining({ title: "Generated title" }), { merge: true });
    expect(mocks.batch.set).toHaveBeenCalledWith(fascicoloRef, expect.objectContaining({ title: "Existing case title" }), { merge: true });
    expect(mocks.batch.commit).toHaveBeenCalledOnce();
  });

  it("does no writes for an empty document list and associates chunks for provided docs", async () => {
    await processFascicoloDocs("", ["doc-1"]);
    await processFascicoloDocs("f1", []);
    expect(mocks.db.batch).not.toHaveBeenCalled();

    const docRef = { id: "doc-1" };
    const documents = { doc: vi.fn(() => docRef) };
    const chunks = {
      where: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ forEach: (callback: (doc: typeof mocks.chunkDoc) => void) => callback(mocks.chunkDoc) }),
    };
    mocks.db.collection.mockImplementation((name: string) => name === "documents" ? documents : chunks);
    await processFascicoloDocs("f1", ["doc-1"]);
    expect(mocks.batch.update).toHaveBeenCalledTimes(2);
    expect(mocks.batch.commit).toHaveBeenCalledOnce();
  });

  it("rejects attempts to migrate a chat owned by another user", async () => {
    const oldChat = { get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ ownerId: "other-user" }) }) };
    const fascicolo = { get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ ownerId: "u1" }) }) };
    mocks.db.collection.mockImplementation((name: string) => ({ doc: () => name === "chats" ? oldChat : fascicolo }));
    await expect(migrateChatToFascicolo({
      uid: "u1", oldChatId: "chat-1", newFascicoloId: "case-1",
    })).rejects.toThrow("Accesso alla chat sorgente negato.");
    expect(mocks.db.batch).not.toHaveBeenCalled();
  });

  it("rejects missing migration chats and destination fascicoli owned by someone else", async () => {
    const absentChat = { get: vi.fn().mockResolvedValue({ exists: false }) };
    const ownedChat = { get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ ownerId: "u1", title: "Chat" }) }) };
    const foreignFascicolo = { get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ ownerId: "u2" }) }) };
    mocks.db.collection.mockImplementation((name: string) => ({ doc: () => name === "chats" ? absentChat : foreignFascicolo }));
    await expect(migrateChatToFascicolo({ uid: "u1", oldChatId: "absent", newFascicoloId: "case" }))
      .rejects.toThrow("Chat sorgente non trovata.");
    mocks.db.collection.mockImplementation((name: string) => ({ doc: () => name === "chats" ? ownedChat : foreignFascicolo }));
    await expect(migrateChatToFascicolo({ uid: "u1", oldChatId: "chat", newFascicoloId: "case" }))
      .rejects.toThrow("Accesso al fascicolo destinazione negato.");
  });

  it("propagates failures while associating fascicolo document chunks", async () => {
    const documents = { doc: vi.fn(() => ({ id: "document" })) };
    const chunks = { where: vi.fn().mockReturnThis(), get: vi.fn().mockRejectedValue(new Error("query failed")) };
    mocks.db.collection.mockImplementation((name: string) => name === "documents" ? documents : chunks);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(processFascicoloDocs("case-1", ["document"])).rejects.toThrow("query failed");
    expect(error).toHaveBeenCalledOnce();
  });
});
