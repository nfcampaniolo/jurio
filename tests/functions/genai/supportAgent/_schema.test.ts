import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ChatMessageSchema, EstraiMetadatiInputSchema, EstraiMetadatiOutputSchema,
  GeminiFallbackInputSchema, GeminiFallbackOutputSchema,
} from "@functions/genai/supportAgent/_schema";

describe("support-agent schemas", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts the supported chat role and rejects invalid roles", () => {
    expect(ChatMessageSchema.parse({ role: "model", content: "hello" })).toEqual({ role: "model", content: "hello" });
    expect(ChatMessageSchema.safeParse({ role: "assistant", content: "hello" }).success).toBe(false);
  });

  it("validates fallback and metadata input/output shapes", () => {
    expect(GeminiFallbackInputSchema.parse({ query: "ricerca" })).toEqual({ query: "ricerca" });
    expect(GeminiFallbackOutputSchema.parse(null)).toBeNull();
    expect(EstraiMetadatiInputSchema.parse({ chatContext: "ctx", metadatiAttuali: {} })).toBeTruthy();
    expect(EstraiMetadatiOutputSchema.parse({ dati_nuovi_o_aggiornati: [{ chiave: "Data", valore: "2025-01-01" }] }))
      .toHaveProperty("dati_nuovi_o_aggiornati");
  });
});
