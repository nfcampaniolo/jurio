import React from "react";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loginWithEmail: vi.fn(),
  loginWithCustomToken: vi.fn(),
  start: vi.fn(),
  exchange: vi.fn(),
  open: vi.fn(),
}));
vi.mock("@word/firebase/auth", () => ({
  loginWithEmail: mocks.loginWithEmail,
  loginWithCustomToken: mocks.loginWithCustomToken,
}));
vi.mock("@word/auth/browserLogin", () => ({
  startBrowserLogin: mocks.start,
  exchangeBrowserLogin: mocks.exchange,
  openInBrowser: mocks.open,
}));

import { BROWSER_LOGIN_MESSAGES, useLogin } from "@word/auth/useLogin";
import LoginPage from "@word/auth/LoginPage";

describe("useLogin – validazione e login email", () => {
  beforeEach(() => {
    mocks.loginWithEmail.mockResolvedValue({ uid: "u1" });
  });

  it("segnala email e password mancanti senza chiamare il backend", async () => {
    const { result } = renderHook(() => useLogin());
    await act(() => result.current.handleLogin());
    expect(result.current.validationErrors).toEqual({
      email: "L'email è obbligatoria.",
      password: "La password è obbligatoria.",
    });
    expect(mocks.loginWithEmail).not.toHaveBeenCalled();
  });

  it("rifiuta email malformate e password corte", async () => {
    const { result } = renderHook(() => useLogin());
    act(() => {
      result.current.setEmail("non-una-mail");
      result.current.setPassword("123");
    });
    await act(() => result.current.handleLogin());
    expect(result.current.validationErrors.email).toMatch(/valido/);
    expect(result.current.validationErrors.password).toMatch(/6 caratteri/);
  });

  it("esegue il login con credenziali valide", async () => {
    const { result } = renderHook(() => useLogin());
    act(() => {
      result.current.setEmail("avv@studio.it");
      result.current.setPassword("secret1");
    });
    await act(() => result.current.handleLogin());
    expect(mocks.loginWithEmail).toHaveBeenCalledWith("avv@studio.it", "secret1");
    expect(result.current.error).toBe("");
    expect(result.current.loading).toBe(false);
  });

  it("mostra l'errore restituito da Firebase", async () => {
    mocks.loginWithEmail.mockImplementation(async () => {
      throw new Error("auth/invalid-credential");
    });
    const { result } = renderHook(() => useLogin());
    act(() => {
      result.current.setEmail("avv@studio.it");
      result.current.setPassword("secret1");
    });
    await act(async () => {
      await result.current.handleLogin();
    });
    expect(result.current.error).toBe("auth/invalid-credential");
  });
});

const session = {
  sessionId: "s".repeat(43),
  code: "K7P-4QX",
  verifier: "v".repeat(43),
  loginUrl: "https://app.jurio.test/word-login?s=" + "s".repeat(43),
  expiresAt: Date.now() + 600_000,
  intervalMs: 2000,
};

describe("useLogin – accesso tramite jurio.it nel browser", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.start.mockReset().mockResolvedValue({ ...session, expiresAt: Date.now() + 600_000 });
    mocks.exchange.mockReset();
    mocks.open.mockReset();
    mocks.loginWithCustomToken.mockReset().mockResolvedValue({ uid: "u1" });
  });
  afterEach(() => vi.useRealTimers());

  const startLogin = async () => {
    const hook = renderHook(() => useLogin());
    await act(async () => {
      await hook.result.current.handleBrowserLogin();
    });
    return hook;
  };
  const tick = (ms = 2000) =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });

  it("apre jurio.it nel browser e mostra il codice di conferma", async () => {
    const { result } = await startLogin();
    expect(mocks.open).toHaveBeenCalledWith(session.loginUrl);
    expect(result.current.browserLogin).toEqual({ phase: "waiting", code: "K7P-4QX", loginUrl: session.loginUrl });
  });

  it("attende la conferma e poi accede con il token personalizzato", async () => {
    mocks.exchange.mockResolvedValueOnce({ status: "pending" }).mockResolvedValueOnce({ status: "approved", token: "tok" });
    const { result } = await startLogin();
    await tick();
    expect(mocks.loginWithCustomToken).not.toHaveBeenCalled();
    await tick();
    expect(mocks.loginWithCustomToken).toHaveBeenCalledWith("tok");
    expect(result.current.browserLogin).toEqual({ phase: "idle" });
    expect(mocks.exchange).toHaveBeenCalledWith(expect.objectContaining({ sessionId: session.sessionId, verifier: session.verifier }));
  });

  it("rifiuto nel browser → messaggio e ritorno allo stato iniziale", async () => {
    mocks.exchange.mockResolvedValue({ status: "denied" });
    const { result } = await startLogin();
    await tick();
    expect(result.current.error).toBe(BROWSER_LOGIN_MESSAGES.denied);
    expect(result.current.browserLogin.phase).toBe("idle");
  });

  it("richiesta scaduta lato server o lato client → messaggio di scadenza", async () => {
    mocks.exchange.mockResolvedValue({ status: "expired" });
    const { result } = await startLogin();
    await tick();
    expect(result.current.error).toBe(BROWSER_LOGIN_MESSAGES.expired);

    mocks.start.mockResolvedValue({ ...session, expiresAt: Date.now() + 1000 });
    mocks.exchange.mockReset().mockResolvedValue({ status: "pending" });
    await act(async () => {
      await result.current.handleBrowserLogin();
    });
    await tick(3000);
    expect(result.current.error).toBe(BROWSER_LOGIN_MESSAGES.expired);
  });

  it("un errore di rete temporaneo non interrompe l'attesa", async () => {
    mocks.exchange
      .mockImplementationOnce(async () => {
        throw new Error("Failed to fetch");
      })
      .mockResolvedValueOnce({ status: "approved", token: "tok" });
    await startLogin();
    await tick();
    await tick();
    expect(mocks.loginWithCustomToken).toHaveBeenCalledWith("tok");
  });

  it("al ritorno su Word controlla subito, senza attendere l'intervallo", async () => {
    mocks.exchange.mockResolvedValue({ status: "approved", token: "tok" });
    await startLogin();
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
    });
    await vi.waitFor(() => expect(mocks.loginWithCustomToken).toHaveBeenCalledWith("tok"));
  });

  it("'Annulla' interrompe l'attesa senza altre richieste", async () => {
    mocks.exchange.mockResolvedValue({ status: "pending" });
    const { result } = await startLogin();
    act(() => result.current.cancelBrowserLogin());
    await tick(10_000);
    expect(mocks.exchange).not.toHaveBeenCalled();
    expect(result.current.browserLogin.phase).toBe("idle");
  });

  it("'Riapri il browser' riapre la stessa pagina", async () => {
    const { result } = await startLogin();
    act(() => result.current.reopenBrowser());
    expect(mocks.open).toHaveBeenCalledTimes(2);
    expect(mocks.open).toHaveBeenLastCalledWith(session.loginUrl);
  });

  it("errore all'avvio → messaggio e nessun browser aperto", async () => {
    mocks.start.mockImplementation(async () => {
      throw new Error("Troppe richieste di accesso. Riprova tra un minuto.");
    });
    const { result } = await startLogin();
    expect(result.current.error).toBe("Troppe richieste di accesso. Riprova tra un minuto.");
    expect(mocks.open).not.toHaveBeenCalled();
  });
});

describe("LoginPage", () => {
  it("disabilita 'Accedi' finché email e password sono vuote, poi invia il form", async () => {
    mocks.loginWithEmail.mockResolvedValue({ uid: "u1" });
    render(<LoginPage />);
    const submit = screen.getByRole("button", { name: "Accedi" });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "avv@studio.it" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret1" } });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    await waitFor(() => expect(mocks.loginWithEmail).toHaveBeenCalledWith("avv@studio.it", "secret1"));
  });

  it("il pulsante con l'occhio mostra e nasconde la password", () => {
    render(<LoginPage />);
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Mostra password" }));
    expect(input).toHaveAttribute("type", "text");
    const toggle = screen.getByRole("button", { name: "Nascondi password" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(toggle);
    expect(input).toHaveAttribute("type", "password");
  });

  it("i link esterni aprono jurio.it in una nuova scheda senza opener", () => {
    render(<LoginPage />);
    const link = screen.getByRole("link", { name: "Crea un account" });
    expect(link).toHaveAttribute("href", "https://app.jurio.test/registrati");
    expect(screen.getByRole("link", { name: "Password dimenticata?" })).toHaveAttribute(
      "href",
      "https://app.jurio.test/reimposta-password"
    );
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("'Accedi con Jurio' mostra il codice durante l'attesa e permette di annullare", async () => {
    mocks.start.mockReset().mockResolvedValue({ ...session, expiresAt: Date.now() + 600_000 });
    mocks.exchange.mockReset().mockResolvedValue({ status: "pending" });
    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: "Accedi con Jurio" }));
    expect(await screen.findByText("K7P-4QX")).toBeInTheDocument();
    expect(screen.getByText("Conferma l'accesso nel browser")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accedi" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
    expect(screen.getByRole("button", { name: "Accedi con Jurio" })).toBeInTheDocument();
  });
});
