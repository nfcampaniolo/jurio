import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getAdminStorage: vi.fn(),
  storageFile: vi.fn(),
  storageSave: vi.fn(),
}));

vi.mock("@functions/_deps", () => ({
  getDb: mocks.getDb,
  getAdminStorage: mocks.getAdminStorage,
}));

const {
  computeAndSaveMonthlyActivityReports,
  computeConversationSignals,
  getPreviousMonthRange,
  mapDeepAnalysisSession,
  toPlain,
} = await import("@functions/schedules/activityReports.logic");

// --- Firestore finto: path → dati; le sottocollezioni sono derivate dai path ---
type Data = Record<string, unknown>;
const ts = (iso: string) => ({ toMillis: () => new Date(iso).getTime() });
const millisOf = (value: unknown) => (value as { toMillis: () => number }).toMillis();

function fakeDb(store: Record<string, Data>) {
  const docSnap = (path: string) => ({
    id: path.split("/").pop()!,
    exists: path in store,
    data: () => store[path],
    ref: docRef(path),
  });
  function collectionRef(path: string) {
    const filters: Array<(d: Data) => boolean> = [];
    let orderField: string | null = null;
    const query = {
      where(field: string, op: string, value: Date) {
        const limit = value.getTime();
        filters.push((d) => {
          const v = d[field] ? millisOf(d[field]) : NaN;
          return op === ">=" ? v >= limit : v < limit;
        });
        return query;
      },
      orderBy(field: string) {
        orderField = field;
        return query;
      },
      async get() {
        const depth = path.split("/").length + 1;
        let docs = Object.keys(store)
          .filter((p) => p.startsWith(`${path}/`) && p.split("/").length === depth)
          .map(docSnap)
          .filter((s) => filters.every((f) => f(s.data())));
        if (orderField) {
          const field = orderField;
          docs = docs.sort((a, b) => millisOf(a.data()[field]) - millisOf(b.data()[field]));
        }
        return { docs };
      },
    };
    return query;
  }
  function docRef(path: string): unknown {
    return {
      collection: (name: string) => collectionRef(`${path}/${name}`),
      get: async () => docSnap(path),
    };
  }
  return {
    collection: (name: string) => ({
      ...collectionRef(name),
      doc: (id: string) => docRef(`${name}/${id}`),
    }),
  };
}

function savedReport(path: string) {
  const index = mocks.storageFile.mock.calls.findIndex(([p]) => p === path);
  expect(index).toBeGreaterThanOrEqual(0);
  return JSON.parse(mocks.storageSave.mock.calls[index][0]);
}

describe("monthly activity reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storageFile.mockImplementation(() => ({ save: mocks.storageSave }));
    mocks.storageSave.mockResolvedValue(undefined);
    mocks.getAdminStorage.mockReturnValue({ bucket: () => ({ file: mocks.storageFile }) });
  });

  it("computes the previous month range and identifier", () => {
    // Act
    const range = getPreviousMonthRange(new Date(2026, 0, 1, 2));

    // Assert
    expect(range.meseId).toBe("2025_12");
    expect(range.start).toEqual(new Date(2025, 11, 1));
    expect(range.end).toEqual(new Date(2026, 0, 1));
    expect(range.meseDescrittivo).toMatch(/^Dicembre 2025$/i);
  });

  it("converts Firestore values to plain JSON", () => {
    // Act
    const plain = toPlain({ at: ts("2026-10-02T10:00:00.000Z"), skip: undefined, list: [new Date("2026-10-03T00:00:00.000Z")] });

    // Assert
    expect(plain).toEqual({ at: "2026-10-02T10:00:00.000Z", list: ["2026-10-03T00:00:00.000Z"] });
  });

  it("flags empty answers, answers without sources and unanswered questions", () => {
    // Act
    const signals = computeConversationSignals([
      { id: "1", ora: null, ruolo: "utente", testo: "domanda" },
      { id: "2", ora: null, ruolo: "assistente", testo: "", fonti: [] },
      { id: "3", ora: null, ruolo: "utente", testo: "seconda domanda" },
      { id: "4", ora: null, ruolo: "utente", testo: "terza domanda" },
      { id: "5", ora: null, ruolo: "assistente", testo: "risposta", fonti: [{ tipo: "web_search" }] },
    ]);

    // Assert
    expect(signals).toEqual({
      messaggi_utente: 3,
      messaggi_modello: 2,
      risposte_vuote: 1,
      risposte_senza_fonti: 1,
      domande_senza_risposta: 1,
      lunghezza_media_risposta: 4,
    });
  });

  it("detects deep analysis anomalies", () => {
    // Arrange
    const now = new Date("2026-11-01T02:00:00.000Z").getTime();

    // Act
    const session = mapDeepAnalysisSession("s1", {
      status: "completed",
      promptOriginale: "Quesito",
      job: { action: "generate_synthesis", status: "processing", attemptCount: 2, startedAt: ts("2026-10-31T20:00:00.000Z") },
      inquadramento: { tema: "x" },
      mappaDialettica: { orientamentoFavorevole: { fonti: [] }, orientamentoContrario: { fonti: [] } },
    }, now);

    // Assert
    expect(session.segnali.anomalie).toEqual([
      "job_bloccato",
      "tentativi_multipli",
      "sintesi_mancante",
      "nessuna_fonte_reperita",
    ]);
  });

  it("builds and saves both reports grouped by user with messages in chronological order", async () => {
    // Arrange
    mocks.getDb.mockReturnValue(fakeDb({
      "register/u-a": { planId: "personale" },
      "register/u-b": { planId: "business" },
      // Chat di u-b: i messaggi sono salvati in ordine sparso, uno è di settembre
      "chats/c1": { user: "u-b", title: "Chat B", updatedAt: ts("2026-10-20T10:00:00.000Z") },
      "chats/c1/messages/m2": { role: "model", content: "Risposta", sources: [{ _type: "database_interno", identificativo: "Cass. 123", match_percentage: 90, extra: "x" }], timestamp: ts("2026-10-20T10:00:01.000Z") },
      "chats/c1/messages/m1": { role: "user", content: "Domanda", timestamp: ts("2026-10-20T10:00:00.000Z") },
      "chats/c1/messages/m0": { role: "user", content: "Vecchia", timestamp: ts("2026-09-30T10:00:00.000Z") },
      // Chat aggiornata nel mese ma senza messaggi nel periodo → esclusa
      "chats/c2": { user: "u-a", updatedAt: ts("2026-10-05T10:00:00.000Z") },
      // Chat ferma da settembre → esclusa dalla query
      "chats/c3": { user: "u-a", updatedAt: ts("2026-09-05T10:00:00.000Z") },
      "chats/c3/messages/m1": { role: "user", content: "x", timestamp: ts("2026-10-05T10:00:00.000Z") },
      // Fascicolo di u-a con un thread attivo e uno senza messaggi nel mese
      "fascicoli/f1": { user: "u-a", title: "Pratica", metadati: { cliente: "Rossi" }, visibleTo: ["u-c"], updatedAt: ts("2026-10-10T10:00:00.000Z") },
      "fascicoli/f1/threads/t1": { title: "Thread 1", updatedAt: ts("2026-10-10T10:00:00.000Z") },
      "fascicoli/f1/threads/t1/messages/m1": { role: "user", content: "Domanda fascicolo", timestamp: ts("2026-10-10T09:00:00.000Z") },
      "fascicoli/f1/threads/t2": { title: "Thread vuoto" },
      // Sessioni deep analysis
      "deep_analysis_sessions/d1": { user: "u-a", status: "review", promptOriginale: "Quesito A", createdAt: ts("2026-10-03T10:00:00.000Z"), updatedAt: ts("2026-10-03T11:00:00.000Z"), job: { action: "start_research", status: "completed", attemptCount: 1, createdAt: ts("2026-10-03T10:00:00.000Z"), startedAt: ts("2026-10-03T10:00:10.000Z"), completedAt: ts("2026-10-03T10:05:10.000Z") }, inquadramento: { a: 1 }, mappaDialettica: { orientamentoFavorevole: { fonti: [{ id: "p1", escluso: true }] }, orientamentoContrario: { fonti: [] } } },
      "deep_analysis_sessions/d2": { user: "u-a", status: "draft", createdAt: ts("2026-11-01T00:30:00.000Z"), updatedAt: ts("2026-11-01T00:30:00.000Z") },
    }));

    // Act
    const result = await computeAndSaveMonthlyActivityReports(new Date(2026, 10, 1, 2));

    // Assert
    expect(result.mese_id).toBe("2026_10");
    expect(mocks.storageSave).toHaveBeenCalledWith(expect.any(String), {
      contentType: "application/json",
      metadata: { cacheControl: "private, no-store" },
    });

    const conversations = savedReport("reports/conversations/monthly/2026_10.json");
    expect(conversations.type).toBe("monthly_conversations_activity");
    expect(conversations.utenti.map((u: { uid: string }) => u.uid)).toEqual(["u-a", "u-b"]);
    expect(conversations.riepilogo).toMatchObject({ utenti: 2, chat: 1, fascicoli: 1, thread: 1, messaggi: 3 });

    const [userA, userB] = conversations.utenti;
    expect(userA.piano).toBe("personale");
    expect(userA.chat).toEqual([]);
    expect(userA.fascicoli[0]).toMatchObject({
      id: "f1",
      metadati: { cliente: "Rossi" },
      condiviso_con_utenti: 1,
      thread_totali: 2,
    });
    expect(userA.fascicoli[0].thread.map((t: { id: string }) => t.id)).toEqual(["t1"]);
    expect(userA.fascicoli[0].thread[0].segnali.domande_senza_risposta).toBe(1);

    expect(userB.chat[0].messaggi.map((m: { id: string }) => m.id)).toEqual(["m1", "m2"]);
    expect(userB.chat[0].messaggi[1]).toMatchObject({
      ruolo: "assistente",
      ora: "2026-10-20T10:00:01.000Z",
      fonti: [{ tipo: "database_interno", identificativo: "Cass. 123", match_percentage: 90, documento_id: null, organo_giudicante: null, data_pubblicazione: null, url: null }],
    });

    const deep = savedReport("reports/deep_analysis/monthly/2026_10.json");
    expect(deep.riepilogo).toEqual({ utenti: 1, sessioni: 1, per_stato: { review: 1 }, per_anomalia: {} });
    expect(deep.utenti[0].sessioni[0]).toMatchObject({
      id: "d1",
      quesito: "Quesito A",
      ultimo_job: { azione: "start_research", stato: "completed", attesa_in_coda_secondi: 10, durata_secondi: 300 },
      segnali: { anomalie: [], fonti: { favorevoli: 1, contrarie: 0, escluse: 1 } },
    });
  });

  it("truncates very long messages and marks them", async () => {
    // Arrange
    mocks.getDb.mockReturnValue(fakeDb({
      "chats/c1": { user: "u", updatedAt: ts("2026-10-20T10:00:00.000Z") },
      "chats/c1/messages/m1": { role: "user", content: "a".repeat(7000), timestamp: ts("2026-10-20T10:00:00.000Z") },
    }));

    // Act
    await computeAndSaveMonthlyActivityReports(new Date(2026, 10, 1, 2));

    // Assert
    const message = savedReport("reports/conversations/monthly/2026_10.json").utenti[0].chat[0].messaggi[0];
    expect(message).toMatchObject({ troncato: true, lunghezza_originale: 7000 });
    expect(message.testo).toHaveLength(6001);
  });

  it("saves the other report and rethrows when one of the two fails", async () => {
    // Arrange
    mocks.getDb.mockReturnValue(fakeDb({}));
    mocks.storageSave.mockImplementation(async (body: string) => {
      if (body.includes("monthly_deep_analysis_activity")) throw new Error("upload failed");
    });
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    // Act
    const result = computeAndSaveMonthlyActivityReports(new Date(2026, 10, 1, 2));

    // Assert
    await expect(result).rejects.toThrow("upload failed");
    expect(mocks.storageFile).toHaveBeenCalledWith("reports/conversations/monthly/2026_10.json");
    expect(errorLog).toHaveBeenCalledWith("MONTHLY_DEEP_ANALYSIS_REPORT_FAILED", { errorType: "Error" });
  });
});
