import { describe, expect, it, vi } from "vitest";
import {
  getActivePseudonymizationVault,
  pseudonymizeGenkit,
  PseudonymizationVault,
  withPseudonymization,
} from "@functions/privacy/pseudonymization";

describe("PseudonymizationVault", () => {
  it("reuses tokens for repeated structured PII and restores the original values", () => {
    const vault = new PseudonymizationVault();
    const input = {
      nomeCliente: "Mario Rossi",
      email: "mario.rossi@email.it",
      message: "Mario Rossi può essere contattato a mario.rossi@email.it.",
    };
    vault.registerPayload(input);

    const pseudonymized = vault.pseudonymize(input);
    expect(pseudonymized.nomeCliente).toBe("{NOME_1}");
    expect(pseudonymized.email).toBe("{EMAIL_1}");
    expect(pseudonymized.message).toBe("{NOME_1} può essere contattato a {EMAIL_1}.");
    expect(vault.restore(pseudonymized)).toEqual(input);
  });

  it("does not rewrite generated tokens when registered values overlap", () => {
    const vault = new PseudonymizationVault();
    const input = {
      nome: "Mario",
      cognome: "Rossi",
      fullName: "Mario Rossi",
      message: "Mario Rossi",
    };
    vault.registerPayload(input);

    const pseudonymized = vault.pseudonymize(input);

    expect(pseudonymized.message).toBe("{NOME_3}");
    expect(vault.restore(pseudonymized)).toEqual(input);
  });

  it("detects common identifiers and labelled names in free text", () => {
    const vault = new PseudonymizationVault();
    const input =
      "Mi chiamo Mario Rossi, CF RSSMRA80A01H501U, email mario.rossi@email.it, " +
      "telefono +39 333 123 4567, IBAN IT60X0542811101000000123456, residente in Via Roma 10. " +
      "L'Avv. Mario Rossi deposita l'atto.";

    const pseudonymized = vault.pseudonymize(input);

    expect(pseudonymized).not.toContain("Mario Rossi");
    expect(pseudonymized).not.toContain("RSSMRA80A01H501U");
    expect(pseudonymized).not.toContain("mario.rossi@email.it");
    expect(pseudonymized).not.toContain("+39 333 123 4567");
    expect(pseudonymized).not.toContain("IT60X0542811101000000123456");
    expect(pseudonymized).not.toContain("Via Roma 10");
    expect(vault.restore(pseudonymized)).toBe(input);
  });

  it("does not classify protocol numbers or currency amounts as phone numbers", () => {
    const vault = new PseudonymizationVault();
    const input = "Protocollo LEG-2026-123456, valore della causa € 1.500.000,00.";

    expect(vault.pseudonymize(input)).toBe(input);
  });

  it("keeps concurrent request vaults isolated", async () => {
    const run = (name: string) =>
      withPseudonymization({ nome: name }, async () => {
        await Promise.resolve();
        const vault = getActivePseudonymizationVault();
        if (!vault) throw new Error("Pseudonymization context is missing");
        const tokenized = vault.pseudonymize(`${name} {NOME_1}`);
        return { tokenized, restored: vault.restore(tokenized) };
      });

    const [first, second] = await Promise.all([run("Mario Rossi"), run("Luisa Bianchi")]);
    expect(first).toEqual({ tokenized: "{NOME_1} {NOME_1}", restored: "Mario Rossi Mario Rossi" });
    expect(second).toEqual({ tokenized: "{NOME_1} {NOME_1}", restored: "Luisa Bianchi Luisa Bianchi" });
  });

  it("clears the request vault after the operation completes", async () => {
    let requestVault: PseudonymizationVault | undefined;
    const token = await withPseudonymization({ email: "mario.rossi@email.it" }, () => {
      requestVault = getActivePseudonymizationVault();
      if (!requestVault) throw new Error("Pseudonymization context is missing");
      return requestVault.pseudonymize("mario.rossi@email.it");
    });

    expect(token).toBe("{EMAIL_1}");
    expect(requestVault?.restore(token)).toBe("{EMAIL_1}");
  });

  it("pseudonymizes Genkit requests and restores model responses and streamed chunks", async () => {
    const streamedChunks: Array<{ text: string }> = [];
    const generate = vi.fn(async (request: {
      prompt: string;
      onChunk: (chunk: { text: string }) => void;
    }) => {
      request.onChunk({ text: request.prompt });
      return { text: request.prompt };
    });
    const ai = pseudonymizeGenkit({ generate });

    const result = await withPseudonymization(
      { email: "mario.rossi@email.it" },
      () =>
        ai.generate({
          prompt: "Contatta mario.rossi@email.it",
          onChunk: (chunk) => streamedChunks.push(chunk),
        })
    );

    expect(generate.mock.calls[0][0].prompt).toBe("Contatta {EMAIL_1}");
    expect(result.text).toBe("Contatta mario.rossi@email.it");
    expect(streamedChunks).toEqual([{ text: "Contatta mario.rossi@email.it" }]);
  });
});
