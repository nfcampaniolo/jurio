import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const mocks = vi.hoisted(() => {
  const apps: object[] = [];
  const settings = vi.fn();
  const db = { settings };
  const auth = { name: "auth" };
  const storage = { name: "storage" };

  return {
    apps,
    settings,
    db,
    auth,
    storage,
  };
});

const functionRequire = createRequire(resolve(process.cwd(), "functions/src/_deps.ts"));
const adminModule = functionRequire("firebase-admin");
const appModule = functionRequire("firebase-admin/app");
const firestoreModule = functionRequire("firebase-admin/firestore");
const authModule = functionRequire("firebase-admin/auth");
const storageModule = functionRequire("firebase-admin/storage");

describe("functions/src/_deps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.apps.length = 0;
    vi.resetModules();
    vi.spyOn(appModule, "initializeApp").mockImplementation(() => {
      mocks.apps.push({});
      return {} as never;
    });
    vi.spyOn(appModule, "getApps").mockImplementation(() => mocks.apps);
    vi.spyOn(firestoreModule, "getFirestore").mockReturnValue(mocks.db);
    vi.spyOn(authModule, "getAuth").mockReturnValue(mocks.auth);
    vi.spyOn(storageModule, "getStorage").mockReturnValue(mocks.storage);
  });

  describe("getDb", () => {
    it("inizializza Firebase e configura Firestore al primo accesso", async () => {
      const { getDb } = await import("@functions/_deps");

      // Arrange
      const expectedDb = mocks.db;

      // Act
      const result = getDb();

      // Assert
      expect(result).toBe(expectedDb);
      expect(appModule.initializeApp).toHaveBeenCalledOnce();
      expect(firestoreModule.getFirestore).toHaveBeenCalledOnce();
      expect(mocks.settings).toHaveBeenCalledWith({ ignoreUndefinedProperties: true });
    });

    it("riusa app e istanza Firestore già inizializzate", async () => {
      mocks.apps.push({});
      const { getDb } = await import("@functions/_deps");

      // Arrange
      const firstDb = getDb();

      // Act
      const secondDb = getDb();

      // Assert
      expect(secondDb).toBe(firstDb);
      expect(appModule.initializeApp).not.toHaveBeenCalled();
      expect(firestoreModule.getFirestore).toHaveBeenCalledOnce();
      expect(mocks.settings).toHaveBeenCalledOnce();
    });
  });

  describe("Firebase accessors", () => {
    it("restituisce Auth inizializzando Firebase solo se necessario", async () => {
      const { getAdminAuth } = await import("@functions/_deps");

      // Arrange
      const expectedAuth = mocks.auth;

      // Act
      const result = getAdminAuth();

      // Assert
      expect(result).toBe(expectedAuth);
      expect(appModule.initializeApp).toHaveBeenCalledOnce();
      expect(authModule.getAuth).toHaveBeenCalledOnce();
    });

    it("non reinizializza Firebase se un'app è già presente prima di Auth", async () => {
      mocks.apps.push({});
      const { getAdminAuth } = await import("@functions/_deps");

      // Arrange
      const expectedAuth = mocks.auth;

      // Act
      const result = getAdminAuth();

      // Assert
      expect(result).toBe(expectedAuth);
      expect(appModule.initializeApp).not.toHaveBeenCalled();
      expect(authModule.getAuth).toHaveBeenCalledOnce();
    });

    it("restituisce Storage inizializzando Firebase solo se necessario", async () => {
      const { getAdminStorage } = await import("@functions/_deps");

      // Arrange
      const expectedStorage = mocks.storage;

      // Act
      const result = getAdminStorage();

      // Assert
      expect(result).toBe(expectedStorage);
      expect(appModule.initializeApp).toHaveBeenCalledOnce();
      expect(storageModule.getStorage).toHaveBeenCalledOnce();
    });

    it("non reinizializza Firebase se un'app è già presente prima di Storage", async () => {
      mocks.apps.push({});
      const { getAdminStorage } = await import("@functions/_deps");

      // Arrange
      const expectedStorage = mocks.storage;

      // Act
      const result = getAdminStorage();

      // Assert
      expect(result).toBe(expectedStorage);
      expect(appModule.initializeApp).not.toHaveBeenCalled();
      expect(storageModule.getStorage).toHaveBeenCalledOnce();
    });

    it("restituisce il modulo Firebase Admin importato", async () => {
      const { getAdmin } = await import("@functions/_deps");

      // Arrange
      const expectedTimestamp = adminModule.firestore.Timestamp;

      // Act
      const result = getAdmin();

      // Assert
      expect(result.firestore.Timestamp).toBe(expectedTimestamp);
    });
  });

  describe("sanitize", () => {
    it("converte undefined in null", async () => {
      const { sanitize } = await import("@functions/_deps");

      // Arrange
      const value = undefined;

      // Act
      const result = sanitize(value);

      // Assert
      expect(result).toBeNull();
    });

    it.each([null, "testo", 42, false])("restituisce invariato un valore primitivo: %s", async (value) => {
      const { sanitize } = await import("@functions/_deps");

      // Arrange
      const input = value;

      // Act
      const result = sanitize(input);

      // Assert
      expect(result).toBe(input);
    });

    it("restituisce invariata una data", async () => {
      const { sanitize } = await import("@functions/_deps");

      // Arrange
      const date = new Date("2025-01-01T00:00:00.000Z");

      // Act
      const result = sanitize(date);

      // Assert
      expect(result).toBe(date);
    });

    it("restituisce invariati Timestamp e FieldValue di Firebase", async () => {
      const { sanitize } = await import("@functions/_deps");

      // Arrange
      const timestamp = new adminModule.firestore.Timestamp(1, 0);
      const fieldValue = adminModule.firestore.FieldValue.serverTimestamp();

      // Act
      const sanitizedTimestamp = sanitize(timestamp);
      const sanitizedFieldValue = sanitize(fieldValue);

      // Assert
      expect(sanitizedTimestamp).toBe(timestamp);
      expect(sanitizedFieldValue).toBe(fieldValue);
    });

    it("rimuove gli undefined dagli array e sanifica ricorsivamente i valori rimanenti", async () => {
      const { sanitize } = await import("@functions/_deps");

      // Arrange
      const input = [1, undefined, { keep: "valore", omit: undefined }, null];

      // Act
      const result = sanitize(input);

      // Assert
      expect(result).toEqual([1, { keep: "valore" }, null]);
    });

    it("rimuove le proprietà undefined dagli oggetti e sanifica i valori annidati", async () => {
      const { sanitize } = await import("@functions/_deps");

      // Arrange
      const input = {
        keep: "valore",
        omit: undefined,
        nested: { number: 7, absent: undefined },
        list: [undefined, "presente"],
      };

      // Act
      const result = sanitize(input);

      // Assert
      expect(result).toEqual({
        keep: "valore",
        nested: { number: 7 },
        list: ["presente"],
      });
    });
  });
});
