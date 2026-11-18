import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signInWithEmailAndPassword: vi.fn(),
  signInWithCustomToken: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
}));

vi.mock("@word/firebase/config", () => ({ firebaseApp: {} }));
vi.mock("firebase/auth", () => ({
  getAuth: () => ({ name: "auth" }),
  signInWithEmailAndPassword: mocks.signInWithEmailAndPassword,
  signInWithCustomToken: mocks.signInWithCustomToken,
  signOut: mocks.signOut,
  onAuthStateChanged: mocks.onAuthStateChanged,
}));

import { loginWithCustomToken, loginWithEmail, logout, onAuthStateChange } from "@word/firebase/auth";
import { readMemoryState, writeMemoryState } from "@word/tools/memoryState";

describe("firebase/auth", () => {
  beforeEach(() => {
    mocks.signInWithEmailAndPassword.mockResolvedValue({ user: { uid: "u1" } });
    mocks.signInWithCustomToken.mockResolvedValue({ user: { uid: "g1" } });
  });

  it("loginWithEmail autentica e non tocca la sessione unica della web app", async () => {
    const user = await loginWithEmail("a@b.it", "secret1");
    expect(user).toEqual({ uid: "u1" });
    expect(mocks.signInWithEmailAndPassword).toHaveBeenCalledWith({ name: "auth" }, "a@b.it", "secret1");
    expect(localStorage.getItem("active_session_id")).toBeNull();
  });

  it("propaga gli errori di autenticazione", async () => {
    mocks.signInWithEmailAndPassword.mockImplementation(async () => {
      throw new Error("auth/wrong-password");
    });
    await expect(loginWithEmail("a@b.it", "bad")).rejects.toThrow("auth/wrong-password");
  });

  it("loginWithCustomToken completa l'accesso autorizzato su jurio.it", async () => {
    const user = await loginWithCustomToken("custom-token");
    expect(mocks.signInWithCustomToken).toHaveBeenCalledWith({ name: "auth" }, "custom-token");
    expect(user).toEqual({ uid: "g1" });
  });

  it("logout esegue signOut", async () => {
    await logout();
    expect(mocks.signOut).toHaveBeenCalledWith({ name: "auth" });
  });

  it("logout cancella il testo dei documenti: stato in memoria e vecchie cache locali", async () => {
    writeMemoryState("review_testoAtto", "Contratto riservato del cliente X");
    localStorage.setItem("review_testoAtto", "Contratto riservato del cliente X");
    localStorage.setItem("search_contesto", "fatti riservati");
    await logout();
    expect(localStorage.getItem("review_testoAtto")).toBeNull();
    expect(localStorage.getItem("search_contesto")).toBeNull();
    expect(readMemoryState("review_testoAtto")).toBeUndefined();
  });

  it("onAuthStateChange delega a onAuthStateChanged", () => {
    const cb = vi.fn();
    onAuthStateChange(cb);
    expect(mocks.onAuthStateChanged).toHaveBeenCalledWith({ name: "auth" }, cb);
  });
});
