import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RichText } from "@word/components/RichText";

describe("RichText", () => {
  it("rende paragrafi, elenchi e grassetto", () => {
    const { container } = render(
      <RichText text={"# Esito\nLa clausola è **nulla**.\n- primo punto\n- secondo\n1. passo uno\n2. passo due"} />
    );
    expect(screen.getByText("Esito")).toHaveClass("rich-heading");
    expect(screen.getByText("nulla").tagName).toBe("STRONG");
    expect(container.querySelectorAll("ul li")).toHaveLength(2);
    expect(container.querySelectorAll("ol li")).toHaveLength(2);
  });

  it("non interpreta HTML proveniente dal modello", () => {
    const { container } = render(<RichText text={'<img src=x onerror="alert(1)">'} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText('<img src=x onerror="alert(1)">')).toBeInTheDocument();
  });
});
