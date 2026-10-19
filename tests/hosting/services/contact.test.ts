import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import type { CreateContactInput } from "@/interfaces/interfaces";

/* ---------- hoisted mocks ---------- */
const {
  mockGetDb,
  mockAddDoc,
  mockCollection,
  mockServerTimestamp,
  MockFirebaseError,
} = vi.hoisted(() => {
  class FirebaseError extends Error {
    code: string;
    constructor(code: string, message: string = "") {
      super(message);
      this.name = "FirebaseError";
      this.code = code;
    }
  }

  return {
    mockGetDb: vi.fn(),
    mockAddDoc: vi.fn(),
    mockCollection: vi.fn((db: unknown, path: string) => ({ db, path })),
    mockServerTimestamp: vi.fn(() => ({ _type: "server_timestamp" })),
    MockFirebaseError: FirebaseError,
  };
});

/* ---------- mock modules ---------- */
vi.mock("firebase/app", () => ({
  __esModule: true,
  FirebaseError: MockFirebaseError,
}));

vi.mock("firebase/firestore", () => ({
  __esModule: true,
  addDoc: mockAddDoc,
  collection: mockCollection,
  serverTimestamp: mockServerTimestamp,
}));

vi.mock("./db", () => ({
  __esModule: true,
  getDb: mockGetDb,
}));

vi.mock("@/infrastructure/db", () => ({
  __esModule: true,
  getDb: mockGetDb,
}));

/* ---------- subject under test ---------- */
// Adeguare il path di import se il file ha un nome specifico (es. contact.ts o register.ts)
import { createContact } from "@/features/info/hooks/contact";

describe("Contact Service - createContact Suite", () => {
  const fakeDb = { id: "firestore_test_db" };

  const validContactInput: CreateContactInput = {
    name: "Avv. Marco Rossi",
    email: "Marco.Rossi@StudioLegale.it",
    subject: "Richiesta integrazione API Jurio Word",
    message: "Vorremmo attivare la licenza team per 5 postazioni dello studio.",
    consent: true,
    page: "/piani-abbonamento",
    userAgent: "Mozilla/5.0 Vitest Test Environment",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDb.mockResolvedValue(fakeDb);
    mockAddDoc.mockResolvedValue({ id: "contact_doc_789" });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /* -------------------------------------------------------------------------- */
  /* VALIDAZIONE DATI INPUT                                                     */
  /* -------------------------------------------------------------------------- */
  describe("Validazione Input Client-Side", () => {
    test("solleva errore se name manca o contiene solo spazi", async () => {
      await expect(
        createContact({ ...validContactInput, name: "" })
      ).rejects.toThrow("Nome mancante");

      await expect(
        createContact({ ...validContactInput, name: "   " })
      ).rejects.toThrow("Nome mancante");
    });

    test("solleva errore se email manca o contiene solo spazi", async () => {
      await expect(
        createContact({ ...validContactInput, email: "" })
      ).rejects.toThrow("Email mancante");

      await expect(
        createContact({ ...validContactInput, email: "   " })
      ).rejects.toThrow("Email mancante");
    });

    test("solleva errore se subject manca o contiene solo spazi", async () => {
      await expect(
        createContact({ ...validContactInput, subject: "" })
      ).rejects.toThrow("Oggetto mancante");

      await expect(
        createContact({ ...validContactInput, subject: "   " })
      ).rejects.toThrow("Oggetto mancante");
    });

    test("solleva errore se message manca o contiene solo spazi", async () => {
      await expect(
        createContact({ ...validContactInput, message: "" })
      ).rejects.toThrow("Messaggio mancante");

      await expect(
        createContact({ ...validContactInput, message: "   " })
      ).rejects.toThrow("Messaggio mancante");
    });

    test("solleva errore se consent è assente o false", async () => {
      await expect(
        createContact({ ...validContactInput, consent: false })
      ).rejects.toThrow("Consenso mancante");
    });
  });

  /* -------------------------------------------------------------------------- */
  /* PERSISTENZA E NORMALIZZAZIONE PAYLOAD                                     */
  /* -------------------------------------------------------------------------- */
  describe("Persistenza Firestore e Sanificazione Dati", () => {
    test("invia il payload normalizzato, effettua il trim, converte l'email in lowercase e ritorna l'id", async () => {
      const input: CreateContactInput = {
        name: "   Dott.ssa Giulia Bianchi   ",
        email: "   Giulia.Bianchi@Studio.IT   ",
        subject: "   Quesito Giurisprudenziale   ",
        message: "   Dettaglio richiesta chiarimento.   ",
        consent: true,
        page: "/giurisprudenza",
        userAgent: "CustomAgent/1.0",
      };

      const docId = await createContact(input);

      expect(mockGetDb).toHaveBeenCalledTimes(1);
      expect(mockCollection).toHaveBeenCalledWith(fakeDb, "contacts");
      expect(mockServerTimestamp).toHaveBeenCalledTimes(1);

      expect(mockAddDoc).toHaveBeenCalledWith(
        { db: fakeDb, path: "contacts" },
        {
          name: "Dott.ssa Giulia Bianchi",
          email: "giulia.bianchi@studio.it",
          subject: "Quesito Giurisprudenziale",
          message: "Dettaglio richiesta chiarimento.",
          consent: true,
          page: "/giurisprudenza",
          userAgent: "CustomAgent/1.0",
          createdAt: { _type: "server_timestamp" },
        }
      );

      expect(docId).toBe("contact_doc_789");
    });

    test("imposta page e userAgent a null se omessi dall'input", async () => {
      const input: CreateContactInput = {
        name: "Avv. Luca Verdi",
        email: "luca.verdi@pec.it",
        subject: "Assistenza",
        message: "Messaggio di test senza metadati browser.",
        consent: true,
      };

      await createContact(input);

      expect(mockAddDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          page: null,
          userAgent: null,
        })
      );
    });
  });

  /* -------------------------------------------------------------------------- */
  /* GESTIONE ERRORI FIREBASE ED ECCEZIONI                                      */
  /* -------------------------------------------------------------------------- */
  describe("Gestione Errori e Mapping", () => {
    test("mappa l'errore permission-denied di Firestore", async () => {
      mockAddDoc.mockRejectedValueOnce(
        new MockFirebaseError("permission-denied", "Missing or insufficient permissions.")
      );

      await expect(createContact(validContactInput)).rejects.toThrow(
        "Permessi insufficienti per inviare il messaggio."
      );
      expect(console.error).toHaveBeenCalledWith("Errore invio contatto:", expect.any(Error));
    });

    test("mappa l'errore unavailable di Firestore", async () => {
      mockAddDoc.mockRejectedValueOnce(
        new MockFirebaseError("unavailable", "Backend service is currently unreachable.")
      );

      await expect(createContact(validContactInput)).rejects.toThrow(
        "Servizio non disponibile. Riprova."
      );
      expect(console.error).toHaveBeenCalledWith("Errore invio contatto:", expect.any(Error));
    });

    test("mappa errori Firebase generici con messaggio generico server", async () => {
      mockAddDoc.mockRejectedValueOnce(
        new MockFirebaseError("resource-exhausted", "Quota exceeded.")
      );

      await expect(createContact(validContactInput)).rejects.toThrow(
        "Errore del server durante l'invio."
      );
    });

    test("rilancia inalterate le istanze generiche di Error non-Firebase", async () => {
      const customDbError = new Error("Database offline: timeout di connessione socket");
      mockGetDb.mockRejectedValueOnce(customDbError);

      await expect(createContact(validContactInput)).rejects.toThrow(
        "Database offline: timeout di connessione socket"
      );
    });

    test("gestisce valori non-Error lanciati nel catch con messaggio imprevisto", async () => {
      mockAddDoc.mockRejectedValueOnce("Errore primitivo stringa");

      await expect(createContact(validContactInput)).rejects.toThrow(
        "Errore imprevisto nell’invio del messaggio."
      );
    });
  });
});