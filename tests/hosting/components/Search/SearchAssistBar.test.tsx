import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SearchAssistBar } from "@/features/search/components/SearchAssistBar";

const renderBar = (props: Partial<React.ComponentProps<typeof SearchAssistBar>> = {}) => {
  const setSearchNormativa = vi.fn();
  render(
    <MemoryRouter>
      <SearchAssistBar searchNormativa={false} setSearchNormativa={setSearchNormativa} {...props} />
    </MemoryRouter>
  );
  return { setSearchNormativa };
};

describe("SearchAssistBar", () => {
  beforeEach(() => vi.useRealTimers());

  test("lo switch normativa è spento di default e si attiva al click", () => {
    const { setSearchNormativa } = renderBar();
    const toggle = screen.getByRole("switch", { name: /riferimento normativo/i });
    expect(toggle).toHaveAttribute("aria-checked", "false");

    fireEvent.click(toggle);
    expect(setSearchNormativa).toHaveBeenCalledWith(true);
  });

  test("lo switch riflette lo stato attivo, si disattiva e si attiva anche cliccando l'etichetta", () => {
    const { setSearchNormativa } = renderBar({ searchNormativa: true });
    const toggle = screen.getByRole("switch", { name: /riferimento normativo/i });
    expect(toggle).toHaveAttribute("aria-checked", "true");

    fireEvent.click(screen.getByText("Riferimenti normativi"));
    expect(setSearchNormativa).toHaveBeenCalledWith(false);
  });

  test("lo switch è disabilitato durante il caricamento", () => {
    renderBar({ disabled: true });
    expect(screen.getByRole("switch", { name: /riferimento normativo/i })).toBeDisabled();
  });

  test("al passaggio del mouse spiega la ricerca per riferimento normativo", async () => {
    renderBar();
    const trigger = screen.getByRole("button", { name: /Informazioni sulla ricerca per riferimento normativo/i });

    fireEvent.mouseEnter(trigger.parentElement as HTMLElement);
    expect(await screen.findByText(/provvedimenti che li richiamano/i)).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  test("la guida alla scrittura indica la struttura consigliata e rimanda agli strumenti agentici", async () => {
    renderBar();
    const trigger = screen.getByRole("button", { name: /Come formulare una ricerca efficace/i });

    fireEvent.click(trigger);
    const tooltip = await screen.findByRole("tooltip");
    for (const voce of ["Fattispecie", "Massima", "Normativa", "Precedenti"]) {
      expect(tooltip).toHaveTextContent(voce);
    }
    expect(screen.getByRole("link", { name: "Approfondimento Giurisprudenziale" })).toHaveAttribute("href", "/analisi");
    expect(screen.getByRole("link", { name: "Consulente Legale" })).toHaveAttribute("href", "/chat");
  });

  test("il pannello si chiude con Esc", async () => {
    renderBar();
    const trigger = screen.getByRole("button", { name: /Come formulare una ricerca efficace/i });
    fireEvent.click(trigger);
    await screen.findByRole("tooltip");

    act(() => { fireEvent.keyDown(document, { key: "Escape" }); });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
