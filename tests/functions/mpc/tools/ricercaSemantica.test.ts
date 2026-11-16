import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ mcpFetch: vi.fn(), formatDocument: vi.fn((doc: { id?: string }) => `formatted:${doc.id}`) }));
vi.mock("@functions/mpc/utils/mcpFetch", () => ({ mcpFetch: mocks.mcpFetch }));
vi.mock("@functions/mpc/helpers", () => ({ formatDocument: mocks.formatDocument }));

import { JURIO_VECTOR_SEARCH_URL } from "@functions/mpc/constants";
import { registerRicercaSemantica } from "@functions/mpc/tools/ricercaSemantica";

function setup() {
  const handler = vi.fn();
  const server = { registerTool: vi.fn((_name: string, _config: unknown, callback: typeof handler) => handler.mockImplementation(callback)) };
  registerRicercaSemantica(server as never, "Bearer search-token");
  return { handler, server };
}

describe("registerRicercaSemantica", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers and executes semantic search with the supplied query and limit", async () => {
    const { handler, server } = setup();
    mocks.mcpFetch.mockResolvedValue({ data: { topMatches: [{ id: "one" }, { id: "two" }] } });

    const result = await handler({ query: "caduta e responsabilità civile", limit: 4 });

    expect(server.registerTool).toHaveBeenCalledWith("ricercaSemantica", expect.any(Object), expect.any(Function));
    expect(mocks.mcpFetch).toHaveBeenCalledWith(
      JURIO_VECTOR_SEARCH_URL,
      "Bearer search-token",
      { query: "caduta e responsabilità civile", limit: 4 }
    );
    expect(result.content[0].text).toBe(
      "Trovati 2 risultati sopra la soglia di pertinenza (richiesti: 4).\n\nformatted:one\n\n---\n\nformatted:two"
    );
  });

  it("omits the header when the requested number of results is reached and fills with partial matches", async () => {
    const { handler } = setup();
    mocks.mcpFetch.mockResolvedValue({
      data: { topMatches: [{ id: "one" }, { id: "two" }], allMatches: [{ id: "three" }, { id: "four" }] },
    });

    const result = await handler({ query: "caduta pedone dislivello marciapiede", limit: 3 });

    const blocks = result.content[0].text.split("\n\n---\n\n");
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toBe("formatted:one");
    expect(blocks[2]).toContain("formatted:three");
    expect(blocks[2]).toContain("PERTINENZA: parziale");
    expect(result.content[0].text).not.toContain("Trovati");
  });

  it("uses the default limit and caps an oversized direct invocation", async () => {
    const { handler } = setup();
    mocks.mcpFetch.mockResolvedValue({ data: { topMatches: [] } });

    await handler({ query: "query sufficientemente lunga" });
    await handler({ query: "query sufficientemente lunga", limit: 100 });

    expect(mocks.mcpFetch).toHaveBeenNthCalledWith(1, JURIO_VECTOR_SEARCH_URL, "Bearer search-token", {
      query: "query sufficientemente lunga", limit: 10,
    });
    expect(mocks.mcpFetch).toHaveBeenNthCalledWith(2, JURIO_VECTOR_SEARCH_URL, "Bearer search-token", {
      query: "query sufficientemente lunga", limit: 15,
    });
  });

  it("returns backend errors and the empty-results message", async () => {
    const { handler } = setup();
    mocks.mcpFetch.mockResolvedValueOnce({ errorText: "No access", isError: false });
    const error = await handler({ query: "questione di diritto" });
    expect(error).toEqual({ content: [{ type: "text", text: "No access" }], isError: false });

    mocks.mcpFetch.mockResolvedValueOnce({ data: { topMatches: [] } });
    const empty = await handler({ query: "questione di diritto" });
    expect(empty.content[0].text).toContain("Nessuna sentenza pertinente");
  });

  it("sends the sezione filter to the backend and mentions it when nothing is found", async () => {
    const { handler } = setup();
    mocks.mcpFetch.mockResolvedValue({ data: { topMatches: [] } });

    const result = await handler({ query: "colpa medica nesso causale", sezione: "QUARTA SEZIONE PENALE" });

    expect(mocks.mcpFetch).toHaveBeenCalledWith(JURIO_VECTOR_SEARCH_URL, "Bearer search-token", {
      query: "colpa medica nesso causale",
      limit: 10,
      filters: [{ field: "sezione", operator: "==", value: "QUARTA SEZIONE PENALE" }],
    });
    expect(result.content[0].text).toContain("sezione = QUARTA SEZIONE PENALE");
    expect(result.content[0].text).toContain("senza filtro");
  });

  it("exposes the section legend with exact uppercase values in the input schema", () => {
    const { server } = setup();
    const config = server.registerTool.mock.calls[0][1] as {
      inputSchema: { sezione: { description: string; safeParse: (v: unknown) => { success: boolean } } };
    };
    const accepts = (v: unknown) => config.inputSchema.sezione.safeParse(v).success;

    expect(accepts("PRIMA SEZIONE CIVILE")).toBe(true);
    expect(accepts("SEZIONE VII")).toBe(true);
    expect(accepts("SEZIONE FERIALE PENALE")).toBe(true);
    expect(accepts(undefined)).toBe(true);
    expect(accepts("PLENARIA")).toBe(true);
    expect(accepts("ADUNANZA PLENARIA")).toBe(false);
    expect(config.inputSchema.sezione.description).toContain("- SEZIONE V: appalti e contratti pubblici");
    expect(accepts("Prima Sezione Civile")).toBe(false);
  });
});
