import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import type {
  FilterInput,
  JurioSentenceDoc,
  ScoredJurioItem,
  SearchRequestBody,
} from "@functions/research/_interfaces";

describe("admin interface contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts typed filters and optional search request properties", () => {
    // Arrange
    const filter: FilterInput = { field: "fonte", operator: "==", value: "Cassazione" };
    const request: SearchRequestBody = { query: "contratto", limit: 10, filters: [filter] };
    const emptyRequest: SearchRequestBody = {};

    // Act
    const results = [request.query, request.limit, emptyRequest.filters];

    // Assert
    expect(filter.operator).toBe("==");
    expectTypeOf(request).toMatchTypeOf<SearchRequestBody>();
    expect(results).toEqual(["contratto", 10, undefined]);
  });

  it("supports the sentence schema and scored ranking metadata", () => {
    // Arrange
    const sentence: JurioSentenceDoc = {
      tipo_documento: "sentenza",
      fonte: "Cassazione",
      logo_fonte: null,
      organo_giudicante: "Corte di Cassazione",
      sezione: "Prima",
      numero_sentenza: "123",
      dataSentenza: "2025-01-01",
      data_sentenza: null,
      ecli: null,
      urn: null,
      tipo_ordinanza: null,
      efficacia_temporale: null,
      misura_disposta: null,
      fumus_boni_iuris: null,
      periculum_in_mora: null,
      tipo_decreto: null,
      contraddittorio: null,
      autorita_monocratica: null,
      contenuto_precettivo: null,
      massima: "Principio di diritto",
      summary: null,
      fattispecie_rilevante: null,
    };
    const scored: ScoredJurioItem = {
      ...sentence,
      id: "sentenza-123",
      url: "https://example.test/sentenza-123",
      highlighted_massima: null,
      highlighted_fattispecie: null,
      highlighted_preview: "Principio",
      _matchCount: 1,
      _distance: 0.2,
      _rankingDistance: 0.1,
      _source: "direct",
    };

    // Act
    const rankingSource = scored._source;

    // Assert
    expectTypeOf(scored).toMatchTypeOf<ScoredJurioItem>();
    expectTypeOf<JurioSentenceDoc["dataSentenza"]>().not.toBeAny();
    expect(rankingSource).toBe("direct");
  });
});
