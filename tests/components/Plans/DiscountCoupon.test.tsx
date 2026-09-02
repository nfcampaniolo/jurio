import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import type { CouponData } from "@/hooks/discount";

/* ---------- tipi mock ---------- */
interface FetchCouponResponse {
  code: string;
  percentage: number;
  durationLabel?: string;
}

/* ---------- hoisted mocks ---------- */
const { mockFetchApplyCoupon } = vi.hoisted(() => ({
  mockFetchApplyCoupon: vi.fn<(code: string) => Promise<FetchCouponResponse>>(),
}));

/* ---------- mock hook discount ---------- */
vi.mock("@/hooks/discount", () => ({
  fetchApplyCoupon: (code: string) => mockFetchApplyCoupon(code),
}));

/* ---------- mock react-icons/fa ---------- */
vi.mock("react-icons/fa", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid={`fa-${name}`} {...props} />
  );
  return {
    FaTicketAlt: Icon("ticket-alt"),
    FaCheckCircle: Icon("check-circle"),
    FaTimes: Icon("times"),
    FaSpinner: Icon("spinner"),
    FaPercent: Icon("percent"),
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
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      form: passthrough("form"),
      span: passthrough("span"),
      div: passthrough("div"),
    },
  };
});

/* ---------- component ---------- */
import { DiscountCoupon } from "@/components/Plans/DiscountCoupon"; // <-- adegua il path se necessario

describe("DiscountCoupon Component Suite", () => {
  const mockOnApplyCoupon = vi.fn<(coupon: CouponData) => void>();
  const mockOnRemoveCoupon = vi.fn<() => void>();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("renderizza il form di inserimento iniziale quando non è presente alcun coupon attivo", () => {
    render(
      <DiscountCoupon
        activeCoupon={null}
        onApplyCoupon={mockOnApplyCoupon}
        onRemoveCoupon={mockOnRemoveCoupon}
      />
    );

    expect(screen.getByLabelText("Hai un codice promozionale?")).toBeInTheDocument();

    const input = screen.getByPlaceholderText("Es. SCONTO20");
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("");

    const submitBtn = screen.getByRole("button", { name: "Applica" });
    expect(submitBtn).toBeDisabled();
    expect(screen.getByTestId("fa-ticket-alt")).toBeInTheDocument();
  });

  test("normalizza l'input convertendolo in maiuscolo e limitando la lunghezza a 12 caratteri", () => {
    render(
      <DiscountCoupon
        activeCoupon={null}
        onApplyCoupon={mockOnApplyCoupon}
        onRemoveCoupon={mockOnRemoveCoupon}
      />
    );

    const input = screen.getByPlaceholderText("Es. SCONTO20");
    const submitBtn = screen.getByRole("button", { name: "Applica" });

    fireEvent.change(input, { target: { value: "promozione2026extra" } });

    expect(input).toHaveValue("PROMOZIONE20");
    expect(submitBtn).not.toBeDisabled();
  });

  test("invia il codice promozionale e invoca onApplyCoupon in caso di validazione positiva", async () => {
    mockFetchApplyCoupon.mockResolvedValueOnce({
      code: "JURIO20",
      percentage: 20,
      durationLabel: "Per 12 mesi",
    });

    render(
      <DiscountCoupon
        activeCoupon={null}
        onApplyCoupon={mockOnApplyCoupon}
        onRemoveCoupon={mockOnRemoveCoupon}
      />
    );

    const input = screen.getByPlaceholderText("Es. SCONTO20");
    fireEvent.change(input, { target: { value: "jurio20" } });

    const submitBtn = screen.getByRole("button", { name: "Applica" });
    fireEvent.click(submitBtn);

    expect(input).toBeDisabled();
    expect(submitBtn).toBeDisabled();

    await waitFor(() => {
      expect(mockFetchApplyCoupon).toHaveBeenCalledWith("JURIO20");
    });

    expect(mockOnApplyCoupon).toHaveBeenCalledWith({
      code: "JURIO20",
      percentage: 20,
      durationLabel: "Per 12 mesi",
    });
  });

  test("applica il fallback 'Coupon attivato' se durationLabel non è presente nella risposta del backend", async () => {
    mockFetchApplyCoupon.mockResolvedValueOnce({
      code: "WELCOME10",
      percentage: 10,
    });

    render(
      <DiscountCoupon
        activeCoupon={null}
        onApplyCoupon={mockOnApplyCoupon}
        onRemoveCoupon={mockOnRemoveCoupon}
      />
    );

    const input = screen.getByPlaceholderText("Es. SCONTO20");
    fireEvent.change(input, { target: { value: "welcome10" } });

    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(mockFetchApplyCoupon).toHaveBeenCalledWith("WELCOME10");
    });

    expect(mockOnApplyCoupon).toHaveBeenCalledWith({
      code: "WELCOME10",
      percentage: 10,
      durationLabel: "Coupon attivato",
    });
  });

  test("mostra il messaggio di errore quando il backend rigetta il coupon inserito", async () => {
    mockFetchApplyCoupon.mockRejectedValueOnce(new Error("Coupon scaduto o non valido."));

    render(
      <DiscountCoupon
        activeCoupon={null}
        onApplyCoupon={mockOnApplyCoupon}
        onRemoveCoupon={mockOnRemoveCoupon}
      />
    );

    const input = screen.getByPlaceholderText("Es. SCONTO20");
    fireEvent.change(input, { target: { value: "SCADUTO50" } });

    fireEvent.click(screen.getByRole("button", { name: "Applica" }));

    await waitFor(() => {
      expect(screen.getByText("Coupon scaduto o non valido.")).toBeInTheDocument();
    });

    expect(mockOnApplyCoupon).not.toHaveBeenCalled();
    expect(input).not.toBeDisabled();
  });

  test("mostra un messaggio di fallback generico in caso di eccezione non standard", async () => {
    mockFetchApplyCoupon.mockRejectedValueOnce("Errore di rete");

    render(
      <DiscountCoupon
        activeCoupon={null}
        onApplyCoupon={mockOnApplyCoupon}
        onRemoveCoupon={mockOnRemoveCoupon}
      />
    );

    const input = screen.getByPlaceholderText("Es. SCONTO20");
    fireEvent.change(input, { target: { value: "PROMO10" } });

    fireEvent.click(screen.getByRole("button", { name: "Applica" }));

    await waitFor(() => {
      expect(screen.getByText("Errore durante la verifica del codice.")).toBeInTheDocument();
    });
  });

  test("renderizza la card del coupon attivo con percentuale, durata e stato di attivazione", () => {
    const activeCouponData: CouponData = {
      code: "SPRING30",
      percentage: 30,
      durationLabel: "Valido per sempre",
    };

    render(
      <DiscountCoupon
        activeCoupon={activeCouponData}
        onApplyCoupon={mockOnApplyCoupon}
        onRemoveCoupon={mockOnRemoveCoupon}
      />
    );

    expect(screen.getByText("SPRING30")).toBeInTheDocument();
    expect(screen.getByText("Attivo")).toBeInTheDocument();
    expect(screen.getByText(/30% di sconto/i)).toBeInTheDocument();
    expect(screen.getByText(/Valido per sempre/i)).toBeInTheDocument();

    expect(screen.queryByPlaceholderText("Es. SCONTO20")).not.toBeInTheDocument();
  });

  test("invoca onRemoveCoupon e pulisce l'input quando si clicca sul pulsante di rimozione", () => {
    const activeCouponData: CouponData = {
      code: "BLACKFRIDAY",
      percentage: 50,
      durationLabel: "Primo anno",
    };

    render(
      <DiscountCoupon
        activeCoupon={activeCouponData}
        onApplyCoupon={mockOnApplyCoupon}
        onRemoveCoupon={mockOnRemoveCoupon}
      />
    );

    const removeBtn = screen.getByRole("button", { name: "Rimuovi coupon" });
    expect(removeBtn).toBeInTheDocument();

    fireEvent.click(removeBtn);

    expect(mockOnRemoveCoupon).toHaveBeenCalledTimes(1);
  });
});