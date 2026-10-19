import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  verifyPlanAndLimits: vi.fn(),
  findBySottocategoriaAdmin: vi.fn(),
  formatDocument: vi.fn((doc: { id?: string }) => `formatted:${doc.id}`),
}));
vi.mock("@functions/_deps", () => ({ getDb: mocks.getDb }));
vi.mock("@functions/mpc/helpers", () => ({
  verifyPlanAndLimits: mocks.verifyPlanAndLimits,
  findBySottocategoriaAdmin: mocks.findBySottocategoriaAdmin,
  formatDocument: mocks.formatDocument,
}));

import { registerRicercaPerMateria } from "@functions/mpc/tools/ricercaPerMateria";

function setup() {
  const handler = vi.fn();
  const server = { registerTool: vi.fn((_name: string, _config: unknown, callback: typeof handler) => handler.mockImplementation(callback)) };
  registerRicercaPerMateria(server as never, "Bearer auth");
  return { handler, server };
}

describe("registerRicercaPerMateria", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockReturnValue({});
    mocks.verifyPlanAndLimits.mockResolvedValue({ ok: true, isError: false, text: "ok" });
    mocks.findBySottocategoriaAdmin.mockResolvedValue([{ id: "one" }, { id: "two" }]);
  });

  it("registers and searches for the requested matter using its limit", async () => {
    const { handler, server } = setup();

    const result = await handler({ termine: "Diritto Penale", limit: 21 });

    expect(server.registerTool).toHaveBeenCalledWith("ricercaPerMateria", expect.any(Object), expect.any(Function));
    expect(mocks.findBySottocategoriaAdmin).toHaveBeenCalledWith("Diritto Penale", 21, {});
    expect(result.content[0].text).toBe("formatted:one\n\n---\n\nformatted:two");
  });

  it("returns authorization failures without starting a search", async () => {
    const { handler } = setup();
    mocks.verifyPlanAndLimits.mockResolvedValue({ ok: false, isError: false, text: "No plan" });

    const result = await handler({ termine: "civile" });

    expect(result).toEqual({ content: [{ type: "text", text: "No plan" }], isError: false });
    expect(mocks.findBySottocategoriaAdmin).not.toHaveBeenCalled();
  });

  it("uses the default and maximum limits and handles empty results", async () => {
    const { handler } = setup();
    mocks.findBySottocategoriaAdmin.mockResolvedValue([]);

    const empty = await handler({ termine: "bancarotta" });
    await handler({ termine: "bancarotta", limit: 100 });

    expect(empty.content[0].text).toContain("Nessuna giurisprudenza trovata");
    expect(mocks.findBySottocategoriaAdmin).toHaveBeenNthCalledWith(1, "bancarotta", 10, {});
    expect(mocks.findBySottocategoriaAdmin).toHaveBeenNthCalledWith(2, "bancarotta", 50, {});
  });

  it("converts unexpected search failures into an error response", async () => {
    const { handler } = setup();
    mocks.findBySottocategoriaAdmin.mockRejectedValue(new Error("query failed"));

    const result = await handler({ termine: "bancarotta" });

    expect(result).toMatchObject({ isError: true });
    expect(result.content[0].text).toContain("Errore nella ricerca per materia: query failed");
  });
});
