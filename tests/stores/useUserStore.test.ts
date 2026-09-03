import { describe, test, expect, beforeEach } from "vitest";
import { useUserStore } from "@/infrastructure/userStore";
import type { User } from "firebase/auth";

describe("useUserStore (zustand)", () => {
  beforeEach(() => {
    useUserStore.setState({ user: null });
  });

  test("stato iniziale: user è null", () => {
    const state = useUserStore.getState();
    expect(state.user).toBeNull();
  });

  test("setUser aggiorna lo stato", () => {
    const fakeUser = {
      uid: "123",
    } as unknown as User;

    useUserStore.getState().setUser(fakeUser);

    expect(useUserStore.getState().user).toBe(fakeUser);
  });

  test("setUser può riportare user a null", () => {
    const fakeUser = {
      uid: "abc",
    } as unknown as User;

    useUserStore.getState().setUser(fakeUser);
    expect(useUserStore.getState().user).toBe(fakeUser);

    useUserStore.getState().setUser(null);
    expect(useUserStore.getState().user).toBeNull();
  });
});