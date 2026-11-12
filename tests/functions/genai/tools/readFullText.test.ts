import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const docGet = vi.fn();
  const queryGet = vi.fn();
  const query = { where: vi.fn(), limit: vi.fn(), get: queryGet };
  query.where.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  const collection = vi.fn(() => ({ doc: vi.fn(() => ({ get: docGet })), where: query.where }));
  return {
    docGet, queryGet, query, db: { collection },
    validate: vi.fn(), extract: vi.fn(), logError: vi.fn(),
  };
});

vi.mock("@functions/genai/_config", () => ({
  ai: { defineTool: (_config: unknown, handler: unknown) => handler },
  CFG: { maxChars: { fullText: 20 } },
}));
vi.mock("@functions/_deps", () => ({ getDb: () => mocks.db }));
vi.mock("@functions/_utils", () => ({ validateUserPlanAndLimits: mocks.validate }));
vi.mock("@functions/_logging", () => ({ logSafeError: mocks.logError }));
vi.mock("@functions/support/pdfText", () => ({ extractPdfTextFromStorage: mocks.extract }));

import { readFullText, resolveSentenceId } from "@functions/genai/tools/readFullText";

interface ToolResult {
  message?: string;
  error?: string;
  truncated?: boolean;
  fullText?: string;
  [key: string]: unknown;
}
const handler = readFullText as unknown as (input: unknown, options?: unknown) => Promise<ToolResult>;
const ctx = { context: { userId: "u1" } };
const sentence = (id: string) => ({
  id, exists: true,
  data: () => ({ numero_sentenza: "12/2024", organo_giudicante: "Cassazione", sourceUrl: "https://court.test" }),
});

describe("readFullText tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.where.mockReturnValue(mocks.query);
    mocks.query.limit.mockReturnValue(mocks.query);
    mocks.validate.mockResolvedValue(undefined);
    mocks.extract.mockResolvedValue({ text: "testo breve", pages: 3 });
  });

  it("resolves ids from raw values and Jurio URLs", () => {
    expect(resolveSentenceId("abc-123")).toBe("abc-123");
    expect(resolveSentenceId("https://jurio.it/giurisprudenza/abc_1")).toBe("abc_1");
    expect(resolveSentenceId("../etc/passwd")).toBeNull();
    expect(resolveSentenceId("")).toBeNull();
  });

  it("requires authentication and an identifier", async () => {
    await expect(handler({ identifier: "abc" }, { context: {} })).resolves.toEqual({ error: "Autenticazione mancante." });
    await expect(handler({ identifier: "  " }, ctx)).resolves.toEqual(expect.objectContaining({ message: expect.stringContaining("identificativo") }));
    expect(mocks.extract).not.toHaveBeenCalled();
  });

  it("reads the full text by document id and checks the extract_document quota", async () => {
    mocks.docGet.mockResolvedValue(sentence("abc"));
    const result = await handler({ identifier: "https://jurio.it/giurisprudenza/abc" }, ctx);
    expect(mocks.validate).toHaveBeenCalledWith("u1", "extract_document");
    expect(mocks.extract).toHaveBeenCalledWith("sentences/abc.pdf");
    expect(result).toEqual(expect.objectContaining({
      id: "abc", caseNumber: "12/2024", court: "Cassazione", pages: 3, truncated: false,
      fullText: "testo breve", _type: "giurisprudenza_puntuale",
    }));
  });

  it("falls back to case-number lookup and truncates long texts", async () => {
    mocks.queryGet.mockResolvedValueOnce({ empty: false, docs: [sentence("xyz")] });
    mocks.extract.mockResolvedValue({ text: "a".repeat(50), pages: 1 });
    const result = await handler({ identifier: "n. 12 / 2024" }, ctx);
    expect(mocks.query.where).toHaveBeenCalledWith("numero_sentenza", "==", "12/2024");
    expect(result.truncated).toBe(true);
    expect(result.fullText?.startsWith("a".repeat(20))).toBe(true);
    expect(result.fullText).toContain("testo troncato");
  });

  it("reports missing decisions without consuming quota", async () => {
    mocks.docGet.mockResolvedValue({ exists: false });
    mocks.queryGet.mockResolvedValue({ empty: true, docs: [] });
    const result = await handler({ identifier: "missing" }, ctx);
    expect(result.message).toContain("Nessun provvedimento trovato");
    expect(mocks.validate).not.toHaveBeenCalled();
  });

  it("maps extraction and quota errors to user-facing messages", async () => {
    mocks.docGet.mockResolvedValue(sentence("abc"));
    mocks.extract.mockRejectedValueOnce(new Error("FILE_NOT_FOUND"));
    expect((await handler({ identifier: "abc" }, ctx)).message).toContain("non è disponibile");
    mocks.validate.mockRejectedValueOnce(new Error("TOO_MANY_REQUESTS"));
    expect((await handler({ identifier: "abc" }, ctx)).error).toContain("Limite di utilizzo");
    mocks.extract.mockRejectedValueOnce(new Error("boom"));
    expect((await handler({ identifier: "abc" }, ctx)).error).toContain("Errore temporaneo");
    expect(mocks.logError).toHaveBeenCalledWith("READ_FULL_TEXT_FAILED", expect.any(Error));
  });
});
