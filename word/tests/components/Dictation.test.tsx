import React, { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchWithSecurity: vi.fn(),
  startRecording: vi.fn(),
  stop: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock("@word/firebase/functions", () => ({ fetchWithSecurity: mocks.fetchWithSecurity }));
vi.mock("@word/tools/recorder", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@word/tools/recorder")>()),
  startRecording: mocks.startRecording,
}));

import { appendDictation, AutoTextarea } from "@word/components/AutoTextarea";
import { MAX_RECORDING_SECONDS } from "@word/tools/recorder";
import { jsonResponse } from "../mocks/http";

const Campo = ({ initial = "" }: { initial?: string }) => {
  const [v, setV] = useState(initial);
  return <AutoTextarea aria-label="campo" value={v} onValueChange={setV} />;
};

describe("dettatura nei campi di testo", () => {
  beforeEach(() => {
    mocks.fetchWithSecurity.mockReset();
    mocks.startRecording.mockReset();
    mocks.stop.mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);
    mocks.startRecording.mockResolvedValue({ stop: mocks.stop, cancel: mocks.cancel });
  });

  it("appendDictation aggiunge in coda con uno spazio", () => {
    expect(appendDictation("", "Ciao")).toBe("Ciao");
    expect(appendDictation("Testo  \n", "aggiunto")).toBe("Testo aggiunto");
  });

  it("registra, trascrive con action=transcribe e aggiunge il testo al campo", async () => {
    mocks.fetchWithSecurity.mockResolvedValue(jsonResponse({ testo: "clausola risolutiva" }));
    render(<Campo initial="Verifica la" />);
    fireEvent.click(screen.getByRole("button", { name: "Detta" }));
    fireEvent.click(await screen.findByRole("button", { name: "Termina la dettatura" }));
    await waitFor(() => expect(screen.getByLabelText("campo")).toHaveValue("Verifica la clausola risolutiva"));
    expect(mocks.fetchWithSecurity).toHaveBeenCalledWith("https://wordagent.test", {
      action: "transcribe",
      audio: "AQID",
    });
  });

  it("si ferma da sola al limite di durata", async () => {
    vi.useFakeTimers();
    try {
      mocks.fetchWithSecurity.mockResolvedValue(jsonResponse({ testo: "fine" }));
      render(<Campo />);
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Detta" }));
      });
      expect(screen.getByText("0:00")).toBeInTheDocument();
      for (let i = 0; i < MAX_RECORDING_SECONDS; i++) {
        await act(async () => {
          vi.advanceTimersByTime(1000);
        });
      }
      expect(mocks.stop).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("mostra gli errori del microfono sotto il campo", async () => {
    mocks.startRecording.mockImplementation(async () => {
      throw new Error("Accesso al microfono negato.");
    });
    render(<Campo />);
    fireEvent.click(screen.getByRole("button", { name: "Detta" }));
    expect(await screen.findByText("Accesso al microfono negato.")).toBeInTheDocument();
  });

  it("nessuna parola riconosciuta: avvisa senza modificare il testo", async () => {
    mocks.fetchWithSecurity.mockResolvedValue(jsonResponse({ testo: "  " }));
    render(<Campo initial="Invariato" />);
    fireEvent.click(screen.getByRole("button", { name: "Detta" }));
    fireEvent.click(await screen.findByRole("button", { name: "Termina la dettatura" }));
    expect(await screen.findByText(/Non ho riconosciuto parole/)).toBeInTheDocument();
    expect(screen.getByLabelText("campo")).toHaveValue("Invariato");
  });

  it("smontare il campo durante la registrazione libera il microfono", async () => {
    const { unmount } = render(<Campo />);
    fireEvent.click(screen.getByRole("button", { name: "Detta" }));
    await screen.findByRole("button", { name: "Termina la dettatura" });
    unmount();
    expect(mocks.cancel).toHaveBeenCalled();
  });

  it("dictation={false} non mostra il microfono", () => {
    render(<AutoTextarea aria-label="x" value="" onValueChange={() => {}} dictation={false} />);
    expect(screen.queryByRole("button", { name: "Detta" })).toBeNull();
  });
});
