import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  registerRicercaSemantica: vi.fn(),
  registerdoctrineSearch: vi.fn(),
  registerRicercaNormativa: vi.fn(),
  registerRicercaIdentificativo: vi.fn(),
  registerRicercaPerMateria: vi.fn(),
  registerEstraiTestoDocumento: vi.fn(),
  registerGetPromptList: vi.fn(),
}));

vi.mock("@functions/mpc/tools/ricercaSemantica", () => ({ registerRicercaSemantica: mocks.registerRicercaSemantica }));
vi.mock("@functions/mpc/tools/ricercaDottrina", () => ({ registerdoctrineSearch: mocks.registerdoctrineSearch }));
vi.mock("@functions/mpc/tools/ricercaNormativa", () => ({ registerRicercaNormativa: mocks.registerRicercaNormativa }));
vi.mock("@functions/mpc/tools/ricercaIdentificativo", () => ({ registerRicercaIdentificativo: mocks.registerRicercaIdentificativo }));
vi.mock("@functions/mpc/tools/ricercaPerMateria", () => ({ registerRicercaPerMateria: mocks.registerRicercaPerMateria }));
vi.mock("@functions/mpc/tools/estraiTestoDocumento", () => ({ registerEstraiTestoDocumento: mocks.registerEstraiTestoDocumento }));
vi.mock("@functions/mpc/tools/ricercaPrompt", () => ({ registerGetPromptList: mocks.registerGetPromptList }));

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
    expect(mocks.registerEstraiTestoDocumento).toHaveBeenCalledWith(expect.any(Object), authHeader);
    expect(mocks.registerGetPromptList).toHaveBeenCalledWith(expect.any(Object), authHeader);
  });
});
