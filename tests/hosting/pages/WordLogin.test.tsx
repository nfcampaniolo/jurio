import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetchWithSecurity: vi.fn() }));
vi.mock("@/config/apiClient", () => ({ fetchWithSecurity: mocks.fetchWithSecurity }));
vi.mock("@/config/env", () => ({ getWordAuthUrl: () => "https://wordauth.test" }));
vi.mock("@/context/useAuth", () => ({ useAuth: () => ({ user: { email: "avv@studio.it" } }) }));

import WordLogin from "@/features/word/WordLogin";

const SESSION = "a".repeat(43);
const json = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as unknown as Response;
const renderAt = (query: string) =>
  render(
    <MemoryRouter initialEntries={[`/word-login${query}`]}>
      <WordLogin />
    </MemoryRouter>
  );

describe("WordLogin – collegamento dell'add-in Word", () => {
  beforeEach(() => {
    mocks.fetchWithSecurity.mockReset();
  });

  it("mostra account e codice di conferma, poi autorizza", async () => {
    mocks.fetchWithSecurity
      .mockResolvedValueOnce(json({ code: "K7P-4QX", expiresAt: Date.now() + 60000 }))
      .mockResolvedValueOnce(json({ status: "approved" }));
    renderAt(`?s=${SESSION}`);
    expect(await screen.findByText("K7P-4QX")).toBeInTheDocument();
    expect(screen.getByText("avv@studio.it")).toBeInTheDocument();
    expect(mocks.fetchWithSecurity).toHaveBeenCalledWith("https://wordauth.test", { action: "describe", sessionId: SESSION });

    fireEvent.click(screen.getByRole("button", { name: "Autorizza Word" }));
    expect(await screen.findByText("Word è collegato")).toBeInTheDocument();
    expect(mocks.fetchWithSecurity).toHaveBeenLastCalledWith("https://wordauth.test", { action: "approve", sessionId: SESSION });
  });

  it("'Non sono stato io' rifiuta la richiesta", async () => {
    mocks.fetchWithSecurity
      .mockResolvedValueOnce(json({ code: "ABC-DEF" }))
      .mockResolvedValueOnce(json({ status: "denied" }));
    renderAt(`?s=${SESSION}`);
    fireEvent.click(await screen.findByRole("button", { name: "Non sono stato io" }));
    expect(await screen.findByText("Accesso rifiutato")).toBeInTheDocument();
    expect(mocks.fetchWithSecurity).toHaveBeenLastCalledWith("https://wordauth.test", { action: "deny", sessionId: SESSION });
  });

  it.each(["", "?s=corto", "?s=../../etc"])("collegamento non valido (%s): nessuna chiamata", async (query) => {
    renderAt(query);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Collegamento non valido/);
    expect(mocks.fetchWithSecurity).not.toHaveBeenCalled();
  });

  it("richiesta scaduta: mostra il messaggio del server", async () => {
    mocks.fetchWithSecurity.mockResolvedValueOnce(
      json({ details: "La richiesta è scaduta: riavvia l'accesso da Word." }, 410)
    );
    renderAt(`?s=${SESSION}`);
    expect(await screen.findByRole("alert")).toHaveTextContent("La richiesta è scaduta");
  });
});
