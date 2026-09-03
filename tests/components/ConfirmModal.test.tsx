import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@/test/test-utils";

/* ---------- mock framer-motion (strict pass-through) ---------- */
vi.mock("framer-motion", async () => {
  const React = await import("react");
  type Props = React.PropsWithChildren<Record<string, unknown>>;

  const passthrough =
    (Tag: string) =>
    (props: Props) =>
      React.createElement(Tag, props, props.children);

  return {
    motion: {
      div: passthrough("div"),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

/* ---------- component ---------- */
import { ConfirmModal } from "@/shared/components/ConfirmModal"; // <-- aggiorna path se serve

describe("ConfirmModal", () => {
  test("non renderizza quando isOpen=false", () => {
    render(
      <ConfirmModal
        isOpen={false}
        message="Sei sicuro?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.queryByText("Sei sicuro?")).toBeNull();
  });

  test("renderizza contenuto quando isOpen=true", () => {
    render(
      <ConfirmModal
        isOpen
        message="Eliminare elemento?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Conferma Azione" })).toBeInTheDocument();
    expect(screen.getByText("Eliminare elemento?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Annulla" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Conferma" })).toBeInTheDocument();
  });

  test("usa titolo custom se fornito", () => {
    render(
      <ConfirmModal
        isOpen
        title="Attenzione"
        message="Procedere?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Attenzione" })).toBeInTheDocument();
  });

  test("click Annulla → chiama onCancel", () => {
    const onCancel = vi.fn();

    render(
      <ConfirmModal
        isOpen
        message="Test"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test("click Conferma → chiama onConfirm", () => {
    const onConfirm = vi.fn();

    render(
      <ConfirmModal
        isOpen
        message="Test"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Conferma" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
