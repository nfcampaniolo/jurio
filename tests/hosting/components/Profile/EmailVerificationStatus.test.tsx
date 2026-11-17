import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { User } from "firebase/auth";

const { mockAuth, mockSendVerificationEmail, mockToast } = vi.hoisted(() => ({
  mockAuth: { user: null as User | null, refreshUser: vi.fn() },
  mockSendVerificationEmail: vi.fn(),
  mockToast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/context/useAuth", () => ({ useAuth: () => mockAuth }));
vi.mock("@/features/auth/hooks/auth", () => ({ sendVerificationEmail: mockSendVerificationEmail }));
vi.mock("react-hot-toast", () => ({ toast: mockToast }));

import { EmailVerificationStatus } from "@/features/profile/components/EmailVerificationStatus";

const mkUser = (over: Partial<User>) =>
  ({ email: "user@example.test", isAnonymous: false, emailVerified: false, ...over }) as unknown as User;

describe("EmailVerificationStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.user = null;
  });

  test("mostra il badge quando l'email è verificata", () => {
    mockAuth.user = mkUser({ emailVerified: true });
    render(<EmailVerificationStatus />);

    expect(screen.getByTestId("email-verified")).toHaveTextContent("Email verificata");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  test("non mostra nulla per utenti senza email o anonimi", () => {
    mockAuth.user = mkUser({ isAnonymous: true });
    const { container } = render(<EmailVerificationStatus />);
    expect(container).toBeEmptyDOMElement();
  });

  test("invia l'email di verifica e propone il ricontrollo", async () => {
    mockAuth.user = mkUser({});
    mockSendVerificationEmail.mockResolvedValue({ alreadyVerified: false });
    mockAuth.refreshUser.mockResolvedValue(mkUser({ emailVerified: true }));
    render(<EmailVerificationStatus />);

    fireEvent.click(screen.getByRole("button", { name: /verifica email/i }));

    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith("Ti abbiamo inviato l'email di conferma."));
    expect(screen.getByRole("button", { name: /reinvia tra/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /ho confermato/i }));
    await waitFor(() => expect(mockAuth.refreshUser).toHaveBeenCalled());
    expect(mockToast.success).toHaveBeenCalledWith("Email verificata!");
  });

  test("gestisce il rate limit", async () => {
    mockAuth.user = mkUser({});
    mockSendVerificationEmail.mockRejectedValue(new Error("rate_limited"));
    render(<EmailVerificationStatus />);

    fireEvent.click(screen.getByRole("button", { name: /verifica email/i }));

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining("troppe email")));
    expect(screen.getByRole("button", { name: /reinvia tra/i })).toBeDisabled();
  });
});
