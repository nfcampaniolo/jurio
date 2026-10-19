import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";

/* ---------- mock lucide-react ---------- */
vi.mock("lucide-react", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid={`icon-${name}`} {...props} />
  );
  return {
    Tag: Icon("tag"),
    ChevronUp: Icon("chevron-up"),
    ChevronDown: Icon("chevron-down"),
    Plus: Icon("plus"),
    Trash2: Icon("trash-2"),
    Check: Icon("check"),
    X: Icon("x"),
    Edit2: Icon("edit-2"),
    Lock: Icon("lock"),
  };
});

/* ---------- mock react-hot-toast ---------- */
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
};
vi.mock("react-hot-toast", () => ({
  default: {
    success: (...args: unknown[]) => mockToast.success(...args),
    error: (...args: unknown[]) => mockToast.error(...args),
  },
}));

/* ---------- mock getDb ---------- */
const mockDbInstance = {};
const mockGetDb = vi.fn().mockResolvedValue(mockDbInstance);
vi.mock("@/infrastructure/db", () => ({
  getDb: () => mockGetDb(),
}));

/* ---------- mock firebase/firestore ---------- */
let snapshotCallback: ((snapshot: unknown) => void) | null = null;
let snapshotErrorCallback: ((error: unknown) => void) | null = null;
const mockUnsubscribe = vi.fn();
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteFieldSentinel = { _delete: true };

vi.mock("firebase/firestore", () => ({
  doc: vi.fn((_db, collectionName, id) => ({ collectionName, id })),
  onSnapshot: vi.fn((_ref, onNext, onError) => {
    snapshotCallback = onNext;
    snapshotErrorCallback = onError;
    return mockUnsubscribe;
  }),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteField: () => mockDeleteFieldSentinel,
}));

/* ---------- component ---------- */
import { CaseMetadataSection } from "@/features/chat/components/CaseMetadataSection"; // <-- adegua il path se necessario

describe("CaseMetadataSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    snapshotCallback = null;
    snapshotErrorCallback = null;
    mockGetDb.mockResolvedValue(mockDbInstance);
    mockUpdateDoc.mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  test("renderizza stato collassato iniziale e permette di espandere/collassare la sezione", async () => {
    render(
      <CaseMetadataSection
        activeFascicoloId="fasc-123"
        initialMetadati={{ Giudice: "Dott. Rossi" }}
      />
    );

    expect(screen.getByText("Info sul caso")).toBeInTheDocument();
    expect(screen.getByTestId("icon-chevron-down")).toBeInTheDocument();
    expect(screen.queryByText("Giudice")).not.toBeInTheDocument();

    // Espandi la sezione
    fireEvent.click(screen.getByRole("button", { name: /Info sul caso/i }));
    expect(screen.getByTestId("icon-chevron-up")).toBeInTheDocument();
    expect(screen.getByText("Giudice")).toBeInTheDocument();
    expect(screen.getByText("Dott. Rossi")).toBeInTheDocument();

    // Richiudi la sezione
    fireEvent.click(screen.getByRole("button", { name: /Info sul caso/i }));
    expect(screen.getByTestId("icon-chevron-down")).toBeInTheDocument();
    expect(screen.queryByText("Giudice")).not.toBeInTheDocument();
  });

  test("gestisce il listener realtime onSnapshot e la pulizia con unmount", async () => {
    const { unmount } = render(
      <CaseMetadataSection
        activeFascicoloId="fasc-123"
        initialMetadati={{}}
      />
    );

    await waitFor(() => {
      expect(snapshotCallback).not.toBeNull();
    });

    // Apri la sezione
    fireEvent.click(screen.getByRole("button", { name: /Info sul caso/i }));
    expect(screen.getByText("Nessuna informazione")).toBeInTheDocument();

    // Simula aggiornamento snapshot con dati presenti
    act(() => {
      snapshotCallback!({
        exists: () => true,
        data: () => ({ metadati: { Sezione: "Civile II" } }),
      });
    });
    expect(screen.getByText("Sezione")).toBeInTheDocument();
    expect(screen.getByText("Civile II")).toBeInTheDocument();

    // Simula aggiornamento snapshot con docSnap privo di metadati (fallback {})
    act(() => {
      snapshotCallback!({
        exists: () => true,
        data: () => ({}),
      });
    });
    expect(screen.getByText("Nessuna informazione")).toBeInTheDocument();

    // Simula snapshot con docSnap non esistente
    act(() => {
      snapshotCallback!({
        exists: () => false,
      });
    });

    // Simula errore nel callback di ascolto
    act(() => {
      snapshotErrorCallback!(new Error("Snapshot error"));
    });
    expect(console.error).toHaveBeenCalledWith("Errore ascolto metadati:", expect.any(Error));

    // Unmount per verificare unsubscribe
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  test("gestisce errore durante setupListener se getDb fallisce", async () => {
    mockGetDb.mockRejectedValueOnce(new Error("DB Init failed"));

    render(
      <CaseMetadataSection
        activeFascicoloId="fasc-123"
        initialMetadati={{}}
      />
    );

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        "Errore inizializzazione db per metadati:",
        expect.any(Error)
      );
    });
  });

  test("aggiunge un nuovo metadato con sanitizzazione della chiave", async () => {
    render(
      <CaseMetadataSection
        activeFascicoloId="fasc-123"
        initialMetadati={{}}
      />
    );

    // Apri sezione
    fireEvent.click(screen.getByRole("button", { name: /Info sul caso/i }));

    // Clicca sul pulsante "+"
    fireEvent.click(screen.getByLabelText("Aggiungi info"));

    const keyInput = screen.getByPlaceholderText("Etichetta (es. Giudice)");
    const valueInput = screen.getByPlaceholderText("Valore");

    fireEvent.change(keyInput, { target: { value: "Val./Key" } });
    fireEvent.change(valueInput, { target: { value: "100" } });

    // Salva nuovo metadato
    fireEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(() => {
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        { "metadati.ValKey": "100" }
      );
      expect(mockToast.success).toHaveBeenCalledWith("Metadato aggiunto");
    });

    // Form di aggiunta chiuso
    expect(screen.queryByPlaceholderText("Etichetta (es. Giudice)")).not.toBeInTheDocument();
  });

  test("annulla l'aggiunta di un nuovo metadato e gestisce i branch vuoti di inserimento", async () => {
    render(
      <CaseMetadataSection
        activeFascicoloId="fasc-123"
        initialMetadati={{}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Info sul caso/i }));
    fireEvent.click(screen.getByLabelText("Aggiungi info"));

    // Tasto Annulla
    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
    expect(screen.queryByPlaceholderText("Etichetta (es. Giudice)")).not.toBeInTheDocument();

    // Riapri e prova a salvare senza campi compilati (early return)
    fireEvent.click(screen.getByLabelText("Aggiungi info"));
    fireEvent.click(screen.getByRole("button", { name: "Salva" }));
    expect(mockUpdateDoc).not.toHaveBeenCalled();

    // Compila solo la chiave (early return)
    fireEvent.change(screen.getByPlaceholderText("Etichetta (es. Giudice)"), {
      target: { value: "Giudice" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salva" }));
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  test("gestisce errore durante il salvataggio di un nuovo metadato", async () => {
    mockUpdateDoc.mockRejectedValueOnce(new Error("Firestore write error"));

    render(
      <CaseMetadataSection
        activeFascicoloId="fasc-123"
        initialMetadati={{}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Info sul caso/i }));
    fireEvent.click(screen.getByLabelText("Aggiungi info"));

    fireEvent.change(screen.getByPlaceholderText("Etichetta (es. Giudice)"), {
      target: { value: "Chiave" },
    });
    fireEvent.change(screen.getByPlaceholderText("Valore"), {
      target: { value: "Valore" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith("Errore aggiunta metadato:", expect.any(Error));
      expect(mockToast.error).toHaveBeenCalledWith("Impossibile aggiungere il metadato");
    });
  });

  test("modifica un singolo metadato con successo e annullamento modifica", async () => {
    render(
      <CaseMetadataSection
        activeFascicoloId="fasc-123"
        initialMetadati={{ NumeroRuolo: "1234/2026" }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Info sul caso/i }));

    // Avvia modifica
    fireEvent.click(screen.getByLabelText("Modifica metadato"));

    const editInput = screen.getByDisplayValue("1234/2026");
    expect(editInput).toBeInTheDocument();

    // Annulla modifica
    fireEvent.click(screen.getByLabelText("Annulla modifica"));
    expect(screen.queryByDisplayValue("1234/2026")).not.toBeInTheDocument();
    expect(screen.getByText("1234/2026")).toBeInTheDocument();

    // Riapri modifica e salva
    fireEvent.click(screen.getByLabelText("Modifica metadato"));
    fireEvent.change(screen.getByDisplayValue("1234/2026"), {
      target: { value: " 5678/2026 " },
    });
    fireEvent.click(screen.getByLabelText("Salva modifica"));

    await waitFor(() => {
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        { "metadati.NumeroRuolo": "5678/2026" }
      );
      expect(mockToast.success).toHaveBeenCalledWith("Metadato aggiornato");
    });
  });

  test("gestisce errore durante la modifica di un metadato", async () => {
    mockUpdateDoc.mockRejectedValueOnce(new Error("Update failed"));

    render(
      <CaseMetadataSection
        activeFascicoloId="fasc-123"
        initialMetadati={{ Note: "Urgente" }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Info sul caso/i }));
    fireEvent.click(screen.getByLabelText("Modifica metadato"));
    fireEvent.click(screen.getByLabelText("Salva modifica"));

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith("Errore modifica metadato:", expect.any(Error));
      expect(mockToast.error).toHaveBeenCalledWith("Impossibile aggiornare");
    });
  });

  test("elimina un singolo metadato con deleteField", async () => {
    render(
      <CaseMetadataSection
        activeFascicoloId="fasc-123"
        initialMetadati={{ Giudice: "Rossi" }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Info sul caso/i }));
    fireEvent.click(screen.getByLabelText("Elimina metadato"));

    await waitFor(() => {
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        { "metadati.Giudice": mockDeleteFieldSentinel }
      );
      expect(mockToast.success).toHaveBeenCalledWith("Metadato rimosso");
    });
  });

  test("gestisce errore durante l'eliminazione di un singolo metadato", async () => {
    mockUpdateDoc.mockRejectedValueOnce(new Error("Delete single error"));

    render(
      <CaseMetadataSection
        activeFascicoloId="fasc-123"
        initialMetadati={{ Giudice: "Rossi" }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Info sul caso/i }));
    fireEvent.click(screen.getByLabelText("Elimina metadato"));

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith("Errore rimozione metadato:", expect.any(Error));
      expect(mockToast.error).toHaveBeenCalledWith("Impossibile rimuovere il metadato");
    });
  });

  test("elimina tutti i metadati dopo conferma dell'utente", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <CaseMetadataSection
        activeFascicoloId="fasc-123"
        initialMetadati={{ Chiave1: "V1", Chiave2: "V2" }}
      />
    );

    const deleteAllBtn = screen.getByLabelText("Elimina tutto");
    expect(deleteAllBtn).toBeInTheDocument();

    fireEvent.click(deleteAllBtn);
    expect(confirmSpy).toHaveBeenCalledWith("Vuoi eliminare tutti i metadati del fascicolo?");

    await waitFor(() => {
      expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { metadati: {} });
      expect(mockToast.success).toHaveBeenCalledWith("Tutti i metadati sono stati puliti");
    });
  });

  test("annulla l'eliminazione globale se l'utente rifiuta il confirm", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <CaseMetadataSection
        activeFascicoloId="fasc-123"
        initialMetadati={{ Chiave1: "V1" }}
      />
    );

    fireEvent.click(screen.getByLabelText("Elimina tutto"));
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  test("gestisce errore durante l'eliminazione globale di tutti i metadati", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockUpdateDoc.mockRejectedValueOnce(new Error("Delete all failed"));

    render(
      <CaseMetadataSection
        activeFascicoloId="fasc-123"
        initialMetadati={{ Chiave1: "V1" }}
      />
    );

    fireEvent.click(screen.getByLabelText("Elimina tutto"));

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith("Errore pulizia metadati:", expect.any(Error));
      expect(mockToast.error).toHaveBeenCalledWith("Impossibile ripulire i metadati");
    });
  });

  test("modalità sola lettura (isReadOnly = true): nasconde pulsanti di azione e mostra badge", () => {
    render(
      <CaseMetadataSection
        activeFascicoloId="fasc-123"
        initialMetadati={{ Note: "Protetta" }}
        isReadOnly={true}
      />
    );

    // Badge Sola lettura visibile
    expect(screen.getByText("Sola lettura")).toBeInTheDocument();
    expect(screen.getByTestId("icon-lock")).toBeInTheDocument();

    // Nessun pulsante di aggiunta o eliminazione totale
    expect(screen.queryByLabelText("Aggiungi info")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Elimina tutto")).not.toBeInTheDocument();

    // Espandi e verifica assenza di controlli di modifica o eliminazione singola
    fireEvent.click(screen.getByRole("button", { name: /Info sul caso/i }));
    expect(screen.getByText("Note")).toBeInTheDocument();
    expect(screen.getByText("Protetta")).toBeInTheDocument();

    expect(screen.queryByLabelText("Modifica metadato")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Elimina metadato")).not.toBeInTheDocument();
  });

  test("copertura guards: non esegue operazioni se activeFascicoloId è vuoto", async () => {
    render(
      <CaseMetadataSection
        activeFascicoloId=""
        initialMetadati={{ Valore: "Test" }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Info sul caso/i }));

    // Inizia modifica e salva con id vuoto
    fireEvent.click(screen.getByLabelText("Modifica metadato"));
    fireEvent.click(screen.getByLabelText("Salva modifica"));

    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });
});