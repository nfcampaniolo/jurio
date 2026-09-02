import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import type { Action } from "@/interfaces/interfaces";

/* ---------- mock react-icons/fi ---------- */
vi.mock("react-icons/fi", () => ({
  FiMoreVertical: (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid="icon-more-vertical" {...props} />
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
    useReducedMotion: () => false,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      div: passthrough("div"),
    },
  };
});

/* ---------- component ---------- */
import { HeaderProfile } from "@/components/Profile/HeaderProfile"; // <-- adegua il path se necessario

describe("HeaderProfile Component Suite", () => {
  const mockEditClick = vi.fn<() => void>();
  const mockDeleteClick = vi.fn<() => void>();

  const dummyActions: Action[] = [
    {
      id: "edit",
      label: "Modifica Profilo",
      onClick: mockEditClick,
      icon: <span data-testid="icon-edit">✏️</span>,
      destructive: false,
    },
    {
      id: "delete",
      label: "Elimina Account",
      onClick: mockDeleteClick,
      icon: <span data-testid="icon-delete">🗑️</span>,
      destructive: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderComponent = (
    props: Partial<React.ComponentProps<typeof HeaderProfile>> = {}
  ) => {
    const defaultProps: React.ComponentProps<typeof HeaderProfile> = {
      name: "Flavio",
      surname: "Campaniolo",
      avatar: "https://jurio.it/avatars/user.png",
      actions: dummyActions,
      ...props,
    };

    return render(<HeaderProfile {...defaultProps} />);
  };

  test("renderizza nome completo e immagine profilo quando l'avatar è presente", () => {
    renderComponent();

    expect(screen.getByText("Flavio Campaniolo")).toBeInTheDocument();

    const img = screen.getByRole("img", { name: "Foto profilo di Flavio Campaniolo" });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://jurio.it/avatars/user.png");
  });

  test("renderizza il fallback con l'iniziale maiuscola quando l'avatar non è fornito", () => {
    renderComponent({ avatar: null, name: "laura", surname: "Neri" });

    expect(screen.getByText("laura Neri")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("L")).toBeInTheDocument();
  });

  test("renderizza '?' come fallback se il nome è una stringa vuota e l'avatar è null", () => {
    renderComponent({ avatar: null, name: "", surname: "Rossi" });

    expect(screen.getByText("?")).toBeInTheDocument();
  });

  test("apre e chiude il menu a tendina tramite il trigger button aggiornando gli attributi ARIA", () => {
    renderComponent();

    const triggerBtn = screen.getByRole("button", { name: "Apri menu azioni profilo" });
    expect(triggerBtn).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).toBeNull();

    // Apertura menu
    fireEvent.click(triggerBtn);
    expect(triggerBtn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Chiudi menu azioni profilo" })).toBeInTheDocument();

    const menu = screen.getByRole("menu", { name: "Azioni profilo" });
    expect(menu).toBeInTheDocument();

    // Chiusura menu cliccando di nuovo sul trigger
    fireEvent.click(triggerBtn);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  test("esegue l'azione selezionata, chiude il menu e restituisce il focus al trigger", () => {
    renderComponent();

    const triggerBtn = screen.getByRole("button", { name: "Apri menu azioni profilo" });
    fireEvent.click(triggerBtn);

    const editActionBtn = screen.getByRole("menuitem", { name: /Modifica Profilo/i });
    expect(screen.getByTestId("icon-edit")).toBeInTheDocument();

    fireEvent.click(editActionBtn);

    expect(mockEditClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(triggerBtn);
  });

  test("applica lo stile destructive alle azioni contrassegnate", () => {
    renderComponent();

    const triggerBtn = screen.getByRole("button", { name: "Apri menu azioni profilo" });
    fireEvent.click(triggerBtn);

    const deleteActionBtn = screen.getByRole("menuitem", { name: /Elimina Account/i });
    expect(deleteActionBtn).toHaveClass("text-red-600");
  });

  test("chiude il menu al click sul backdrop esterno", () => {
    renderComponent();

    const triggerBtn = screen.getByRole("button", { name: "Apri menu azioni profilo" });
    fireEvent.click(triggerBtn);

    const backdrop = screen.getByRole("button", { name: "Chiudi menu" });
    fireEvent.click(backdrop);

    expect(screen.queryByRole("menu")).toBeNull();
  });

  test("chiude il menu e restituisce il focus al trigger alla pressione del tasto Escape", () => {
    renderComponent();

    const triggerBtn = screen.getByRole("button", { name: "Apri menu azioni profilo" });
    fireEvent.click(triggerBtn);

    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(triggerBtn);
  });

  test("gestisce il focus trap all'interno del menu con i tasti Tab e Shift+Tab", () => {
    renderComponent();

    const triggerBtn = screen.getByRole("button", { name: "Apri menu azioni profilo" });
    fireEvent.click(triggerBtn);

    const menuItems = screen.getAllByRole("menuitem");
    const firstItem = menuItems[0];
    const lastItem = menuItems[menuItems.length - 1];

    // Simula focus sull'ultimo elemento e pressione Tab -> torna al primo
    lastItem.focus();
    expect(document.activeElement).toBe(lastItem);

    fireEvent.keyDown(window, { key: "Tab", shiftKey: false });
    expect(document.activeElement).toBe(firstItem);

    // Simula focus sul primo elemento e pressione Shift+Tab -> va all'ultimo
    firstItem.focus();
    expect(document.activeElement).toBe(firstItem);

    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(lastItem);
  });
});