import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React, { useContext } from "react";
import { AuthContext } from "@/context/AuthContext";
import type { User } from "firebase/auth";

/* ---------- hoisted mocks ---------- */
const { mockUnsubscribe, mockOnUserStateChange } = vi.hoisted(() => {
  const unsub = vi.fn();
  const onUserChange = vi.fn();
  return {
    mockUnsubscribe: unsub,
    mockOnUserStateChange: onUserChange,
  };
});

/* ---------- mock auth service ---------- */
vi.mock("@/services/auth", () => ({
  __esModule: true,
  onUserStateChange: (
    cb: (user: User | null, conflict: boolean) => void
  ) => mockOnUserStateChange(cb),
}));

/* ---------- test consumer component ---------- */
const TestConsumer: React.FC = () => {
  const { user, loading, hasConflict } = useContext(AuthContext);
  return (
    <div>
      <span data-testid="user-id">{user ? user.uid : "no-user"}</span>
      <span data-testid="loading-state">{loading ? "loading" : "idle"}</span>
      <span data-testid="conflict-state">{hasConflict ? "conflict" : "no-conflict"}</span>
    </div>
  );
};

/* ---------- component under test ---------- */
import { AuthProvider } from "@/context/AuthProvider";

const setLocationPath = (path: string) => {
  window.history.pushState({}, "Test Path", path);
};

describe("AuthProvider Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLocationPath("/");
    mockOnUserStateChange.mockImplementation(
      (cb: (user: User | null, conflict: boolean) => void) => {
        cb(null, false);
        return mockUnsubscribe;
      }
    );
  });

  test("salta la sottoscrizione e imposta loading su false se la rotta è statica (/privacy, /termini, /gdpr)", () => {
    setLocationPath("/privacy");

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId("loading-state")).toHaveTextContent("idle");
    expect(screen.getByTestId("user-id")).toHaveTextContent("no-user");
    expect(screen.getByTestId("conflict-state")).toHaveTextContent("no-conflict");
    expect(mockOnUserStateChange).not.toHaveBeenCalled();
  });

  test("sottoscrive il listener e aggiorna il contesto quando l'utente è autenticato", async () => {
    const mockUser = {
      uid: "usr_flv_2026",
      email: "flavio@jurio.it",
    } as unknown as User;

    mockOnUserStateChange.mockImplementation(
      (cb: (user: User | null, conflict: boolean) => void) => {
        cb(mockUser, false);
        return mockUnsubscribe;
      }
    );

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading-state")).toHaveTextContent("idle");
      expect(screen.getByTestId("user-id")).toHaveTextContent("usr_flv_2026");
      expect(screen.getByTestId("conflict-state")).toHaveTextContent("no-conflict");
    });

    expect(mockOnUserStateChange).toHaveBeenCalledTimes(1);
  });

  test("rileva e propaga correttamente la presenza di un conflitto di sessione (hasConflict: true)", async () => {
    const mockUser = {
      uid: "usr_flv_2026",
    } as unknown as User;

    mockOnUserStateChange.mockImplementation(
      (cb: (user: User | null, conflict: boolean) => void) => {
        cb(mockUser, true);
        return mockUnsubscribe;
      }
    );

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading-state")).toHaveTextContent("idle");
      expect(screen.getByTestId("user-id")).toHaveTextContent("usr_flv_2026");
      expect(screen.getByTestId("conflict-state")).toHaveTextContent("conflict");
    });
  });

  test("imposta loading su false se l'import dinamico o l'inizializzazione del modulo fallisce", async () => {
    mockOnUserStateChange.mockImplementation(() => {
      throw new Error("Auth module loading failure");
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading-state")).toHaveTextContent("idle");
      expect(screen.getByTestId("user-id")).toHaveTextContent("no-user");
    });
  });

  test("esegue unsubscribe al disinnesco del provider (unmount)", async () => {
    let capturedUnsubscribe: () => void = vi.fn();

    mockOnUserStateChange.mockImplementation(
      (cb: (user: User | null, conflict: boolean) => void) => {
        cb(null, false);
        capturedUnsubscribe = mockUnsubscribe;
        return mockUnsubscribe;
      }
    );

    const { unmount } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading-state")).toHaveTextContent("idle");
    });

    unmount();

    expect(capturedUnsubscribe).toHaveBeenCalledTimes(1);
  });
});