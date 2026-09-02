import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminFooterLinks } from "@/components/Admin/AdminFooterLinks";

describe("AdminFooterLinks", () => {
  test("renderizza correttamente tutti i link con i relativi attributi href e classi", () => {
    const { container } = render(<AdminFooterLinks />);

    // Verifica il contenitore principale e le classi di layout
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveClass("mt-8", "mb-8", "flex", "justify-center", "gap-6", "text-sm", "text-neutral-500", "dark:text-neutral-400");

    // Link: Privacy
    const privacyLink = screen.getByRole("link", { name: "Privacy" });
    expect(privacyLink).toBeInTheDocument();
    expect(privacyLink).toHaveAttribute("href", "/privacy");
    expect(privacyLink).toHaveClass("hover:underline");

    // Link: Termini
    const terminiLink = screen.getByRole("link", { name: "Termini" });
    expect(terminiLink).toBeInTheDocument();
    expect(terminiLink).toHaveAttribute("href", "/termini");
    expect(terminiLink).toHaveClass("hover:underline");

    // Link: Trattamento dati
    const gdprLink = screen.getByRole("link", { name: "Trattamento dati" });
    expect(gdprLink).toBeInTheDocument();
    expect(gdprLink).toHaveAttribute("href", "/gdpr");
    expect(gdprLink).toHaveClass("hover:underline");

    // Verifica il numero complessivo di link
    const allLinks = screen.getAllByRole("link");
    expect(allLinks).toHaveLength(3);
  });
});