import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  translateRiferimento: vi.fn(),
  getDb: vi.fn(),
  verifyPlanAndLimits: vi.fn(),
  formatDocument: vi.fn((doc: { id?: string }) => `formatted:${doc.id}`),
  query: {
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue({ empty: false, docs: [{ id: "s-1", data: () => ({ massima: "principio" }) }] }),
  },
}));
vi.mock("@functions/_riferimenti_normativi", () => ({ translateRiferimento: mocks.translateRiferimento }));
vi.mock("@functions/_deps", () => ({ getDb: mocks.getDb }));
vi.mock("@functions/mpc/helpers", () => ({
  verifyPlanAndLimits: mocks.verifyPlanAndLimits,
  formatDocument: mocks.formatDocument,
}));

import { registerRicercaNormativa } from "@functions/mpc/tools/ricercaNormativa";

function setup() {
  const handler = vi.fn();
  const server = { registerTool: vi.fn((_name: string, _config: unknown, callback: typeof handler) => handler.mockImplementation(callback)) };
  registerRicercaNormativa(server as never, "Bearer auth");
  return { handler, server };
}

describe("registerRicercaNormativa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyPlanAndLimits.mockResolvedValue({ ok: true, isError: false, text: "ok" });
    mocks.translateRiferimento.mockReturnValue({ key: "codice:2051" });
    mocks.query.where.mockReturnThis();
    mocks.query.limit.mockReturnThis();
    mocks.query.get.mockResolvedValue({ empty: false, docs: [{ id: "s-1", data: () => ({ massima: "principio" }) }] });
    mocks.getDb.mockReturnValue({ collection: vi.fn().mockReturnValue(mocks.query) });
  });

  it("searches a translated reference using the requested bounded limit", async () => {
    const { handler, server } = setup();

    const result = await handler({ riferimento: "art. 2051 c.c.", limit: 8 });

    expect(server.registerTool).toHaveBeenCalledWith("ricercaNormativa", expect.any(Object), expect.any(Function));
    expect(mocks.translateRiferimento).toHaveBeenCalledWith("art. 2051 c.c.");
    expect(mocks.query.where).toHaveBeenCalledWith("riferimenti_normativi_key", "array-contains", "codice:2051");
    expect(mocks.query.limit).toHaveBeenCalledWith(8);
    expect(result.content[0].text).toBe("formatted:s-1");
  });

  it("stops when authorization fails and reports unparseable references", async () => {
    const { handler } = setup();
    mocks.verifyPlanAndLimits.mockResolvedValueOnce({ ok: false, isError: true, text: "not authorized" });

    const denied = await handler({ riferimento: "art. 2051 c.c." });
    expect(denied).toEqual({ content: [{ type: "text", text: "not authorized" }], isError: true });
    expect(mocks.translateRiferimento).not.toHaveBeenCalled();

    mocks.translateRiferimento.mockReturnValueOnce({ key: "" });
    const invalid = await handler({ riferimento: "???" });
    expect(invalid.isError).toBe(true);
    expect(invalid.content[0].text).toContain("Impossibile interpretare");
  });

  it("uses default/capped limits and returns an empty-result response", async () => {
    const { handler } = setup();
    mocks.query.get.mockResolvedValue({ empty: true, docs: [] });

    const empty = await handler({ riferimento: "art. 2051 c.c." });
    await handler({ riferimento: "art. 2051 c.c.", limit: 50 });

    expect(empty.content[0].text).toContain("Nessun precedente trovato");
    expect(mocks.query.limit).toHaveBeenNthCalledWith(1, 10);
    expect(mocks.query.limit).toHaveBeenNthCalledWith(2, 20);
  });

  it("converts Firestore failures into an error response", async () => {
    const { handler } = setup();
    mocks.query.get.mockRejectedValue(new Error("Firestore unavailable"));

    const result = await handler({ riferimento: "art. 2051 c.c." });

    expect(result).toMatchObject({ isError: true });
    expect(result.content[0].text).toContain("Errore Firestore: Firestore unavailable");
  });
});
