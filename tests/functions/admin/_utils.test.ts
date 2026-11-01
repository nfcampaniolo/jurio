import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractSubcats, generateEcli, generateUrn } from "@functions/admin/_utils";
import type { SentenceDoc } from "@functions/admin/_interfaces";

describe("admin utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateUrn", () => {
    it("creates normalized URNs for recognized courts", () => {
      // Arrange
      const constitution: SentenceDoc = {
        organo_giudicante: "Corte Costituzionale",
        tipo_documento: "sentenza",
        data_sentenza: "2024-05-06T10:00:00Z",
        numero_sentenza: "42/2024",
      };
      const cassation = {
        ...constitution,
        organo_giudicante: "Corte di Cassazione",
        materia: "Civile",
        sezione: "Sezioni Unite",
      };

      // Act
      const constitutionUrn = generateUrn(constitution);
      const cassationUrn = generateUrn(cassation);

      // Assert
      expect(constitutionUrn).toBe("urn:nir:corte.costituzionale:sentenza:2024-05-06;42");
      expect(cassationUrn).toBe("urn:nir:corte.cassazione;civile;sezione.unite:sentenza:2024-05-06;42");
    });

    it("returns an empty value when required data or court is unsupported", () => {
      // Arrange
      const incomplete: SentenceDoc = { organo_giudicante: "Corte di Cassazione", tipo_documento: "sentenza" };
      const unsupported: SentenceDoc = {
        organo_giudicante: "Tribunale ordinario",
        tipo_documento: "sentenza" as const,
        data_sentenza: "2024-01-01",
        numero_sentenza: "1",
      };

      // Act
      const missing = generateUrn(incomplete);
      const unknown = generateUrn(unsupported);

      // Assert
      expect(missing).toBe("");
      expect(unknown).toBe("");
    });

    it("supports Cassation fallback sections, criminal matters, State Council plenary and rejects invalid types", () => {
      // Arrange
      const cassation: SentenceDoc = {
        organo_giudicante: "Corte di Cassazione",
        tipo_documento: "ordinanza",
        materia: "penale",
        sezione: "Feriale",
        data_sentenza: "2023-02-03",
        numero_sentenza: 8,
      };
      const plenary: SentenceDoc = {
        ...cassation,
        organo_giudicante: "Consiglio di Stato",
        sezione: "Adunanza Plenaria",
        tipo_documento: "decreto",
      };
      const invalid: SentenceDoc = { ...cassation, tipo_documento: undefined };

      // Act
      const cassationUrn = generateUrn(cassation);
      const plenaryUrn = generateUrn(plenary);
      const invalidUrn = generateUrn(invalid);

      // Assert
      expect(cassationUrn).toBe("urn:nir:corte.cassazione;penale;sezione.feriale:ordinanza:2023-02-03;8");
      expect(plenaryUrn).toBe("urn:nir:consiglio.di.stato:adunanza.plenaria:decreto:2023-02-03;8");
      expect(invalidUrn).toBe("");
    });

    it("maps numbered State Council sections and rejects missing identifying fields", () => {
      // Arrange
      const stateCouncil: SentenceDoc = {
        organo_giudicante: "Consiglio di Stato",
        tipo_documento: "sentenza",
        sezione: "Terza",
        data_sentenza: "2020-01-01",
        numero_sentenza: 9,
      };
      const missingCourt = { ...stateCouncil, organo_giudicante: "" };
      const missingDate = { ...stateCouncil, data_sentenza: "" };
      const missingNumber = { ...stateCouncil, numero_sentenza: "" };
      const defaultSection = { ...stateCouncil, sezione: undefined };

      // Act
      const valid = generateUrn(stateCouncil);

      // Assert
      expect(valid).toBe("urn:nir:consiglio.di.stato:sezione.3:sentenza:2020-01-01;9");
      expect(generateUrn(missingCourt)).toBe("");
      expect(generateUrn(missingDate)).toBe("");
      expect(generateUrn(missingNumber)).toBe("");
      expect(generateUrn(defaultSection)).toBe("urn:nir:consiglio.di.stato:sezione.sez:sentenza:2020-01-01;9");
    });
  });

  describe("generateEcli", () => {
    it("normalizes a court identifier and sentence number", () => {
      // Arrange
      const data = {
        organo_giudicante: "Corte di Cassazione",
        materia: "civile",
        tipo_documento: "sentenza" as const,
        numero_sentenza: "0007",
        data_sentenza: "2024-01-02",
      };

      // Act
      const result = generateEcli(data);

      // Assert
      expect(result).toBe("ECLI:IT:CASS:2024:7CIV");
    });

    it("returns an empty value for an invalid number", () => {
      // Arrange
      const data = { organo_giudicante: "Corte di Cassazione", numero_sentenza: "n/a" };

      // Act
      const result = generateEcli(data);

      // Assert
      expect(result).toBe("");
    });

    it("generates ECLI suffixes for State Council decisions and other court authorities", () => {
      // Arrange
      const base: SentenceDoc = {
        organo_giudicante: "Consiglio di Stato",
        tipo_documento: "sentenza",
        numero_sentenza: "7",
        data_sentenza: "2024-06-01",
      };
      const decisions: Array<[SentenceDoc, string]> = [
        [base, "ECLI:IT:CDS:2024:7SENT"],
        [{ ...base, tipo_documento: "ordinanza", tipo_ordinanza: "misura cautelare" }, "ECLI:IT:CDS:2024:7OCAU"],
        [{ ...base, tipo_documento: "ordinanza", tipo_ordinanza: "istruttoria" }, "ECLI:IT:CDS:2024:7OCOL"],
        [{ ...base, tipo_documento: "decreto", tipo_decreto: "cautelare" }, "ECLI:IT:CDS:2024:7DCAU"],
        [{ ...base, tipo_documento: "decreto" }, "ECLI:IT:CDS:2024:7DCOL"],
        [{ ...base, organo_giudicante: "Corte dei Conti" }, "ECLI:IT:CCONT:2024:7"],
        [{ ...base, organo_giudicante: "Tribunale Amministrativo Regionale" }, "ECLI:IT:TAR:2024:7"],
        [{ ...base, organo_giudicante: "Corte di Appello" }, "ECLI:IT:CAPP:2024:7"],
        [{ ...base, organo_giudicante: "Tribunale di Milano" }, "ECLI:IT:TRIB:2024:7"],
        [{ ...base, organo_giudicante: "Giudice di Pace" }, "ECLI:IT:GDP:2024:7"],
      ];

      // Act
      const results = decisions.map(([data]) => generateEcli(data));

      // Assert
      expect(results).toEqual(decisions.map(([, expected]) => expected));
    });

    it("tokenizes unrecognized court names and rejects unsupported decision types", () => {
      // Arrange
      const generic: SentenceDoc = {
        organo_giudicante: "Ufficio Suprema del Foro Centrale",
        tipo_documento: "sentenza",
        numero_sentenza: "15",
        data_sentenza: "2024-01-01",
      };
      const invalidStateCouncil = {
        ...generic,
        organo_giudicante: "Consiglio di Stato",
        tipo_documento: "decreto" as const,
        tipo_decreto: undefined,
      };
      const unsupportedStateCouncil = {
        ...invalidStateCouncil,
        tipo_documento: "unknown" as SentenceDoc["tipo_documento"],
      };

      // Act
      const tokenized = generateEcli(generic);
      const noSuffix = generateEcli(invalidStateCouncil);
      const unsupportedSuffix = generateEcli(unsupportedStateCouncil);

      // Assert
      expect(tokenized).toBe("ECLI:IT:ufficio.foro.centrale:2024:15");
      expect(noSuffix).toBe("ECLI:IT:CDS:2024:15DCOL");
      expect(unsupportedSuffix).toBe("");
    });

    it("returns empty when the sentence number cannot be normalized or the court has no ECLI code", () => {
      // Arrange
      const invalidNumber: SentenceDoc = {
        organo_giudicante: "Corte dei Conti",
        numero_sentenza: "abc",
        data_sentenza: "2024-01-01",
      };
      const unsupported: SentenceDoc = { organo_giudicante: "", numero_sentenza: "10/2024" };

      // Act
      const malformed = generateEcli(invalidNumber);
      const noAuthority = generateEcli(unsupported);

      // Assert
      expect(malformed).toBe("");
      expect(noAuthority).toBe("");
    });
  });

  describe("extractSubcats", () => {
    it("normalizes strings and filters invalid array values", () => {
      // Arrange
      const raw = ["  Diritto   Civile ", 4, "", "Penale"];

      // Act
      const result = extractSubcats(raw);

      // Assert
      expect(result).toEqual(["diritto civile", "penale"]);
    });

    it("returns an empty list for unsupported input", () => {
      // Arrange
      const raw = { value: "civile" };

      // Act
      const result = extractSubcats(raw);

      // Assert
      expect(result).toEqual([]);
    });

    it("returns normalized values from strings and rejects empty or falsy metadata", () => {
      // Arrange
      const valid = "  DIRITTO\n   PENALE ";

      // Act
      const fromString = extractSubcats(valid);
      const fromBlank = extractSubcats("   ");
      const fromFalsy = extractSubcats(null);

      // Assert
      expect(fromString).toEqual(["diritto penale"]);
      expect(fromBlank).toEqual([]);
      expect(fromFalsy).toEqual([]);
    });
  });
});
