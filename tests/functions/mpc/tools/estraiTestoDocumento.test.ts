import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mcpFetch: vi.fn(),
}));

vi.mock("@functions/mpc/utils/mcpFetch", () => ({ mcpFetch: mocks.mcpFetch }));

import { JURIO_EXTRACT_TEXT_URL } from "@functions/mpc/constants";
import { MAX_CHARS_PER_PARTE, registerEstraiTestoDocumento, splitInParti } from "@functions/mpc/tools/estraiTestoDocumento";

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

  it("splits long documents into parts and returns the requested one", async () => {
    const { handler } = setup();
    const paragraph = "Lorem ipsum dolor sit amet. ".repeat(100) + "\n\n";
    const longText = paragraph.repeat(Math.ceil((MAX_CHARS_PER_PARTE * 2.5) / paragraph.length));
    mocks.mcpFetch.mockResolvedValue({ data: { pages: 40, text: longText } });

    const first = await handler({ url: "https://jurio.it/giurisprudenza/abc123" });
    expect(first.content[0].text).toMatch(/Parte 1 di 3/);
    expect(first.content[0].text).toContain("parte: 2");
    expect(first.content[0].text.length).toBeLessThan(MAX_CHARS_PER_PARTE + 500);

    const last = await handler({ url: "https://jurio.it/giurisprudenza/abc123", parte: 3 });
    expect(last.content[0].text).toMatch(/Parte 3 di 3 — fine del documento/);
    expect(last.content[0].text).not.toContain("[Continua");

    const outOfRange = await handler({ url: "https://jurio.it/giurisprudenza/abc123", parte: 4 });
    expect(outOfRange.isError).toBe(true);
    expect(outOfRange.content[0].text).toBe("La parte richiesta non esiste. Il documento ha 3 parti.");
  });

  it("splitInParti preserves all content and prefers paragraph boundaries", () => {
    const text = ("a".repeat(70) + "\n\n").repeat(10);
    const parti = splitInParti(text, 100);
    expect(parti.every((p) => p.length <= 100)).toBe(true);
    expect(parti.join("").replace(/\s/g, "")).toBe(text.replace(/\s/g, ""));
    expect(splitInParti("")).toEqual([""]);
  });
  it("masks personal names in the extracted text and says so", async () => {
    const { handler } = setup();
    mocks.mcpFetch.mockResolvedValue({
      data: { pages: 2, text: "ricorso proposto da: BIANCHI LUIGI, rappresentato dall'avvocato Mario Verdi." },
    });

    const result = await handler({ url: "https://jurio.it/giurisprudenza/abc123" });

    expect(result.content[0].text).not.toMatch(/BIANCHI|LUIGI|Verdi/);
    expect(result.content[0].text).toContain("[omissis]");
    expect(result.content[0].text).toContain("mascherati automaticamente");
  });
  it("declares 'parte' as an optional integer >= 1 and coerces numeric strings", () => {
    const { server } = setup();
    type FieldSchema = { parse: (v: unknown) => unknown; safeParse: (v: unknown) => { success: boolean } };
    const config = server.registerTool.mock.calls[0][1] as {
      inputSchema: { parte: FieldSchema };
      description: string;
    };
    const parte = config.inputSchema.parte;

    expect(parte.parse(undefined)).toBe(1);
    expect(parte.parse(2)).toBe(2);
    expect(parte.parse("2")).toBe(2);
    expect(parte.safeParse("0").success).toBe(false);
    expect(parte.safeParse("1.5").success).toBe(false);
    expect(parte.safeParse("due").success).toBe(false);
    expect(config.description).toContain("'parte' = N+1");
  });

  it("keeps every part within the character budget", () => {
    const sentence = "La Corte rileva che il motivo è infondato. ";
    const parti = splitInParti(sentence.repeat(Math.ceil(157_608 / sentence.length)));
    expect(parti.length).toBeGreaterThanOrEqual(6);
    expect(Math.max(...parti.map((p) => p.length))).toBeLessThanOrEqual(30_000);
  });
});
