import { describe, test, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import type { Team } from "@/interfaces/interfaces";

/* ---------- tipi mock voucher & hook ---------- */
interface MockVoucher {
  id: string;
}

interface MockMessage {
  type: "success" | "info" | "error";
  text: string;
}

interface MockTeamVouchersHook {
  email: string;
  setEmail: Mock<(val: string) => void>;
  loading: boolean;
  voucherEmail: string;
  setVoucherEmail: Mock<(val: string) => void>;
  emailingVoucherId: string | null;
  sendingVoucherId: string | null;
  copiedId: string | null;
  message: MockMessage | null;
  availableVouchers: MockVoucher[];
  handleAssignSeat: Mock<(e: React.FormEvent) => void>;
  handleSendInviteEmail: Mock<(voucherId: string) => void>;
  copyToClipboard: Mock<(voucherId: string) => void>;
  openEmailForm: Mock<(voucherId: string) => void>;
  closeEmailForm: Mock<() => void>;
}

/* ---------- hoisted mocks ---------- */
const { mockTeamVouchersState } = vi.hoisted(() => ({
  mockTeamVouchersState: {
    email: "",
    setEmail: vi.fn<(val: string) => void>(),
    loading: false,
    voucherEmail: "",
    setVoucherEmail: vi.fn<(val: string) => void>(),
    emailingVoucherId: null,
    sendingVoucherId: null,
    copiedId: null,
    message: null,
    availableVouchers: [],
    handleAssignSeat: vi.fn<(e: React.FormEvent) => void>((e) => e.preventDefault()),
    handleSendInviteEmail: vi.fn<(voucherId: string) => void>(),
    copyToClipboard: vi.fn<(voucherId: string) => void>(),
    openEmailForm: vi.fn<(voucherId: string) => void>(),
    closeEmailForm: vi.fn<() => void>(),
  } as MockTeamVouchersHook,
}));

/* ---------- mock hook useTeamVouchers ---------- */
vi.mock("@/hooks/teams", () => ({
  useTeamVouchers: () => mockTeamVouchersState,
}));

/* ---------- mock react-icons/fi ---------- */
vi.mock("react-icons/fi", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid={`fi-${name}`} {...props} />
  );
  return {
    FiUsers: Icon("users"),
    FiCopy: Icon("copy"),
    FiCheck: Icon("check"),
    FiInfo: Icon("info"),
    FiAlertCircle: Icon("alert-circle"),
    FiMail: Icon("mail"),
    FiSend: Icon("send"),
    FiX: Icon("x"),
  };
});

/* ---------- mock lucide-react ---------- */
vi.mock("lucide-react", () => ({
  Loader2: (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid="icon-loader-2" {...props} />
  ),
}));

/* ---------- mock framer-motion con filtraggio props ---------- */
vi.mock("framer-motion", async () => {
  const ReactActual = await import("react");

  const passthrough =
    (Tag: string) =>
    ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLElement> & { [key: string]: unknown }) =>
      ReactActual.createElement(Tag, props, children);

  return {
    useReducedMotion: () => false,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      section: passthrough("section"),
      div: passthrough("div"),
      form: passthrough("form"),
      ul: passthrough("ul"),
      li: passthrough("li"),
    },
  };
});

/* ---------- component ---------- */
import TeamVouchers from "@/components/Profile/TeamVouchers"; // <-- adegua il path se necessario

describe("TeamVouchers Component Suite", () => {
  const dummyTeam: Team = {
    id: "team-jurio-1",
    name: "Studio Legale Campaniolo",
  } as unknown as Team;

  const dummyVouchers: MockVoucher[] = [
    { id: "VCH-ABC-101" },
    { id: "VCH-XYZ-202" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockTeamVouchersState.email = "";
    mockTeamVouchersState.loading = false;
    mockTeamVouchersState.voucherEmail = "";
    mockTeamVouchersState.emailingVoucherId = null;
    mockTeamVouchersState.sendingVoucherId = null;
    mockTeamVouchersState.copiedId = null;
    mockTeamVouchersState.message = null;
    mockTeamVouchersState.availableVouchers = [...dummyVouchers];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderComponent = (props: Partial<React.ComponentProps<typeof TeamVouchers>> = {}) => {
    const defaultProps: React.ComponentProps<typeof TeamVouchers> = {
      team: dummyTeam,
      ...props,
    };

    return render(<TeamVouchers {...defaultProps} />);
  };

  test("renderizza l'intestazione, il conteggio plurale degli inviti e il form di assegnazione", () => {
    renderComponent();

    expect(screen.getByRole("heading", { name: /Gestione Inviti/i, level: 2 })).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText(/inviti disponibili dal tuo abbonamento/i)).toBeInTheDocument();

    expect(screen.getByPlaceholderText("collega@azienda.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aggiungi al Team" })).toBeInTheDocument();
  });

  test("adatta il testo al singolare quando è disponibile un solo invito", () => {
    mockTeamVouchersState.availableVouchers = [{ id: "VCH-SOLO-1" }];

    renderComponent();

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText(/invito disponibile dal tuo abbonamento/i)).toBeInTheDocument();
  });

  test("renderizza i messaggi informativi, di successo e di errore", () => {
    // 1. Messaggio di successo
    mockTeamVouchersState.message = {
      type: "success",
      text: "Invito assegnato con successo a mario@rossi.it",
    };
    const { rerender } = renderComponent();

    expect(screen.getByText("Invito assegnato con successo a mario@rossi.it")).toBeInTheDocument();
    expect(screen.getByTestId("fi-check")).toBeInTheDocument();

    // 2. Messaggio di errore
    mockTeamVouchersState.message = {
      type: "error",
      text: "Utente non registrato su Jurio.",
    };
    rerender(<TeamVouchers team={dummyTeam} />);

    expect(screen.getByText("Utente non registrato su Jurio.")).toBeInTheDocument();
    expect(screen.getByTestId("fi-alert-circle")).toBeInTheDocument();

    // 3. Messaggio info
    mockTeamVouchersState.message = {
      type: "info",
      text: "Email di invito inviata correttamente.",
    };
    rerender(<TeamVouchers team={dummyTeam} />);

    expect(screen.getByText("Email di invito inviata correttamente.")).toBeInTheDocument();
    expect(screen.getByTestId("fi-info")).toBeInTheDocument();
  });

  test("mostra lo stato 'Posti esauriti' quando non ci sono voucher disponibili", () => {
    mockTeamVouchersState.availableVouchers = [];

    renderComponent();

    expect(screen.getByRole("heading", { name: "Posti esauriti", level: 3 })).toBeInTheDocument();
    expect(
      screen.getByText(/Hai esaurito i posti inclusi nel tuo team\. Fai l'upgrade del piano/i)
    ).toBeInTheDocument();

    expect(screen.queryByPlaceholderText("collega@azienda.com")).toBeNull();
    expect(screen.queryByText("Oppure condividi un codice d'invito")).toBeNull();
  });

  test("gestisce la digitazione dell'email e l'invio del form di assegnazione diretta", () => {
    renderComponent();

    const emailInput = screen.getByPlaceholderText("collega@azienda.com");
    fireEvent.change(emailInput, { target: { value: "giulia@studiolegale.it" } });

    expect(mockTeamVouchersState.setEmail).toHaveBeenCalledWith("giulia@studiolegale.it");

    const form = emailInput.closest("form")!;
    fireEvent.submit(form);

    expect(mockTeamVouchersState.handleAssignSeat).toHaveBeenCalledTimes(1);
  });

  test("disabilita il form e mostra lo spinner durante l'assegnazione (loading: true)", () => {
    mockTeamVouchersState.loading = true;

    renderComponent();

    expect(screen.getByPlaceholderText("collega@azienda.com")).toBeDisabled();

    const submitBtn = screen.getByRole("button", { name: /Assegnazione\.\.\./i });
    expect(submitBtn).toBeDisabled();
    expect(screen.getByTestId("icon-loader-2")).toBeInTheDocument();
  });

  test("renderizza i codici voucher e permette la copia negli appunti", () => {
    renderComponent();

    expect(screen.getByText("VCH-ABC-101")).toBeInTheDocument();
    expect(screen.getByText("VCH-XYZ-202")).toBeInTheDocument();

    const copyButtons = screen.getAllByRole("button", { name: /Copia/i });
    expect(copyButtons).toHaveLength(2);

    fireEvent.click(copyButtons[0]);
    expect(mockTeamVouchersState.copyToClipboard).toHaveBeenCalledWith("VCH-ABC-101");
  });

  test("mostra lo stato 'Copiato' sul voucher con ID corrispondente a copiedId", () => {
    mockTeamVouchersState.copiedId = "VCH-ABC-101";

    renderComponent();

    const copiedButton = screen.getByRole("button", { name: /Copiato/i });
    expect(copiedButton).toBeInTheDocument();
    expect(copiedButton).toHaveClass("bg-emerald-500");
    expect(screen.getByTestId("fi-check")).toBeInTheDocument();
  });

  test("apre il form di invio email al click su 'Invia Email'", () => {
    renderComponent();

    const sendEmailButtons = screen.getAllByRole("button", { name: /Invia Email/i });
    fireEvent.click(sendEmailButtons[1]);

    expect(mockTeamVouchersState.openEmailForm).toHaveBeenCalledWith("VCH-XYZ-202");
  });

  test("gestisce il form di invio email del voucher, la chiusura e l'invio", () => {
    mockTeamVouchersState.emailingVoucherId = "VCH-XYZ-202";
    mockTeamVouchersState.voucherEmail = "destinatario@avvocati.it";

    renderComponent();

    const emailInput = screen.getByPlaceholderText("Email destinatario");
    expect(emailInput).toHaveValue("destinatario@avvocati.it");

    fireEvent.change(emailInput, { target: { value: "nuovo@avvocati.it" } });
    expect(mockTeamVouchersState.setVoucherEmail).toHaveBeenCalledWith("nuovo@avvocati.it");

    const sendBtn = screen.getByRole("button", { name: /^Invia$/i });
    fireEvent.click(sendBtn);
    expect(mockTeamVouchersState.handleSendInviteEmail).toHaveBeenCalledWith("VCH-XYZ-202");

    const closeBtn = screen.getByTestId("fi-x").closest("button")!;
    fireEvent.click(closeBtn);
    expect(mockTeamVouchersState.closeEmailForm).toHaveBeenCalledTimes(1);
  });

  test("disabilita i controlli durante l'invio dell'email per il voucher specifico (sendingVoucherId)", () => {
    mockTeamVouchersState.emailingVoucherId = "VCH-XYZ-202";
    mockTeamVouchersState.sendingVoucherId = "VCH-XYZ-202";

    renderComponent();

    expect(screen.getByPlaceholderText("Email destinatario")).toBeDisabled();

    const sendingBtn = screen.getByRole("button", { name: /^Invio\.\.\.$/i });
    expect(sendingBtn).toBeDisabled();
    expect(screen.getByTestId("icon-loader-2")).toBeInTheDocument();
  });
});