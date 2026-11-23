import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  registerRicercaSemantica: vi.fn(),
  registerdoctrineSearch: vi.fn(),
  registerRicercaNormativa: vi.fn(),
  registerRicercaIdentificativo: vi.fn(),
  registerRicercaPerMateria: vi.fn(),
  registerGetPromptList: vi.fn(),
  registerEstraiTestoDocumento: vi.fn(),
}));

vi.mock("@functions/mpc/tools/ricercaSemantica", () => ({ registerRicercaSemantica: mocks.registerRicercaSemantica }));
vi.mock("@functions/mpc/tools/ricercaDottrina", () => ({ registerdoctrineSearch: mocks.registerdoctrineSearch }));
vi.mock("@functions/mpc/tools/ricercaNormativa", () => ({ registerRicercaNormativa: mocks.registerRicercaNormativa }));
vi.mock("@functions/mpc/tools/ricercaIdentificativo", () => ({ registerRicercaIdentificativo: mocks.registerRicercaIdentificativo }));
vi.mock("@functions/mpc/tools/ricercaPerMateria", () => ({ registerRicercaPerMateria: mocks.registerRicercaPerMateria }));
vi.mock("@functions/mpc/tools/ricercaPrompt", () => ({ registerGetPromptList: mocks.registerGetPromptList }));
vi.mock("@functions/mpc/tools/estraiTestoDocumento", () => ({ registerEstraiTestoDocumento: mocks.registerEstraiTestoDocumento }));

describe("createMcpServer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("constructs and returns an MCP server while registering each tool with the provided auth header", async () => {
    const { createMcpServer } = await import("@functions/mpc/server");
    const authHeader = "Bearer user-token";

    const result = createMcpServer(authHeader);

    expect(typeof result.connect).toBe("function");
    expect(mocks.registerRicercaSemantica).toHaveBeenCalledWith(expect.any(Object), authHeader);
    expect(mocks.registerdoctrineSearch).toHaveBeenCalledWith(expect.any(Object), authHeader);
    expect(mocks.registerRicercaNormativa).toHaveBeenCalledWith(expect.any(Object), authHeader);
    expect(mocks.registerRicercaIdentificativo).toHaveBeenCalledWith(expect.any(Object), authHeader);
    expect(mocks.registerRicercaPerMateria).toHaveBeenCalledWith(expect.any(Object), authHeader);
    expect(mocks.registerGetPromptList).toHaveBeenCalledWith(expect.any(Object), authHeader);
    expect(mocks.registerEstraiTestoDocumento).toHaveBeenCalledWith(expect.any(Object), authHeader);
  });
});

describe("createMcpServer usage tracking", () => {
  const recordMcpToolCall = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.doMock("@functions/mpc/usage", () => ({ recordMcpToolCall }));
    recordMcpToolCall.mockResolvedValue(undefined);
  });

  async function registerAndGetWrapped(cb: (...args: unknown[]) => unknown) {
    const { createMcpServer } = await import("@functions/mpc/server");
    mocks.registerRicercaSemantica.mockImplementationOnce((server: { registerTool: (...a: unknown[]) => unknown }) => {
      server.registerTool("ricercaSemantica", { description: "x" }, cb);
    });
    const server = createMcpServer("Bearer t", { uid: "user-1", client: "claude" });
    const registered = (server as unknown as { _registeredTools: Record<string, { handler?: (...a: unknown[]) => unknown; callback?: (...a: unknown[]) => unknown }> })._registeredTools.ricercaSemantica;
    return (registered.handler ?? registered.callback)!;
  }

  it("records successful and isError tool results", async () => {
    const ok = await registerAndGetWrapped(async () => ({ content: [] }));
    await expect(ok({ query: "q" }, {})).resolves.toEqual({ content: [] });
    expect(recordMcpToolCall).toHaveBeenLastCalledWith(expect.objectContaining({
      uid: "user-1", client: "claude", tool: "ricercaSemantica", ok: true, durationMs: expect.any(Number),
    }));

    const failed = await registerAndGetWrapped(async () => ({ content: [], isError: true }));
    await failed({}, {});
    expect(recordMcpToolCall).toHaveBeenLastCalledWith(expect.objectContaining({ ok: false }));
  });

  it("records thrown errors and rethrows them", async () => {
    const throwing = await registerAndGetWrapped(async () => { throw new Error("boom"); });
    await expect(throwing({}, {})).rejects.toThrow("boom");
    expect(recordMcpToolCall).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  it("does not instrument tools without a usage context", async () => {
    const { createMcpServer } = await import("@functions/mpc/server");
    createMcpServer("Bearer t");
    expect(recordMcpToolCall).not.toHaveBeenCalled();
  });
});
