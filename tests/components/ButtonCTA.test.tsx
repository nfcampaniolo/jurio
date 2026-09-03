import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@/test/test-utils";

// framer-motion pass-through (strict)
vi.mock("framer-motion", async () => {
  const React = await import("react");
  type Props = React.PropsWithChildren<Record<string, unknown>>;
  return {
    motion: {
      button: (props: Props) => React.createElement("button", props, props.children),
    },
  };
});

import { ButtonCTA, ButtonSecondCTA } from "@/shared/components/ButtonCTA"; // <-- aggiorna path se serve

describe("ButtonCTA", () => {
  test("renderizza children e type di default = button", () => {
    render(<ButtonCTA>Click</ButtonCTA>);

    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("type", "button");
  });

  test("type custom: submit", () => {
    render(<ButtonCTA type="submit">Invia</ButtonCTA>);
    expect(screen.getByRole("button", { name: "Invia" })).toHaveAttribute("type", "submit");
  });

  test("disabled: true", () => {
    render(<ButtonCTA disabled>Disabled</ButtonCTA>);
    expect(screen.getByRole("button", { name: "Disabled" })).toBeDisabled();
  });

  test("onClick viene chiamato", () => {
    const onClick = vi.fn();
    render(<ButtonCTA onClick={onClick}>Go</ButtonCTA>);

    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("ButtonSecondCTA", () => {
  test("renderizza children e type di default = button", () => {
    render(<ButtonSecondCTA>Second</ButtonSecondCTA>);

    const btn = screen.getByRole("button", { name: "Second" });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("type", "button");
  });

  test("type custom: reset", () => {
    render(<ButtonSecondCTA type="reset">Reset</ButtonSecondCTA>);
    expect(screen.getByRole("button", { name: "Reset" })).toHaveAttribute("type", "reset");
  });

  test("disabled: true", () => {
    render(<ButtonSecondCTA disabled>Disabled</ButtonSecondCTA>);
    expect(screen.getByRole("button", { name: "Disabled" })).toBeDisabled();
  });

  test("onClick viene chiamato", () => {
    const onClick = vi.fn();
    render(<ButtonSecondCTA onClick={onClick}>Go</ButtonSecondCTA>);

    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
