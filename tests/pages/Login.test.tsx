import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", () => ({
  __esModule: true,
  motion: {
    div: React.forwardRef<
      HTMLDivElement,
      React.HTMLAttributes<HTMLDivElement> & {
        initial?: unknown;
        animate?: unknown;
        exit?: unknown;
        transition?: unknown;
        layoutId?: unknown;
      }
    >(
      (
        {
          children,
          ...props
        },
        ref
      ) => (
        <div ref={ref} {...props}>
          {children}
        </div>
      )
    ),
  },
}));

/* ---------- mock subcomponents ---------- */
vi.mock("@/components/AuthForm", () => ({
  __esModule: true,
  AuthForm: ({ initialMode }: { initialMode: string }) => (
    <div data-testid="auth-form" data-mode={initialMode}>
      Auth Form ({initialMode})
    </div>
  ),
}));

vi.mock("@/components/GoogleButton", () => ({
  __esModule: true,
  GoogleButton: () => (
    <button type="button" data-testid="google-button">
      Accedi con Google
    </button>
  ),
}));

/* ---------- component under test ---------- */
import { Login } from "@/pages/Login"; // <-- adegua il path se necessario

describe("Login Page Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza l'illustrazione con src e alt corretti", () => {
    render(<Login />);

    const illustration = screen.getByRole("img", { name: "Login illustration" });
    expect(illustration).toBeInTheDocument();
    expect(illustration).toHaveAttribute("src", "/login.webp");
  });

  test("renderizza il form di autenticazione con initialMode impostato su 'register'", () => {
    render(<Login />);

    const authForm = screen.getByTestId("auth-form");
    expect(authForm).toBeInTheDocument();
    expect(authForm).toHaveAttribute("data-mode", "register");
    expect(screen.getByText("Auth Form (register)")).toBeInTheDocument();
  });

  test("renderizza il separatore visivo e il pulsante Google", () => {
    render(<Login />);

    expect(screen.getByText("oppure")).toBeInTheDocument();
    expect(screen.getByTestId("google-button")).toBeInTheDocument();
  });
});