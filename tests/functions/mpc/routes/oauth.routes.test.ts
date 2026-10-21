import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const mocks = vi.hoisted(() => {
  const collection = vi.fn();
  const db = { collection };
  const codeGet = vi.fn();
  const codeDelete = vi.fn();
  const clientGet = vi.fn();
  const clientSet = vi.fn();
  const tokenSet = vi.fn();
  return {
    collection, db, codeGet, codeDelete, clientGet, clientSet, tokenSet,
  };
});

vi.mock("@functions/_deps", () => ({ getDb: () => mocks.db }));
const functionRequire = createRequire(resolve(process.cwd(), "functions/src/mpc/routes/oauth.routes.ts"));
const firestoreModule = functionRequire("firebase-admin/firestore");
let oauthRouter: typeof import("@functions/mpc/routes/oauth.routes").oauthRouter;

const postHandler = (path: string) =>
  (oauthRouter as unknown as {
    stack: Array<{ route?: { path: string; stack: Array<{ handle: (req: unknown, res: unknown) => unknown }> } }>;
  })
    .stack.find(({ route }) => route?.path === path)?.route?.stack[0].handle as
    (req: { body?: unknown }, res: ReturnType<typeof makeResponse>) => Promise<void>;
const getHandler = (path: string) =>
  (oauthRouter as unknown as {
    stack: Array<{ route?: { path: string; stack: Array<{ handle: (req: unknown, res: unknown) => unknown }> } }>;
  })
    .stack.find(({ route }) => route?.path === path)?.route?.stack[0].handle as
    (req: { query?: Record<string, unknown> }, res: ReturnType<typeof makeResponse>) => Promise<void>;

function makeResponse() {
  return {
    headersSent: false,
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    send: vi.fn(),
    redirect: vi.fn(),
  };
}

const futureExpiration = () => ({ toDate: () => new Date(Date.now() + 60_000) });
const expiredExpiration = () => ({ toDate: () => new Date(Date.now() - 60_000) });

function configureCollections() {
  const clientRef = { get: mocks.clientGet, set: mocks.clientSet };
  const codeRef = { get: mocks.codeGet, delete: mocks.codeDelete };
  const tokenRef = { set: mocks.tokenSet };
  mocks.collection.mockImplementation((name: string) => {
    if (name === "oauth_clients") return { doc: vi.fn(() => clientRef) };
    if (name === "oauth_codes") return { doc: vi.fn(() => codeRef) };
    if (name === "oauth_tokens") return { doc: vi.fn(() => tokenRef) };
    return { doc: vi.fn() };
  });
  return { clientRef, codeRef, tokenRef };
}

describe("oauthRouter", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    configureCollections();
    mocks.clientSet.mockResolvedValue(undefined);
    mocks.codeDelete.mockResolvedValue(undefined);
    mocks.tokenSet.mockResolvedValue(undefined);
    vi.resetModules();
    vi.spyOn(firestoreModule.FieldValue, "serverTimestamp").mockReturnValue("server-timestamp" as never);
    vi.spyOn(firestoreModule.Timestamp, "fromDate").mockReturnValue({
      toDate: () => new Date(),
    } as never);
    ({ oauthRouter } = await import("@functions/mpc/routes/oauth.routes"));
  });

  describe("dynamic client registration", () => {
    it("rejects missing, empty, or malformed redirect URI arrays", async () => {
      const handler = postHandler("/register");
      for (const redirect_uris of [undefined, [], ["not a URL"]]) {
        const res = makeResponse();
        await handler({ body: { redirect_uris } }, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: "invalid_redirect_uri",
          error_description: "redirect_uris deve essere un array di URL validi.",
        });
      }
      expect(mocks.collection).not.toHaveBeenCalled();
    });

    it("stores a new client and returns OAuth registration details", async () => {
      const res = makeResponse();

      await postHandler("/register")({ body: { redirect_uris: ["https://client.example/callback"] } }, res);

      expect(mocks.collection).toHaveBeenCalledWith("oauth_clients");
      expect(mocks.clientSet).toHaveBeenCalledWith(expect.objectContaining({
        client_secret: expect.stringMatching(/^[a-f0-9]{64}$/),
        redirect_uris: ["https://client.example/callback"],
        createdAt: "server-timestamp",
      }));
      const [status, result] = res.status.mock.calls[0];
      expect(status).toBe(201);
      expect(result).toBeUndefined();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        client_id: expect.stringMatching(/^client_[a-f0-9]{32}$/),
        client_secret: expect.stringMatching(/^[a-f0-9]{64}$/),
        grant_types: ["authorization_code"],
        response_types: ["code"],
      }));
    });

    it("returns a server error when client persistence fails", async () => {
      mocks.clientSet.mockRejectedValueOnce(new Error("write failed"));
      const res = makeResponse();
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      await postHandler("/register")({ body: { redirect_uris: ["https://client.example/callback"] } }, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "server_error" });
      expect(consoleError).toHaveBeenCalledOnce();
    });
  });

  describe("authorization endpoint", () => {
    const validQuery = {
      response_type: "code",
      client_id: "client-1",
      redirect_uri: "https://client.example/callback",
      code_challenge: "a".repeat(43),
      code_challenge_method: "S256",
    };

    it.each([
      [{ ...validQuery, response_type: "token" }, "Unsupported response_type"],
      [{ ...validQuery, client_id: undefined }, "Parametri client_id"],
      [{ ...validQuery, code_challenge: undefined }, "Parametro code_challenge"],
      [{ ...validQuery, code_challenge_method: "plain" }, "code_challenge_method"],
      [{ ...validQuery, code_challenge: "bad" }, "code_challenge non valido"],
      [{ ...validQuery, state: "x".repeat(2049) }, "Parametro state non valido"],
    ])("rejects invalid authorization parameters with a descriptive response", async (query, message) => {
      const res = makeResponse();

      await getHandler("/authorize")({ query }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining(message));
      expect(mocks.clientGet).not.toHaveBeenCalled();
    });

    it("rejects unknown clients and unregistered redirect URIs", async () => {
      const invalidClient = makeResponse();
      mocks.clientGet.mockResolvedValueOnce({ exists: false });
      await getHandler("/authorize")({ query: validQuery }, invalidClient);
      expect(invalidClient.send).toHaveBeenCalledWith("client_id non valido o non registrato.");

      const wrongRedirect = makeResponse();
      mocks.clientGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ redirect_uris: ["https://other.example/callback"] }),
      });
      await getHandler("/authorize")({ query: validQuery }, wrongRedirect);
      expect(wrongRedirect.send).toHaveBeenCalledWith("redirect_uri non autorizzato per questo client.");
    });

    it("redirects registered clients to login with PKCE and optional state", async () => {
      const res = makeResponse();
      mocks.clientGet.mockResolvedValue({
        exists: true,
        data: () => ({ redirect_uris: [validQuery.redirect_uri] }),
      });

      await getHandler("/authorize")({ query: { ...validQuery, state: "state value" } }, res);

      expect(res.redirect).toHaveBeenCalledWith(302, expect.stringContaining("https://jurio.it/oauth-login?"));
      const location = new URL(res.redirect.mock.calls[0][1]);
      expect(location.searchParams.get("client_id")).toBe("client-1");
      expect(location.searchParams.get("redirect_uri")).toBe(validQuery.redirect_uri);
      expect(location.searchParams.get("code_challenge")).toBe(validQuery.code_challenge);
      expect(location.searchParams.get("code_challenge_method")).toBe("S256");
      expect(location.searchParams.get("state")).toBe("state value");
    });

    it("returns an internal error if client lookup fails", async () => {
      const res = makeResponse();
      mocks.clientGet.mockRejectedValueOnce(new Error("read failed"));
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      await getHandler("/authorize")({ query: validQuery }, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith("Internal server error");
      expect(consoleError).toHaveBeenCalledOnce();
    });
  });

  describe("token exchange", () => {
    const validCodeData = (overrides: Record<string, unknown> = {}) => ({
      user: "user-1",
      client_id: "client-1",
      expiresAt: futureExpiration(),
      code_challenge: createHash("sha256").update("verifier").digest("base64url"),
      ...overrides,
    });

    it("rejects unsupported grant types or missing authorization codes", async () => {
      const res = makeResponse();

      await postHandler("/token")({ body: { grant_type: "client_credentials" } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "unsupported_grant_type" }));
      expect(mocks.codeGet).not.toHaveBeenCalled();
    });

    it("rejects nonexistent codes, invalid records, and client mismatches", async () => {
      const missing = makeResponse();
      mocks.codeGet.mockResolvedValueOnce({ exists: false });
      await postHandler("/token")({ body: { grant_type: "authorization_code", code: "missing", client_id: "client-1" } }, missing);
      expect(missing.status).toHaveBeenCalledWith(401);
      expect(missing.json).toHaveBeenCalledWith(expect.objectContaining({ error: "invalid_grant" }));

      const emptyData = makeResponse();
      mocks.codeGet.mockResolvedValueOnce({ exists: true, data: () => undefined });
      await postHandler("/token")({ body: { grant_type: "authorization_code", code: "empty", client_id: "client-1" } }, emptyData);
      expect(emptyData.json).toHaveBeenCalledWith(expect.objectContaining({ error_description: "Dati del codice non validi" }));

      const mismatch = makeResponse();
      mocks.codeGet.mockResolvedValueOnce({ exists: true, data: () => validCodeData() });
      await postHandler("/token")({ body: { grant_type: "authorization_code", code: "code", client_id: "wrong" } }, mismatch);
      expect(mismatch.json).toHaveBeenCalledWith(expect.objectContaining({ error_description: "client_id non corrisponde al codice" }));
    });

    it("rejects malformed or expired code expirations and deletes expired codes", async () => {
      const malformed = makeResponse();
      mocks.codeGet.mockResolvedValueOnce({ exists: true, data: () => validCodeData({ expiresAt: {} }) });
      await postHandler("/token")({ body: { grant_type: "authorization_code", code: "bad-date", client_id: "client-1" } }, malformed);
      expect(malformed.json).toHaveBeenCalledWith(expect.objectContaining({ error_description: "Scadenza del codice non valida" }));

      const expired = makeResponse();
      mocks.codeGet.mockResolvedValueOnce({ exists: true, data: () => validCodeData({ expiresAt: expiredExpiration() }) });
      await postHandler("/token")({ body: { grant_type: "authorization_code", code: "expired", client_id: "client-1" } }, expired);
      expect(mocks.codeDelete).toHaveBeenCalledOnce();
      expect(expired.json).toHaveBeenCalledWith(expect.objectContaining({ error_description: "Codice di autorizzazione scaduto" }));
    });

    it("requires and verifies the PKCE code verifier after consuming the code", async () => {
      const missingVerifier = makeResponse();
      mocks.codeGet.mockResolvedValueOnce({ exists: true, data: () => validCodeData() });
      await postHandler("/token")({ body: { grant_type: "authorization_code", code: "one", client_id: "client-1" } }, missingVerifier);
      expect(mocks.codeDelete).toHaveBeenCalledOnce();
      expect(missingVerifier.status).toHaveBeenCalledWith(400);
      expect(missingVerifier.json).toHaveBeenCalledWith(expect.objectContaining({ error_description: "code_verifier mancante" }));

      const badVerifier = makeResponse();
      mocks.codeGet.mockResolvedValueOnce({ exists: true, data: () => validCodeData() });
      await postHandler("/token")({
        body: { grant_type: "authorization_code", code: "two", client_id: "client-1", code_verifier: "wrong" },
      }, badVerifier);
      expect(badVerifier.json).toHaveBeenCalledWith(expect.objectContaining({ error_description: "Verifica PKCE fallita" }));
    });

    it("deletes a valid code and persists a 30-day access token after successful PKCE", async () => {
      const res = makeResponse();
      mocks.codeGet.mockResolvedValue({ exists: true, data: () => validCodeData() });

      await postHandler("/token")({
        body: { grant_type: "authorization_code", code: "valid-code", client_id: "client-1", code_verifier: "verifier" },
      }, res);

      expect(mocks.codeDelete).toHaveBeenCalledOnce();
      expect(mocks.tokenSet).toHaveBeenCalledWith(expect.objectContaining({
        user: "user-1",
        createdAt: "server-timestamp",
        expiresAt: expect.objectContaining({ toDate: expect.any(Function) }),
        client_id: "client-1",
      }));
      const token = res.json.mock.calls[0][0];
      expect(res.status).toHaveBeenCalledWith(200);
      expect(token).toMatchObject({ token_type: "Bearer", expires_in: 30 * 24 * 60 * 60 });
      expect(token.access_token).toMatch(/^[a-f0-9]{64}$/);
    });

    it("supports legacy codes without a challenge and reports persistence errors", async () => {
      const legacy = makeResponse();
      mocks.codeGet.mockResolvedValueOnce({
        exists: true,
        data: () => validCodeData({ code_challenge: undefined }),
      });
      await postHandler("/token")({
        body: { grant_type: "authorization_code", code: "legacy", client_id: "client-1" },
      }, legacy);
      expect(legacy.status).toHaveBeenCalledWith(200);

      const failure = makeResponse();
      mocks.codeGet.mockResolvedValueOnce({ exists: true, data: () => validCodeData() });
      mocks.tokenSet.mockRejectedValueOnce(new Error("write failed"));
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      await postHandler("/token")({
        body: { grant_type: "authorization_code", code: "failure", client_id: "client-1", code_verifier: "verifier" },
      }, failure);
      expect(failure.status).toHaveBeenCalledWith(500);
      expect(failure.json).toHaveBeenCalledWith({ error: "server_error" });
      expect(consoleError).toHaveBeenCalledOnce();
    });
  });
});
