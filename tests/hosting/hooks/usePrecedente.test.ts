import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { usePrecedente } from "@/features/analisi/hooks/usePrecedente";
import { getDb } from "@/infrastructure/db";
import { doc, getDoc } from "firebase/firestore";
import type { DocumentSnapshot, DocumentData } from "firebase/firestore";

/* ---------- mock dei moduli esterni ---------- */
vi.mock("@/infrastructure/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
}));

const mockedGetDb = vi.mocked(getDb);
const mockedDoc = vi.mocked(doc);
const mockedGetDoc = vi.mocked(getDoc);

describe("usePrecedente Hook Suite", () => {
  const mockDb = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetDb.mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof getDb>>);
    mockedDoc.mockReturnValue("mocked-doc-ref" as unknown as ReturnType<typeof doc>);
  });

  test("non esegue il fetch e resetta lo stato se enabled è false", () => {
    const { result } = renderHook(() => usePrecedente("cass-1234", false));

    expect(result.current.loading).toBe(false);
    expect(result.current.precedente).toBeNull();
    expect(result.current.error).toBeNull();
    expect(mockedGetDoc).not.toHaveBeenCalled();
  });

  test("non esegue il fetch e resetta lo stato se l'ID è nullo, indefinito o contiene '/'", () => {
    const { result: resNull } = renderHook(() => usePrecedente(null));
    expect(resNull.current.loading).toBe(false);

    const { result: resUndefined } = renderHook(() => usePrecedente(undefined));
    expect(resUndefined.current.loading).toBe(false);

    const { result: resSlash } = renderHook(() => usePrecedente("invalid/id"));
    expect(resSlash.current.loading).toBe(false);

    expect(mockedGetDoc).not.toHaveBeenCalled();
  });

  test("recupera con successo il documento quando è valido", async () => {
    const mockDocSnapshot = {
      exists: () => true,
      id: "cass-1234",
      data: () => ({
        organo_giudicante: "Corte di Cassazione",
        massima: "Principio di diritto fondamentale",
      }),
    };

    mockedGetDoc.mockResolvedValueOnce(
      mockDocSnapshot as unknown as DocumentSnapshot<DocumentData, DocumentData>
    );

    const { result } = renderHook(() => usePrecedente("cass-1234"));

    // Prima del completamento della Promise, loading deve essere true
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.precedente).toEqual({
      id: "cass-1234",
      organo_giudicante: "Corte di Cassazione",
      massima: "Principio di diritto fondamentale",
    });
    expect(result.current.error).toBeNull();
    
    // Verifica i parametri passati a doc()
    expect(mockedDoc).toHaveBeenCalledWith(mockDb, "sentences", "cass-1234");
  });

  test("imposta correttamente l'errore se il documento non esiste in Firestore", async () => {
    const mockDocSnapshot = {
      exists: () => false,
    };

    mockedGetDoc.mockResolvedValueOnce(
      mockDocSnapshot as unknown as DocumentSnapshot<DocumentData, DocumentData>
    );

    const { result } = renderHook(() => usePrecedente("cass-not-found"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.precedente).toBeNull();
    expect(result.current.error).toBe("Precedente non trovato: cass-not-found");
  });

  test("imposta correttamente l'errore se la chiamata a Firestore fallisce (eccezione)", async () => {
    mockedGetDoc.mockRejectedValueOnce(new Error("Errore di rete Firebase"));

    const { result } = renderHook(() => usePrecedente("cass-error"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.precedente).toBeNull();
    expect(result.current.error).toBe("Errore di rete Firebase");
  });

  test("non aggiorna lo stato se il componente viene smontato prima della fine della Promise", async () => {
    let resolvePromise: (value: unknown) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    mockedGetDoc.mockReturnValueOnce(
      pendingPromise as unknown as Promise<DocumentSnapshot<DocumentData, DocumentData>>
    );

    const { result, unmount } = renderHook(() => usePrecedente("cass-unmount"));

    expect(result.current.loading).toBe(true);

    // Smonta il componente (simula la navigazione via dalla pagina o rimozione dal DOM)
    unmount();

    // Ora risolvi la promessa
    await act(async () => {
      resolvePromise!({
        exists: () => true,
        id: "cass-unmount",
        data: () => ({ organo_giudicante: "Cassazione" }),
      });
      // Lasciamo smaltire le code dei task
      await new Promise((r) => setTimeout(r, 0));
    });

    // Dato che il componente è smontato, l'aggiornamento di stato non deve essere avvenuto
    expect(result.current.loading).toBe(true); 
    expect(result.current.precedente).toBeNull();
  });
});