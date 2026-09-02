import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import type { PastChat, PastFascicolo } from "@/interfaces/interfaces";

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

/* ---------- mock @dr.pogodin/react-helmet ---------- */
vi.mock("@dr.pogodin/react-helmet", () => ({
  __esModule: true,
  Helmet: () => null,
}));

/* ---------- mock firebase/auth ---------- */
let mockCurrentUserId: string | undefined = "user-123";

vi.mock("firebase/auth", () => ({
  __esModule: true,
  getAuth: () => ({
    currentUser: mockCurrentUserId ? { uid: mockCurrentUserId } : null,
  }),
}));

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", () => ({
  __esModule: true,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: React.forwardRef<
      HTMLDivElement,
      React.HTMLAttributes<HTMLDivElement> & {
        initial?: unknown;
        animate?: unknown;
        exit?: unknown;
        transition?: unknown;
        layoutId?: unknown;
      }
    >(
      (
        {
          children,
          ...props
        },
        ref
      ) => (
        <div ref={ref} {...props}>
          {children}
        </div>
      )
    ),
  },
}));

/* ---------- mock child components ---------- */
vi.mock("@/components/Info/Header", () => ({
  __esModule: true,
  Header: () => <header data-testid="main-header">Header</header>,
}));

vi.mock("@/components/ConfirmModal", () => ({
  __esModule: true,
  ConfirmModal: ({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
  }: {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  }) =>
    isOpen ? (
      <div data-testid="confirm-modal">
        <h2>{title}</h2>
        <p>{message}</p>
        <button onClick={onCancel} data-testid="confirm-modal-cancel">
          Annulla
        </button>
        <button onClick={onConfirm} data-testid="confirm-modal-confirm">
          Elimina
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/Chat/PastFascicoli", () => ({
  __esModule: true,
  PastFascicoli: ({
    fascicoli,
    chats,
    onSelectFascicolo,
    onSelectChat,
    onDeleteFascicolo,
    onDeleteChat,
    onRenameFascicolo,
    onRenameChat,
    onBack,
  }: {
    fascicoli: PastFascicolo[];
    chats: PastChat[];
    onSelectFascicolo: (f: PastFascicolo) => void;
    onSelectChat: (c: PastChat) => void;
    onDeleteFascicolo: (id: string) => void;
    onDeleteChat: (id: string) => void;
    onRenameFascicolo: (id: string, name: string) => void;
    onRenameChat: (id: string, name: string) => void;
    onBack: () => void;
  }) => (
    <div data-testid="past-fascicoli-component">
      <button onClick={onBack} data-testid="btn-back">
        Indietro
      </button>

      {fascicoli.map((f) => (
        <div key={f.id} data-testid={`fascicolo-${f.id}`}>
          <span onClick={() => onSelectFascicolo(f)}>{f.title}</span>
          <button
            onClick={() => onRenameFascicolo(f.id, f.title)}
            data-testid={`rename-fascicolo-${f.id}`}
          >
            Rinomina Fascicolo
          </button>
          <button
            onClick={() => onDeleteFascicolo(f.id)}
            data-testid={`delete-fascicolo-${f.id}`}
          >
            Elimina Fascicolo
          </button>
        </div>
      ))}

      {chats.map((c) => (
        <div key={c.id} data-testid={`chat-${c.id}`}>
          <span onClick={() => onSelectChat(c)}>{c.title}</span>
          <button
            onClick={() => onRenameChat(c.id, c.title)}
            data-testid={`rename-chat-${c.id}`}
          >
            Rinomina Chat
          </button>
          <button
            onClick={() => onDeleteChat(c.id)}
            data-testid={`delete-chat-${c.id}`}
          >
            Elimina Chat
          </button>
        </div>
      ))}
    </div>
  ),
}));

/* ---------- mock useLegalChat hook ---------- */
const mockDeleteFascicolo = vi.fn();
const mockDeleteChat = vi.fn();
const mockRenameFascicolo = vi.fn();
const mockRenameChat = vi.fn();

const defaultFascicoli: PastFascicolo[] = [
  {
    id: "f-1",
    title: "Fascicolo Societario",
    ownerId: "user-123",
  } as unknown as PastFascicolo,
  {
    id: "f-shared",
    title: "Fascicolo Condiviso da Terzi",
    ownerId: "other-user",
  } as unknown as PastFascicolo,
];

const defaultChats: PastChat[] = [
  {
    id: "c-1",
    title: "Consulenza Contrattuale",
  } as unknown as PastChat,
];

let mockLegalChatState = {
  pastFascicoli: defaultFascicoli,
  pastChats: defaultChats,
  isLoadingData: false,
  deleteFascicolo: mockDeleteFascicolo,
  deleteChat: mockDeleteChat,
  renameFascicolo: mockRenameFascicolo,
  renameChat: mockRenameChat,
};

vi.mock("@/hooks/useLegalChat", () => ({
  __esModule: true,
  useLegalChat: () => mockLegalChatState,
}));

/* ---------- component under test ---------- */
import { HistoryPage } from "@/pages/HistoryPage"; // <-- adegua il path se necessario
import { toast } from "react-hot-toast";

describe("HistoryPage Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUserId = "user-123";
    mockLegalChatState = {
      pastFascicoli: [...defaultFascicoli],
      pastChats: [...defaultChats],
      isLoadingData: false,
      deleteFascicolo: mockDeleteFascicolo,
      deleteChat: mockDeleteChat,
      renameFascicolo: mockRenameFascicolo,
      renameChat: mockRenameChat,
    };
  });

  test("mostra lo stato di caricamento quando isLoadingData è true", () => {
    mockLegalChatState.isLoadingData = true;
    render(<HistoryPage />);

    expect(
      screen.getByText("Caricamento archivio in corso...")
    ).toBeInTheDocument();
    expect(screen.queryByTestId("past-fascicoli-component")).not.toBeInTheDocument();
  });

  test("renderizza i fascicoli e le chat gestendo la navigazione", () => {
    render(<HistoryPage />);

    expect(screen.getByTestId("main-header")).toBeInTheDocument();
    expect(screen.getByTestId("past-fascicoli-component")).toBeInTheDocument();

    // Selezione Fascicolo
    fireEvent.click(screen.getByText("Fascicolo Societario"));
    expect(mockNavigate).toHaveBeenCalledWith("/fascicolo/f-1");

    // Selezione Chat
    fireEvent.click(screen.getByText("Consulenza Contrattuale"));
    expect(mockNavigate).toHaveBeenCalledWith("/chat/c-1");

    // Pulsante Indietro
    fireEvent.click(screen.getByTestId("btn-back"));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  test("blocca l'eliminazione del fascicolo se l'utente non è il proprietario", () => {
    render(<HistoryPage />);

    const deleteSharedBtn = screen.getByTestId("delete-fascicolo-f-shared");
    fireEvent.click(deleteSharedBtn);

    expect(toast.error).toHaveBeenCalledWith(
      "Non hai i permessi necessari. Solo il proprietario può eliminare questo fascicolo."
    );
    expect(screen.queryByTestId("confirm-modal")).not.toBeInTheDocument();
  });

  test("apre la modale di conferma ed esegue l'eliminazione di un fascicolo di proprietà", async () => {
    render(<HistoryPage />);

    const deleteBtn = screen.getByTestId("delete-fascicolo-f-1");
    fireEvent.click(deleteBtn);

    expect(screen.getByTestId("confirm-modal")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Sei sicuro di voler eliminare definitivamente questo fascicolo? Tutti i documenti e le analisi ad esso associati andranno persi."
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("confirm-modal-confirm"));

    await waitFor(() => {
      expect(mockDeleteFascicolo).toHaveBeenCalledWith("f-1");
      expect(screen.queryByTestId("confirm-modal")).not.toBeInTheDocument();
    });
  });

  test("apre la modale di conferma ed esegue l'eliminazione di una chat", async () => {
    render(<HistoryPage />);

    const deleteChatBtn = screen.getByTestId("delete-chat-c-1");
    fireEvent.click(deleteChatBtn);

    expect(screen.getByTestId("confirm-modal")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Sei sicuro di voler eliminare definitivamente questa chat? L'azione è irreversibile."
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("confirm-modal-confirm"));

    await waitFor(() => {
      expect(mockDeleteChat).toHaveBeenCalledWith("c-1");
      expect(screen.queryByTestId("confirm-modal")).not.toBeInTheDocument();
    });
  });

  test("blocca la rinomina del fascicolo se l'utente non è il proprietario", () => {
    render(<HistoryPage />);

    const renameSharedBtn = screen.getByTestId("rename-fascicolo-f-shared");
    fireEvent.click(renameSharedBtn);

    expect(toast.error).toHaveBeenCalledWith(
      "Non hai i permessi necessari. Solo il proprietario può rinominare questo fascicolo."
    );
    expect(screen.queryByLabelText("Nuovo nome")).not.toBeInTheDocument();
  });

  test("apre la modale di rinomina, modifica il valore ed esegue renameFascicolo", async () => {
    render(<HistoryPage />);

    fireEvent.click(screen.getByTestId("rename-fascicolo-f-1"));

    const input = screen.getByLabelText("Nuovo nome");
    expect(input).toHaveValue("Fascicolo Societario");

    const submitBtn = screen.getByRole("button", { name: "Salva modifiche" });
    expect(submitBtn).toBeDisabled(); // Disabilitato perché il nome è identico

    fireEvent.change(input, { target: { value: "Fascicolo Societario Revisionato" } });
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockRenameFascicolo).toHaveBeenCalledWith(
        "f-1",
        "Fascicolo Societario Revisionato"
      );
      expect(screen.queryByLabelText("Nuovo nome")).not.toBeInTheDocument();
    });
  });

  test("apre la modale di rinomina ed esegue renameChat", async () => {
    render(<HistoryPage />);

    fireEvent.click(screen.getByTestId("rename-chat-c-1"));

    const input = screen.getByLabelText("Nuovo nome");
    fireEvent.change(input, { target: { value: "Consulenza Penale 2026" } });

    const submitBtn = screen.getByRole("button", { name: "Salva modifiche" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockRenameChat).toHaveBeenCalledWith("c-1", "Consulenza Penale 2026");
      expect(screen.queryByLabelText("Nuovo nome")).not.toBeInTheDocument();
    });
  });
});