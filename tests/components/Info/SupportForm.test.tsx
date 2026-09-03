import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

/* ---------- tipi mock ---------- */
interface CreateContactPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
  consent: boolean;
  website: string;
  page: string;
  userAgent: string;
}

interface MockToast {
  success: (msg: string) => void;
  error: (msg: string) => void;
}

/* ---------- hoisted mocks ---------- */
const { mockCreateContact, mockToast } = vi.hoisted(() => ({
  mockCreateContact: vi.fn<(payload: CreateContactPayload) => Promise<string>>(),
  mockToast: {
    success: vi.fn<(msg: string) => void>(),
    error: vi.fn<(msg: string) => void>(),
  } as MockToast,
}));

/* ---------- mock react-hot-toast ---------- */
vi.mock("react-hot-toast", () => ({
  toast: mockToast,
}));

/* ---------- mock services/contact ---------- */
vi.mock("@/features/info/hooks/contact", () => ({
  createContact: (payload: CreateContactPayload) => mockCreateContact(payload),
}));

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", async () => {
  const ReactActual = await import("react");
  type Props = React.PropsWithChildren<Record<string, unknown>>;

  const passthrough =
    (Tag: string) =>
    ({ children, ...props }: Props) =>
      ReactActual.createElement(Tag, props, children);

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      div: passthrough("div"),
      path: passthrough("path"),
    },
  };
});

/* ---------- component ---------- */
import { SupportForm } from "@/features/info/components/SupportForm"; // <-- adegua il path se necessario

describe("SupportForm Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateContact.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("renderizza il modulo di supporto con tutti i campi inizialmente vuoti", () => {
    render(<SupportForm />);

    expect(screen.getByRole("heading", { name: /Supporto Jurio/i, level: 1 })).toBeInTheDocument();
    expect(
      screen.getByText(/Il nostro team è pronto ad aiutarti/i)
    ).toBeInTheDocument();

    expect(screen.getByLabelText("Nome Completo")).toHaveValue("");
    expect(screen.getByLabelText("Email Account")).toHaveValue("");
    expect(screen.getByLabelText("Oggetto della richiesta")).toHaveValue("");
    expect(screen.getByLabelText("Descrizione del problema")).toHaveValue("");
    expect(screen.getByRole("checkbox", { name: "Privacy Policy" })).not.toBeChecked();

    const submitBtn = screen.getByRole("button", { name: "Apri Ticket di Supporto" });
    expect(submitBtn).toBeInTheDocument();
    expect(submitBtn).not.toBeDisabled();
  });

  test("mostra gli errori di validazione onBlur per ciascun campo non valido", () => {
    render(<SupportForm />);

    const nameInput = screen.getByLabelText("Nome Completo");
    const emailInput = screen.getByLabelText("Email Account");
    const subjectInput = screen.getByLabelText("Oggetto della richiesta");
    const messageInput = screen.getByLabelText("Descrizione del problema");

    // Nome vuoto
    fireEvent.blur(nameInput);
    expect(screen.getByText("Nome richiesto")).toBeInTheDocument();

    // Email non valida
    fireEvent.change(emailInput, { target: { value: "invalid-email" } });
    fireEvent.blur(emailInput);
    expect(screen.getByText("Email non valida")).toBeInTheDocument();

    // Oggetto vuoto
    fireEvent.blur(subjectInput);
    expect(screen.getByText("Oggetto richiesto")).toBeInTheDocument();

    // Messaggio inferiore a 10 caratteri
    fireEvent.change(messageInput, { target: { value: "breve" } });
    fireEvent.blur(messageInput);
    expect(screen.getByText("Descrivi meglio il problema (min. 10 caratteri)")).toBeInTheDocument();
  });

  test("blocca l'invio e mostra tutti i messaggi di errore se si invia il form incompleto", async () => {
    render(<SupportForm />);

    const submitBtn = screen.getByRole("button", { name: "Apri Ticket di Supporto" });
    fireEvent.click(submitBtn);

    expect(screen.getByText("Nome richiesto")).toBeInTheDocument();
    expect(screen.getByText("Email non valida")).toBeInTheDocument();
    expect(screen.getByText("Oggetto richiesto")).toBeInTheDocument();
    expect(screen.getByText("Descrivi meglio il problema (min. 10 caratteri)")).toBeInTheDocument();
    expect(screen.getByText("Necessario per gestire il ticket")).toBeInTheDocument();

    expect(screen.getByRole("alert")).toHaveTextContent("Controlla i campi evidenziati.");
    expect(mockToast.error).toHaveBeenCalledWith("Controlla i campi evidenziati.");
    expect(mockCreateContact).not.toHaveBeenCalled();
  });

  test("rileva la compilazione del campo honeypot e blocca la sottomissione spam", () => {
    const { container } = render(<SupportForm />);

    const honeypotInput = container.querySelector('input[name="bot_field"]') as HTMLInputElement;
    expect(honeypotInput).toBeInTheDocument();

    fireEvent.change(honeypotInput, { target: { value: "https://spam-bot.com" } });

    const submitBtn = screen.getByRole("button", { name: "Apri Ticket di Supporto" });
    fireEvent.click(submitBtn);

    expect(screen.getByRole("alert")).toHaveTextContent("Azione non consentita.");
    expect(mockToast.error).toHaveBeenCalledWith("Azione non consentita.");
    expect(mockCreateContact).not.toHaveBeenCalled();
  });

  test("invia correttamente il ticket, mostra lo stato di successo e resetta i campi", async () => {
    mockCreateContact.mockResolvedValueOnce("TICKET-2026-XYZ");

    render(<SupportForm />);

    fireEvent.change(screen.getByLabelText("Nome Completo"), {
      target: { value: "Avv. Laura Neri" },
    });
    fireEvent.change(screen.getByLabelText("Email Account"), {
      target: { value: "laura.neri@studiolegale.it" },
    });
    fireEvent.change(screen.getByLabelText("Oggetto della richiesta"), {
      target: { value: "Richiesta integrazione banche dati" },
    });
    fireEvent.change(screen.getByLabelText("Descrizione del problema"), {
      target: { value: "Desidero richiedere maggiori informazioni sulle fonti del Consiglio di Stato." },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Privacy Policy" }));

    const submitBtn = screen.getByRole("button", { name: "Apri Ticket di Supporto" });
    fireEvent.click(submitBtn);

    // Verifica stato caricamento
    expect(screen.getByRole("button")).toHaveTextContent("Invio in corso...");
    expect(screen.getByRole("button")).toBeDisabled();

    await waitFor(() => {
      expect(mockCreateContact).toHaveBeenCalledTimes(1);
    });

    expect(mockCreateContact).toHaveBeenCalledWith({
      name: "Avv. Laura Neri",
      email: "laura.neri@studiolegale.it",
      subject: "Richiesta integrazione banche dati",
      message: "Desidero richiedere maggiori informazioni sulle fonti del Consiglio di Stato.",
      consent: true,
      website: "",
      page: "/contatti",
      userAgent: expect.any(String),
    });

    // Notifica toast e messaggio di successo a schermo
    expect(mockToast.success).toHaveBeenCalledWith("Ticket creato con successo!");
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Ticket inviato.")).toBeInTheDocument();
    expect(screen.getByText("TICKET-2026-XYZ")).toBeInTheDocument();

    // Form resettato
    expect(screen.getByLabelText("Nome Completo")).toHaveValue("");
    expect(screen.getByLabelText("Email Account")).toHaveValue("");
    expect(screen.getByRole("checkbox", { name: "Privacy Policy" })).not.toBeChecked();
  });

  test("gestisce il fallimento dell'invio mostrando il banner di errore e notifica toast", async () => {
    mockCreateContact.mockRejectedValueOnce(new Error("Errore di connessione al database"));

    render(<SupportForm />);

    fireEvent.change(screen.getByLabelText("Nome Completo"), {
      target: { value: "Avv. Mario Rossi" },
    });
    fireEvent.change(screen.getByLabelText("Email Account"), {
      target: { value: "mario.rossi@ordineavvocatitorino.it" },
    });
    fireEvent.change(screen.getByLabelText("Oggetto della richiesta"), {
      target: { value: "Malfunzionamento ricerca semantica" },
    });
    fireEvent.change(screen.getByLabelText("Descrizione del problema"), {
      target: { value: "La ricerca non restituisce i precedenti della Corte di Cassazione indicati." },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Privacy Policy" }));

    const submitBtn = screen.getByRole("button", { name: "Apri Ticket di Supporto" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Errore di connessione al database");
    });

    expect(mockToast.error).toHaveBeenCalledWith("Errore di connessione al database");
    expect(submitBtn).not.toBeDisabled();
    expect(submitBtn).toHaveTextContent("Apri Ticket di Supporto");

    // I dati inseriti rimangono nel form per permettere all'utente di riprovare
    expect(screen.getByLabelText("Nome Completo")).toHaveValue("Avv. Mario Rossi");
  });

  test("nasconde il banner di successo non appena l'utente inizia a modificare un nuovo form", async () => {
    mockCreateContact.mockResolvedValueOnce("TICKET-123");

    render(<SupportForm />);

    fireEvent.change(screen.getByLabelText("Nome Completo"), { target: { value: "Test User" } });
    fireEvent.change(screen.getByLabelText("Email Account"), { target: { value: "test@jurio.it" } });
    fireEvent.change(screen.getByLabelText("Oggetto della richiesta"), { target: { value: "Oggetto valido" } });
    fireEvent.change(screen.getByLabelText("Descrizione del problema"), { target: { value: "Messaggio con testo sufficiente." } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Privacy Policy" }));

    fireEvent.click(screen.getByRole("button", { name: "Apri Ticket di Supporto" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    // Modifica di un campo per un nuovo invio -> lo stato torna idle
    fireEvent.change(screen.getByLabelText("Nome Completo"), { target: { value: "Nuovo Utente" } });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});