import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const mocks = vi.hoisted(() => ({
  teamData: { visibility_default: "team", member_ids: ["user-1", "user-2"] as string[] },
  where: vi.fn(),
  limit: vi.fn(),
  get: vi.fn(),
  collection: vi.fn(),
  getDb: vi.fn(),
  update: vi.fn(),
  arrayUnion: vi.fn((...members: string[]) => ({ union: members })),
}));

const sourceRequire = createRequire(resolve(process.cwd(), "functions/src/triggers/_helper.ts"));
const firestoreModule = sourceRequire("firebase-admin/firestore");
void firestoreModule;
const firestorePath = resolve(
  sourceRequire.resolve("firebase-admin/firestore").replace("/lib/firestore/index.js", "/lib/esm/firestore/index.js"),
);
vi.doMock(firestorePath, async () => {
  const actual = await vi.importActual<typeof firestoreModule>(firestorePath);
  const fieldValue = Object.create(actual.FieldValue);
  Object.assign(fieldValue, { arrayUnion: mocks.arrayUnion });
  return { ...actual, FieldValue: fieldValue };
});
vi.mock("@functions/_deps", () => ({ getDb: mocks.getDb }));

const { applyTeamVisibility } = await import("@functions/triggers/_helper");
const docRef = { id: "document-1", path: "docs/document-1", update: mocks.update };
const teamDoc = { id: "team-1", data: () => mocks.teamData };

describe("applyTeamVisibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.teamData = { visibility_default: "team", member_ids: ["user-1", "user-2"] };
    mocks.where.mockReturnValue({ limit: mocks.limit });
    mocks.limit.mockReturnValue({ get: mocks.get });
    mocks.collection.mockReturnValue({ where: mocks.where });
    mocks.getDb.mockReturnValue({ collection: mocks.collection });
  });

  it("does not query teams when the user field is absent", async () => {
    // Arrange
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Act
    await applyTeamVisibility(docRef as never, {}, "ownerId");

    // Assert
    expect(warn).toHaveBeenCalledWith("Campo utente 'ownerId' non trovato nel doc document-1");
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("adds all team members when team visibility is enabled", async () => {
    // Arrange
    mocks.get.mockResolvedValue({ empty: false, docs: [teamDoc] });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    // Act
    await applyTeamVisibility(docRef as never, { ownerId: "user-1" }, "ownerId");

    // Assert
    expect(mocks.where).toHaveBeenCalledWith("member_ids", "array-contains", "user-1");
    expect(mocks.limit).toHaveBeenCalledWith(1);
    expect(mocks.arrayUnion).toHaveBeenCalledWith("user-1", "user-2");
    expect(mocks.update).toHaveBeenCalledWith({ visibleTo: { union: ["user-1", "user-2"] } });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("does not update when no matching team or no members are returned", async () => {
    // Arrange
    mocks.get.mockResolvedValueOnce({ empty: true, docs: [] });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    // Act
    await applyTeamVisibility(docRef as never, { ownerId: "user-1" }, "ownerId");

    // Assert
    expect(mocks.update).not.toHaveBeenCalled();

    // Arrange
    mocks.teamData = { visibility_default: "team", member_ids: [] };
    mocks.get.mockResolvedValueOnce({ empty: false, docs: [teamDoc] });

    // Act
    await applyTeamVisibility(docRef as never, { ownerId: "user-1" }, "ownerId");

    // Assert
    expect(mocks.update).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("leaves private teams unchanged and swallows lookup errors", async () => {
    // Arrange
    mocks.teamData = { visibility_default: "private", member_ids: ["user-1"] };
    mocks.get.mockResolvedValueOnce({ empty: false, docs: [teamDoc] });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    // Act
    await applyTeamVisibility(docRef as never, { ownerId: "user-1" }, "ownerId");

    // Assert
    expect(mocks.update).not.toHaveBeenCalled();

    // Arrange
    const failure = new Error("Firestore unavailable");
    mocks.get.mockRejectedValueOnce(failure);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    // Act
    await expect(applyTeamVisibility(docRef as never, { ownerId: "user-1" }, "ownerId")).resolves.toBeUndefined();

    // Assert
    expect(error).toHaveBeenCalledWith("Errore in applyTeamVisibility per docs/document-1:", failure);
    expect(mocks.update).not.toHaveBeenCalled();
    log.mockRestore();
    error.mockRestore();
  });
});
