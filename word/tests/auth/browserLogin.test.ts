import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetchPublic: vi.fn() }));
vi.mock("@word/firebase/functions", () => ({ fetchPublic: mocks.fetchPublic }));

import {
  challengeOf,
  createVerifier,
  exchangeBrowserLogin,
  openInBrowser,
  startBrowserLogin,
} from "@word/auth/browserLogin";
import { jsonResponse } from "../mocks/http";

describe("accesso tramite jurio.it – lato pannello", () => {
  beforeEach(() => {
    mocks.fetchPublic.mockReset();
  });

  it("il verifier è casuale e in base64url (43 caratteri)", () => {
    const a = createVerifier();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(createVerifier()).not.toBe(a);
  });

  it("la challenge è SHA-256 del verifier in base64url (come il backend)", async () => {
    const verifier = "v".repeat(43);
    await expect(challengeOf(verifier)).resolves.toBe(createHash("sha256").update(verifier).digest("base64url"));
  });

  it("start invia solo la challenge e costruisce il link alla web app", async () => {
    mocks.fetchPublic.mockResolvedValue(jsonResponse({ sessionId: "abc", code: "K7P-4QX", expiresIn: 600, interval: 2 }));
    const s = await startBrowserLogin();
    const [url, body] = mocks.fetchPublic.mock.calls[0];
    expect(url).toBe("https://wordauth.test");
    expect(body.action).toBe("start");
    expect(body.challenge).toBe(await challengeOf(s.verifier));
    expect(JSON.stringify(body)).not.toContain(s.verifier);
    expect(s).toMatchObject({ sessionId: "abc", code: "K7P-4QX", intervalMs: 2000 });
    expect(s.loginUrl).toBe("https://app.jurio.test/word-login?s=abc");
  });

  it("exchange invia sessione e verifier; gli errori HTTP diventano messaggi leggibili", async () => {
    mocks.fetchPublic.mockResolvedValueOnce(jsonResponse({ status: "pending" }));
    await expect(exchangeBrowserLogin({ sessionId: "abc", verifier: "v" })).resolves.toEqual({ status: "pending" });
    expect(mocks.fetchPublic.mock.calls[0][1]).toEqual({ action: "exchange", sessionId: "abc", verifier: "v" });

    mocks.fetchPublic.mockResolvedValueOnce(jsonResponse({ details: "Troppe richieste di accesso." }, 429));
    await expect(startBrowserLogin()).rejects.toThrow("Troppe richieste di accesso.");
  });

  it("apre il browser di sistema con Office, altrimenti una nuova finestra", () => {
    const office = (globalThis as unknown as { Office: { context: Record<string, unknown> } }).Office;
    const openBrowserWindow = vi.fn();
    office.context = { ...office.context, ui: { openBrowserWindow } };
    openInBrowser("https://app.jurio.test/word-login?s=abc");
    expect(openBrowserWindow).toHaveBeenCalledWith("https://app.jurio.test/word-login?s=abc");

    office.context = { ...office.context, ui: {} };
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    openInBrowser("https://x.test");
    expect(open).toHaveBeenCalledWith("https://x.test", "_blank", "noopener");
  });
});
