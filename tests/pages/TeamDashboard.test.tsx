import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

/* ---------- hoisted mocks ---------- */
const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));

/* ---------- mock react-router-dom ---------- */
vi.mock("react-router-dom", () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
}));

/* ---------- mock subcomponents ---------- */
vi.mock("@/features/teams/components/JoinTeamWithVoucher", () => ({
  __esModule: true,
  default: () => <div data-testid="join-team-voucher">Join Team With Voucher</div>,
}));

vi.mock("@/features/teams/components/TeamMembers", () => ({
  __esModule: true,
  default: ({
    teamId,
    isManager,
    currentUserUid,
  }: {
    teamId: string;
    isManager: boolean;
    currentUserUid: string;
  }) => (
    <div
      data-testid="team-members"
      data-team-id={teamId}
      data-is-manager={isManager}
      data-uid={currentUserUid}
    >
      Membri del Team
    </div>
  ),
}));

vi.mock("@/shared/components/YourDocument", () => ({
  __esModule: true,
  YourDocument: () => <div data-testid="your-document">I Tuoi Documenti</div>,
}));

vi.mock("@/features/teams/components/TeamSettings", () => ({
  __esModule: true,
  default: ({
    team,
    isManager,
  }: {
    team: { id: string; name?: string };
    isManager: boolean;
  }) => (
    <div data-testid="team-settings" data-is-manager={isManager} data-team-name={team.name}>
      Impostazioni Team
    </div>
  ),
}));

vi.mock("@/features/teams/components/TeamVouchers", () => ({
  __esModule: true,
  default: ({ team }: { team: { id: string; name?: string } }) => (
    <div data-testid="team-vouchers" data-team-id={team.id}>
      Voucher Team
    </div>
  ),
}));

/* ---------- mock useTeamDashboard hook ---------- */
type MockUser = { uid: string; email?: string };
type MockTeam = { id: string; name?: string; ownerId?: string };

type TeamDashboardState = {
  user: MockUser | null;
  team: MockTeam | null;
  loading: boolean;
  isManager: boolean;
};

let mockDashboardState: TeamDashboardState = {
  user: { uid: "usr_flv_2026" },
  team: { id: "team_jurio_1", name: "Studio Legale Campaniolo" },
  loading: false,
  isManager: false,
};

vi.mock("@/features/teams/hooks/useTeamDashboard", () => ({
  __esModule: true,
  useTeamDashboard: () => mockDashboardState,
}));

/* ---------- component under test ---------- */
import TeamDashboard from "@/features/teams/TeamDashboard"; // <-- adegua il path se necessario

describe("TeamDashboard Page Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDashboardState = {
      user: { uid: "usr_flv_2026" },
      team: { id: "team_jurio_1", name: "Studio Legale Campaniolo" },
      loading: false,
      isManager: false,
    };
  });

  test("mostra lo stato di caricamento quando loading è true", () => {
    mockDashboardState.loading = true;
    render(<TeamDashboard />);

    expect(screen.getByText("Caricamento Workspace in corso...")).toBeInTheDocument();
    expect(screen.queryByTestId("team-members")).not.toBeInTheDocument();
  });

  test("renderizza JoinTeamWithVoucher quando l'utente non fa parte di alcun team o non è loggato", () => {
    mockDashboardState.team = null;
    const { rerender } = render(<TeamDashboard />);

    expect(screen.getByTestId("join-team-voucher")).toBeInTheDocument();
    expect(screen.queryByTestId("team-members")).not.toBeInTheDocument();

    mockDashboardState.user = null;
    rerender(<TeamDashboard />);
    expect(screen.getByTestId("join-team-voucher")).toBeInTheDocument();
  });

  test("renderizza la vista membro con titolo, membri, documenti e navigazione indietro", () => {
    render(<TeamDashboard />);

    expect(
      screen.getByRole("heading", { name: "Studio Legale Campaniolo", level: 1 })
    ).toBeInTheDocument();
    expect(screen.getByText("Il tuo spazio di lavoro condiviso")).toBeInTheDocument();

    const membersComponent = screen.getByTestId("team-members");
    expect(membersComponent).toHaveAttribute("data-team-id", "team_jurio_1");
    expect(membersComponent).toHaveAttribute("data-is-manager", "false");
    expect(membersComponent).toHaveAttribute("data-uid", "usr_flv_2026");

    expect(screen.getByTestId("your-document")).toBeInTheDocument();

    // Sezioni manager non visibili
    expect(screen.queryByTestId("team-settings")).not.toBeInTheDocument();
    expect(screen.queryByTestId("team-vouchers")).not.toBeInTheDocument();

    // Navigazione indietro
    const backBtn = screen.getByRole("button", { name: "Torna al profilo" });
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  test("renderizza le sezioni esclusive del manager (TeamSettings e TeamVouchers) quando isManager è true", () => {
    mockDashboardState.isManager = true;
    render(<TeamDashboard />);

    expect(screen.getByText("Pannello di controllo manager")).toBeInTheDocument();

    const membersComponent = screen.getByTestId("team-members");
    expect(membersComponent).toHaveAttribute("data-is-manager", "true");

    const settingsComponent = screen.getByTestId("team-settings");
    expect(settingsComponent).toBeInTheDocument();
    expect(settingsComponent).toHaveAttribute("data-is-manager", "true");

    const vouchersComponent = screen.getByTestId("team-vouchers");
    expect(vouchersComponent).toBeInTheDocument();
    expect(vouchersComponent).toHaveAttribute("data-team-id", "team_jurio_1");
  });

  test("mostra il fallback 'Workspace' nel titolo se team.name non è definito", () => {
    mockDashboardState.team = { id: "team_unnamed", name: "" };
    render(<TeamDashboard />);

    expect(screen.getByRole("heading", { name: "Workspace", level: 1 })).toBeInTheDocument();
  });
});