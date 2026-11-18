import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: { currentUser: null as null | { uid: string } },
  listFascicoliByUser: vi.fn(),
}));

vi.mock("@word/firebase/auth", () => ({ auth: mocks.auth }));
vi.mock("@word/firebase/functions", () => ({ listFascicoliByUser: mocks.listFascicoliByUser }));

import {
  formattaScore,
  formattaTitoloFonte,
  isWordEnvironment,
  spezzaTesto,
  useFascicoloSelector,
} from "@word/tools/utils";
import { uninstallOfficeMocks, installWordMock } from "../mocks/office";

describe("formattaTitoloFonte", () => {
  it("antepone 'Provvedimento giuridico' ai soli numeri di sentenza", () => {
    expect(formattaTitoloFonte("1234/2023")).toBe("Provvedimento giuridico 1234/2023");
    expect(formattaTitoloFonte(" 12 / 2020 ")).toBe("Provvedimento giuridico 12 / 2020");
  });

  it("lascia invariati i titoli descrittivi", () => {
    expect(formattaTitoloFonte("Cass. civ. n. 1234/2023")).toBe("Cass. civ. n. 1234/2023");
    expect(formattaTitoloFonte("")).toBe("");
  });
});

describe("formattaScore", () => {
  it("converte lo score 0–1 del backend in percentuale", () => {
    expect(formattaScore(0.91)).toBe("91%");
    expect(formattaScore(0.876)).toBe("88%");
    expect(formattaScore(1)).toBe("100%");
    expect(formattaScore(0)).toBe("0%");
  });

  it("lascia invariati valori già in percentuale", () => {
    expect(formattaScore(88)).toBe("88%");
  });
});

describe("spezzaTesto", () => {
  it("restituisce un array vuoto per testo vuoto", () => {
    expect(spezzaTesto("")).toEqual([]);
  });

  it("non spezza un testo più corto del limite", () => {
    expect(spezzaTesto("abc")).toEqual(["abc"]);
  });

  it("produce blocchi di 1500 caratteri con 200 di sovrapposizione", () => {
    expect(spezzaTesto("x".repeat(3000)).map((c) => c.length)).toEqual([1500, 1500, 400]);
  });

  it("non aggiunge un blocco finale già contenuto nel precedente", () => {
    expect(spezzaTesto("x".repeat(1500))).toHaveLength(1);
  });

  it("i blocchi sovrapposti ricostruiscono il testo originale", () => {
    const testo = Array.from({ length: 5000 }, (_, i) => String.fromCharCode(97 + (i % 26))).join("");
    const chunks = spezzaTesto(testo, 1000, 100);
    const ricostruito = chunks.map((c, i) => (i === 0 ? c : c.slice(100))).join("");
    expect(ricostruito).toBe(testo);
  });

  it("rifiuta overlap >= maxLength invece di entrare in un ciclo infinito", () => {
    expect(() => spezzaTesto("abc", 10, 10)).toThrow(RangeError);
    expect(() => spezzaTesto("abc", 0, 0)).toThrow(RangeError);
  });
});

describe("isWordEnvironment", () => {
  it("ritorna true dentro Word", () => {
    installWordMock();
    const setError = vi.fn();
    expect(isWordEnvironment(setError)).toBe(true);
    expect(setError).not.toHaveBeenCalled();
  });

  it("segnala l'errore fuori da Word", () => {
    uninstallOfficeMocks();
    const setError = vi.fn();
    expect(isWordEnvironment(setError)).toBe(false);
    expect(setError).toHaveBeenCalledWith(expect.stringContaining("Microsoft Word"));
  });
});

describe("useFascicoloSelector", () => {
  it("non carica nulla se l'utente non è autenticato", () => {
    mocks.auth.currentUser = null;
    renderHook(() => useFascicoloSelector(vi.fn()));
    expect(mocks.listFascicoliByUser).not.toHaveBeenCalled();
  });

  it("carica i fascicoli dell'utente e filtra per titolo senza distinguere maiuscole", async () => {
    mocks.auth.currentUser = { uid: "u1" };
    mocks.listFascicoliByUser.mockResolvedValue([
      { id: "1", title: "Rossi c. Bianchi" },
      { id: "2", title: "Verdi SRL" },
    ]);
    const { result } = renderHook(() => useFascicoloSelector(vi.fn()));
    await waitFor(() => expect(result.current.filteredFascicoli).toHaveLength(2));
    expect(result.current.isLoading).toBe(false);
    expect(mocks.listFascicoliByUser).toHaveBeenCalledWith("u1");

    act(() => result.current.setSearchQuery("ROSSI"));
    expect(result.current.filteredFascicoli.map((f) => f.id)).toEqual(["1"]);
  });

  it("un errore di Firestore spegne lo spinner e mostra un messaggio", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.auth.currentUser = { uid: "u1" };
    mocks.listFascicoliByUser.mockRejectedValue(new Error("permission-denied"));
    const { result } = renderHook(() => useFascicoloSelector(vi.fn()));
    await waitFor(() => expect(result.current.error).toBe("Impossibile caricare i fascicoli."));
    expect(result.current.isLoading).toBe(false);
  });

  it("handleSelect(null) azzera la ricerca e propaga la selezione", () => {
    mocks.auth.currentUser = null;
    const onSelect = vi.fn();
    const { result } = renderHook(() => useFascicoloSelector(onSelect));
    act(() => result.current.setSearchQuery("abc"));
    act(() => result.current.handleSelect(null));
    expect(onSelect).toHaveBeenCalledWith(null);
    expect(result.current.searchQuery).toBe("");
  });
});
