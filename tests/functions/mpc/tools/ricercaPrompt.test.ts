import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  verifyPlanAndLimits: vi.fn(),
}));
vi.mock("@functions/_deps", () => ({ getDb: mocks.getDb }));
vi.mock("@functions/mpc/helpers", () => ({ verifyPlanAndLimits: mocks.verifyPlanAndLimits }));

import { registerGetPromptList } from "@functions/mpc/tools/ricercaPrompt";

function setup() {
  const handler = vi.fn();
  const server = {
    registerTool: vi.fn((_name: string, _config: unknown, callback: typeof handler) =>
      handler.mockImplementation(callback)
    ),
  };
  registerGetPromptList(server as never, "Bearer prompt");
  return { handler, server };
}

type FakeDoc = { id: string; data: () => Record<string, unknown> };
const fakeDoc = (id: string, data: Record<string, unknown>): FakeDoc => ({ id, data: () => data });

/**
 * Mock di Firestore:
 * - catalogo: collection() -> query con where / select / get
 * - dettaglio: collection().doc(id).get()
 */
function makeDb(
  opts: {
    docs?: FakeDoc[];
    single?: { exists: boolean; id?: string; data?: () => unknown };
  } = {}
) {
  const docGet = vi.fn().mockResolvedValue(opts.single ?? { exists: false, id: "", data: () => undefined });
  const query = {
    where: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue({ docs: opts.docs ?? [] }),
    doc: vi.fn().mockReturnValue({ get: docGet }),
  };
  const db = { collection: vi.fn().mockReturnValue(query) };
  mocks.getDb.mockReturnValue(db);
  return { db, query, docGet };
}

describe("registerGetPromptList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyPlanAndLimits.mockResolvedValue({ ok: true, isError: false, text: "ok" });
  });

  it("registers the tool as read-only with validated id and optional type inputs", () => {
    const { server } = setup();

    expect(server.registerTool).toHaveBeenCalledWith("getPromptList", expect.any(Object), expect.any(Function));

    const config = server.registerTool.mock.calls[0][1] as {
      annotations: { readOnlyHint: boolean };
      inputSchema: {
        id: { safeParse: (value: unknown) => { success: boolean } };
        type: unknown;
      };
    };
    expect(config.annotations.readOnlyHint).toBe(true);
    expect(config.inputSchema.type).toBeDefined();
    expect(config.inputSchema.id.safeParse("prompt-1_A").success).toBe(true);
    expect(config.inputSchema.id.safeParse("a/b").success).toBe(false);
    expect(config.inputSchema.id.safeParse("x".repeat(129)).success).toBe(false);
  });

  it("does not query prompts when authorization fails", async () => {
    const { handler } = setup();
    mocks.verifyPlanAndLimits.mockResolvedValue({ ok: false, isError: true, text: "denied" });
    const { db } = makeDb();

    const result = await handler({});
    const detail = await handler({ id: "prompt-1" });

    expect(result).toEqual({ content: [{ type: "text", text: "denied" }], isError: true });
    expect(detail).toEqual({ content: [{ type: "text", text: "denied" }], isError: true });
    expect(db.collection).not.toHaveBeenCalled();
  });

  it("lists a light catalog with the type filter, only prompts with chatContent, sorted by title", async () => {
    const { handler } = setup();
    const { db, query } = makeDb({
      docs: [
        fakeDoc("p-b", { title: "Zeta", type: "analisi", objective: "Obiettivo Z", chatContent: "Istruzioni Z" }),
        fakeDoc("p-a", { title: "Alfa", type: "analisi", objective: "", chatContent: "Istruzioni A" }),
        fakeDoc("p-legacy", { title: "Legacy", type: "analisi", content: "Solo JSON, versione pipeline" }),
      ],
    });

    const result = await handler({ type: "analisi" });
    const text: string = result.content[0].text;

    expect(mocks.verifyPlanAndLimits).toHaveBeenCalledWith("Bearer prompt", db);
    expect(db.collection).toHaveBeenCalledWith("prompt_list");
    expect(query.where).toHaveBeenCalledWith("type", "==", "analisi");
    expect(query.select).toHaveBeenCalledWith("title", "type", "objective", "chatContent");

    expect(text).toContain("PROMPT DISPONIBILI (2)");
    expect(text).toContain("**Alfa** (id: `p-a`, tipo: analisi)");
    expect(text).toContain("**Zeta** (id: `p-b`, tipo: analisi) — Obiettivo Z");
    expect(text.indexOf("Alfa")).toBeLessThan(text.indexOf("Zeta"));
    expect(text).toContain("richiama getPromptList con il suo 'id'");

    // il catalogo non espone le istruzioni e non include i prompt senza chatContent
    expect(text).not.toContain("Istruzioni");
    expect(text).not.toContain("Legacy");
    expect(result.isError).toBeUndefined();
  });

  it("does not apply a type filter when none is given", async () => {
    const { handler } = setup();
    const { query } = makeDb({ docs: [fakeDoc("p-1", { title: "Uno", type: "analisi", chatContent: "x" })] });

    const result = await handler({});

    expect(query.where).not.toHaveBeenCalled();
    expect(result.content[0].text).toContain("PROMPT DISPONIBILI (1)");
  });

  it("returns the full chat prompt by id, ignoring the type filter and never exposing content or schema", async () => {
    const { handler } = setup();
    const { db, query, docGet } = makeDb({
      single: {
        exists: true,
        id: "prompt-1",
        data: () => ({
          title: "Analisi",
          type: "analisi",
          objective: "Obiettivo",
          chatContent: "Istruzioni da chat",
          content: "Versione pipeline: restituisci solo JSON",
          schema: "{ dato: string }",
        }),
      },
    });

    const result = await handler({ id: "prompt-1", type: "altro" });
    const text: string = result.content[0].text;

    expect(db.collection).toHaveBeenCalledWith("prompt_list");
    expect(query.doc).toHaveBeenCalledWith("prompt-1");
    expect(docGet).toHaveBeenCalledTimes(1);
    expect(query.where).not.toHaveBeenCalled();
    expect(query.select).not.toHaveBeenCalled();

    expect(text).toContain("Applica le istruzioni seguenti");
    expect(text).toContain("<id>prompt-1</id>");
    expect(text).toContain("<title>Analisi</title>");
    expect(text).toContain("<type>analisi</type>");
    expect(text).toContain("<objective>Obiettivo</objective>");
    expect(text).toContain("<instructions>\nIstruzioni da chat\n</instructions>");

    expect(text).not.toContain("Versione pipeline");
    expect(text).not.toContain("{ dato: string }");
    expect(text).not.toContain("reference_schema");
    expect(result.isError).toBeUndefined();
  });

  it("reports an error when the id does not exist or the prompt has no chatContent", async () => {
    const { handler } = setup();

    makeDb({ single: { exists: false, id: "missing", data: () => undefined } });
    const missing = await handler({ id: "missing" });
    expect(missing.isError).toBe(true);
    expect(missing.content[0].text).toContain("Nessun prompt con id 'missing'");

    makeDb({
      single: { exists: true, id: "legacy", data: () => ({ title: "Legacy", content: "Solo versione pipeline" }) },
    });
    const legacy = await handler({ id: "legacy" });
    expect(legacy.isError).toBe(true);
    expect(legacy.content[0].text).toContain("Nessun prompt con id 'legacy'");
    expect(legacy.content[0].text).not.toContain("Solo versione pipeline");
  });

  it("reports no prompts, including a filtered no-match message and catalogs without chatContent", async () => {
    const { handler } = setup();

    makeDb({ docs: [] });
    const filtered = await handler({ type: "analisi" });
    expect(filtered.content[0].text).toBe("Nessun prompt trovato per il tipo 'analisi'.");

    makeDb({ docs: [] });
    const all = await handler({});
    expect(all.content[0].text).toBe("Nessun prompt disponibile.");

    makeDb({ docs: [fakeDoc("p-legacy", { title: "Legacy", content: "Solo versione pipeline" })] });
    const onlyLegacy = await handler({});
    expect(onlyLegacy.content[0].text).toBe("Nessun prompt disponibile.");
  });

  it("uses safe defaults for missing title, type and objective", async () => {
    const { handler } = setup();

    makeDb({ docs: [fakeDoc("defaulted", { chatContent: "Istruzioni" })] });
    const catalog = await handler({});
    expect(catalog.content[0].text).toContain("**Senza titolo** (id: `defaulted`, tipo: generico)");

    makeDb({
      single: { exists: true, id: "defaulted", data: () => ({ chatContent: "Istruzioni" }) },
    });
    const detail = await handler({ id: "defaulted" });
    expect(detail.content[0].text).toContain("<title>Senza titolo</title>");
    expect(detail.content[0].text).toContain("<type>generico</type>");
    expect(detail.content[0].text).not.toContain("<objective>");
  });

  it("returns a generic error without leaking internals when Firestore fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { handler } = setup();

    const { query } = makeDb();
    query.get.mockRejectedValue(new Error("read failed"));
    const catalogError = await handler({});
    expect(catalogError).toEqual({
      content: [{ type: "text", text: "Errore nel recupero dei prompt. Riprova tra poco." }],
      isError: true,
    });
    expect(catalogError.content[0].text).not.toContain("read failed");

    const { docGet } = makeDb();
    docGet.mockRejectedValue(new Error("doc read failed"));
    const detailError = await handler({ id: "prompt-1" });
    expect(detailError.isError).toBe(true);
    expect(detailError.content[0].text).not.toContain("doc read failed");

    expect(consoleError).toHaveBeenCalledTimes(2);
    consoleError.mockRestore();
  });
});