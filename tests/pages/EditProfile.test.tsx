import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

/* ---------- mock react-router-dom ---------- */
const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
}));

/* ---------- mock react-hot-toast ---------- */
vi.mock("react-hot-toast", () => ({
  __esModule: true,
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", () => ({
  __esModule: true,
  useReducedMotion: vi.fn(() => false),
  motion: {
    main: React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement> & { variants?: unknown; initial?: unknown; animate?: unknown }>(
      ({ children, ...props }, ref) => (
        <main ref={ref} {...props}>{children}</main>
      )
    ),
    div: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { variants?: unknown; initial?: unknown; animate?: unknown; whileHover?: unknown; whileTap?: unknown }>(
      ({ children,  ...props }, ref) => (
        <div ref={ref} {...props}>{children}</div>
      )
    ),
    h1: React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement> & { variants?: unknown }>(
      ({ children, ...props }, ref) => <h1 ref={ref} {...props}>{children}</h1>
    ),
    p: React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement> & { variants?: unknown }>(
      ({ children, ...props }, ref) => <p ref={ref} {...props}>{children}</p>
    ),
    button: React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { whileHover?: unknown; whileTap?: unknown }>(
      ({ children,  ...props }, ref) => <button ref={ref} {...props}>{children}</button>
    ),
  },
}));

/* ---------- mock subcomponents ---------- */
vi.mock("@/components/Profile/EditProfileAvatar", () => ({
  __esModule: true,
  EditProfileAvatar: ({ name }: { name: string }) => (
    <div data-testid="edit-profile-avatar">Avatar per {name}</div>
  ),
}));

vi.mock("@/components/Profile/EditProfileForm", () => ({
  __esModule: true,
  EditProfileForm: ({ name, surname }: { name: string; surname: string }) => (
    <div data-testid="edit-profile-form">Form Dati: {name} {surname}</div>
  ),
}));

vi.mock("@/components/Profile/EditProfileConsents", () => ({
  __esModule: true,
  EditProfileConsents: () => (
    <div data-testid="edit-profile-consents">Consensi Trattamento Dati</div>
  ),
}));

/* ---------- mock useProfile hook ---------- */
const mockHandleSave = vi.fn();
const mockSetName = vi.fn();
const mockSetSurname = vi.fn();
const mockSetAvatar = vi.fn();
const mockSetAvatarFile = vi.fn();
const mockHandleConsentChange = vi.fn();
const mockSetRole = vi.fn();
const mockSetRoleOther = vi.fn();

let mockProfileState = {
  user: { uid: "usr_flv_2026" } as { uid: string } | null,
  loading: false,
  userData: { status: "active", email: "flavio@jurio.it" } as { status: string; email: string } | null,
  name: "Flavio",
  surname: "Campaniolo",
  avatar: "https://jurio.it/avatar.png",
  consents: { marketing: false, profiling: true },
  saving: false,
  setName: mockSetName,
  setSurname: mockSetSurname,
  setAvatar: mockSetAvatar,
  setAvatarFile: mockSetAvatarFile,
  handleConsentChange: mockHandleConsentChange,
  handleSave: mockHandleSave,
  role: "avvocato",
  setRole: mockSetRole,
  roleOther: "",
  setRoleOther: mockSetRoleOther,
};

vi.mock("@/hooks/useProfile", () => ({
  __esModule: true,
  useProfile: () => mockProfileState,
}));

/* ---------- component under test ---------- */
import { EditProfile } from "@/pages/EditProfile"; // <-- adegua il path se necessario
import { toast } from "react-hot-toast";

describe("EditProfile Page Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProfileState = {
      user: { uid: "usr_flv_2026" },
      loading: false,
      userData: { status: "active", email: "flavio@jurio.it" },
      name: "Flavio",
      surname: "Campaniolo",
      avatar: "https://jurio.it/avatar.png",
      consents: { marketing: false, profiling: true },
      saving: false,
      setName: mockSetName,
      setSurname: mockSetSurname,
      setAvatar: mockSetAvatar,
      setAvatarFile: mockSetAvatarFile,
      handleConsentChange: mockHandleConsentChange,
      handleSave: mockHandleSave,
      role: "avvocato",
      setRole: mockSetRole,
      roleOther: "",
      setRoleOther: mockSetRoleOther,
    };
    mockHandleSave.mockResolvedValue(undefined);

    // Mock clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  test("mostra lo stato di caricamento quando i dati profilo non sono ancora disponibili", () => {
    mockProfileState.loading = true;
    const { rerender } = render(<EditProfile />);
    expect(screen.getByText("Caricamento...")).toBeInTheDocument();

    mockProfileState.loading = false;
    mockProfileState.userData = null;
    rerender(<EditProfile />);
    expect(screen.getByText("Caricamento...")).toBeInTheDocument();
  });

  test("renderizza il titolo, i sottocomponenti di modifica e i link legali", () => {
    render(<EditProfile />);

    expect(screen.getByRole("heading", { name: "Modifica profilo", level: 1 })).toBeInTheDocument();
    expect(screen.getByTestId("edit-profile-avatar")).toBeInTheDocument();
    expect(screen.getByTestId("edit-profile-form")).toBeInTheDocument();
    expect(screen.getByTestId("edit-profile-consents")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Termini" })).toHaveAttribute("href", "/termini");
    expect(screen.getByRole("link", { name: "Trattamento dati" })).toHaveAttribute("href", "/gdpr");
  });

  test("gestisce la navigazione indietro e il pulsante annulla", () => {
    render(<EditProfile />);

    const backButton = screen.getByRole("button", { name: /Torna al profilo/i });
    fireEvent.click(backButton);
    expect(mockNavigate).toHaveBeenCalledWith(-1);

    const cancelButton = screen.getByRole("button", { name: "Annulla" });
    fireEvent.click(cancelButton);
    expect(mockNavigate).toHaveBeenCalledWith("/profilo");
  });

  test("copia il token MCP negli appunti e mostra il toast di conferma", () => {
    render(<EditProfile />);

    const copyTokenButton = screen.getByRole("button", { name: /Copia Token MCP/i });
    fireEvent.click(copyTokenButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Bearer usr_flv_2026");
    expect(toast.success).toHaveBeenCalledWith("Token MCP copiato!");
  });

  test("gestisce il salvataggio del profilo con successo", async () => {
    render(<EditProfile />);

    const saveButton = screen.getByRole("button", { name: "Salva" });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockHandleSave).toHaveBeenCalledTimes(1);
      expect(toast.success).toHaveBeenCalledWith("Profilo aggiornato");
      expect(mockNavigate).toHaveBeenCalledWith("/profilo", { replace: true });
    });
  });

  test("gestisce gli errori sollevati durante il salvataggio", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockHandleSave.mockRejectedValue(new Error("Errore Firestore"));

    render(<EditProfile />);

    const saveButton = screen.getByRole("button", { name: "Salva" });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Errore durante il salvataggio.");
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    consoleErrorSpy.mockRestore();
  });

  test("disabilita le azioni e mostra il testo di avanzamento quando saving è true", () => {
    mockProfileState.saving = true;
    render(<EditProfile />);

    const cancelButton = screen.getByRole("button", { name: "Annulla" });
    const saveButton = screen.getByRole("button", { name: /Salvataggio\.\.\./i });

    expect(cancelButton).toBeDisabled();
    expect(saveButton).toBeDisabled();
  });
});