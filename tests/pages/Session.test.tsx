import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

/* ---------- hoisted mocks ---------- */
const { mockNavigate, mockForceSessionTakeover, mockClearLocalSession } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockForceSessionTakeover: vi.fn(),
  mockClearLocalSession: vi.fn(),
}));

/* ---------- mock react-router-dom ---------- */
vi.mock("react-router-dom", () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
  Link: ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => (
    <a href={to} className={className} data-testid="support-link">
      {children}
    </a>
  ),
}));

/* ---------- mock sessionLogic ---------- */
vi.mock("@/services/sessionLogic", () => ({
  __esModule: true,
  forceSessionTakeover: () => mockForceSessionTakeover(),
  clearLocalSession: () => mockClearLocalSession(),
}));

/* ---------- component under test ---------- */
import Session from "@/pages/Session"; // <-- adegua il path se necessario

describe("Session Page Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockForceSessionTakeover.mockResolvedValue(undefined);
    mockClearLocalSession.mockResolvedValue(undefined);
    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  test("renderizza il titolo, il testo informativo, i pulsanti d'azione e il link al supporto", () => {
    render(<Session />);

    expect(
      screen.getByRole("heading", { name: "Sessione già attiva", level: 1 })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Sembra che il tuo account sia già connesso su un altro dispositivo/i)
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Forza l'accesso qui" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Esci e torna al Login" })
    ).toBeInTheDocument();

    const supportLink = screen.getByTestId("support-link");
    expect(supportLink).toHaveAttribute("href", "/contatti");
    expect(supportLink).toHaveTextContent("Contatta il supporto");
  });

  test("gestisce il takeover della sessione con successo e torna alla pagina precedente", async () => {
    render(<Session />);

    const takeoverBtn = screen.getByRole("button", { name: "Forza l'accesso qui" });
    fireEvent.click(takeoverBtn);

    await waitFor(() => {
      expect(mockForceSessionTakeover).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });
  });

  test("reindirizza a '/login' se forceSessionTakeover fallisce con errore 'no_user'", async () => {
    mockForceSessionTakeover.mockRejectedValue(new Error("no_user"));

    render(<Session />);

    const takeoverBtn = screen.getByRole("button", { name: "Forza l'accesso qui" });
    fireEvent.click(takeoverBtn);

    await waitFor(() => {
      expect(mockForceSessionTakeover).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith("/login");
      expect(window.alert).not.toHaveBeenCalled();
    });
  });

  test("mostra un alert con il messaggio specifico in caso di errore generico Error", async () => {
    mockForceSessionTakeover.mockRejectedValue(new Error("Conflitto di sincronizzazione sessione"));

    render(<Session />);

    const takeoverBtn = screen.getByRole("button", { name: "Forza l'accesso qui" });
    fireEvent.click(takeoverBtn);

    await waitFor(() => {
      expect(mockForceSessionTakeover).toHaveBeenCalledTimes(1);
      expect(window.alert).toHaveBeenCalledWith("Conflitto di sincronizzazione sessione");
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  test("mostra un alert di fallback se l'errore sollevato non è un'istanza di Error", async () => {
    mockForceSessionTakeover.mockRejectedValue("String error");

    render(<Session />);

    const takeoverBtn = screen.getByRole("button", { name: "Forza l'accesso qui" });
    fireEvent.click(takeoverBtn);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith("Si è verificato un errore imprevisto. Riprova.");
    });
  });

  test("gestisce il logout con pulizia della sessione e reindirizza al login", async () => {
    render(<Session />);

    const logoutBtn = screen.getByRole("button", { name: "Esci e torna al Login" });
    fireEvent.click(logoutBtn);

    await waitFor(() => {
      expect(mockClearLocalSession).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith("/login");
    });
  });

  test("gestisce gli errori sollevati durante il logout senza bloccare la UI", async () => {
    mockClearLocalSession.mockRejectedValue(new Error("Errore pulizia storage"));

    render(<Session />);

    const logoutBtn = screen.getByRole("button", { name: "Esci e torna al Login" });
    fireEvent.click(logoutBtn);

    await waitFor(() => {
      expect(mockClearLocalSession).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalled();
    });
  });
});