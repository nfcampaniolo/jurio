import { beforeEach, describe, expect, it, vi } from "vitest";

type Doc = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- documenti Firestore simulati

const mocks = vi.hoisted(() => {
  const store = new Map<string, Doc>();
  const docRef = (path: string) => ({
    path,
    get: vi.fn(async () => ({ exists: store.has(path), data: () => store.get(path) })),
    set: vi.fn(async (data: Doc) => void store.set(path, { ...data })),
  });
  const db = {
    collection: vi.fn((name: string) => ({ doc: (id: string) => docRef(`${name}/${id}`) })),
    runTransaction: vi.fn(async (work: (tx: unknown) => unknown) =>
      work({
        get: async (ref: { path: string }) => ({ exists: store.has(ref.path), data: () => store.get(ref.path) }),
        update: (ref: { path: string }, data: Doc) => store.set(ref.path, { ...store.get(ref.path), ...data }),
        delete: (ref: { path: string }) => store.delete(ref.path),
      })
    ),
  };
  return {
    store,
    db,
    requireAppCheck: vi.fn(),
    requireUid: vi.fn(),
    consumePerMinute: vi.fn(),
    createCustomToken: vi.fn(),
  };
});

vi.mock("@functions/_deps", () => ({
  getDb: () => mocks.db,
  getAdminAuth: () => ({ createCustomToken: mocks.createCustomToken }),
}));
vi.mock("@functions/_logging", () => ({ logSafeError: vi.fn() }));
vi.mock("@functions/_utils", () => ({
  corsHandlerWordAddin: (_req: unknown, _res: unknown, next: () => unknown) => next(),
  requireAppCheck: mocks.requireAppCheck,
  requireUidFromAuthHeader: mocks.requireUid,
  consumePerMinuteFeature: mocks.consumePerMinute,
}));

import { createHash } from "node:crypto";
import {
  challengeFor,
  executeWordAuth,
  newConfirmationCode,
  WORD_LOGIN,
} from "@functions/auth/wordLogin.logic";

const VERIFIER = "v".repeat(43);
const CHALLENGE = createHash("sha256").update(VERIFIER).digest("base64url");

const makeRes = () => {
  const res = {
    status: vi.fn(() => res),
    json: vi.fn(() => res),
    set: vi.fn(() => res),
    send: vi.fn(() => res),
    end: vi.fn(() => res),
  };
  return res;
};
const call = async (body: Doc, headers: Doc = {}) => {
  const res = makeRes();
  await executeWordAuth({ method: "POST", body, headers, ip: "1.2.3.4" } as never, res as never);
  return { status: (res.status.mock.calls.at(-1) as [number])[0], body: (res.json.mock.calls.at(-1) as [Doc])[0] };
};
const startSession = async () => (await call({ action: "start", challenge: CHALLENGE })).body as Doc;
const sessionPath = (id: string) => `${WORD_LOGIN.collection}/${id}`;

describe("accesso a Word tramite jurio.it", () => {
  beforeEach(() => {
    mocks.store.clear();
    vi.clearAllMocks();
    mocks.requireAppCheck.mockResolvedValue(undefined);
    mocks.requireUid.mockResolvedValue("u1");
    mocks.consumePerMinute.mockResolvedValue(undefined);
    mocks.createCustomToken.mockResolvedValue("custom-token");
    mocks.store.set("register/u1", { planId: "personale" });
  });

  it("challengeFor è SHA-256 in base64url (come PKCE S256)", () => {
    expect(challengeFor(VERIFIER)).toBe(CHALLENGE);
  });

  it("il codice di conferma è leggibile e senza caratteri ambigui", () => {
    for (let i = 0; i < 50; i++) expect(newConfirmationCode()).toMatch(/^[A-HJ-KM-NP-Z2-9]{3}-[A-HJ-KM-NP-Z2-9]{3}$/);
  });

  it("start: crea una sessione in attesa che scade, con limite per IP", async () => {
    const out = await startSession();
    expect(out).toMatchObject({ expiresIn: WORD_LOGIN.ttlSeconds, interval: WORD_LOGIN.pollIntervalSeconds });
    expect(out.sessionId).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const saved = mocks.store.get(sessionPath(out.sessionId))!;
    expect(saved).toMatchObject({ challenge: CHALLENGE, code: out.code, status: "pending", uid: null });
    expect(saved.expireAt.toMillis()).toBeGreaterThan(Date.now());
    expect(mocks.consumePerMinute).toHaveBeenCalledWith(expect.stringMatching(/^ip_[0-9a-f]{32}$/), "word_login", 10);
  });

  it.each([undefined, "corta", "x".repeat(43) + "!"])("start: challenge %s non valido → 400", async (challenge) => {
    const { status } = await call({ action: "start", challenge });
    expect(status).toBe(400);
    expect(mocks.store.size).toBe(1); // solo register/u1
  });

  it("start: troppe richieste dallo stesso IP → 429", async () => {
    mocks.consumePerMinute.mockRejectedValue(new Error("rate_limited"));
    expect((await call({ action: "start", challenge: CHALLENGE })).status).toBe(429);
  });

  it("senza App Check → 401 per qualsiasi azione", async () => {
    mocks.requireAppCheck.mockRejectedValue(new Error("Missing App Check token"));
    expect((await call({ action: "start", challenge: CHALLENGE })).status).toBe(401);
  });

  it("azione sconosciuta → 400", async () => {
    expect((await call({ action: "magic" })).status).toBe(400);
  });

  it("flusso completo: in attesa → approvata → token una sola volta", async () => {
    const { sessionId, code } = await startSession();

    expect((await call({ action: "exchange", sessionId, verifier: VERIFIER })).body).toEqual({ status: "pending" });

    const described = await call({ action: "describe", sessionId });
    expect(described.body.code).toBe(code);

    expect((await call({ action: "approve", sessionId })).body).toEqual({ status: "approved" });

    const exchanged = await call({ action: "exchange", sessionId, verifier: VERIFIER });
    expect(exchanged.body).toEqual({ status: "approved", token: "custom-token" });
    expect(mocks.createCustomToken).toHaveBeenCalledWith("u1");
    expect(mocks.store.has(sessionPath(sessionId))).toBe(false);

    // riuso della stessa sessione
    expect((await call({ action: "exchange", sessionId, verifier: VERIFIER })).body).toEqual({ status: "expired" });
  });

  it("exchange con verifier sbagliato → 403 e la sessione resta valida", async () => {
    const { sessionId } = await startSession();
    await call({ action: "approve", sessionId });
    const wrong = await call({ action: "exchange", sessionId, verifier: "w".repeat(43) });
    expect(wrong.status).toBe(403);
    expect(mocks.createCustomToken).not.toHaveBeenCalled();
    expect(mocks.store.get(sessionPath(sessionId))!.status).toBe("approved");
  });

  it("rifiuto dalla web app: il pannello riceve denied e la sessione viene cancellata", async () => {
    const { sessionId } = await startSession();
    expect((await call({ action: "deny", sessionId })).body).toEqual({ status: "denied" });
    expect((await call({ action: "exchange", sessionId, verifier: VERIFIER })).body).toEqual({ status: "denied" });
    expect(mocks.store.has(sessionPath(sessionId))).toBe(false);
  });

  it("sessione scaduta: describe/approve → 410, exchange → expired", async () => {
    const { sessionId } = await startSession();
    const doc = mocks.store.get(sessionPath(sessionId))!;
    doc.expireAt = { toMillis: () => Date.now() - 1 };
    expect((await call({ action: "describe", sessionId })).status).toBe(410);
    expect((await call({ action: "approve", sessionId })).status).toBe(410);
    expect((await call({ action: "exchange", sessionId, verifier: VERIFIER })).body).toEqual({ status: "expired" });
  });

  it("una richiesta già approvata non può essere approvata di nuovo (anche da un altro utente)", async () => {
    const { sessionId } = await startSession();
    await call({ action: "approve", sessionId });
    mocks.requireUid.mockResolvedValue("attaccante");
    mocks.store.set("register/attaccante", {});
    expect((await call({ action: "approve", sessionId })).status).toBe(409);
    expect(mocks.store.get(sessionPath(sessionId))!.uid).toBe("u1");
  });

  it("approve richiede un utente autenticato e registrato su Jurio", async () => {
    const { sessionId } = await startSession();
    mocks.requireUid.mockRejectedValueOnce(new Error("Missing Authorization Bearer token"));
    expect((await call({ action: "approve", sessionId })).status).toBe(401);
    mocks.store.delete("register/u1");
    expect((await call({ action: "approve", sessionId })).status).toBe(403);
    expect(mocks.store.get(sessionPath(sessionId))!.status).toBe("pending");
  });

  it.each([
    ["sessionId non valido", { sessionId: "../x", verifier: VERIFIER }],
    ["verifier troppo corto", { sessionId: "a".repeat(43), verifier: "short" }],
  ])("exchange: %s → 400", async (_l, body) => {
    expect((await call({ action: "exchange", ...body })).status).toBe(400);
  });

  it("gli errori previsti rispondono con codice e testo fissi (mai il messaggio di un'eccezione)", async () => {
    const { sessionId } = await startSession();
    mocks.store.get(sessionPath(sessionId))!.expireAt = { toMillis: () => Date.now() - 1 };
    const out = await call({ action: "describe", sessionId });
    expect(out).toEqual({
      status: 410,
      body: { error: "EXPIRED", details: "La richiesta è scaduta: riavvia l'accesso da Word." },
    });
  });

  it("errori imprevisti → 500 generico senza dettagli interni", async () => {
    const { sessionId } = await startSession();
    await call({ action: "approve", sessionId });
    mocks.createCustomToken.mockRejectedValue(new Error("iam.serviceAccounts.signBlob denied"));
    const out = await call({ action: "exchange", sessionId, verifier: VERIFIER });
    expect(out.status).toBe(500);
    expect(JSON.stringify(out.body)).not.toContain("signBlob");
  });
});
