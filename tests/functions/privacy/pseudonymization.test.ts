import { describe, expect, it, vi } from "vitest";
import {
  getActivePseudonymizationVault,
  pseudonymizeGenkit,
  PseudonymizationVault,
  withPseudonymization,
  containsPseudonymTokens,
  pseudonymizeOutbound,
  restoreForStorage,
  stripPersonalDataForSearch,
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

  it("detects labelled names with optional separators", () => {
    const vault = new PseudonymizationVault();
    const input = "Cliente: Mario Rossi; avv.  =  Luca Bianchi; sig. Paolo Verdi";
    const pseudonymized = vault.pseudonymize(input);

    expect(pseudonymized).not.toMatch(/Mario Rossi|Luca Bianchi|Paolo Verdi/);
    expect(vault.restore(pseudonymized)).toBe(input);
  });

  it("handles long whitespace runs after a name label in linear time (ReDoS guard)", () => {
    const vault = new PseudonymizationVault();
    const input = `cliente.${" \t".repeat(50_000)}1`;

    const start = performance.now();
    expect(vault.pseudonymize(input)).toBe(input);
    expect(performance.now() - start).toBeLessThan(1_000);
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

    expect(generate.mock.calls[0][0].prompt).toMatch(/^Contatta \{EMAIL_1\}\n\n\[NOTA PRIVACY\]/);
    expect(result.text).toMatch(/^Contatta mario\.rossi@email\.it\n\n\[NOTA PRIVACY\]/);
    expect(streamedChunks).toHaveLength(1);
    expect(streamedChunks[0].text).toMatch(/^Contatta mario\.rossi@email\.it/);
  });

  it("does not add the placeholder instruction when the request has no personal data", async () => {
    const generate = vi.fn(async (request: { prompt: string }) => ({ text: request.prompt }));
    const ai = pseudonymizeGenkit({ generate });

    await withPseudonymization({}, () => ai.generate({ prompt: "Che cos'è l'art. 2043 c.c.?" }));

    expect(generate.mock.calls[0][0].prompt).toBe("Che cos'è l'art. 2043 c.c.?");
  });

  it("restores class instances returned by Genkit (getters read the restored content)", async () => {
    class FakeMessage {
      constructor(public role: string, public content: Array<{ text?: string; toolRequest?: unknown }>) {}
      get text() {
        return this.content.map((part) => part.text ?? "").join("");
      }
    }
    class FakeResponse {
      constructor(public message: FakeMessage) {}
      get text() {
        return this.message.text;
      }
      get toolRequests() {
        return this.message.content.filter((part) => part.toolRequest);
      }
    }
    const generate = vi.fn(async (request: { prompt: string }) =>
      new FakeResponse(new FakeMessage("model", [
        { text: request.prompt.split("\n\n")[0] },
        { toolRequest: { name: "webSearch", input: { query: "{NOME_1}" } } },
      ]))
    );
    const ai = pseudonymizeGenkit({ generate });

    const response = await withPseudonymization({}, () => ai.generate({ prompt: "Il cliente Mario Rossi chiede…" }));

    expect(generate.mock.calls[0][0].prompt).toMatch(/^Il cliente \{NOME_1\} chiede…/);
    expect(response).toBeInstanceOf(FakeResponse);
    expect(response.text).toBe("Il cliente Mario Rossi chiede…");
    expect(response.toolRequests).toEqual([{ toolRequest: { name: "webSearch", input: { query: "Mario Rossi" } } }]);
  });

  it("restores placeholders split across streamed chunks", async () => {
    const received: string[] = [];
    const generate = vi.fn(async (request: { onChunk: (chunk: unknown) => void }) => {
      request.onChunk({ content: [{ text: "Gentile {NO" }] });
      request.onChunk({ content: [{ text: "ME_1}, la" }] });
      request.onChunk({ content: [{ text: " pratica di {COGNOME_" }] });
      return { text: "" };
    });
    const ai = pseudonymizeGenkit({ generate });

    await withPseudonymization({ cliente: "Mario Rossi" }, () =>
      ai.generate({
        prompt: "Scrivi a Mario Rossi",
        onChunk: (chunk: { content: Array<{ text: string }> }) => received.push(chunk.content[0].text),
      })
    );

    expect(received.join("")).toBe("Gentile Mario Rossi, la pratica di {COGNOME_");
    expect(received.some((text) => text.includes("{NO") && !text.includes("{NOME_1}"))).toBe(false);
  });
});

describe("PseudonymizationVault — rilevamento nomi", () => {
  it("does not treat lowercase words after a label as names", () => {
    const vault = new PseudonymizationVault();
    const input = "Il mio cliente vuole sapere se può recedere. Il dottore ha detto che va bene.";

    expect(vault.pseudonymize(input)).toBe(input);
  });

  it("stops labelled names at the first lowercase word", () => {
    const vault = new PseudonymizationVault();
    const pseudonymized = vault.pseudonymize("il sig. Rossi e la sig.ra Verdi");

    expect(pseudonymized).toBe("il sig. {NOME_1} e la sig.ra {NOME_2}");
  });

  it("detects unlabelled names and later surname-only mentions", () => {
    const vault = new PseudonymizationVault();
    const input = "Mario Rossi ha citato in giudizio la Bianchi Srl. Il ROSSI chiede i danni; Rossi è assistito da me.";
    const pseudonymized = vault.pseudonymize(input);

    expect(pseudonymized).toBe(
      "{NOME_1} ha citato in giudizio la Bianchi Srl. Il {COGNOME_1} chiede i danni; {COGNOME_1} è assistito da me."
    );
    expect(vault.restore("{NOME_1} e {COGNOME_1}")).toBe("Mario Rossi e Rossi");
  });

  it("detects party formulas and birth data cues", () => {
    const vault = new PseudonymizationVault();
    const pseudonymized = vault.pseudonymize("Ricorso contro ROSSI MARIO, nato a Roma; Anna De Luca, nata a Bari.");

    expect(pseudonymized).not.toMatch(/ROSSI|MARIO|Anna|De Luca/);
  });

  it("seeds names from case-file metadata with legal role keys, ignoring non-name values", () => {
    const vault = new PseudonymizationVault();
    vault.registerPayload({
      metadatiFascicolo: { controparte: "Giulia Neri", ruolo_cliente: "attore", parte_convenuta: "Edilnord Srl" },
    });

    expect(vault.pseudonymize("L'attore chiede che la Neri e Edilnord Srl siano condannate.")).toBe(
      "L'attore chiede che la {COGNOME_1} e {NOME_2} siano condannate."
    );
  });

  it("keeps lowercase common words that match a registered first name", () => {
    const vault = new PseudonymizationVault();
    vault.registerPayload({ nome: "Rosa" });

    expect(vault.pseudonymize("Rosa ha scelto la vernice rosa.")).toBe("{NOME_1} ha scelto la vernice rosa.");
  });

  it("does not replace registered names inside longer words", () => {
    const vault = new PseudonymizationVault();
    vault.registerPayload({ cognome: "Rossi" });

    expect(vault.pseudonymize("Il Rossini e il Rossi")).toBe("Il Rossini e il {NOME_1}");
  });

  it("restores placeholders altered by the model", () => {
    const vault = new PseudonymizationVault();
    vault.registerPayload({ cliente: "Mario Rossi", email: "m.rossi@email.it" });

    expect(vault.restore("[NOME_1], {nome_1}, {NOME\\_1}, { EMAIL_1 }, {COGNOME_1}, {NOME_9}")).toBe(
      "Mario Rossi, Mario Rossi, Mario Rossi, m.rossi@email.it, Rossi, {NOME_9}"
    );
  });

  it("ignores lowercase street-like phrases but detects real addresses", () => {
    const vault = new PseudonymizationVault();
    const pseudonymized = vault.pseudonymize("Il corso di formazione 2026 si tiene in Via dei Mille 5.");

    expect(pseudonymized).toBe("Il corso di formazione 2026 si tiene in {INDIRIZZO_1}.");
  });
});

describe("helper per servizi esterni e salvataggio", () => {
  it("strips personal data from external search queries", async () => {
    const query = await withPseudonymization({ cliente: "Mario Rossi" }, () =>
      stripPersonalDataForSearch("risarcimento danni Mario Rossi incidente stradale")
    );

    expect(query).toBe("risarcimento danni incidente stradale");
  });

  it("pseudonymizes outbound text only inside a request context", async () => {
    expect(pseudonymizeOutbound("Mario Rossi")).toBe("Mario Rossi");
    const inside = await withPseudonymization({ cliente: "Mario Rossi" }, () => pseudonymizeOutbound("Mario Rossi"));
    expect(inside).toBe("{NOME_1}");
  });

  it("restores data before storage and warns about leftover placeholders", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const saved = await withPseudonymization({ cliente: "Mario Rossi" }, () =>
      restoreForStorage({ risposta: "{NOME_1} ha ragione", altro: "{NOME_7}" }, "test")
    );

    expect(saved).toEqual({ risposta: "Mario Rossi ha ragione", altro: "{NOME_7}" });
    expect(containsPseudonymTokens(saved)).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("PSEUDONYM_LEAK"));
    warn.mockRestore();
  });
});

describe("PseudonymizationVault — regressione su testi realistici", () => {
  const hides: Array<[string, string[]]> = [
    ["Il mio assistito Ahmed Benali è stato licenziato da Kevin Schmidt.", ["Ahmed", "Benali", "Kevin", "Schmidt"]],
    ["La signora Ornella Vanoni e il marito Gennaro Esposito vogliono separarsi.", ["Gennaro", "Esposito"]],
    ["il mio cliente mario rossi vuole fare causa a giuseppe verdi", ["mario rossi", "giuseppe verdi"]],
    ["Esposito mi ha chiesto se può impugnare il licenziamento. Ferrari invece è d'accordo.", ["Esposito", "Ferrari"]],
    ["Ho parlato con Marco ieri. Domani vedo Chiara e suo fratello Tommaso.", ["Marco", "Chiara", "Tommaso"]],
    ["La situazione è serena. Rosa Russo invece è la ricorrente.", ["Rosa Russo"]],
    ["Il numero è 3331234567, il fisso 0612345678, oppure 333 1234567.", ["3331234567", "0612345678", "333 1234567"]],
    ["La società ha P.IVA 01234567890.", ["01234567890"]],
    ["L'auto targata AB123CD guidata da Francesco Totti, nato il 27/09/1976.", ["AB123CD", "Totti", "27/09/1976"]],
    ["SINISTRO: veicolo FG 456 HK condotto da BRUNO PELLEGRINI.", ["FG 456 HK", "BRUNO", "PELLEGRINI"]],
    ["Oleksandr Kovalenko, nato in Ucraina il 3 maggio 1988, chiede le differenze.", ["3 maggio 1988"]],
  ];

  it.each(hides)("nasconde i dati personali: %s", (input, values) => {
    const vault = new PseudonymizationVault();
    const pseudonymized = vault.pseudonymize(input);
    for (const value of values) expect(pseudonymized).not.toContain(value);
    expect(vault.restore(pseudonymized)).toBe(input);
  });

  const keeps = [
    "La Corte di Cassazione, con sentenza n. 1234/2023, ha richiamato l'art. 2043 c.c. San Giovanni Rotondo. Santa Maria Capua Vetere.",
    "Il Codice Civile disciplina la materia. Via Giuseppe Garibaldi è chiusa. Legge Fornero. Riforma Cartabia.",
    "Condanna al pagamento di € 12.345,67. Cass. civ. Sez. III, 12/05/2021 n. 12345. R.G. 1234/2022.",
    "Sei Jurio, un assistente legale. Rispondi in italiano. Cita sempre le fonti normative.",
    "La Legge Pinto (L. 89/2001) prevede l'equa riparazione. Il decreto Bersani ha liberalizzato le tariffe.",
    "Il ricorso va notificato entro 60 giorni. Costa 518 euro di contributo unificato. Villa Borghese è a Roma.",
    "Natale cade di venerdì; le udienze riprendono il 7 gennaio. Riva del Garda e Monte San Savino.",
    "Il fascicolo R.G. n. 31245/2023 e il protocollo n. 0045678912. Importo dovuto: 3.450,00 euro.",
    "Martini & Rossi S.p.A. ha impugnato il provvedimento dell'AGCM.",
  ];

  it.each(keeps)("non modifica testi senza dati personali: %s", (input) => {
    expect(new PseudonymizationVault().pseudonymize(input)).toBe(input);
  });

  it("maschera un cognome anche nei testi che precedono il nome completo", () => {
    const vault = new PseudonymizationVault();
    const pseudonymized = vault.pseudonymize({
      messages: [{ text: "Verdi non ha pagato." }, { text: "Il debitore è Luigi Verdi." }],
    });

    expect(pseudonymized).toEqual({
      messages: [{ text: "{COGNOME_1} non ha pagato." }, { text: "Il debitore è {NOME_1}." }],
    });
  });
});
