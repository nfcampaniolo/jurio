import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const mocks = vi.hoisted(() => {
  const recognize = vi.fn();
  const speechClient = { recognize };
  const userGet = vi.fn();
  const tokenGet = vi.fn();
  const tokenDelete = vi.fn();
  const collection = vi.fn((name: string) => ({
    doc: vi.fn(() => name === "oauth_tokens"
      ? { get: tokenGet, ref: { delete: tokenDelete } }
      : { get: userGet }),
  }));
  const db = { collection };
  const fileExists = vi.fn();
  const getMetadata = vi.fn();
  const download = vi.fn();
  const file = vi.fn(() => ({ exists: fileExists, getMetadata, download }));
  const bucket = vi.fn(() => ({ file }));
  const storage = { bucket };
  return {
    recognize, speechClient, userGet, tokenGet, tokenDelete, collection, db,
    fileExists, getMetadata, download, file, bucket, storage,
    getDb: vi.fn(() => db),
    getAdminStorage: vi.fn(() => storage),
    secureEndpoint: vi.fn(async (_req: unknown, _res: unknown, handler: (uid: string) => Promise<void>) => handler("user-1")),
    validate: vi.fn(),
    requireAppCheck: vi.fn(),
    requireUid: vi.fn(),
    pdfExtract: vi.fn(),
  };
});

vi.mock("@functions/_deps", () => ({
  getDb: mocks.getDb,
  getAdminStorage: mocks.getAdminStorage,
}));
vi.mock("@functions/_utils", () => ({
  withSecureApiEndpoint: mocks.secureEndpoint,
  validateUserPlanAndLimits: mocks.validate,
  requireAppCheck: mocks.requireAppCheck,
  requireUidFromAuthHeader: mocks.requireUid,
}));

const sourceRequire = createRequire(resolve(process.cwd(), "functions/src/support/textAgents.logic.ts"));
vi.doMock(sourceRequire.resolve("@google-cloud/speech"), () => ({
  SpeechClient: class { constructor() { return mocks.speechClient; } },
}));
vi.doMock(sourceRequire.resolve("pdf-extraction"), () => ({ default: mocks.pdfExtract }));
const { executeExtractDocumentText, executeSpeechToTextAgent } = await import("@functions/support/textAgents.logic");

function response() {
  return {
    status: vi.fn(function (this: unknown) { return this; }),
    json: vi.fn(function (this: unknown) { return this; }),
  };
}

function audioRequest(contentType = "audio/mpeg", filename = "recording.mp3", body = "spoken audio") {
  const boundary = "jurio-test-boundary";
  const content = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"`,
    `Content-Type: ${contentType}`,
    "",
    body,
    `--${boundary}--`,
    "",
  ].join("\r\n");
  return {
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    rawBody: Buffer.from(content),
  };
}

function extractRequest(storagePath = "docs/contract.pdf", token = `${"a".repeat(64)}$`) {
  return {
    method: "POST",
    body: { storagePath },
    headers: { authorization: `Bearer ${token}` },
    ip: "127.0.0.1",
  };
}

describe("speech and document text agents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userGet.mockResolvedValue({ exists: true });
    mocks.tokenGet.mockResolvedValue({
      exists: true,
      data: () => ({ uid: "user-1", expiresAt: { toDate: () => new Date(Date.now() + 60_000) } }),
      ref: { delete: mocks.tokenDelete },
    });
    mocks.tokenDelete.mockResolvedValue(undefined);
    mocks.validate.mockResolvedValue(undefined);
    mocks.recognize.mockResolvedValue([{
      results: [
        { alternatives: [{ transcript: " Prima frase. " }] },
        { alternatives: [{ transcript: "Seconda frase." }] },
        { alternatives: [] },
      ],
    }]);
    mocks.requireAppCheck.mockResolvedValue(undefined);
    mocks.requireUid.mockResolvedValue("user-1");
    mocks.fileExists.mockResolvedValue([true]);
    mocks.getMetadata.mockResolvedValue([{ size: "20" }]);
    mocks.download.mockResolvedValue([Buffer.from("pdf bytes")]);
    mocks.pdfExtract.mockResolvedValue({ text: "Prima riga\nseconda riga\n\n\nterza", numpages: 3 });
  });

  it("transcribes a supported multipart audio file with Italian speech recognition", async () => {
    // Arrange
    const res = response();

    // Act
    await executeSpeechToTextAgent(audioRequest() as never, res as never);

    // Assert
    expect(mocks.validate).toHaveBeenCalledWith("user-1", "speech_to_text", { exists: true });
    expect(mocks.recognize).toHaveBeenCalledWith({
      audio: { content: Buffer.from("spoken audio").toString("base64") },
      config: {
        encoding: "MP3", sampleRateHertz: 16000, languageCode: "it-IT", enableAutomaticPunctuation: true,
      },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, text: "Prima frase.  Seconda frase." });
  });

  it("rejects bad multipart content type, absent raw data, missing file, and unsupported file formats", async () => {
    // Arrange
    const badType = response();

    // Act
    await executeSpeechToTextAgent({ headers: { "content-type": "application/json" } } as never, badType as never);

    // Assert
    expect(badType.status).toHaveBeenCalledWith(400);

    // Arrange
    const missingBody = response();

    // Act
    await executeSpeechToTextAgent({ headers: { "content-type": "multipart/form-data; boundary=x" }, rawBody: "not a buffer" } as never, missingBody as never);

    // Assert
    expect(missingBody.status).toHaveBeenCalledWith(400);

    // Arrange
    const missingFile = response();
    const boundary = "empty-boundary";

    // Act
    await executeSpeechToTextAgent({
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      rawBody: Buffer.from(`--${boundary}--\r\n`),
    } as never, missingFile as never);

    // Assert
    expect(missingFile.status).toHaveBeenCalledWith(400);

    // Arrange
    const unsupported = response();

    // Act
    await executeSpeechToTextAgent(audioRequest("application/octet-stream", "document.bin") as never, unsupported as never);

    // Assert
    expect(unsupported.status).toHaveBeenCalledWith(400);
    expect(mocks.recognize).not.toHaveBeenCalled();
  });

  it("maps WAV and OGG formats and rejects missing accounts before speech recognition", async () => {
    // Arrange
    const wav = response();
    const ogg = response();

    // Act
    await executeSpeechToTextAgent(audioRequest("audio/wav", "audio.wav") as never, wav as never);
    await executeSpeechToTextAgent(audioRequest("audio/ogg", "audio.ogg") as never, ogg as never);

    // Assert
    expect(mocks.recognize).toHaveBeenNthCalledWith(1, expect.objectContaining({ config: expect.objectContaining({ encoding: "LINEAR16" }) }));
    expect(mocks.recognize).toHaveBeenNthCalledWith(2, expect.objectContaining({ config: expect.objectContaining({ encoding: "OGG_OPUS" }) }));

    // Arrange
    mocks.userGet.mockResolvedValueOnce({ exists: false });
    const missingAccount = response();

    // Act
    const result = executeSpeechToTextAgent(audioRequest() as never, missingAccount as never);

    // Assert
    await expect(result).rejects.toThrow("NOT_FOUND");
    expect(mocks.recognize).toHaveBeenCalledTimes(2);
  });

  it("enforces POST and a non-empty storage path before document extraction", async () => {
    // Arrange
    const wrongMethod = response();

    // Act
    await executeExtractDocumentText({ method: "GET" } as never, wrongMethod as never);

    // Assert
    expect(wrongMethod.status).toHaveBeenCalledWith(405);

    // Arrange
    const missingPath = response();

    // Act
    await executeExtractDocumentText(extractRequest("   ") as never, missingPath as never);

    // Assert
    expect(missingPath.status).toHaveBeenCalledWith(400);
    expect(mocks.requireAppCheck).not.toHaveBeenCalled();
  });

  it("rejects unauthorized and expired OAuth tokens and deletes expired tokens", async () => {
    // Arrange
    mocks.tokenGet.mockResolvedValueOnce({ exists: false });
    const missingToken = response();

    // Act
    await executeExtractDocumentText(extractRequest() as never, missingToken as never);

    // Assert
    expect(missingToken.status).toHaveBeenCalledWith(401);
    expect(mocks.file).not.toHaveBeenCalled();

    // Arrange
    mocks.tokenGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ uid: "user-1", expiresAt: { toDate: () => new Date(Date.now() - 1) } }),
      ref: { delete: mocks.tokenDelete },
    });
    const expired = response();

    // Act
    await executeExtractDocumentText(extractRequest() as never, expired as never);

    // Assert
    expect(mocks.tokenDelete).toHaveBeenCalledOnce();
    expect(expired.status).toHaveBeenCalledWith(401);
    expect(mocks.file).not.toHaveBeenCalled();
  });

  it("authenticates through app check, removes traversal segments, and returns cleaned PDF text", async () => {
    // Arrange
    const request = extractRequest("../docs/../contract.pdf", "firebase-token");
    const res = response();

    // Act
    await executeExtractDocumentText(request as never, res as never);

    // Assert
    expect(mocks.requireAppCheck).toHaveBeenCalledWith(request);
    expect(mocks.requireUid).toHaveBeenCalledWith(request);
    expect(mocks.validate).toHaveBeenCalledWith("user-1", "extract_document", { exists: true });
    expect(mocks.file).toHaveBeenCalledWith("/docs//contract.pdf");
    expect(mocks.pdfExtract).toHaveBeenCalledWith(Buffer.from("pdf bytes"));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      text: "Prima riga seconda riga\n\nterza",
      pages: 3,
    });
  });

  it("returns not-found, size, and internal-error responses for storage extraction failures", async () => {
    // Arrange
    mocks.fileExists.mockResolvedValueOnce([false]);
    const missing = response();

    // Act
    await executeExtractDocumentText(extractRequest() as never, missing as never);

    // Assert
    expect(missing.status).toHaveBeenCalledWith(404);
    expect(mocks.download).not.toHaveBeenCalled();

    // Arrange
    mocks.getMetadata.mockResolvedValueOnce([{ size: 31 * 1024 * 1024 }]);
    const tooLarge = response();

    // Act
    await executeExtractDocumentText(extractRequest() as never, tooLarge as never);

    // Assert
    expect(tooLarge.status).toHaveBeenCalledWith(413);
    expect(mocks.download).not.toHaveBeenCalled();

    // Arrange
    mocks.download.mockRejectedValueOnce(new Error("storage unavailable"));
    const failed = response();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    // Act
    await executeExtractDocumentText(extractRequest() as never, failed as never);

    // Assert
    expect(failed.status).toHaveBeenCalledWith(500);
    expect(failed.json).toHaveBeenCalledWith({ error: "Internal Server Error" });
    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
  });
});
