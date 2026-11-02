import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mcpFetch: vi.fn(),
}));

vi.mock("@functions/mpc/utils/mcpFetch", () => ({ mcpFetch: mocks.mcpFetch }));

import { JURIO_EXTRACT_TEXT_URL } from "@functions/mpc/constants";
import { registerEstraiTestoDocumento } from "@functions/mpc/tools/estraiTestoDocumento";

function setup() {
  const handler = vi.fn();
  const server = {
    registerTool: vi.fn((_name: string, _config: unknown, callback: typeof handler) =>
      handler.mockImplementation(callback)
    ),
  };

  registerEstraiTestoDocumento(server as never, "Bearer extract-token");
  return { handler, server };
}

describe("registerEstraiTestoDocumento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mcpFetch.mockResolvedValue({ data: { pages: 12, text: "testo estratto" } });
  });

  it("registers tool and extracts text from a valid giudizio URL", async () => {
    const { handler, server } = setup();

    const result = await handler({
      url: "https://jurio.it/giurisprudenza/8c0893ca-5a7a-471a-9ed0-128ab34d0bfa",
    });

    expect(server.registerTool).toHaveBeenCalledWith(
      "estraiTestoDocumento",
      expect.any(Object),
      expect.any(Function)
    );

    expect(mocks.mcpFetch).toHaveBeenCalledWith(
      JURIO_EXTRACT_TEXT_URL,
      "Bearer extract-token",
      { storagePath: "sentences/8c0893ca-5a7a-471a-9ed0-128ab34d0bfa.pdf" }
    );

    expect(result.content[0].text).toContain("ESTRAZIONE COMPLETATA (Pagine: 12)");
    expect(result.content[0].text).toContain("testo estratto");
  });

  it("returns an error when URL does not include a valid document id", async () => {
    const { handler } = setup();

    const result = await handler({ url: "https://jurio.it/documenti/qualcosa" });

    expect(result).toMatchObject({ isError: true });
    expect(result.content[0].text).toContain("Impossibile estrarre l'ID del documento");
    expect(mocks.mcpFetch).not.toHaveBeenCalled();
  });

  it("does not block extraction for italgiure sources", async () => {
    const { handler } = setup();

    const result = await handler({ url: "https://jurio.it/giurisprudenza/abc123" });

    expect(mocks.mcpFetch).toHaveBeenCalledWith(
      JURIO_EXTRACT_TEXT_URL,
      "Bearer extract-token",
      { storagePath: "sentences/abc123.pdf" }
    );
    expect(result.content[0].text).toContain("ESTRAZIONE COMPLETATA");
  });

  it("returns backend error payload when extraction endpoint fails", async () => {
    const { handler } = setup();
    mocks.mcpFetch.mockResolvedValueOnce({ errorText: "Token OAuth non valido", isError: true });

    const result = await handler({ url: "https://jurio.it/giurisprudenza/abc123" });

    expect(result).toEqual({
      content: [{ type: "text", text: "Token OAuth non valido" }],
      isError: true,
    });
  });

});
