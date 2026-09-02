import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import type { PaymentRecord } from "@/services/paymentService";

/* ---------- hoisted mocks ---------- */
const { mockFetchUserPayments } = vi.hoisted(() => ({
  mockFetchUserPayments: vi.fn<(uid: string) => Promise<PaymentRecord[]>>(),
}));

/* ---------- mock paymentService ---------- */
vi.mock("@/services/paymentService", () => ({
  fetchUserPayments: (uid: string) => mockFetchUserPayments(uid),
}));

/* ---------- mock lucide-react ---------- */
vi.mock("lucide-react", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid={`icon-${name}`} {...props} />
  );
  return {
    Receipt: Icon("receipt"),
    Loader2: Icon("loader-2"),
    AlertCircle: Icon("alert-circle"),
    CreditCard: Icon("credit-card"),
    ExternalLink: Icon("external-link"),
  };
});

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", async () => {
  const ReactActual = await import("react");
  type Props = React.PropsWithChildren<Record<string, unknown>>;

  const passthrough =
    (Tag: string) =>
    ({ children, ...props }: Props) =>
      ReactActual.createElement(Tag, props, children);

  return {
    motion: {
      div: passthrough("div"),
    },
  };
});

/* ---------- component ---------- */
import { PaymentHistory } from "@/components/Plans/PaymentHistory";

describe("PaymentHistory Component Suite", () => {
  const mockPaymentsList: PaymentRecord[] = [
    {
      id: "pay-1",
      completedAt: new Date(2026, 4, 15), // 15 Maggio 2026
      planId: "professional",
      paidValue: 49.0,
      paidCurrency: "EUR",
      provider: "paypal",
      paypalCaptureId: "PAYPAL-CAP-998877",
    } as unknown as PaymentRecord,
    {
      id: "pay-2",
      completedAt: new Date(2026, 6, 20), // 20 Luglio 2026
      planId: "",
      paidValue: 99.0,
      paidCurrency: "EUR",
      provider: "stripe",
      customerId: "cus_stripe_123456",
    } as unknown as PaymentRecord,
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("mostra lo spinner e la dicitura di caricamento durante il fetch dei pagamenti", () => {
    mockFetchUserPayments.mockReturnValue(new Promise(() => {})); // Promise pendente

    render(<PaymentHistory uid="user-123" />);

    expect(screen.getByTestId("icon-loader-2")).toBeInTheDocument();
    expect(screen.getByText("Caricamento storico pagamenti...")).toBeInTheDocument();
  });

  test("non avvia la richiesta se uid è una stringa vuota", () => {
    render(<PaymentHistory uid="" />);

    expect(mockFetchUserPayments).not.toHaveBeenCalled();
    expect(screen.getByText("Caricamento storico pagamenti...")).toBeInTheDocument();
  });

  test("renderizza lo stato vuoto (empty state) quando non ci sono transazioni registrate", async () => {
    mockFetchUserPayments.mockResolvedValueOnce([]);

    render(<PaymentHistory uid="user-empty" />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Nessun pagamento", level: 3 })).toBeInTheDocument();
    });

    expect(
      screen.getByText("Non hai ancora effettuato transazioni sulla piattaforma.")
    ).toBeInTheDocument();
    expect(screen.getByTestId("icon-receipt")).toBeInTheDocument();
  });

  test("renderizza il banner di errore se il servizio fetchUserPayments lancia un'eccezione", async () => {
    mockFetchUserPayments.mockRejectedValueOnce(new Error("Database non raggiungibile"));

    render(<PaymentHistory uid="user-error" />);

    await waitFor(() => {
      expect(screen.getByTestId("icon-alert-circle")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Impossibile caricare lo storico: Database non raggiungibile")
    ).toBeInTheDocument();
  });

  test("mostra il messaggio di fallback se l'errore sollevato non è un'istanza di Error", async () => {
    mockFetchUserPayments.mockRejectedValueOnce("Errore generico di rete");

    render(<PaymentHistory uid="user-error-string" />);

    await waitFor(() => {
      expect(
        screen.getByText("Impossibile caricare lo storico: Errore nel caricamento dei pagamenti")
      ).toBeInTheDocument();
    });
  });

  test("renderizza correttamente i dati delle transazioni sia nella tabella Desktop che nelle Card Mobile", async () => {
    mockFetchUserPayments.mockResolvedValueOnce(mockPaymentsList);

    const { container } = render(<PaymentHistory uid="user-success" />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Storico Pagamenti", level: 3 })).toBeInTheDocument();
    });

    // 1. Verifica Tabella Desktop
    const table = container.querySelector("table")!;
    expect(table).toBeInTheDocument();

    const tableScope = within(table);
    expect(tableScope.getByText("professional")).toBeInTheDocument();
    expect(tableScope.getByText("N/A")).toBeInTheDocument(); // Fallback su planId vuoto
    expect(tableScope.getByText("49.00")).toBeInTheDocument();
    expect(tableScope.getByText("99.00")).toBeInTheDocument();
    expect(tableScope.getByText("paypal")).toBeInTheDocument();
    expect(tableScope.getByText("stripe")).toBeInTheDocument();
    expect(tableScope.getByText("PAYPAL-CAP-998877")).toBeInTheDocument();
    expect(tableScope.getByText("cus_stripe_123456")).toBeInTheDocument();

    // 2. Verifica Card Mobile
    const mobileContainer = container.querySelector(".md\\:hidden")!;
    expect(mobileContainer).toBeInTheDocument();

    const mobileScope = within(mobileContainer as HTMLElement);
    expect(mobileScope.getByText("PAYPAL-CAP-998877")).toBeInTheDocument();
    expect(mobileScope.getByText("cus_stripe_123456")).toBeInTheDocument();
    expect(mobileScope.getAllByTestId("icon-external-link")).toHaveLength(2);
  });

  test("previene aggiornamenti di stato se il componente viene smontato prima della risoluzione della promise", async () => {
    let resolvePromise: (data: PaymentRecord[]) => void;
    const promise = new Promise<PaymentRecord[]>((resolve) => {
      resolvePromise = resolve;
    });

    mockFetchUserPayments.mockReturnValueOnce(promise);

    const { unmount } = render(<PaymentHistory uid="user-unmount" />);

    unmount();

    // Risoluzione asincrona post-unmount non deve sollevare warning/errori
    resolvePromise!(mockPaymentsList);
    await expect(promise).resolves.toEqual(mockPaymentsList);
  });
});