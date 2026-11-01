import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AdminNotificationsSection } from "@/features/admin/components/AdminNotificationsSection";
import { toast } from "react-hot-toast";

/* ---------- mock react-icons/fi ---------- */
vi.mock("react-icons/fi", () => ({
  FiSend: () => <svg data-testid="icon-send" />,
  FiMail: () => <svg data-testid="icon-mail" />,
  FiBell: () => <svg data-testid="icon-bell" />,
  FiCode: () => <svg data-testid="icon-code" />,
  FiEye: () => <svg data-testid="icon-eye" />,
}));

/* ---------- mock react-hot-toast ---------- */
vi.mock("react-hot-toast", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

/* ---------- mock useAdminNotifications hook ---------- */
const mockSendNotification = vi.fn();
let mockIsSending = false;

vi.mock("@/features/admin/hooks/useAdminNotifications", () => ({
  useAdminNotifications: () => ({
    sendNotification: mockSendNotification,
    isSending: mockIsSending,
  }),
}));

describe("AdminNotificationsSection Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSending = false;
    mockSendNotification.mockResolvedValue({ success: true });
  });

  test("renderizza i valori di default: modalità broadcast, filtri consensi e invio in-app attivo", () => {
    const { container } = render(<AdminNotificationsSection />);

    const broadcastRadio = screen.getByRole("radio", { name: /Broadcast \(A tappeto\)/i });
    expect(broadcastRadio).toBeChecked();

    expect(screen.getByText("Filtra per Consensi (Users DB)")).toBeInTheDocument();
    
    const consentSelect = container.querySelector('select[name="consentFilter"]');
    expect(consentSelect).toBeInTheDocument();
    expect(consentSelect).toHaveValue("all");

    const inAppCheckbox = screen.getByRole("checkbox", { name: /Notifica In-App/i });
    const emailCheckbox = screen.getByRole("checkbox", { name: /Invia Email/i });
    expect(inAppCheckbox).toBeChecked();
    expect(emailCheckbox).not.toBeChecked();

    expect(screen.getByText("Contenuto Notifica In-App")).toBeInTheDocument();
    expect(screen.queryByText("Editor HTML Email")).not.toBeInTheDocument();
  });

  test("commuta la modalità di destinazione tra broadcast e singolo utente aggiornando i relativi input", () => {
    render(<AdminNotificationsSection />);

    const singleRadio = screen.getByRole("radio", { name: /Singolo Utente/i });
    fireEvent.click(singleRadio);

    expect(singleRadio).toBeChecked();
    expect(screen.queryByText("Filtra per Consensi (Users DB)")).not.toBeInTheDocument();

    const uidInput = screen.getByPlaceholderText("Inserisci uid");
    expect(uidInput).toBeInTheDocument();

    fireEvent.change(uidInput, { target: { name: "uid", value: "usr_mock_123" } });
    expect(uidInput).toHaveValue("usr_mock_123");

    const broadcastRadio = screen.getByRole("radio", { name: /Broadcast \(A tappeto\)/i });
    fireEvent.click(broadcastRadio);

    expect(broadcastRadio).toBeChecked();
    expect(screen.getByText("Filtra per Consensi (Users DB)")).toBeInTheDocument();
  });

  test("gestisce l'attivazione della notifica email e il passaggio tra vista codice e anteprima iframe", () => {
    render(<AdminNotificationsSection />);

    const emailCheckbox = screen.getByRole("checkbox", { name: /Invia Email/i });
    fireEvent.click(emailCheckbox);

    expect(emailCheckbox).toBeChecked();
    expect(screen.getByText("Editor HTML Email")).toBeInTheDocument();

    const codeBtn = screen.getByRole("button", { name: /Codice/i });
    const previewBtn = screen.getByRole("button", { name: /Anteprima/i });
    const htmlTextarea = screen.getByPlaceholderText(/Incolla qui il tuo HTML/i);
    expect(htmlTextarea).toBeInTheDocument();

    fireEvent.click(previewBtn);
    expect(
      screen.getByText("Inserisci del codice HTML per vedere l'anteprima")
    ).toBeInTheDocument();

    fireEvent.click(codeBtn);
    fireEvent.change(screen.getByPlaceholderText(/Incolla qui il tuo HTML/i), {
      target: { name: "emailHtml", value: "<h1>Nuovo Aggiornamento Giurisprudenziale</h1>" },
    });

    fireEvent.click(previewBtn);
    const iframe = screen.getByTitle("Anteprima Email HTML");
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute(
      "srcDoc",
      "<h1>Nuovo Aggiornamento Giurisprudenziale</h1>"
    );
  });

  test("mostra errore se non viene selezionato alcun canale di invio", async () => {
    render(<AdminNotificationsSection />);

    const inAppCheckbox = screen.getByRole("checkbox", { name: /Notifica In-App/i });
    fireEvent.click(inAppCheckbox);

    const form = screen.getByRole("button", { name: /Esegui Invio/i }).closest("form")!;
    fireEvent.submit(form);

    expect(toast.error).toHaveBeenCalledWith(
      "Seleziona almeno un canale di invio (In-App o Email)."
    );
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  test("mostra errore se la modalità è singolo utente e il campo UID è vuoto", async () => {
    render(<AdminNotificationsSection />);

    fireEvent.click(screen.getByRole("radio", { name: /Singolo Utente/i }));

    const titleInput = screen.getByPlaceholderText("es. Benvenuto su Jurio!");
    const messageInput = screen.getByPlaceholderText("Scrivi il messaggio della notifica in-app...");

    fireEvent.change(titleInput, { target: { name: "title", value: "Avviso Importante" } });
    fireEvent.change(messageInput, { target: { name: "message", value: "Testo di avviso" } });

    const form = screen.getByRole("button", { name: /Esegui Invio/i }).closest("form")!;
    fireEvent.submit(form);

    expect(toast.error).toHaveBeenCalledWith("Inserisci l'UID dell'utente destinatario.");
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  test("mostra errore se il canale In-App è selezionato ma il messaggio è vuoto", async () => {
    render(<AdminNotificationsSection />);

    const titleInput = screen.getByPlaceholderText("es. Benvenuto su Jurio!");
    fireEvent.change(titleInput, { target: { name: "title", value: "Avviso Senza Testo" } });

    const form = screen.getByRole("button", { name: /Esegui Invio/i }).closest("form")!;
    fireEvent.submit(form);

    expect(toast.error).toHaveBeenCalledWith("Inserisci il testo per la notifica In-App.");
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  test("mostra errore se il canale Email è attivo ma l'HTML è vuoto", async () => {
    render(<AdminNotificationsSection />);

    fireEvent.click(screen.getByRole("checkbox", { name: /Notifica In-App/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Invia Email/i }));

    const titleInput = screen.getByPlaceholderText("es. Benvenuto su Jurio!");
    fireEvent.change(titleInput, { target: { name: "title", value: "Oggetto Email" } });

    const form = screen.getByRole("button", { name: /Esegui Invio/i }).closest("form")!;
    fireEvent.submit(form);

    expect(toast.error).toHaveBeenCalledWith("Inserisci il codice HTML per l'email.");
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  test("invia con successo la notifica e resetta i campi del form", async () => {
    const { container } = render(<AdminNotificationsSection />);

    const titleInput = screen.getByPlaceholderText("es. Benvenuto su Jurio!");
    const messageInput = screen.getByPlaceholderText("Scrivi il messaggio della notifica in-app...");
    const linkInput = screen.getByPlaceholderText("es. /profilo");
    const typeSelect = container.querySelector('select[name="type"]')!;

    fireEvent.change(titleInput, { target: { name: "title", value: "Rilascio Funzionalità RAG" } });
    fireEvent.change(messageInput, { target: { name: "message", value: "Disponibile la ricerca vettoriale su Cassazione." } });
    fireEvent.change(linkInput, { target: { name: "link", value: "/novita" } });
    fireEvent.change(typeSelect, { target: { name: "type", value: "report" } });

    const form = screen.getByRole("button", { name: /Esegui Invio/i }).closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockSendNotification).toHaveBeenCalledWith({
        targetMode: "broadcast",
        consentFilter: "all",
        uid: "",
        sendInApp: true,
        sendEmail: false,
        title: "Rilascio Funzionalità RAG",
        message: "Disponibile la ricerca vettoriale su Cassazione.",
        emailHtml: "",
        link: "/novita",
        type: "report",
      });
    });

    expect(titleInput).toHaveValue("");
    expect(messageInput).toHaveValue("");
  });

  test("disabilita il pulsante di invio e mostra il testo di caricamento quando isSending è true", () => {
    mockIsSending = true;

    render(<AdminNotificationsSection />);

    const submitBtn = screen.getByRole("button", { name: /Invio in corso\.\.\./i });
    expect(submitBtn).toBeDisabled();
    expect(screen.queryByText("Esegui Invio")).not.toBeInTheDocument();
  });
});