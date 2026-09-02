import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

/* ---------- mock react-router-dom ---------- */
const mockNavigate = vi.fn();

vi.mock("react-router-dom", () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
}));

/* ---------- component under test ---------- */
import NotFound from "@/pages/NotFound"; // <-- adegua il path se necessario

describe("NotFound Page Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza il codice di errore 404, il titolo e la descrizione", () => {
    render(<NotFound />);

    expect(screen.getByRole("heading", { name: "404", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Pagina non trovata")).toBeInTheDocument();
    expect(
      screen.getByText("L’indirizzo che hai inserito non esiste oppure è stato spostato.")
    ).toBeInTheDocument();
  });

  test("naviga a '/chat' al click su 'Torna alla home'", () => {
    render(<NotFound />);

    const homeBtn = screen.getByRole("button", { name: /Torna alla home/i });
    fireEvent.click(homeBtn);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/chat");
  });

  test("esegue la navigazione alla cronologia precedente (-1) al click su 'Torna indietro'", () => {
    render(<NotFound />);

    const backBtn = screen.getByRole("button", { name: /Torna indietro/i });
    fireEvent.click(backBtn);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  test("naviga a '/ricerca' al click su 'Vai alla ricerca'", () => {
    render(<NotFound />);

    const searchBtn = screen.getByRole("button", { name: /Vai alla ricerca/i });
    fireEvent.click(searchBtn);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/ricerca");
  });
});