import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mcpFetch: vi.fn(),
  formatDoctrineDocument: vi.fn((doc: { tematica?: string }) => `formatted:${doc.tematica}`),
}));
vi.mock("@functions/mpc/utils/mcpFetch", () => ({ mcpFetch: mocks.mcpFetch }));
vi.mock("@functions/mpc/helpers", () => ({ formatDoctrineDocument: mocks.formatDoctrineDocument }));

import { JURIO_DOCTRINE_SEARCH_URL } from "@functions/mpc/constants";
import { registerdoctrineSearch } from "@functions/mpc/tools/ricercaDottrina";

function setup() {
  const handler = vi.fn();
  const server = { registerTool: vi.fn((_name: string, _config: unknown, callback: typeof handler) => handler.mockImplementation(callback)) };
  registerdoctrineSearch(server as never, "Bearer doctrine");
  return { handler, server };
}

describe("registerdoctrineSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers and searches doctrine with query and requested result count", async () => {
    const { handler, server } = setup();
    mocks.mcpFetch.mockResolvedValue({ data: { results: [{ tematica: "contratto" }] } });

    const result = await handler({ query: "risoluzione del contratto", limit: 7 });

    expect(server.registerTool).toHaveBeenCalledWith("doctrineSearch", expect.any(Object), expect.any(Function));
    expect(mocks.mcpFetch).toHaveBeenCalledWith(JURIO_DOCTRINE_SEARCH_URL, "Bearer doctrine", {
      query: "risoluzione del contratto", limit: 7,
    });
    expect(result.content[0].text).toBe("formatted:contratto");
  });

  it("uses a default limit, caps excessive limits, and handles no matches", async () => {
    const { handler } = setup();
    mocks.mcpFetch.mockResolvedValue({ data: { results: [] } });

    const empty = await handler({ query: "domanda di diritto" });
    await handler({ query: "domanda di diritto", limit: 80 });

    expect(empty.content[0].text).toContain("Nessun approfondimento dottrinale");
    expect(mocks.mcpFetch).toHaveBeenNthCalledWith(1, JURIO_DOCTRINE_SEARCH_URL, "Bearer doctrine", {
      query: "domanda di diritto", limit: 5,
    });
    expect(mocks.mcpFetch).toHaveBeenNthCalledWith(2, JURIO_DOCTRINE_SEARCH_URL, "Bearer doctrine", {
      query: "domanda di diritto", limit: 10,
    });
  });

  it("returns backend errors without formatting result data", async () => {
    const { handler } = setup();
    mocks.mcpFetch.mockResolvedValue({ errorText: "Rate limited", isError: false });

    const result = await handler({ query: "domanda complessa" });

    expect(result).toEqual({ content: [{ type: "text", text: "Rate limited" }], isError: false });
    expect(mocks.formatDoctrineDocument).not.toHaveBeenCalled();
  });
});
