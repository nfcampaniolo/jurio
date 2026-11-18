import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetchWithSecurity: vi.fn() }));
vi.mock("@word/firebase/functions", () => ({ fetchWithSecurity: mocks.fetchWithSecurity }));

import { PromptSelector } from "@word/components/PromptSelector";
import { jsonResponse } from "../mocks/http";

const Harness = () => {
  const [value, setValue] = useState("");
  return <PromptSelector value={value} onChange={setValue} />;
};

describe("PromptSelector", () => {
  beforeEach(() => {
    mocks.fetchWithSecurity.mockReset();
  });

  it("elenca prompt Jurio e playbook personali in gruppi separati e mostra l'obiettivo", async () => {
    mocks.fetchWithSecurity.mockResolvedValue(
      jsonResponse({
        jurio: [{ id: "contr", titolo: "Analisi contrattuale", obiettivo: "Clausole critiche e lacune" }],
        playbook: [{ id: "pb1", titolo: "Locazioni dello studio", obiettivo: "" }],
      })
    );
    render(<Harness />);
    expect(await screen.findByRole("group", { name: "Prompt di analisi Jurio" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "I tuoi playbook" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Criteri di revisione"), { target: { value: "contr" } });
    expect(screen.getByText("Clausole critiche e lacune")).toBeInTheDocument();
    expect(mocks.fetchWithSecurity).toHaveBeenCalledWith("https://wordagent.test", { action: "prompts" });
    expect(screen.getByRole("link", { name: "Crea un playbook" })).toHaveAttribute(
      "href",
      "https://jurio.it/profilo/prompt-builder"
    );
  });

  it("se il caricamento fallisce resta disponibile la revisione standard", async () => {
    mocks.fetchWithSecurity.mockImplementation(async () => {
      throw new Error("rete");
    });
    render(<Harness />);
    expect(await screen.findByText("Impossibile caricare prompt e playbook.")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Standard: verifica di tesi e clausole" })).toBeInTheDocument();
  });

  it("carica l'elenco una sola volta per sessione del pannello", async () => {
    mocks.fetchWithSecurity.mockResolvedValue(jsonResponse({ jurio: [], playbook: [] }));
    const { unmount } = render(<Harness />);
    await screen.findByLabelText("Criteri di revisione");
    await vi.waitFor(() => expect(mocks.fetchWithSecurity).toHaveBeenCalledOnce());
    unmount();
    render(<Harness />);
    expect(mocks.fetchWithSecurity).toHaveBeenCalledOnce();
  });
});
