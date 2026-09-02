import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

/* ---------- mock react-router-dom ---------- */
const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
}));

/* ---------- component ---------- */
import BillingCancel from "@/pages/BillingCancel"; // <-- adegua il path se necessario

describe("BillingCancel Page Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza l'intestazione, il titolo di pagamento annullato e la descrizione", () => {
    render(<BillingCancel />);

    expect(
      screen.getByRole("heading", {
        name: "Pagamento annullato",
        level: 1,
      })
    ).toBeInTheDocument();

    expect(screen.getByText("✕")).toBeInTheDocument();

    expect(
      screen.getByText(
        "Nessun addebito è stato effettuato. Puoi riprovare in qualsiasi momento."
      )
    ).toBeInTheDocument();
  });

  test("renderizza il messaggio informativo e la nota di supporto", () => {
    render(<BillingCancel />);

    expect(
      screen.getByText(
        "Se hai annullato per un errore o un dubbio, puoi tornare ai piani e completare il pagamento più tardi."
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Hai bisogno di aiuto\? Contatta il supporto dalla sezione/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Contatti")).toBeInTheDocument();
  });

  test("naviga a '/profilo/piani' al click sul pulsante 'Riprova'", () => {
    render(<BillingCancel />);

    const retryButton = screen.getByRole("button", { name: "Riprova" });
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/profilo/piani");
  });

  test("naviga a '/profilo' al click sul pulsante 'Torna alla home'", () => {
    render(<BillingCancel />);

    const homeButton = screen.getByRole("button", { name: "Torna alla home" });
    expect(homeButton).toBeInTheDocument();

    fireEvent.click(homeButton);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/profilo");
  });
});