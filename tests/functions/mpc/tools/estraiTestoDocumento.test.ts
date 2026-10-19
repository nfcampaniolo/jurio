import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ mcpFetch: vi.fn() }));
vi.mock("@functions/mpc/utils/mcpFetch", () => ({ mcpFetch: mocks.mcpFetch }));

import { JURIO_EXTRACT_TEXT_URL } from "@functions/mpc/constants";
import { registerEstraiTestoDocumento } from "@functions/mpc/tools/estraiTestoDocumento";

function setup() {
  const handler = vi.fn();
  const server = { registerTool: vi.fn((_name: string, _config: unknown, callback: typeof handler) => handler.mockImplementation(callback)) };
  registerEstraiTestoDocumento(server as never, "Bearer test");
  return { handler, server };
}

describe("registerEstraiTestoDocumento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers the extraction tool and requests the PDF corresponding to a valid document URL", async () => {
    const { handler, server } = setup();
    mocks.mcpFetch.mockResolvedValue({ data: { pages: 3, text: "Testo estratto" } });

    const result = await handler({ url: "https://jurio.it/giurisprudenza/a-123_X" });

    expect(server.registerTool).toHaveBeenCalledWith("estraiTestoDocumento", expect.any(Object), expect.any(Function));
    expect(mocks.mcpFetch).toHaveBeenCalledWith(JURIO_EXTRACT_TEXT_URL, "Bearer test", {
      storagePath: "sentences/a-123_X.pdf",
    });
    expect(result.content[0].text).toBe("ESTRAZIONE COMPLETATA (Pagine: 3)\n\nTesto estratto");
  });

  it("rejects URLs that do not contain a Jurio judgment id without calling the backend", async () => {
    const { handler } = setup();

    const result = await handler({ url: "https://jurio.it/documenti/123" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Impossibile estrarre l'ID");
    expect(mocks.mcpFetch).not.toHaveBeenCalled();
  });

  it("propagates the backend error result", async () => {
    const { handler } = setup();
    mocks.mcpFetch.mockResolvedValue({ errorText: "Backend down", isError: true });

    const result = await handler({ url: "https://jurio.it/giurisprudenza/123" });

    expect(result).toEqual({ content: [{ type: "text", text: "Backend down" }], isError: true });
  });

  it("uses empty extraction defaults when optional response data is absent", async () => {
    const { handler } = setup();
    mocks.mcpFetch.mockResolvedValue({});

    const result = await handler({ url: "https://jurio.it/giurisprudenza/123" });

    expect(result.content[0].text).toBe("ESTRAZIONE COMPLETATA (Pagine: 0)\n\n");
  });
});
