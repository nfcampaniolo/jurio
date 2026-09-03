import React from "react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@/test/test-utils";

/* ---------- mocks ---------- */

vi.mock("react-icons/fc", () => ({
  FcGoogle: (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid="google-icon" {...props} />
  ),
}));

type GoogleLogic = {
  loading: boolean;
  error: string | null;
  handleGoogleLogin: () => void;
};

const logicMock = vi.fn<() => GoogleLogic>();

vi.mock("@/features/auth/hooks/useGoogleAuthLogic", () => ({
  useGoogleAuthLogic: () => logicMock(),
}));

/* ---------- component ---------- */

import { GoogleButton } from "@/features/auth/components/GoogleButton";

describe("GoogleButton", () => {
  const handleGoogleLogin = vi.fn<() => void>();

  beforeEach(() => {
    vi.clearAllMocks();

    logicMock.mockReturnValue({
      loading: false,
      error: null,
      handleGoogleLogin,
    });
  });

  test("render base: bottone attivo e testo 'Accedi con Google'", () => {
    render(<GoogleButton />);

    expect(screen.getByTestId("google-icon")).toBeInTheDocument();

    const btn = screen.getByRole("button", { name: /Accedi con Google/i });
    expect(btn).toBeEnabled();
    expect(btn).toHaveAttribute("aria-busy", "false");
    expect(btn).toHaveAttribute("aria-disabled", "false");

    // status sempre presente
    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
    expect(status).toBeEmptyDOMElement();
  });

  test("click → chiama handleGoogleLogin", () => {
    render(<GoogleButton />);

    fireEvent.click(screen.getByRole("button", { name: /Accedi con Google/i }));
    expect(handleGoogleLogin).toHaveBeenCalledTimes(1);
  });

  test("loading: disabilita bottone e mostra 'Caricamento...'", () => {
    logicMock.mockReturnValue({
      loading: true,
      error: null,
      handleGoogleLogin,
    });

    render(<GoogleButton />);

    const btn = screen.getByRole("button", { name: /Caricamento/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(btn).toHaveAttribute("aria-disabled", "true");
  });

  test("error: mostra messaggio dentro role=status", () => {
    logicMock.mockReturnValue({
      loading: false,
      error: "Errore login",
      handleGoogleLogin,
    });

    render(<GoogleButton />);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Errore login");
  });
});