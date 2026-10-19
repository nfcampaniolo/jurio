import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  verifyPlanAndLimits: vi.fn(),
}));
vi.mock("@functions/_deps", () => ({ getDb: mocks.getDb }));
vi.mock("@functions/mpc/helpers", () => ({ verifyPlanAndLimits: mocks.verifyPlanAndLimits }));

import { registerGetPromptList } from "@functions/mpc/tools/ricercaPrompt";

function setup() {
  const handler = vi.fn();
  const server = { registerTool: vi.fn((_name: string, _config: unknown, callback: typeof handler) => handler.mockImplementation(callback)) };
  registerGetPromptList(server as never, "Bearer prompt");
  return { handler, server };
}

function dbWithSnapshot(snapshot: unknown) {
  const query = { where: vi.fn().mockReturnThis(), get: vi.fn().mockResolvedValue(snapshot) };
  const db = { collection: vi.fn().mockReturnValue(query) };
  mocks.getDb.mockReturnValue(db);
  return { db, query };
}

describe("registerGetPromptList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyPlanAndLimits.mockResolvedValue({ ok: true, isError: false, text: "ok" });
  });

  it("registers the prompt tool, applies an optional type filter, and formats documents", async () => {
    const date = new Date("2025-03-01T00:00:00Z");
    const { handler, server } = setup();
    const { query } = dbWithSnapshot({
      empty: false,
      docs: [{
        id: "prompt-1",
        data: () => ({
          title: "Analisi", type: "analisi", objective: "Obiettivo", content: "Istruzioni",
          schema: "{ dato: string }", createdAt: { toDate: () => date },
        }),
      }],
    });

    const result = await handler({ type: "analisi" });

    expect(server.registerTool).toHaveBeenCalledWith("getPromptList", expect.any(Object), expect.any(Function));
    expect(query.where).toHaveBeenCalledWith("type", "==", "analisi");
    expect(result.content[0].text).toContain("PROMPT DISPONIBILI NELLA COLLEZIONE 'prompt_list' (1 trovati)");
    expect(result.content[0].text).toContain("PROMPT: Analisi");
    expect(result.content[0].text).toContain("Obiettivo");
    expect(result.content[0].text).toContain("Istruzioni");
  });

  it("does not query prompts when authorization fails", async () => {
    const { handler } = setup();
    mocks.verifyPlanAndLimits.mockResolvedValue({ ok: false, isError: true, text: "denied" });
    dbWithSnapshot({ empty: true, docs: [] });

    const result = await handler({});

    expect(result).toEqual({ content: [{ type: "text", text: "denied" }], isError: true });
    expect(mocks.getDb.mock.results[0].value.collection).not.toHaveBeenCalled();
  });

  it("reports no prompts, including a filtered no-match message", async () => {
    const { handler } = setup();
    dbWithSnapshot({ empty: true, docs: [] });

    const filtered = await handler({ type: "analisi" });
    expect(filtered.content[0].text).toContain("per il tipo 'analisi'");

    dbWithSnapshot({ empty: true, docs: [] });
    const all = await handler({});
    expect(all.content[0].text).toBe("Nessun prompt trovato nella collezione 'prompt_list'.");
  });

  it("uses safe defaults and reports Firestore errors", async () => {
    const { handler } = setup();
    const { query } = dbWithSnapshot({
      empty: false,
      docs: [{ id: "defaulted", data: () => ({ createdAt: "raw-date" }) }],
    });
    const result = await handler({});
    expect(query.where).not.toHaveBeenCalled();
    expect(result.content[0].text).toContain("PROMPT: Senza titolo");

    const { query: failingQuery } = dbWithSnapshot({ empty: false, docs: [] });
    failingQuery.get.mockRejectedValue(new Error("read failed"));
    const error = await handler({});
    expect(error).toMatchObject({ isError: true });
    expect(error.content[0].text).toContain("Errore nel recupero della lista prompt: read failed");
  });
});
