import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import type { IconType } from "react-icons";

/* ---------- component ---------- */
import {
  SectionTitle,
  SectionText,
  SectionContainer,
} from "@/components/Document/SharedUI";

describe("SharedUI Component Suite", () => {
  const DummyIcon: IconType = (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="dummy-icon" {...props} />
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("SectionTitle", () => {
    test("renderizza l'icona con classe opacity e il titolo", () => {
      render(<SectionTitle icon={DummyIcon} title="Titolo Sezione" />);

      const icon = screen.getByTestId("dummy-icon");
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass("opacity-70");

      expect(screen.getByText("Titolo Sezione")).toBeInTheDocument();
    });

    test("renderizza il sottotitolo quando fornito come stringa o nodo React", () => {
      const { rerender } = render(
        <SectionTitle
          icon={DummyIcon}
          title="Fattispecie"
          subtitle="- Diritto Civile"
        />
      );

      expect(screen.getByText("Fattispecie - Diritto Civile")).toBeInTheDocument();

      rerender(
        <SectionTitle
          icon={DummyIcon}
          title="Fattispecie"
          subtitle={<span data-testid="custom-sub">• Penale</span>}
        />
      );

      expect(screen.getByTestId("custom-sub")).toBeInTheDocument();
      expect(screen.getByText("• Penale")).toBeInTheDocument();
    });
  });

  describe("SectionText", () => {
    test("renderizza il testo all'interno di un tag paragrafo con le classi tipografiche", () => {
      render(
        <SectionText>
          Contenuto descrittivo relativo alla sentenza analizzata.
        </SectionText>
      );

      const paragraph = screen.getByText(
        "Contenuto descrittivo relativo alla sentenza analizzata."
      );
      expect(paragraph.tagName).toBe("P");
      expect(paragraph).toHaveClass(
        "text-sm",
        "md:text-base",
        "text-(--color-muted)",
        "font-light",
        "leading-relaxed"
      );
    });

    test("supporta nodi JSX complessi come children", () => {
      render(
        <SectionText>
          <span>Testo con un </span>
          <strong>termine evidenziato</strong>
        </SectionText>
      );

      expect(screen.getByText("termine evidenziato")).toBeInTheDocument();
      expect(screen.getByText("termine evidenziato").tagName).toBe("STRONG");
    });
  });

  describe("SectionContainer", () => {
    test("renderizza i children applicando le classi di bordo e padding di base", () => {
      const { container } = render(
        <SectionContainer>
          <div data-testid="child-content">Contenuto</div>
        </SectionContainer>
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass("border-t", "border-(--color-border)", "pt-6");
      expect(screen.getByTestId("child-content")).toBeInTheDocument();
    });

    test("concatena correttamente classi CSS personalizzate", () => {
      const { container } = render(
        <SectionContainer className="border-t-0 pt-0 custom-margin">
          <div>Contenuto senza bordo</div>
        </SectionContainer>
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass("border-t-0", "pt-0", "custom-margin");
      expect(wrapper).toHaveClass("border-t", "border-(--color-border)", "pt-6");
    });
  });
});