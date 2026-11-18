import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: { currentUser: null as null | { uid: string; getIdToken: () => Promise<string> } },
  getToken: vi.fn(),
  appCheck: { value: {} as unknown },
  where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  orderBy: vi.fn((f: string, d: string) => ({ orderBy: f, d })),
  getDocs: vi.fn(),
}));

vi.mock("@word/firebase/auth", () => ({ auth: mocks.auth }));
vi.mock("@word/firebase/config", () => ({
  firebaseApp: {},
  get appCheckInstance() {
    return mocks.appCheck.value;
  },
}));
vi.mock("firebase/app-check", () => ({ getToken: mocks.getToken }));
vi.mock("firebase/firestore/lite", () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn(() => "fascicoli-ref"),
  query: vi.fn((...parts: unknown[]) => parts),
  where: mocks.where,
  or: vi.fn((...c: unknown[]) => ({ or: c })),
  orderBy: mocks.orderBy,
  getDocs: mocks.getDocs,
}));

import { fetchWithSecurity, listFascicoliByUser } from "@word/firebase/functions";

describe("fetchWithSecurity", () => {
  beforeEach(() => {
    mocks.auth.currentUser = { uid: "u1", getIdToken: async () => "id-token" };
    mocks.appCheck.value = {};
    mocks.getToken.mockResolvedValue({ token: "app-check-token" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok")));
  });

  it("rifiuta la chiamata se l'utente non è autenticato", async () => {
    mocks.auth.currentUser = null;
    await expect(fetchWithSecurity("https://x", {})).rejects.toThrow("Utente non autenticato");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("invia POST JSON con Bearer token e token App Check", async () => {
    await fetchWithSecurity("https://api.example/word", { action: "review" });
    expect(fetch).toHaveBeenCalledWith("https://api.example/word", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer id-token",
        "X-Firebase-AppCheck": "app-check-token",
      },
      body: JSON.stringify({ action: "review" }),
    });
  });

  it("prosegue con header App Check vuoto se il token non è ottenibile (il server rifiuterà)", async () => {
    mocks.getToken.mockRejectedValue(new Error("recaptcha failed"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await fetchWithSecurity("https://x", {});
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["X-Firebase-AppCheck"]).toBe("");
  });

  it("non chiede il token App Check se App Check non è inizializzato", async () => {
    mocks.appCheck.value = undefined;
    await fetchWithSecurity("https://x", {});
    expect(mocks.getToken).not.toHaveBeenCalled();
  });
});

describe("listFascicoliByUser", () => {
  const ts = (iso: string) => ({ toDate: () => new Date(iso) });

  beforeEach(() => {
    mocks.where.mockClear();
  });

  it("mappa i documenti con titolo di default e date formattate in it-IT", async () => {
    mocks.getDocs.mockResolvedValue({
      docs: [{ id: "f1", data: () => ({ createdAt: ts("2026-01-05"), updatedAt: ts("2026-01-05") }) }],
    });
    const out = await listFascicoliByUser("u1");
    expect(out).toEqual([{ id: "f1", title: "Nuovo Fascicolo", createdAt: "05/01/2026", updatedAt: "05/01/2026" }]);
  });

  it("filtra per proprietario sul campo 'user' (come regole Firestore e web app) o per condivisione", async () => {
    mocks.getDocs.mockResolvedValue({ docs: [] });
    await listFascicoliByUser("u1");
    expect(mocks.where).toHaveBeenCalledWith("user", "==", "u1");
    expect(mocks.where).toHaveBeenCalledWith("visibleTo", "array-contains", "u1");
    expect(mocks.where).not.toHaveBeenCalledWith("ownerId", expect.anything(), expect.anything());
    expect(mocks.orderBy).toHaveBeenCalledWith("updatedAt", "desc");
  });

  it("mantiene l'ordine più-recente-prima restituito da Firestore", async () => {
    mocks.getDocs.mockResolvedValue({
      docs: [
        { id: "feb", data: () => ({ title: "Febbraio", updatedAt: ts("2026-02-03") }) },
        { id: "jan", data: () => ({ title: "Gennaio", updatedAt: ts("2026-01-05") }) },
      ],
    });
    const out = await listFascicoliByUser("u1");
    expect(out.map((f) => f.id)).toEqual(["feb", "jan"]);
  });
});
