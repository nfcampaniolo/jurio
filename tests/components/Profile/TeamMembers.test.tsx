import { describe, test, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

/* ---------- tipi mock useTeamMembers ---------- */
interface MockTeamMember {
  uid: string;
  displayName: string;
  role: "owner" | "editor" | "viewer";
  avatarUrl?: string;
  expire?: { toDate: () => Date };
}

interface MockTeamMembersHook {
  members: MockTeamMember[];
  loading: boolean;
  handleRoleChange: Mock<(uid: string, newRole: string) => void>;
  getInitial: Mock<(name: string) => string>;
  removeMember: Mock<(uid: string, revokeDocs: boolean) => Promise<void>>;
}

/* ---------- hoisted mocks ---------- */
const { mockTeamMembersState } = vi.hoisted(() => ({
  mockTeamMembersState: {
    members: [],
    loading: false,
    handleRoleChange: vi.fn<(uid: string, newRole: string) => void>(),
    getInitial: vi.fn<(name: string) => string>((name) => name?.[0]?.toUpperCase() || "?"),
    removeMember: vi.fn<(uid: string, revokeDocs: boolean) => Promise<void>>(),
  } as MockTeamMembersHook,
}));

/* ---------- mock hook useTeamMembers ---------- */
vi.mock("@/features/teams/hooks/useTeamMembers", () => ({ // <-- Update this path
  useTeamMembers: () => mockTeamMembersState,
}));
/* ---------- mock react-icons/fi ---------- */
vi.mock("react-icons/fi", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid={`fi-${name}`} {...props} />
  );
  return {
    FiUserCheck: Icon("user-check"),
    FiShield: Icon("shield"),
    FiClock: Icon("clock"),
    FiInfo: Icon("info"),
    FiTrash2: Icon("trash-2"),
    FiLogOut: Icon("log-out"),
    FiAlertCircle: Icon("alert-circle"),
  };
});

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
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      section: passthrough("section"),
      div: passthrough("div"),
      ul: passthrough("ul"),
      li: passthrough("li"),
    },
  };
});

/* ---------- component ---------- */
import TeamMembers from "@/features/teams/components/TeamMembers"; // <-- adegua il path se necessario

describe("TeamMembers Component Suite", () => {
  const dummyMembers: MockTeamMember[] = [
    {
      uid: "user-me",
      displayName: "Flavio Campaniolo",
      role: "owner",
      avatarUrl: "https://jurio.it/avatars/flavio.png",
      expire: { toDate: () => new Date(2027, 4, 15) },
    },
    {
      uid: "user-editor",
      displayName: "Giulia Bianchi",
      role: "editor",
    },
    {
      uid: "user-viewer",
      displayName: "Marco Rossi",
      role: "viewer",
      expire: { toDate: () => new Date(2026, 11, 31) },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockTeamMembersState.members = [...dummyMembers];
    mockTeamMembersState.loading = false;
    mockTeamMembersState.removeMember.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderComponent = (props: Partial<React.ComponentProps<typeof TeamMembers>> = {}) => {
    const defaultProps: React.ComponentProps<typeof TeamMembers> = {
      teamId: "team-workspace-123",
      isManager: true,
      currentUserUid: "user-me",
      ...props,
    };

    return render(<TeamMembers {...defaultProps} />);
  };

  test("mostra lo stato di caricamento con scheletri quando loading è true", () => {
    mockTeamMembersState.loading = true;

    const { container } = renderComponent();

    expect(screen.getByRole("heading", { name: /Membri del Workspace/i, level: 2 })).toBeInTheDocument();
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(3);
    expect(screen.queryByText("Flavio Campaniolo")).toBeNull();
  });

  test("renderizza i membri del team con avatar, iniziali, badge 'Tu' e data di scadenza", () => {
    renderComponent();

    // 1. Membro corrente con avatar e badge 'Tu'
    expect(screen.getByText("Flavio Campaniolo")).toBeInTheDocument();
    expect(screen.getByText("Tu")).toBeInTheDocument();
    const avatarImg = screen.getByRole("img", { name: "Flavio Campaniolo" });
    expect(avatarImg).toHaveAttribute("src", "https://jurio.it/avatars/flavio.png");

    // 2. Membro senza avatar: fallback iniziale
    expect(screen.getByText("Giulia Bianchi")).toBeInTheDocument();
    expect(mockTeamMembersState.getInitial).toHaveBeenCalledWith("Giulia Bianchi");
    expect(screen.getByText("G")).toBeInTheDocument();

    // 3. Scadenze formattate meglio
    expect(screen.getByText(/15\/(?:0?5)\/2027|5\/15\/2027/)).toBeInTheDocument();
    expect(screen.getByText(/31\/12\/2026|12\/31\/2026/)).toBeInTheDocument();
  });

  test("permette al manager di modificare il ruolo degli altri membri tramite select", () => {
    renderComponent({ isManager: true, currentUserUid: "user-me" });

    // La select è presente solo per gli altri membri (non per se stessi)
    const selects = screen.getAllByRole("combobox");
    expect(selects).toHaveLength(2);

    fireEvent.change(selects[0], { target: { value: "viewer" } });
    expect(mockTeamMembersState.handleRoleChange).toHaveBeenCalledWith("user-editor", "viewer");
  });

  test("mostra il badge di ruolo statico quando isManager è false o per il proprio profilo", () => {
    renderComponent({ isManager: false, currentUserUid: "user-me" });

    expect(screen.queryByRole("combobox")).toBeNull();

    // Tutti i ruoli sono mostrati come testo/badge statico
    expect(screen.getByText("owner")).toBeInTheDocument();
    expect(screen.getByText("editor")).toBeInTheDocument();
    expect(screen.getByText("viewer")).toBeInTheDocument();
  });

  test("disabilita il pulsante di uscita per l'utente corrente se è l'unico owner del gruppo", () => {
    renderComponent({ currentUserUid: "user-me" });

    const leaveBtn = screen.getByTitle("Non puoi uscire: sei l'unico owner del gruppo.");
    expect(leaveBtn).toBeInTheDocument();
    expect(leaveBtn).toBeDisabled();
  });

  test("permette l'uscita se ci sono più owner: apre la modale, gestisce la checkbox documenti e conferma", async () => {
    const multiOwnerMembers: MockTeamMember[] = [
      ...dummyMembers,
      {
        uid: "user-owner-2",
        displayName: "Secondo Owner",
        role: "owner",
      },
    ];
    mockTeamMembersState.members = multiOwnerMembers;

    renderComponent({ currentUserUid: "user-me" });

    const leaveBtn = screen.getByTitle("Esci dal gruppo");
    expect(leaveBtn).not.toBeDisabled();

    fireEvent.click(leaveBtn);

    // Modale di conferma abbandono
    expect(screen.getByRole("heading", { name: /Abbandona il gruppo/i, level: 3 })).toBeInTheDocument();
    expect(
      screen.getByText(/Sei sicuro di voler abbandonare questo workspace\? Perderai l'accesso a tutte le funzionalità/i)
    ).toBeInTheDocument();

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();

    // Deseleziona riassegnazione fascicoli
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();

    // Conferma uscita
    const confirmBtn = screen.getByRole("button", { name: "Sì, esci" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockTeamMembersState.removeMember).toHaveBeenCalledWith("user-me", false);
    });

    expect(screen.queryByRole("heading", { name: /Abbandona il gruppo/i })).toBeNull();
  });

  test("permette al manager di rimuovere un altro membro e di annullare la modale", () => {
    renderComponent({ isManager: true, currentUserUid: "user-me" });

    const deleteButtons = screen.getAllByTitle("Rimuovi membro");
    expect(deleteButtons).toHaveLength(2);

    // Apertura modale per Giulia Bianchi
    fireEvent.click(deleteButtons[0]);

    expect(screen.getByRole("heading", { name: /Rimuovi membro/i, level: 3 })).toBeInTheDocument();
    expect(screen.getByText(/Sei sicuro di voler rimuovere Giulia Bianchi dal workspace\?/i)).toBeInTheDocument();

    // Annulla azione
    const cancelBtn = screen.getByRole("button", { name: "Annulla" });
    fireEvent.click(cancelBtn);

    expect(mockTeamMembersState.removeMember).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: /Rimuovi membro/i })).toBeNull();
  });

  test("esegue la rimozione del membro trasferendo i documenti (default revokeDocs: true)", async () => {
    renderComponent({ isManager: true, currentUserUid: "user-me" });

    const deleteButtons = screen.getAllByTitle("Rimuovi membro");
    fireEvent.click(deleteButtons[1]); // Marco Rossi

    const confirmBtn = screen.getByRole("button", { name: "Rimuovi" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockTeamMembersState.removeMember).toHaveBeenCalledWith("user-viewer", true);
    });
  });
});