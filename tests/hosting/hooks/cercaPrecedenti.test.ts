import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRicercaRicorsivaPrecedenti } from "@/features/analisi/hooks/useRicercaRicorsivaPrecedenti";
import { getDb } from "@/infrastructure/db";
import { doc, getDoc } from "firebase/firestore";
import { cercaPrecedente } from "@/features/document/hooks/cercaPrecedenti";
import type { PrecedenteReperito } from "@/features/analisi/hooks/types";
import type { DocumentSnapshot, DocumentData } from "firebase/firestore";

/* ---------- mock dei moduli esterni ---------- */
vi.mock("@/infrastructure/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
}));

vi.mock("@/features/document/hooks/cercaPrecedenti", () => ({
  cercaPrecedente: vi.fn(),
}));

const mockedGetDb = vi.mocked(getDb);
const mockedDoc = vi.mocked(doc);
const mockedGetDoc = vi.mocked(getDoc);
const mockedCercaPrecedente = vi.mocked(cercaPrecedente);

describe("useRicercaRicorsivaPrecedenti Hook Suite", () => {
  const mockDb = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetDb.mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof getDb>>);
    mockedDoc.mockReturnValue("mocked-doc-ref" as unknown as ReturnType<typeof doc>);
  });

  test("stato iniziale corretto con isSearchingRecursive a false", () => {
    const { result } = renderHook(() => useRicercaRicorsivaPrecedenti());

    expect(result.current.isSearchingRecursive).toBe(false);
  });

  test("ignora le fonti di tipo web senza effettuare query su Firestore", async () => {
    const { result } = renderHook(() => useRicercaRicorsivaPrecedenti());

    const fontiWeb: PrecedenteReperito[] = [
      {
        id: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:1990;241",
        fonte: "web",
        gradoPertinenza: 80,
      },
    ];

    let albero;
    await act(async () => {
      albero = await result.current.avviaAnalisiRicorsivaCompleta(fontiWeb);
    });

    expect(albero).toEqual([]);
    expect(mockedGetDoc).not.toHaveBeenCalled();
    expect(result.current.isSearchingRecursive).toBe(false);
  });

  test("costruisce correttamente l'albero gerarchico dei precedenti con ricorsione a più livelli", async () => {
    const { result } = renderHook(() => useRicercaRicorsivaPrecedenti());

    // 1. Radice Firestore
    const rootSnapshot = {
      exists: () => true,
      id: "cass-radice-1",
      data: () => ({
        organo_giudicante: "Cassazione Civile Sez. I",
        numero_sentenza: "1000/2026",
        precedenti_richiamati: ["Cass. 500/2024", "Cass. 200/2020"],
      }),
    };

    mockedGetDoc.mockResolvedValueOnce(
      rootSnapshot as unknown as DocumentSnapshot<DocumentData, DocumentData>
    );

    // 2. Risoluzione primo figlio: Cass. 500/2024 (ha a sua volta una citazione figlia)
    mockedCercaPrecedente.mockResolvedValueOnce({
      id: "cass-figlio-500",
      numero_sentenza: "500/2024",
      organo_giudicante: "Cassazione Civile",
      precedenti_richiamati: ["Cass. 100/2018"],
    } as unknown as Awaited<ReturnType<typeof cercaPrecedente>>);

    // 3. Risoluzione nipote: Cass. 100/2018 (foglia, senza ulteriori citazioni)
    mockedCercaPrecedente.mockResolvedValueOnce({
      id: "cass-nipote-100",
      numero_sentenza: "100/2018",
      organo_giudicante: "Cassazione Sezioni Unite",
      precedenti_richiamati: [],
    } as unknown as Awaited<ReturnType<typeof cercaPrecedente>>);

    // 4. Risoluzione secondo figlio della radice: Cass. 200/2020 (non reperito)
    mockedCercaPrecedente.mockResolvedValueOnce(null);

    const fonti: PrecedenteReperito[] = [
      {
        id: "cass-radice-1",
        fonte: "interna",
        gradoPertinenza: 95,
      },
    ];

    let albero;
    await act(async () => {
      albero = await result.current.avviaAnalisiRicorsivaCompleta(fonti);
    });

    expect(albero).toHaveLength(1);
    expect(albero![0].radiceId).toBe("cass-radice-1");
    expect(albero![0].datiRadice.numero_sentenza).toBe("1000/2026");

    // Figli della radice
    const figliRadice = albero![0].alberoFigli;
    expect(figliRadice).toHaveLength(2);

    // Primo ramo: Cass. 500/2024 con il suo sotto-ramo
    expect(figliRadice[0].citazioneTestuale).toBe("Cass. 500/2024");
    expect(figliRadice[0].documentoTrovato?.id).toBe("cass-figlio-500");
    expect(figliRadice[0].figli).toHaveLength(1);
    expect(figliRadice[0].figli[0].citazioneTestuale).toBe("Cass. 100/2018");
    expect(figliRadice[0].figli[0].documentoTrovato?.id).toBe("cass-nipote-100");
    expect(figliRadice[0].figli[0].figli).toEqual([]);

    // Secondo ramo: Cass. 200/2020 (non trovato)
    expect(figliRadice[1].citazioneTestuale).toBe("Cass. 200/2020");
    expect(figliRadice[1].documentoTrovato).toBeNull();
    expect(figliRadice[1].figli).toEqual([]);

    expect(result.current.isSearchingRecursive).toBe(false);
  });

  test("evita loop e chiamate duplicate tracciando i nodi già visitati", async () => {
    const { result } = renderHook(() => useRicercaRicorsivaPrecedenti());

    const rootSnapshot = {
      exists: () => true,
      id: "cass-radice-loop",
      data: () => ({
        precedenti_richiamati: ["Cass. 500/2024", "Cass. 500/2024", " cass. 500/2024 "],
      }),
    };

    mockedGetDoc.mockResolvedValueOnce(
      rootSnapshot as unknown as DocumentSnapshot<DocumentData, DocumentData>
    );

    mockedCercaPrecedente.mockResolvedValueOnce({
      id: "cass-500",
      precedenti_richiamati: [],
    } as unknown as Awaited<ReturnType<typeof cercaPrecedente>>);

    let albero;
    await act(async () => {
      albero = await result.current.avviaAnalisiRicorsivaCompleta([
        { id: "cass-radice-loop", fonte: "interna", gradoPertinenza: 90 },
      ]);
    });

    expect(albero).toHaveLength(1);
    expect(albero![0].alberoFigli).toHaveLength(1);
    expect(mockedCercaPrecedente).toHaveBeenCalledTimes(1);
  });

  test("gestisce il caso in cui il documento radice non esista su Firestore", async () => {
    const { result } = renderHook(() => useRicercaRicorsivaPrecedenti());

    mockedGetDoc.mockResolvedValueOnce({
      exists: () => false,
    } as unknown as DocumentSnapshot<DocumentData, DocumentData>);

    let albero;
    await act(async () => {
      albero = await result.current.avviaAnalisiRicorsivaCompleta([
        { id: "cass-inesistente", fonte: "interna", gradoPertinenza: 70 },
      ]);
    });

    expect(albero).toEqual([]);
    expect(result.current.isSearchingRecursive).toBe(false);
  });

  test("intercetta le eccezioni restituendo un array vuoto e ripristinando isSearchingRecursive a false", async () => {
    const { result } = renderHook(() => useRicercaRicorsivaPrecedenti());

    mockedGetDoc.mockRejectedValueOnce(new Error("Errore di connessione Firestore"));

    let albero;
    await act(async () => {
      albero = await result.current.avviaAnalisiRicorsivaCompleta([
        { id: "cass-faulty", fonte: "interna", gradoPertinenza: 50 },
      ]);
    });

    expect(albero).toEqual([]);
    expect(result.current.isSearchingRecursive).toBe(false);
  });
});