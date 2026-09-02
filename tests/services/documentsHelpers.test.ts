import { describe, test, expect } from "vitest";
import type { DocumentoGiurisprudenziale } from "@/interfaces/interfaces";
import {
  normalizeTipoDocumento,
  toDateSafe,
  _mapFirestoreDocToMassima,
  buildNumeroSentenza,
  parseSezioneUrn,
  normalizeUpperSpaces,
  normalizeNumeroSentenzaFirstPart,
  buildUrnFromMassima,
  lowerArrayOrString,
} from "@/services/documentsHelpers";

describe("Documents Helpers Service Suite", () => {
  /* -------------------------------------------------------------------------- */
  /* NORMALIZE TIPO DOCUMENTO                                                   */
  /* -------------------------------------------------------------------------- */
  describe("normalizeTipoDocumento", () => {
    test("restituisce il valore invariato per i tipi ammessi", () => {
      expect(normalizeTipoDocumento("sentenza")).toBe("sentenza");
      expect(normalizeTipoDocumento("ordinanza")).toBe("ordinanza");
      expect(normalizeTipoDocumento("decreto")).toBe("decreto");
      expect(normalizeTipoDocumento("documento_giurisprudenza_generico")).toBe(
        "documento_giurisprudenza_generico"
      );
    });

    test("effettua il fallback a 'documento_giurisprudenza_generico' per valori non supportati", () => {
      expect(normalizeTipoDocumento("ricorso")).toBe("documento_giurisprudenza_generico");
      expect(normalizeTipoDocumento("")).toBe("documento_giurisprudenza_generico");
      expect(normalizeTipoDocumento(null)).toBe("documento_giurisprudenza_generico");
      expect(normalizeTipoDocumento(undefined)).toBe("documento_giurisprudenza_generico");
      expect(normalizeTipoDocumento(123)).toBe("documento_giurisprudenza_generico");
    });
  });

  /* -------------------------------------------------------------------------- */
  /* TO DATE SAFE                                                               */
  /* -------------------------------------------------------------------------- */
  describe("toDateSafe", () => {
    test("estrae la data da un Timestamp Firestore invocando toDate()", () => {
      const targetDate = new Date("2026-03-15T10:00:00Z");
      const firestoreTimestamp = {
        toDate: () => targetDate,
      };

      const result = toDateSafe(firestoreTimestamp);
      expect(result).toEqual(targetDate);
    });

    test("restituisce l'oggetto Date se già istanziato e valido", () => {
      const now = new Date();
      expect(toDateSafe(now)).toBe(now);
    });

    test("effettua il parse di stringhe ISO valide", () => {
      const result = toDateSafe("2026-08-10T14:30:00.000Z");
      expect(result.toISOString()).toBe("2026-08-10T14:30:00.000Z");
    });

    test("converte epoch timestamp numerici", () => {
      const epoch = 1773571200000;
      const result = toDateSafe(epoch);
      expect(result.getTime()).toBe(epoch);
    });

    test("restituisce epoch 0 (new Date(0)) per valori non validi, null o eccezioni in toDate", () => {
      expect(toDateSafe(null).getTime()).toBe(0);
      expect(toDateSafe(undefined).getTime()).toBe(0);
      expect(toDateSafe("stringa-data-invalida").getTime()).toBe(0);
      expect(toDateSafe({ toDate: () => { throw new Error("Faulty toDate"); } }).getTime()).toBe(0);
      expect(toDateSafe({ toDate: "non-una-funzione" }).getTime()).toBe(0);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* _MAP FIRESTORE DOC TO MASSIMA                                              */
  /* -------------------------------------------------------------------------- */
  describe("_mapFirestoreDocToMassima", () => {
    test("mappa correttamente un documento completo con normalizzazione di data e tipo", () => {
      const rawDoc = {
        titolo: "Sentenza Trasparenza Bancaria",
        organo_giudicante: "Corte di Cassazione",
        tipo_documento: "sentenza",
        createdAt: "2026-06-01T08:00:00Z",
        fascicoloIds: ["fasc_01", "fasc_02"],
        massima: "La clausola di determinazione del tasso...",
      };

      const result = _mapFirestoreDocToMassima("doc_cass_101", rawDoc);

      expect(result.id).toBe("doc_cass_101");
      expect(result.tipo_documento).toBe("sentenza");
      expect(result.createdAt).toEqual(new Date("2026-06-01T08:00:00Z"));
      expect(result.fascicoloIds).toEqual(["fasc_01", "fasc_02"]);
    });

    test("assegna 'documento_giurisprudenza_generico' se il tipo_documento è assente", () => {
      const rawDoc = {
        titolo: "Provvedimento generico",
        createdAt: null,
      };

      const result = _mapFirestoreDocToMassima("doc_gen_01", rawDoc);

      expect(result.tipo_documento).toBe("documento_giurisprudenza_generico");
      expect(result.createdAt.getTime()).toBe(0);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* BUILD NUMERO SENTENZA                                                      */
  /* -------------------------------------------------------------------------- */
  describe("buildNumeroSentenza", () => {
    test("restituisce stringa vuota se numero_sentenza manca", () => {
      const doc = { data_sentenza: "2026-04-10" } as DocumentoGiurisprudenziale;
      expect(buildNumeroSentenza(doc)).toBe("");
    });

    test("lascia inalterato il numero se contiene già lo slash dell'anno", () => {
      const doc = {
        numero_sentenza: " 15420/2026 ",
        data_sentenza: "2026-05-15",
      } as DocumentoGiurisprudenziale;

      expect(buildNumeroSentenza(doc)).toBe("15420/2026");
    });

    test("concatena l'anno a 4 cifre estratto da data_sentenza se il numero è privo di slash", () => {
      const doc = {
        numero_sentenza: " 15420 ",
        data_sentenza: "2026-05-15T00:00:00",
      } as DocumentoGiurisprudenziale;

      expect(buildNumeroSentenza(doc)).toBe("15420/2026");
    });

    test("restituisce solo il numero se l'anno estratto non è lungo esattamente 4 caratteri", () => {
      const doc = {
        numero_sentenza: "8899",
        data_sentenza: "26-05-15",
      } as DocumentoGiurisprudenziale;

      expect(buildNumeroSentenza(doc)).toBe("8899");
    });
  });

  /* -------------------------------------------------------------------------- */
  /* PARSE SEZIONE URN                                                          */
  /* -------------------------------------------------------------------------- */
  describe("parseSezioneUrn", () => {
    test("restituisce 'sez' se il parametro è indefinito o vuoto", () => {
      expect(parseSezioneUrn()).toBe("sez");
      expect(parseSezioneUrn("")).toBe("sez");
    });

    test("riconosce 'SEZIONI UNITE' e 'PLENARIA'", () => {
      expect(parseSezioneUrn("Corte di Cassazione - Sezioni Unite Civili")).toBe("unite");
      expect(parseSezioneUrn("Adunanza Plenaria Consiglio di Stato")).toBe("adunanza.plenaria");
    });

    test("mappa sezioni espresse in lettere o numeri romani", () => {
      expect(parseSezioneUrn("Sezione Prima Civile")).toBe("1");
      expect(parseSezioneUrn("SEZIONE SECONDA")).toBe("2");
      expect(parseSezioneUrn("Sez. TERZA")).toBe("3");
      expect(parseSezioneUrn("Sezione Quarta Penale")).toBe("4");
      expect(parseSezioneUrn("Quinta Sezione")).toBe("5");
      expect(parseSezioneUrn("Sezione Sesta")).toBe("6");
      expect(parseSezioneUrn("Settima")).toBe("7");

      expect(parseSezioneUrn("Sezione II")).toBe("2");
      expect(parseSezioneUrn("Sezione III")).toBe("3");
      expect(parseSezioneUrn("Sez. IV")).toBe("4");
      expect(parseSezioneUrn("Sezione V Bis")).toBe("5");
      expect(parseSezioneUrn("Sezione VI")).toBe("6");
      expect(parseSezioneUrn("Sez. VII")).toBe("7");
    });

    test("estrae cifre numeriche tramite fallback regex o ritorna 'sez'", () => {
      expect(parseSezioneUrn("Sezione Specializzata 8")).toBe("8");
      expect(parseSezioneUrn("Tribunale Regionale")).toBe("sez");
    });
  });

  /* -------------------------------------------------------------------------- */
  /* STRING & NUMBER SANITIZERS                                                 */
  /* -------------------------------------------------------------------------- */
  describe("normalizeUpperSpaces & normalizeNumeroSentenzaFirstPart", () => {
    test("normalizeUpperSpaces rimuove spazi multipli consecutivi e fa trim", () => {
      expect(normalizeUpperSpaces("  Corte   di    Cassazione \n Sez.  Unite ")).toBe(
        "Corte di Cassazione Sez. Unite"
      );
    });

    test("normalizeNumeroSentenzaFirstPart estrae solo il numero principale prima dello slash", () => {
      expect(normalizeNumeroSentenzaFirstPart(" 12345 / 2026 ")).toBe("12345");
      expect(normalizeNumeroSentenzaFirstPart(9876)).toBe("9876");
      expect(normalizeNumeroSentenzaFirstPart("")).toBe("");
      expect(normalizeNumeroSentenzaFirstPart(undefined)).toBe("");
      expect(normalizeNumeroSentenzaFirstPart(null as unknown as string)).toBe("");
    });
  });

  /* -------------------------------------------------------------------------- */
  /* BUILD URN FROM MASSIMA                                                     */
  /* -------------------------------------------------------------------------- */
  describe("buildUrnFromMassima", () => {
    test("restituisce stringa vuota se mancano campi obbligatori o tipo non valido", () => {
      const incompleteDoc = {
        organo_giudicante: "Corte Costituzionale",
        numero_sentenza: "12",
        data_sentenza: "2026-01-15",
        tipo_documento: "documento_giurisprudenza_generico",
      } as unknown as DocumentoGiurisprudenziale;

      expect(buildUrnFromMassima(incompleteDoc)).toBe("");
      expect(buildUrnFromMassima({ ...incompleteDoc, tipo_documento: "sentenza", data_sentenza: "" })).toBe("");
      expect(buildUrnFromMassima({ ...incompleteDoc, tipo_documento: "sentenza", numero_sentenza: "" })).toBe("");
    });

    test("genera URN conforme per Corte Costituzionale", () => {
      const doc = {
        organo_giudicante: "Corte Costituzionale",
        tipo_documento: "sentenza",
        numero_sentenza: "45/2026",
        data_sentenza: "2026-02-20T10:00:00",
      } as unknown as DocumentoGiurisprudenziale;

      expect(buildUrnFromMassima(doc)).toBe(
        "urn:nir:corte.costituzionale:sentenza:2026-02-20;45"
      );
    });

    test("genera URN conforme per Corte di Cassazione Civile (Sezioni Unite)", () => {
      const doc = {
        organo_giudicante: "Corte Suprema di Cassazione",
        materia: "Diritto Civile",
        sezione: "Sezioni Unite",
        tipo_documento: "sentenza",
        numero_sentenza: "1810/2026",
        data_sentenza: "2026-01-18",
      } as unknown as DocumentoGiurisprudenziale;

      expect(buildUrnFromMassima(doc)).toBe(
        "urn:nir:corte.cassazione;civile;sezione.unite:sentenza:2026-01-18;1810"
      );
    });

    test("genera URN conforme per Corte di Cassazione Penale (Sezione ordinaria)", () => {
      const doc = {
        organo_giudicante: "Corte di Cassazione",
        materia: "Penale",
        sezione: "Sezione Seconda",
        tipo_documento: "ordinanza",
        numero_sentenza: "789",
        data_sentenza: "2026-03-05",
      } as unknown as DocumentoGiurisprudenziale;

      expect(buildUrnFromMassima(doc)).toBe(
        "urn:nir:corte.cassazione;penale;sezione.2:ordinanza:2026-03-05;789"
      );
    });

    test("genera URN conforme per Consiglio di Stato (Adunanza Plenaria e Sezione Singola)", () => {
      const docPlenaria = {
        organo_giudicante: "Consiglio di Stato",
        sezione: "Adunanza Plenaria",
        tipo_documento: "sentenza",
        numero_sentenza: "5/2026",
        data_sentenza: "2026-04-12",
      } as unknown as DocumentoGiurisprudenziale;

      expect(buildUrnFromMassima(docPlenaria)).toBe(
        "urn:nir:consiglio.di.stato:adunanza.plenaria:sentenza:2026-04-12;5"
      );

      const docSezione = {
        organo_giudicante: "Consiglio di Stato",
        sezione: "Sezione Quarta",
        tipo_documento: "decreto",
        numero_sentenza: "22",
        data_sentenza: "2026-04-15",
      } as unknown as DocumentoGiurisprudenziale;

      expect(buildUrnFromMassima(docSezione)).toBe(
        "urn:nir:consiglio.di.stato:sezione.4:decreto:2026-04-15;22"
      );
    });

    test("restituisce stringa vuota per organi non riconosciuti nella logica URN", () => {
      const doc = {
        organo_giudicante: "Tribunale Ordinario di Torino",
        tipo_documento: "sentenza",
        numero_sentenza: "100",
        data_sentenza: "2026-05-10",
      } as unknown as DocumentoGiurisprudenziale;

      expect(buildUrnFromMassima(doc)).toBe("");
    });
  });

  /* -------------------------------------------------------------------------- */
  /* LOWER ARRAY OR STRING                                                      */
  /* -------------------------------------------------------------------------- */
  describe("lowerArrayOrString", () => {
    test("restituisce undefined se il valore è null o undefined", () => {
      expect(lowerArrayOrString(null)).toBeUndefined();
      expect(lowerArrayOrString(undefined)).toBeUndefined();
    });

    test("normalizza una stringa singola rimuovendo spazi", () => {
      expect(lowerArrayOrString("  Contratti Bancari  ")).toBe("contratti bancari");
      expect(lowerArrayOrString("   ")).toBeUndefined();
    });

    test("normalizza un array di stringhe eliminando elementi vuoti", () => {
      const input = ["  Diritto Societario  ", "", "   ", "FALLIMENTARE"];
      expect(lowerArrayOrString(input)).toEqual(["diritto societario", "fallimentare"]);
    });

    test("restituisce undefined se l'array è vuoto o composto solo da spazi", () => {
      expect(lowerArrayOrString([])).toBeUndefined();
      expect(lowerArrayOrString(["", "   "])).toBeUndefined();
    });

    test("restituisce undefined per tipi non gestiti", () => {
      expect(lowerArrayOrString(12345)).toBeUndefined();
      expect(lowerArrayOrString({})).toBeUndefined();
    });
  });
});