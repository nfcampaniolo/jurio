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

  const createMockSnapshot = (
    id: string,
    exists: boolean,
    data?: Record<string, unknown>
  ) =>
    ({
      id,
      exists: () => exists,
      data: () => data ?? {},
    }) as unknown as DocumentSnapshot<DocumentData, DocumentData>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetDb.mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof getDb>>);
    mockedDoc.mockReturnValue("mocked-doc-ref" as unknown as ReturnType<typeof doc>);
  });

  test("inizializza lo stato con isSearchingRecursive impostato su false", () => {
    const { result } = renderHook(() => useRicercaRicorsivaPrecedenti());

    expect(result.current.isSearchingRecursive).toBe(false);
  });

  test("ignora le fonti di tipo web senza interrogare Firestore né creare rami nell'albero", async () => {
    const { result } = renderHook(() => useRicercaRicorsivaPrecedenti());

    const fontiWeb: PrecedenteReperito[] = [
      {
        id: "https://www.normattiva.it/uri-res/legge-241-1990",
        fonte: "web",
        gradoPertinenza: 85,
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

  test("costruisce correttamente l'albero ricorsivo per fonti interne a più livelli di profondità", async () => {
    const { result } = renderHook(() => useRicercaRicorsivaPrecedenti());

    // 1. Documento radice Firestore (Livello 0)
    mockedGetDoc.mockResolvedValueOnce(
      createMockSnapshot("cass-radice", true, {
        organo_giudicante: "Corte di Cassazione, Sez. I",
        numero_sentenza: "1000/2026",
        precedenti_richiamati: ["Cass. 500/2024", "Cass. 200/2020"],
      })
    );

    // 2. Livello 1: Cass. 500/2024 (ha a sua volta una citazione)
    mockedCercaPrecedente.mockResolvedValueOnce({
      id: "cass-500",
      numero_sentenza: "500/2024",
      organo_giudicante: "Corte di Cassazione",
      precedenti_richiamati: ["Cass. Sez. Un. 100/2018"],
    } as unknown as Awaited<ReturnType<typeof cercaPrecedente>>);

    // 3. Livello 2: Cass. Sez. Un. 100/2018 (foglia)
    mockedCercaPrecedente.mockResolvedValueOnce({
      id: "cass-100",
      numero_sentenza: "100/2018",
      organo_giudicante: "Corte di Cassazione Sezioni Unite",
      precedenti_richiamati: [],
    } as unknown as Awaited<ReturnType<typeof cercaPrecedente>>);

    // 4. Livello 1: Cass. 200/2020 (non trovata dal resolver)
    mockedCercaPrecedente.mockResolvedValueOnce(null);

    const fonti: PrecedenteReperito[] = [
      {
        id: "cass-radice",
        fonte: "interna",
        gradoPertinenza: 95,
      },
    ];

    let albero;
    await act(async () => {
      albero = await result.current.avviaAnalisiRicorsivaCompleta(fonti);
    });

    expect(albero).toHaveLength(1);
    expect(albero![0].radiceId).toBe("cass-radice");
    expect(albero![0].datiRadice.numero_sentenza).toBe("1000/2026");

    const figliRadice = albero![0].alberoFigli;
    expect(figliRadice).toHaveLength(2);

    // Ramo 1
    expect(figliRadice[0].citazioneTestuale).toBe("Cass. 500/2024");
    expect(figliRadice[0].documentoTrovato?.id).toBe("cass-500");
    expect(figliRadice[0].figli).toHaveLength(1);
    expect(figliRadice[0].figli[0].citazioneTestuale).toBe("Cass. Sez. Un. 100/2018");
    expect(figliRadice[0].figli[0].documentoTrovato?.id).toBe("cass-100");
    expect(figliRadice[0].figli[0].figli).toEqual([]);

    // Ramo 2
    expect(figliRadice[1].citazioneTestuale).toBe("Cass. 200/2020");
    expect(figliRadice[1].documentoTrovato).toBeNull();
    expect(figliRadice[1].figli).toEqual([]);

    expect(result.current.isSearchingRecursive).toBe(false);
  });

  test("evita loop e chiamate duplicate normalizzando le citazioni già visitate", async () => {
    const { result } = renderHook(() => useRicercaRicorsivaPrecedenti());

    mockedGetDoc.mockResolvedValueOnce(
      createMockSnapshot("cass-loop", true, {
        precedenti_richiamati: [
          "Cass. 1234/2023",
          " cass. 1234/2023 ",
          "CASS. 1234/2023",
        ],
      })
    );

    mockedCercaPrecedente.mockResolvedValueOnce({
      id: "cass-1234",
      precedenti_richiamati: [],
    } as unknown as Awaited<ReturnType<typeof cercaPrecedente>>);

    let albero;
    await act(async () => {
      albero = await result.current.avviaAnalisiRicorsivaCompleta([
        { id: "cass-loop", fonte: "interna", gradoPertinenza: 90 },
      ]);
    });

    expect(albero).toHaveLength(1);
    expect(albero![0].alberoFigli).toHaveLength(1);
    expect(mockedCercaPrecedente).toHaveBeenCalledTimes(1);
  });

  test("interrompe la ricorsione al raggiungimento del limite massimo di profondità (maxProfondita = 3)", async () => {
    const { result } = renderHook(() => useRicercaRicorsivaPrecedenti());

    // Radice
    mockedGetDoc.mockResolvedValueOnce(
      createMockSnapshot("cass-d0", true, {
        precedenti_richiamati: ["D1"],
      })
    );

    // Profondità 0: cerca D1 -> richiama D2
    mockedCercaPrecedente.mockResolvedValueOnce({
      id: "id-d1",
      precedenti_richiamati: ["D2"],
    } as unknown as Awaited<ReturnType<typeof cercaPrecedente>>);

    // Profondità 1: cerca D2 -> richiama D3
    mockedCercaPrecedente.mockResolvedValueOnce({
      id: "id-d2",
      precedenti_richiamati: ["D3"],
    } as unknown as Awaited<ReturnType<typeof cercaPrecedente>>);

    // Profondità 2: cerca D3 -> richiama D4
    mockedCercaPrecedente.mockResolvedValueOnce({
      id: "id-d3",
      precedenti_richiamati: ["D4"],
    } as unknown as Awaited<ReturnType<typeof cercaPrecedente>>);

    // Profondità 3: cerca D4 -> richiama D5
    mockedCercaPrecedente.mockResolvedValueOnce({
      id: "id-d4",
      precedenti_richiamati: ["D5"],
    } as unknown as Awaited<ReturnType<typeof cercaPrecedente>>);

    // Profondità 4 (4 > 3): esploraAlberoRicorsivo restituisce [] senza chiamare cercaPrecedente per D5
    let albero;
    await act(async () => {
      albero = await result.current.avviaAnalisiRicorsivaCompleta([
        { id: "cass-d0", fonte: "interna", gradoPertinenza: 92 },
      ]);
    });

    expect(mockedCercaPrecedente).toHaveBeenCalledTimes(4);

    const livello0 = albero![0].alberoFigli[0]; // D1
    const livello1 = livello0.figli[0];          // D2
    const livello2 = livello1.figli[0];          // D3
    const livello3 = livello2.figli[0];          // D4

    expect(livello3.citazioneTestuale).toBe("D4");
    expect(livello3.figli).toEqual([]);
  });

  test("restituisce un array vuoto se il documento radice non esiste in Firestore", async () => {
    const { result } = renderHook(() => useRicercaRicorsivaPrecedenti());

    mockedGetDoc.mockResolvedValueOnce(
      createMockSnapshot("cass-inesistente", false)
    );

    let albero;
    await act(async () => {
      albero = await result.current.avviaAnalisiRicorsivaCompleta([
        { id: "cass-inesistente", fonte: "interna", gradoPertinenza: 70 },
      ]);
    });

    expect(albero).toEqual([]);
    expect(result.current.isSearchingRecursive).toBe(false);
  });

  test("gestisce le eccezioni durante l'analisi restituendo un array vuoto e ripristinando isSearchingRecursive", async () => {
    const { result } = renderHook(() => useRicercaRicorsivaPrecedenti());

    mockedGetDoc.mockRejectedValueOnce(new Error("Errore critico di lettura Firestore"));

    let albero;
    await act(async () => {
      albero = await result.current.avviaAnalisiRicorsivaCompleta([
        { id: "cass-errore", fonte: "interna", gradoPertinenza: 50 },
      ]);
    });

    expect(albero).toEqual([]);
    expect(result.current.isSearchingRecursive).toBe(false);
  });
});