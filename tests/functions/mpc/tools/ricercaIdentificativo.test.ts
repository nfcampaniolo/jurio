import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  verifyPlanAndLimits: vi.fn(),
  findByNumeroSentenzaAdmin: vi.fn(),
  formatDocument: vi.fn((doc: { id?: string }) => `formatted:${doc.id}`),
}));
vi.mock("@functions/_deps", () => ({ getDb: mocks.getDb }));
vi.mock("@functions/mpc/helpers", () => ({
  verifyPlanAndLimits: mocks.verifyPlanAndLimits,
  findByNumeroSentenzaAdmin: mocks.findByNumeroSentenzaAdmin,
  formatDocument: mocks.formatDocument,
}));

import { registerRicercaIdentificativo } from "@functions/mpc/tools/ricercaIdentificativo";

function setup() {
  const handler = vi.fn();
  const server = { registerTool: vi.fn((_name: string, _config: unknown, callback: typeof handler) => handler.mockImplementation(callback)) };
  registerRicercaIdentificativo(server as never, "Bearer auth");
  return { handler, server };
}

describe("registerRicercaIdentificativo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockReturnValue({});
    mocks.verifyPlanAndLimits.mockResolvedValue({ ok: true, isError: false, text: "ok" });
    mocks.findByNumeroSentenzaAdmin.mockResolvedValue([{ id: "case-1" }]);
  });

  it("registers and searches by the provided identifier", async () => {
    const { handler, server } = setup();

    const result = await handler({ identificativo: "123/2026" });

    expect(server.registerTool).toHaveBeenCalledWith("ricercaIdentificativo", expect.any(Object), expect.any(Function));
    expect(mocks.findByNumeroSentenzaAdmin).toHaveBeenCalledWith("123/2026", {});
    expect(result.content[0].text).toBe("formatted:case-1");
  });

  it("returns authorization failures without querying", async () => {
    const { handler } = setup();
    mocks.verifyPlanAndLimits.mockResolvedValue({ ok: false, isError: true, text: "Invalid token" });

    const result = await handler({ identificativo: "123/2026" });

    expect(result).toEqual({ content: [{ type: "text", text: "Invalid token" }], isError: true });
    expect(mocks.findByNumeroSentenzaAdmin).not.toHaveBeenCalled();
  });

  it("handles absent matches and unexpected errors", async () => {
    const { handler } = setup();
    mocks.findByNumeroSentenzaAdmin.mockResolvedValueOnce([]);
    const empty = await handler({ identificativo: "999/2026" });
    expect(empty.content[0].text).toContain("Nessun documento trovato");

    mocks.findByNumeroSentenzaAdmin.mockRejectedValueOnce(new Error("lookup failed"));
    const error = await handler({ identificativo: "999/2026" });
    expect(error).toMatchObject({ isError: true });
    expect(error.content[0].text).toContain("Errore nella ricerca per identificativo: lookup failed");
  });
});
