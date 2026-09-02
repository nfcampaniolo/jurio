import React, { type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@/test/test-utils";

/* ---------- mocks ---------- */

// Input: lo trasformo in <input> reale così posso cambiare value e triggerare onChange
vi.mock("@/components/Input", () => ({
  Input: ({
    type,
    placeholder,
    value,
    onChange,
    required,
  }: {
    type: string;
    placeholder?: string;
    value: string;
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
    required?: boolean;
  }) => (
    <input
      aria-label={placeholder}
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      required={required}
    />
  ),
}));

// ButtonCTA: <button>
vi.mock("@/components/ButtonCTA", () => ({
  ButtonCTA: ({
    children,
    disabled,
    type,
    onClick,
  }: {
    children: ReactNode;
    disabled?: boolean;
    type?: "button" | "submit" | "reset";
    onClick?: () => void;
  }) => (
    <button type={type} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}));

// react-icons
vi.mock("react-icons/hi", () => {
  const Icon = () => <svg data-testid="icon" />;
  return { HiOutlineEye: Icon, HiOutlineEyeOff: Icon };
});

// framer-motion pass-through (motion.form, motion.h1) + AnimatePresence wrapper
vi.mock("framer-motion", async () => {
  const ReactMod = await import("react");
  type Props = React.PropsWithChildren<Record<string, unknown>>;

  const passthrough =
    (tag: string) =>
    (props: Props) =>
      ReactMod.createElement(tag, props, props.children);

  return {
    motion: {
      form: passthrough("form"),
      h1: passthrough("h1"),
      div: passthrough("div"),
      section: passthrough("section"),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

// useAuthFormLogic controllabile
type AuthLogic = {
  mode: "login" | "register";
  email: string;
  password: string;
  loading: boolean;
  error: string | null;
  setEmail: (v: string) => void;
  setPassword: (v: string) => void;
  toggleMode: () => void;
  handleSubmit: (e: FormEvent<HTMLFormElement>) => void;
  handleResetPassword: () => void;
};

const logicMock = vi.fn<(initialMode: "login" | "register") => AuthLogic>();

// IMPORTANTE: deve matchare l'import reale dentro AuthForm
vi.mock("@/hooks/useAuthFormLogic", () => ({
  useAuthFormLogic: (initialMode: "login" | "register") => logicMock(initialMode),
}));

/* ---------- component ---------- */
import { AuthForm } from "@/components/AuthForm";

describe("AuthForm", () => {
  const setEmail = vi.fn<(v: string) => void>();
  const setPassword = vi.fn<(v: string) => void>();
  const toggleMode = vi.fn<() => void>();
  const handleSubmit = vi.fn<(e: FormEvent<HTMLFormElement>) => void>();
  const handleResetPassword = vi.fn<() => void>();

  beforeEach(() => {
    vi.clearAllMocks();

    logicMock.mockReturnValue({
      mode: "login",
      email: "",
      password: "",
      loading: false,
      error: null,
      setEmail,
      setPassword,
      toggleMode,
      handleSubmit,
      handleResetPassword,
    });
  });

  test("mode login: titolo, reset password visibile, testo toggle corretto", () => {
    render(<AuthForm initialMode="login" />);

    expect(screen.getByRole("heading", { name: "Accedi a Jurio" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Password dimenticata?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accedi" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Non hai un account? Registrati" })
    ).toBeInTheDocument();
  });

  test("mode register: titolo, reset password NON visibile, testo toggle corretto", () => {
    logicMock.mockReturnValue({
      mode: "register",
      email: "",
      password: "",
      loading: false,
      error: null,
      setEmail,
      setPassword,
      toggleMode,
      handleSubmit,
      handleResetPassword,
    });

    render(<AuthForm initialMode="register" />);

    expect(screen.getByRole("heading", { name: "Registrati a Jurio" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Password dimenticata?" })).toBeNull();
    expect(screen.getByRole("button", { name: "Registrati" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Hai già un account? Accedi" })
    ).toBeInTheDocument();
  });

  test("typing: onChange email/password chiama setEmail/setPassword", () => {
    render(<AuthForm initialMode="login" />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.com" } });
    expect(setEmail).toHaveBeenCalledWith("a@b.com");

    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
    expect(setPassword).toHaveBeenCalledWith("secret");
  });

  test("toggle password: cambia aria-label e tipo input", () => {
    render(<AuthForm initialMode="login" />);

    const pwd = screen.getByLabelText("Password") as HTMLInputElement;
    expect(pwd.type).toBe("password");

    const toggle = screen.getByRole("button", { name: "Mostra password" });
    fireEvent.click(toggle);

    expect(screen.getByRole("button", { name: "Nascondi password" })).toBeInTheDocument();
    expect((screen.getByLabelText("Password") as HTMLInputElement).type).toBe("text");
  });

  test("submit: submit del form chiama handleSubmit", () => {
    render(<AuthForm initialMode="login" />);

    const submitBtn = screen.getByRole("button", { name: "Accedi" });
    const form = submitBtn.closest("form");
    expect(form).not.toBeNull();

    fireEvent.submit(form as HTMLFormElement);
    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  test("reset password: click chiama handleResetPassword (solo login)", () => {
    render(<AuthForm initialMode="login" />);

    fireEvent.click(screen.getByRole("button", { name: "Password dimenticata?" }));
    expect(handleResetPassword).toHaveBeenCalledTimes(1);
  });

  test("toggleMode: click chiama toggleMode", () => {
    render(<AuthForm initialMode="login" />);

    fireEvent.click(screen.getByRole("button", { name: "Non hai un account? Registrati" }));
    expect(toggleMode).toHaveBeenCalledTimes(1);
  });

  test("error: se presente viene mostrato", () => {
    logicMock.mockReturnValue({
      mode: "login",
      email: "",
      password: "",
      loading: false,
      error: "Credenziali non valide",
      setEmail,
      setPassword,
      toggleMode,
      handleSubmit,
      handleResetPassword,
    });

    render(<AuthForm initialMode="login" />);

    expect(screen.getByText("Credenziali non valide")).toBeInTheDocument();
  });

  test("loading: bottone submit mostra 'Elaborazione...' e reset password è disabled", () => {
    logicMock.mockReturnValue({
      mode: "login",
      email: "",
      password: "",
      loading: true,
      error: null,
      setEmail,
      setPassword,
      toggleMode,
      handleSubmit,
      handleResetPassword,
    });

    render(<AuthForm initialMode="login" />);

    expect(screen.getByRole("button", { name: "Elaborazione..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Password dimenticata?" })).toBeDisabled();
  });
});