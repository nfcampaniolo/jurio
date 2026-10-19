import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const mocks = vi.hoisted(() => {
  const list = vi.fn();
  const get = vi.fn();
  const setCredentials = vi.fn();
  const OAuth2 = vi.fn(function (this: { setCredentials: typeof setCredentials }) {
    this.setCredentials = setCredentials;
  });
  const drive = vi.fn(() => ({ files: { list, get } }));
  const db = { collection: vi.fn() };
  const userGet = vi.fn();
  const doc = vi.fn(() => ({ get: userGet }));
  db.collection.mockReturnValue({ doc });
  const secureEndpoint = vi.fn(async (_req: unknown, _res: unknown, handler: (uid: string) => Promise<void>) => handler("user-1"));
  const validate = vi.fn();
  return { list, get, setCredentials, OAuth2, drive, db, userGet, doc, secureEndpoint, validate, getDb: vi.fn(() => db) };
});

vi.mock("@functions/_utils", () => ({
  withSecureApiEndpoint: mocks.secureEndpoint,
  validateUserPlanAndLimits: mocks.validate,
}));
vi.mock("@functions/_deps", () => ({ getDb: mocks.getDb }));

const sourceRequire = createRequire(resolve(process.cwd(), "functions/src/cloud/googledrive.logic.ts"));
const googleapisPath = sourceRequire.resolve("googleapis");
vi.doMock(googleapisPath, async () => {
  const actual = await vi.importActual<typeof import("googleapis")>(googleapisPath);
  const auth = Object.create(actual.google.auth);
  auth.OAuth2 = mocks.OAuth2;
  const google = Object.create(actual.google);
  google.auth = auth;
  google.drive = mocks.drive;
  return { ...actual, google };
});
const httpsPath = sourceRequire.resolve("firebase-functions/v2/https");
vi.doMock(httpsPath, async () => {
  const actual = await vi.importActual<typeof import("firebase-functions/v2/https")>(httpsPath);
  return { ...actual, onRequest: (_options: unknown, handler: unknown) => handler };
});
const { executeDownloadCloudFile, executeListCloudFiles } = await import("@functions/cloud/googledrive.logic");

function response() {
  return {
    status: vi.fn(function (this: unknown) { return this; }),
    json: vi.fn(function (this: unknown) { return this; }),
    setHeader: vi.fn(),
    send: vi.fn(),
  };
}

describe("cloud file endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mocks.userGet.mockResolvedValue({ exists: true });
    mocks.validate.mockResolvedValue(undefined);
    mocks.list.mockResolvedValue({ data: { files: [{ id: "file-1" }] } });
    mocks.get.mockResolvedValue({ data: Buffer.from("pdf").buffer, headers: { "content-type": "application/pdf" } });
  });

  it("rejects missing users, provider tokens, and unsupported list providers", async () => {
    // Arrange
    const res = response();
    mocks.userGet.mockResolvedValueOnce({ exists: false });

    // Act
    await executeListCloudFiles({ body: { provider: "google", providerToken: "token" } } as never, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mocks.validate).not.toHaveBeenCalled();

    // Arrange
    const noToken = response();

    // Act
    await executeListCloudFiles({ body: { provider: "google" } } as never, noToken as never);

    // Assert
    expect(noToken.status).toHaveBeenCalledWith(400);
    expect(mocks.drive).not.toHaveBeenCalled();

    // Arrange
    const invalidProvider = response();

    // Act
    await executeListCloudFiles({ body: { provider: "dropbox", providerToken: "token" } } as never, invalidProvider as never);

    // Assert
    expect(invalidProvider.status).toHaveBeenCalledWith(400);
    expect(mocks.validate).toHaveBeenCalledTimes(2);
  });

  it("lists Google Drive files using a trimmed bearer token and returns an empty list by default", async () => {
    // Arrange
    mocks.list.mockResolvedValueOnce({ data: {} });
    const res = response();

    // Act
    await executeListCloudFiles({ body: { provider: " GOOGLE ", providerToken: " token " } } as never, res as never);

    // Assert
    expect(mocks.setCredentials).toHaveBeenCalledWith({ access_token: "token" });
    expect(mocks.drive).toHaveBeenCalledWith({ version: "v3", auth: expect.any(Object) });
    expect(mocks.list).toHaveBeenCalledWith({
      q: "mimeType='application/pdf' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document'",
      pageSize: 50,
      fields: "files(id, name, mimeType, modifiedTime)",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ files: [] });
  });

  it("maps Microsoft search results and returns a gateway error for failed provider responses", async () => {
    // Arrange
    const fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [
            { id: "id-1", name: "doc.pdf", file: { mimeType: "application/pdf" }, lastModifiedDateTime: "today", webUrl: "https://file" },
            { id: 7, name: null, file: {}, webUrl: 4 },
          ],
        }),
      })
      .mockResolvedValueOnce({ ok: false, status: 503 });
    vi.stubGlobal("fetch", fetch);
    const res = response();
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Act
    await executeListCloudFiles({ body: { provider: "microsoft", providerToken: "ms-token" } } as never, res as never);

    // Assert
    expect(fetch).toHaveBeenCalledWith(
      "https://graph.microsoft.com/v1.0/me/drive/root/search(q='.pdf')?select=id,name,file,lastModifiedDateTime,webUrl",
      { headers: { Authorization: "Bearer ms-token" } },
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      files: [
        { id: "id-1", name: "doc.pdf", mimeType: "application/pdf", modifiedTime: "today", webUrl: "https://file" },
        { id: "", name: "Senza nome", mimeType: "application/octet-stream", modifiedTime: null, webUrl: "" },
      ],
    });

    // Arrange
    const failedRes = response();

    // Act
    await executeListCloudFiles({ body: { provider: "microsoft", providerToken: "token" } } as never, failedRes as never);

    // Assert
    expect(failedRes.status).toHaveBeenCalledWith(502);
    expect(warning).toHaveBeenCalledOnce();
    warning.mockRestore();
  });

  it("validates download input, sanitizes file IDs, and returns Google file bytes", async () => {
    // Arrange
    const missing = response();

    // Act
    await executeDownloadCloudFile({ body: { provider: "google", providerToken: "t" } } as never, missing as never);

    // Assert
    expect(missing.status).toHaveBeenCalledWith(400);

    // Arrange
    const invalidId = response();

    // Act
    await executeDownloadCloudFile({ body: { provider: "google", providerToken: "t", fileId: "!!!" } } as never, invalidId as never);

    // Assert
    expect(invalidId.status).toHaveBeenCalledWith(400);

    // Arrange
    const res = response();

    // Act
    await executeDownloadCloudFile({ body: { provider: "google", providerToken: " token ", fileId: "id/with spaces" } } as never, res as never);

    // Assert
    expect(mocks.get).toHaveBeenCalledWith({ fileId: "idwithspaces", alt: "media" }, { responseType: "arraybuffer" });
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
    expect(res.send).toHaveBeenCalledWith(expect.any(Buffer));
  });

  it("downloads Microsoft content and handles provider errors with a default media type", async () => {
    // Arrange
    const bytes = Buffer.from("downloaded");
    const fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        headers: { get: () => null },
      })
      .mockResolvedValueOnce({ ok: false, status: 404 });
    vi.stubGlobal("fetch", fetch);
    const res = response();

    // Act
    await executeDownloadCloudFile({ body: { provider: "microsoft", providerToken: "token", fileId: "item/123" } } as never, res as never);

    // Assert
    expect(fetch).toHaveBeenCalledWith(
      "https://graph.microsoft.com/v1.0/me/drive/items/item123/content",
      { headers: { Authorization: "Bearer token" } },
    );
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
    expect(res.send).toHaveBeenCalledWith(Buffer.from("downloaded"));

    // Arrange
    const failedRes = response();
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Act
    await executeDownloadCloudFile({ body: { provider: "microsoft", providerToken: "token", fileId: "item-2" } } as never, failedRes as never);

    // Assert
    expect(failedRes.status).toHaveBeenCalledWith(502);
    expect(warning).toHaveBeenCalledOnce();
    warning.mockRestore();
  });
});
