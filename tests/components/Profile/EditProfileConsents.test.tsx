import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

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
      label: passthrough("label"),
      span: passthrough("span"),
      svg: passthrough("svg"),
    },
  };
});

/* ---------- component ---------- */
import { EditProfileConsents } from "@/components/Profile/EditProfileConsents"; // <-- adegua il path se necessario

describe("EditProfileConsents Component Suite", () => {
  const mockHandleConsentChange = vi.fn<(key: "comms" | "marketing") => void>();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (
    props: Partial<React.ComponentProps<typeof EditProfileConsents>> = {}
  ) => {
    const defaultProps: React.ComponentProps<typeof EditProfileConsents> = {
      consents: { comms: true, marketing: false },
      handleConsentChange: mockHandleConsentChange,
      shouldReduceMotion: false,
      ...props,
    };

    return render(<EditProfileConsents {...defaultProps} />);
  };

  test("renderizza l'intestazione e tutte le opzioni di consenso con le rispettive descrizioni", () => {
    renderComponent();

    expect(screen.getByRole("heading", { name: "Preferenze", level: 2 })).toBeInTheDocument();

    // Sezione Comunicazioni
    expect(screen.getByText("Comunicazioni")).toBeInTheDocument();
    expect(
      screen.getByText("Ricevere comunicazioni importanti via email")
    ).toBeInTheDocument();

    // Sezione Marketing
    expect(screen.getByText("Marketing")).toBeInTheDocument();
    expect(
      screen.getByText("Ricevere email promozionali e offerte speciali")
    ).toBeInTheDocument();
  });

  test("imposta correttamente lo stato checked delle checkbox in base all'oggetto consents", () => {
    const { container } = renderComponent({
      consents: { comms: true, marketing: false },
    });

    const commsCheckbox = screen.getByRole("checkbox", { name: /comunicazioni/i });
    const marketingCheckbox = screen.getByRole("checkbox", { name: /marketing/i });

    expect(commsCheckbox).toBeChecked();
    expect(marketingCheckbox).not.toBeChecked();

    // Verifica che l'icona SVG di spunta sia renderizzata solo per il consenso attivo
    const checkmarkIcons = container.querySelectorAll("svg");
    expect(checkmarkIcons).toHaveLength(1);
  });

  test("invoca handleConsentChange con la chiave corretta quando l'utente clicca sulle opzioni", () => {
    renderComponent({
      consents: { comms: false, marketing: false },
    });

    const commsCheckbox = screen.getByRole("checkbox", { name: /comunicazioni/i });
    const marketingCheckbox = screen.getByRole("checkbox", { name: /marketing/i });

    // Click su Comunicazioni
    fireEvent.click(commsCheckbox);
    expect(mockHandleConsentChange).toHaveBeenCalledTimes(1);
    expect(mockHandleConsentChange).toHaveBeenCalledWith("comms");

    // Click su Marketing
    fireEvent.click(marketingCheckbox);
    expect(mockHandleConsentChange).toHaveBeenCalledTimes(2);
    expect(mockHandleConsentChange).toHaveBeenCalledWith("marketing");
  });

  test("renderizza entrambe le spunte quando tutti i consensi sono attivi", () => {
    const { container } = renderComponent({
      consents: { comms: true, marketing: true },
    });

    const commsCheckbox = screen.getByRole("checkbox", { name: /comunicazioni/i });
    const marketingCheckbox = screen.getByRole("checkbox", { name: /marketing/i });

    expect(commsCheckbox).toBeChecked();
    expect(marketingCheckbox).toBeChecked();

    const checkmarkIcons = container.querySelectorAll("svg");
    expect(checkmarkIcons).toHaveLength(2);
  });

  test("supporta shouldReduceMotion impostato a true senza anomalie di rendering", () => {
    renderComponent({ shouldReduceMotion: true });

    expect(screen.getByRole("heading", { name: "Preferenze", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /comunicazioni/i })).toBeInTheDocument();
  });
});