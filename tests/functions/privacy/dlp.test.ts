import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { chunkTexts, collectUserTexts, dlpAuth, enrichVaultWithDlp } from "@functions/privacy/dlp";
import { pseudonymizeGenkit, PseudonymizationVault, withPseudonymization } from "@functions/privacy/pseudonymization";

function dlpResponse(findings: Array<[string, string]>) {
  return new Response(
    JSON.stringify({ result: { findings: findings.map(([quote, name]) => ({ quote, infoType: { name } })) } }),
    { status: 200 }
  );
}

describe("Cloud DLP", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    process.env.PSEUDONYMIZATION_DLP = "true";
    process.env.GCLOUD_PROJECT = "test-project";
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(dlpAuth, "getAccessToken").mockResolvedValue("token");
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    delete process.env.PSEUDONYMIZATION_DLP;
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("collects only user-originated text: prompt, user/model messages, user file search results", () => {
    const texts = collectUserTexts({
      system: "Sei Jurio",
      messages: [
        { role: "system", content: [{ text: "istruzioni" }] },
        { role: "user", content: [{ text: "domanda utente" }] },
        { role: "model", content: [{ text: "risposta modello" }] },
        { role: "tool", content: [{ toolResponse: { name: "userFileSearch", output: { chunks: ["atto del fascicolo"] } } }] },
        { role: "tool", content: [{ toolResponse: { name: "internalDatabaseSearch", output: "massima" } }] },
      ],
    });

    expect(texts).toEqual(["domanda utente", "risposta modello", "atto del fascicolo"]);
  });

  it("splits long texts below the DLP size limit with overlap", () => {
    const chunks = chunkTexts(["a".repeat(250), "b", "c"], 100);

    expect(chunks.slice(0, 3).every((chunk) => chunk.length <= 100)).toBe(true);
    expect(chunks.at(-1)).toBe("b\n\nc");
  });

  it("registers DLP findings that the regexes miss and calls the EU regional endpoint", async () => {
    fetchMock.mockResolvedValue(dlpResponse([["Xu Ming", "PERSON_NAME"], ["Tribunale", "PERSON_NAME"]]));
    const vault = new PseudonymizationVault();

    await enrichVaultWithDlp(vault, { prompt: "Il cliente Xu Ming è stato citato dal Tribunale." });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://dlp.googleapis.com/v2/projects/test-project/locations/europe-west1/content:inspect"
    );
    expect(vault.pseudonymize("Xu Ming e il Tribunale")).toBe("{NOME_1} e il Tribunale");
  });

  it("inspects each text only once per request", async () => {
    fetchMock.mockImplementation(async () => dlpResponse([]));
    const vault = new PseudonymizationVault();
    const request = { messages: [{ role: "user", content: [{ text: "primo messaggio" }] }] };

    await enrichVaultWithDlp(vault, request);
    await enrichVaultWithDlp(vault, request);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to regex-only detection when DLP fails", async () => {
    fetchMock.mockResolvedValue(new Response("denied", { status: 403 }));
    const vault = new PseudonymizationVault();

    await expect(enrichVaultWithDlp(vault, { prompt: "Mario Rossi" })).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("DLP_UNAVAILABLE reason=DLP_HTTP_403"));
    expect(vault.pseudonymize("Mario Rossi")).toBe("{NOME_1}");
  });

  it("does not call DLP when the flag is off", async () => {
    delete process.env.PSEUDONYMIZATION_DLP;
    await enrichVaultWithDlp(new PseudonymizationVault(), { prompt: "Mario Rossi" });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pseudonymizes DLP findings in Genkit requests before calling the model", async () => {
    fetchMock.mockResolvedValue(dlpResponse([["Xu Ming", "PERSON_NAME"]]));
    const generate = vi.fn(async (request: { prompt: string }) => ({ text: request.prompt.split("\n\n")[0] }));
    const ai = pseudonymizeGenkit({ generate });

    const response = await withPseudonymization({}, () => ai.generate({ prompt: "Scrivi a Xu Ming" }));

    expect(generate.mock.calls[0][0].prompt).toMatch(/^Scrivi a \{NOME_1\}/);
    expect(response).toEqual({ text: "Scrivi a Xu Ming" });
  });
});
