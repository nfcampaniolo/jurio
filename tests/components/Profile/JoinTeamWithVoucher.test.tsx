import { describe, test, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

/* ---------- tipi mock hook teams ---------- */
interface Team {
  id: string;
  name: string;
}

interface MockJoinTeamHook {
  step: number;
  setStep: Mock<(step: number) => void>;
  voucherCode: string;
  setVoucherCode: Mock<(code: string) => void>;
  loading: boolean;
  joining: boolean;
  teams: Team[];
  selectedTeamId: string;
  setSelectedTeamId: Mock<(id: string) => void>;
  handleVerifyVoucher: Mock<(e: React.FormEvent) => void>;
  handleJoinTeam: Mock<() => void>;
}

/* ---------- hoisted mocks ---------- */
const { mockJoinTeamState } = vi.hoisted(() => ({
  mockJoinTeamState: {
    step: 1,
    setStep: vi.fn<(step: number) => void>(),
    voucherCode: "",
    setVoucherCode: vi.fn<(code: string) => void>(),
    loading: false,
    joining: false,
    teams: [],
    selectedTeamId: "",
    setSelectedTeamId: vi.fn<(id: string) => void>(),
    handleVerifyVoucher: vi.fn<(e: React.FormEvent) => void>((e) => e.preventDefault()),
    handleJoinTeam: vi.fn<() => void>(),
  } as MockJoinTeamHook,
}));

/* ---------- mock hook teams ---------- */
vi.mock("@/features/teams/hooks/useJoinTeamWithVoucher", () => ({
  useJoinTeamWithVoucher: () => mockJoinTeamState,
}));

/* ---------- mock react-icons/fi ---------- */
vi.mock("react-icons/fi", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid={`fi-${name}`} {...props} />
  );
  return {
    FiKey: Icon("key"),
    FiArrowRight: Icon("arrow-right"),
    FiCheckCircle: Icon("check-circle"),
    FiX: Icon("x"),
    FiShield: Icon("shield"),
  };
});

/* ---------- mock lucide-react ---------- */
vi.mock("lucide-react", () => ({
  Loader2: (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid="icon-loader-2" {...props} />
  ),
}));

/* ---------- mock framer-motion ---------- */
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
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      section: passthrough("section"),
      div: passthrough("div"),
      form: passthrough("form"),
    },
  };
});

/* ---------- component ---------- */
import JoinTeamWithVoucher from "@/features/teams/components/JoinTeamWithVoucher"; // <-- adegua il path se necessario

describe("JoinTeamWithVoucher Component Suite", () => {
  const mockOnJoinSuccess = vi.fn<() => void>();

  beforeEach(() => {
    vi.clearAllMocks();

    mockJoinTeamState.step = 1;
    mockJoinTeamState.voucherCode = "";
    mockJoinTeamState.loading = false;
    mockJoinTeamState.joining = false;
    mockJoinTeamState.teams = [];
    mockJoinTeamState.selectedTeamId = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderComponent = (
    props: Partial<React.ComponentProps<typeof JoinTeamWithVoucher>> = {}
  ) => {
    const defaultProps: React.ComponentProps<typeof JoinTeamWithVoucher> = {
      onJoinSuccess: mockOnJoinSuccess,
      ...props,
    };

    return render(<JoinTeamWithVoucher {...defaultProps} />);
  };

  test("renderizza l'intestazione, la descrizione e il form di inserimento del codice al Step 1", () => {
    renderComponent();

    expect(screen.getByRole("heading", { name: "Unisciti a un Workspace", level: 2 })).toBeInTheDocument();
    expect(
      screen.getByText(/Hai ricevuto un codice d'invito\? Inseriscilo qui per accedere al team/i)
    ).toBeInTheDocument();

    const voucherInput = screen.getByPlaceholderText("Es. VCH-123ABC");
    expect(voucherInput).toBeInTheDocument();
    expect(voucherInput).toHaveValue("");

    const verifyBtn = screen.getByRole("button", { name: /Verifica Codice/i });
    expect(verifyBtn).toBeDisabled();
    expect(screen.getByTestId("fi-key")).toBeInTheDocument();
  });

  test("converte il codice voucher in maiuscolo all'inserimento e invoca setVoucherCode", () => {
    renderComponent();

    const voucherInput = screen.getByPlaceholderText("Es. VCH-123ABC");
    fireEvent.change(voucherInput, { target: { value: "vch-jurio-2026" } });

    expect(mockJoinTeamState.setVoucherCode).toHaveBeenCalledWith("VCH-JURIO-2026");
  });

  test("mostra lo stato di caricamento e disabilita gli elementi durante la verifica del voucher", () => {
    mockJoinTeamState.voucherCode = "VCH-123ABC";
    mockJoinTeamState.loading = true;

    renderComponent();

    const voucherInput = screen.getByPlaceholderText("Es. VCH-123ABC");
    expect(voucherInput).toBeDisabled();

    const verifyBtn = screen.getByRole("button", { name: /Verifica in corso\.\.\./i });
    expect(verifyBtn).toBeDisabled();
    expect(screen.getByTestId("icon-loader-2")).toBeInTheDocument();
  });

  test("sottomette il form invocando handleVerifyVoucher quando il codice è valido", () => {
    mockJoinTeamState.voucherCode = "VCH-VALID123";

    renderComponent();

    const form = screen.getByPlaceholderText("Es. VCH-123ABC").closest("form")!;
    fireEvent.submit(form);

    expect(mockJoinTeamState.handleVerifyVoucher).toHaveBeenCalledTimes(1);
  });

  test("renderizza il messaggio di conferma per un singolo Workspace trovato al Step 2", () => {
    mockJoinTeamState.step = 2;
    mockJoinTeamState.teams = [{ id: "team-alpha", name: "Studio Legale Alpha" }];
    mockJoinTeamState.selectedTeamId = "team-alpha";

    renderComponent();

    expect(
      screen.getByText("Codice verificato! Confermi di volerti unire a questo Workspace?")
    ).toBeInTheDocument();

    const radio = screen.getByRole("radio", { name: "Studio Legale Alpha" });
    expect(radio).toBeInTheDocument();
    expect(radio).toBeChecked();
  });

  test("renderizza la lista di scelta multipla al Step 2 e gestisce la selezione del team", () => {
    mockJoinTeamState.step = 2;
    mockJoinTeamState.teams = [
      { id: "team-1", name: "Studio Associato Nord" },
      { id: "team-2", name: "Studio Associato Sud" },
    ];
    mockJoinTeamState.selectedTeamId = "team-1";

    renderComponent();

    expect(
      screen.getByText(
        "Abbiamo trovato più Workspace associati a questo codice. Scegli a quale vuoi unirti:"
      )
    ).toBeInTheDocument();

    const radioTeam1 = screen.getByRole("radio", { name: "Studio Associato Nord" });
    const radioTeam2 = screen.getByRole("radio", { name: "Studio Associato Sud" });

    expect(radioTeam1).toBeChecked();
    expect(radioTeam2).not.toBeChecked();

    fireEvent.click(radioTeam2);
    expect(mockJoinTeamState.setSelectedTeamId).toHaveBeenCalledWith("team-2");
  });

  test("torna allo Step 1 quando l'utente clicca sul pulsante Annulla", () => {
    mockJoinTeamState.step = 2;
    mockJoinTeamState.teams = [{ id: "team-1", name: "Studio Legale" }];

    renderComponent();

    const cancelBtn = screen.getByRole("button", { name: /Annulla/i });
    fireEvent.click(cancelBtn);

    expect(mockJoinTeamState.setStep).toHaveBeenCalledWith(1);
  });

  test("esegue l'adesione al team al click su 'Conferma e Accedi'", () => {
    mockJoinTeamState.step = 2;
    mockJoinTeamState.teams = [{ id: "team-1", name: "Studio Legale" }];
    mockJoinTeamState.selectedTeamId = "team-1";

    renderComponent();

    const confirmBtn = screen.getByRole("button", { name: /Conferma e Accedi/i });
    expect(confirmBtn).not.toBeDisabled();

    fireEvent.click(confirmBtn);
    expect(mockJoinTeamState.handleJoinTeam).toHaveBeenCalledTimes(1);
  });

  test("disabilita le azioni e mostra il caricamento durante l'operazione di accesso (joining: true)", () => {
    mockJoinTeamState.step = 2;
    mockJoinTeamState.teams = [{ id: "team-1", name: "Studio Legale" }];
    mockJoinTeamState.selectedTeamId = "team-1";
    mockJoinTeamState.joining = true;

    renderComponent();

    const cancelBtn = screen.getByRole("button", { name: /Annulla/i });
    expect(cancelBtn).toBeDisabled();

    const confirmBtn = screen.getByRole("button", { name: /Accesso in corso\.\.\./i });
    expect(confirmBtn).toBeDisabled();
    expect(screen.getByTestId("icon-loader-2")).toBeInTheDocument();
  });
});