import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { RiquadroFonte } from "@/features/analisi/components/RiquadroFonte";

describe("RiquadroFonte Component Suite", () => {
  test("renderizza correttamente lo stato attivo con etichetta e descrizione", () => {
    render(
      <RiquadroFonte
        attivo={true}
        etichetta="Banca dati di legittimità"
        descrizione="Consultazione massime e orientamenti di cassazione."
      />
    );

    expect(screen.getByText("Banca dati di legittimità")).toBeInTheDocument();
    expect(
      screen.getByText("Consultazione massime e orientamenti di cassazione.")
    ).toBeInTheDocument();
  });

  test("renderizza correttamente lo stato disattivato (attivo = false) con classi di opacità", () => {
    render(
      <RiquadroFonte
        attivo={false}
        etichetta="Archivi di merito"
        descrizione="Ricerca nelle sentenze dei tribunali di primo e secondo grado."
      />
    );

    expect(screen.getByText("Archivi di merito")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Ricerca nelle sentenze dei tribunali di primo e secondo grado."
      )
    ).toBeInTheDocument();
  });
});