import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  storage: { name: "storage" },
  ref: vi.fn((_storage: unknown, path: string) => ({ path })),
  list: vi.fn(),
  getBlob: vi.fn(),
}));

vi.mock("@/infrastructure/storageClient", () => ({ getStorageClient: async () => mocks.storage }));
vi.mock("firebase/storage", () => ({ ref: mocks.ref, list: mocks.list, getBlob: mocks.getBlob }));

import { ADMIN_REPORT_OPTIONS, downloadLatestAdminReport } from "@/features/admin/hooks/admin";

const page = (names: string[], nextPageToken?: string) => ({
  items: names.map((name) => ({ name })),
  prefixes: [],
  nextPageToken,
});

describe("downloadLatestAdminReport", () => {
  const createObjectURL = vi.fn(() => "blob:report");
  const revokeObjectURL = vi.fn();
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    mocks.getBlob.mockResolvedValue(new Blob(['{"ok":true}'], { type: "application/json" }));
  });

  afterEach(() => {
    vi.useRealTimers();
    clickSpy.mockRestore();
  });

  test("espone le tre tipologie di report", () => {
    expect(ADMIN_REPORT_OPTIONS.map((o) => o.type)).toEqual(["usage", "conversations", "deep_analysis"]);
  });

  test("elenca la cartella su più pagine, sceglie il mese più recente e lo scarica con getBlob", async () => {
    mocks.list
      .mockResolvedValueOnce(page(["2026_09.json", "latest.json"], "next"))
      .mockResolvedValueOnce(page(["2026_10.json", "2025_12.json", "note.txt"]));

    const fileName = await downloadLatestAdminReport("usage");

    expect(mocks.ref).toHaveBeenCalledWith(mocks.storage, "reports/usage/monthly");
    expect(mocks.list).toHaveBeenNthCalledWith(1, { path: "reports/usage/monthly" }, { maxResults: 1000, pageToken: undefined });
    expect(mocks.list).toHaveBeenNthCalledWith(2, { path: "reports/usage/monthly" }, { maxResults: 1000, pageToken: "next" });
    expect(mocks.getBlob).toHaveBeenCalledWith({ path: "reports/usage/monthly/2026_10.json" });
    expect(fileName).toBe("jurio_report_usage_2026_10.json");
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:report");
  });

  test("segnala l'assenza di report senza scaricare nulla", async () => {
    mocks.list.mockResolvedValueOnce(page(["latest.json"]));

    await expect(downloadLatestAdminReport("deep_analysis")).rejects.toThrow("Nessun report disponibile per questa tipologia.");
    expect(mocks.getBlob).not.toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
  });

  test("traduce il rifiuto delle regole di Storage in un messaggio chiaro", async () => {
    mocks.list.mockRejectedValueOnce(Object.assign(new Error("Firebase Storage: unauthorized"), { code: "storage/unauthorized" }));

    await expect(downloadLatestAdminReport("conversations")).rejects.toThrow("Accesso ai report riservato agli amministratori.");
  });

  test("propaga gli altri errori invariati", async () => {
    mocks.list.mockResolvedValueOnce(page(["2026_10.json"]));
    mocks.getBlob.mockRejectedValueOnce(new Error("network"));

    await expect(downloadLatestAdminReport("conversations")).rejects.toThrow("network");
  });
});
