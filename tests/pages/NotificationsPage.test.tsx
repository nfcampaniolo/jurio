import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import type { NotificationType } from "@/interfaces/interfaces";

/* ---------- tipi mock notifica ---------- */
interface MockNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  isGlobal?: boolean;
  createdAt: string | Date;
}

/* ---------- mock helmet ---------- */
vi.mock("@dr.pogodin/react-helmet", () => ({
  Helmet: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-helmet">{children}</div>
  ),
}));

/* ---------- mock lucide-react icons ---------- */
vi.mock("lucide-react", () => {
  const mockIcon = (name: string) => (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid={`icon-${name}`} {...props} />
  );
  return {
    Bell: mockIcon("bell"),
    CreditCard: mockIcon("credit-card"),
    Users: mockIcon("users"),
    UserCircle: mockIcon("user-circle"),
    FileText: mockIcon("file-text"),
    LifeBuoy: mockIcon("life-buoy"),
    Info: mockIcon("info"),
    Check: mockIcon("check"),
    CheckCheck: mockIcon("check-check"),
    Loader2: mockIcon("loader-2"),
    Megaphone: mockIcon("megaphone"),
  };
});

/* ---------- state & mock custom hook ---------- */
const mockUseNotificationsState = {
  user: null as { uid: string; email?: string } | null,
  authLoading: false,
  dbLoading: false,
  feedCompleto: [] as MockNotification[],
  unreadCount: 0,
  handleNotificationClick: vi.fn(),
  markAllAsRead: vi.fn(),
  formatTime: vi.fn(() => "10 min fa"),
};

// Adeguare il path relativo al modulo reale di useNotifications
vi.mock("@/features/notifications/hooks/useNotifications", () => ({
  useNotifications: () => mockUseNotificationsState,
}));

/* ---------- subject under test ---------- */
import NotificationsPage from "@/features/notifications/NotificationsPage"; // adegua il path se necessario

describe("NotificationsPage Component Suite", () => {
  const dummyNotifications: MockNotification[] = [
    {
      id: "notif-1",
      type: "billing",
      title: "Rinnovo abbonamento completato",
      message: "La fattura mensile è disponibile nella sezione Piani.",
      isRead: false,
      isGlobal: false,
      createdAt: "2026-09-01T10:00:00Z",
    },
    {
      id: "notif-2",
      type: "team",
      title: "Nuovo membro aggiunto al team",
      message: "Giulia Bianchi si è unita al workspace.",
      isRead: true,
      isGlobal: false,
      createdAt: "2026-08-30T14:30:00Z",
    },
    {
      id: "notif-3",
      type: "support",
      title: "Manutenzione programmata",
      message: "I servizi saranno offline domenica notte per aggiornamenti.",
      isRead: false,
      isGlobal: true,
      createdAt: "2026-09-02T08:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseNotificationsState.user = { uid: "usr_flv_2026", email: "flavio@jurio.it" };
    mockUseNotificationsState.authLoading = false;
    mockUseNotificationsState.dbLoading = false;
    mockUseNotificationsState.feedCompleto = [...dummyNotifications];
    mockUseNotificationsState.unreadCount = 2;
    mockUseNotificationsState.formatTime = vi.fn(() => "Oggi, 12:00");
  });

  describe("Stati di Caricamento e Autenticazione", () => {
    test("mostra lo stato di caricamento quando authLoading o dbLoading è true", () => {
      mockUseNotificationsState.authLoading = true;

      const { rerender } = render(<NotificationsPage />);
      expect(screen.getByText(/Caricamento notifiche\.\.\./i)).toBeInTheDocument();
      expect(screen.getByTestId("icon-loader-2")).toBeInTheDocument();

      // Test con dbLoading attivo
      mockUseNotificationsState.authLoading = false;
      mockUseNotificationsState.dbLoading = true;
      rerender(<NotificationsPage />);
      expect(screen.getByText(/Caricamento notifiche\.\.\./i)).toBeInTheDocument();
    });

    test("mostra il messaggio di accesso richiesto se l'utente non è autenticato", () => {
      mockUseNotificationsState.user = null;

      render(<NotificationsPage />);

      expect(
        screen.getByText("Devi effettuare l'accesso per vedere le notifiche.")
      ).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Notifiche" })).toBeNull();
    });
  });

  describe("Stato Vuoto (Empty Feed)", () => {
    test("renderizza il segnaposto 'Nessuna notifica' se la lista è vuota", () => {
      mockUseNotificationsState.feedCompleto = [];
      mockUseNotificationsState.unreadCount = 0;

      render(<NotificationsPage />);

      expect(screen.getByRole("heading", { name: "Nessuna notifica" })).toBeInTheDocument();
      expect(screen.getByText("Non hai ancora ricevuto aggiornamenti.")).toBeInTheDocument();
      expect(screen.queryByText(/Segna tutte come lette/i)).toBeNull();
      expect(screen.queryByText(/nuove/i)).toBeNull();
    });
  });

  describe("Rendering Lista e Contatori", () => {
    test("renderizza le notifiche con titolo, messaggio, timestamp e conteggio non lette", () => {
      render(<NotificationsPage />);

      expect(screen.getByText("2 nuove")).toBeInTheDocument();
      expect(screen.getByText("Rinnovo abbonamento completato")).toBeInTheDocument();
      expect(screen.getByText("Nuovo membro aggiunto al team")).toBeInTheDocument();
      expect(screen.getByText("Manutenzione programmata")).toBeInTheDocument();
      expect(screen.getAllByText("Oggi, 12:00")).toHaveLength(3);
    });

    test("renderizza le icone corrette per tipo e per notifiche globali", () => {
      render(<NotificationsPage />);

      // notif-1 (billing)
      expect(screen.getByTestId("icon-credit-card")).toBeInTheDocument();
      // notif-2 (team)
      expect(screen.getByTestId("icon-users")).toBeInTheDocument();
      // notif-3 (isGlobal = true, prioritaria su tipo support)
      expect(screen.getByTestId("icon-megaphone")).toBeInTheDocument();
    });

    test("mostra l'indicatore di spunta per lette e l'invito all'azione per non lette", () => {
      render(<NotificationsPage />);

      // 1 letta -> icona check
      expect(screen.getByTestId("icon-check")).toBeInTheDocument();
      // 2 non lette -> etichette "Controlla →"
      expect(screen.getAllByText("Controlla →")).toHaveLength(2);
    });
  });

  describe("Interazioni Utente", () => {
    test("esegue markAllAsRead al click sul pulsante 'Segna tutte come lette'", () => {
      render(<NotificationsPage />);

      const markBtn = screen.getByRole("button", { name: /Segna tutte come lette/i });
      fireEvent.click(markBtn);

      expect(mockUseNotificationsState.markAllAsRead).toHaveBeenCalledTimes(1);
    });

    test("invoca handleNotificationClick al click sulla riga della notifica", () => {
      render(<NotificationsPage />);

      const firstNotification = screen.getByText("Rinnovo abbonamento completato");
      fireEvent.click(firstNotification);

      expect(mockUseNotificationsState.handleNotificationClick).toHaveBeenCalledWith(
        dummyNotifications[0]
      );
    });

    test("invoca handleNotificationClick alla pressione dei tasti Enter o Spazio", () => {
      render(<NotificationsPage />);

      const notifElements = screen.getAllByRole("button");
      // Il primo elemento è il bottone "Segna tutte come lette", gli altri sono i container notifica
      const secondNotifCard = notifElements[2]; 

      // Pressione tasto Enter
      fireEvent.keyDown(secondNotifCard, { key: "Enter" });
      expect(mockUseNotificationsState.handleNotificationClick).toHaveBeenCalledWith(
        dummyNotifications[1]
      );

      // Pressione tasto Spazio
      fireEvent.keyDown(secondNotifCard, { key: " " });
      expect(mockUseNotificationsState.handleNotificationClick).toHaveBeenCalledWith(
        dummyNotifications[1]
      );

      // Nessuna chiamata per altri tasti (es: Escape)
      fireEvent.keyDown(secondNotifCard, { key: "Escape" });
      expect(mockUseNotificationsState.handleNotificationClick).toHaveBeenCalledTimes(2);
    });
  });
});