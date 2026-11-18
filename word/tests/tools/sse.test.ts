import { describe, expect, it, vi } from "vitest";
import { INCOMPLETE_STREAM_MESSAGE, readSseStream } from "@word/tools/sse";
import { SSE_DONE, sseEvent, sseResponse } from "../mocks/sse";

describe("readSseStream", () => {
  it("riporta stati e risultato, fermandosi a [DONE]", async () => {
    const onStatus = vi.fn();
    const onResult = vi.fn();
    await readSseStream(
      sseResponse([
        sseEvent({ message: { status: "A" } }),
        sseEvent({ message: { message: { status: "B" } } }),
        sseEvent({ result: { ok: 1 } }),
        SSE_DONE,
        sseEvent({ result: { ignorato: true } }),
      ]),
      { onStatus, onResult }
    );
    expect(onStatus.mock.calls.map((c) => c[0])).toEqual(["A", "B"]);
    expect(onResult).toHaveBeenCalledOnce();
    expect(onResult).toHaveBeenCalledWith({ ok: 1 });
  });

  it("ricompone eventi spezzati su più letture, anche a metà di caratteri multibyte", async () => {
    const ev = sseEvent({ result: { testo: "perché è così" } });
    const bytes = new TextEncoder().encode(ev);
    const cut = bytes.indexOf(0xc3) + 1; // spezza dentro "é"
    // sseResponse codifica stringhe: per spezzare i byte costruiamo il reader a mano
    const chunks = [bytes.slice(0, cut), bytes.slice(cut), new TextEncoder().encode(SSE_DONE)];
    let i = 0;
    const response = {
      ok: true,
      body: { getReader: () => ({ read: async () => (i < chunks.length ? { value: chunks[i++], done: false } : { done: true }) }) },
    } as unknown as Response;
    const onResult = vi.fn();
    await readSseStream(response, { onResult });
    expect(onResult).toHaveBeenCalledWith({ testo: "perché è così" });
  });

  it("elabora l'ultimo evento anche senza separatore finale", async () => {
    const onResult = vi.fn();
    await readSseStream(sseResponse([`data: ${JSON.stringify({ result: 1 })}`]), { onResult });
    expect(onResult).toHaveBeenCalledWith(1);
  });

  it("lancia l'errore inviato dal server nello stream", async () => {
    await expect(
      readSseStream(sseResponse([sseEvent({ error: { message: "Quota esaurita" } }), SSE_DONE]), { onResult: vi.fn() })
    ).rejects.toThrow("Quota esaurita");
  });

  it("lancia un errore se lo stream si chiude senza risultato", async () => {
    await expect(
      readSseStream(sseResponse([sseEvent({ message: { status: "..." } })]), { onResult: vi.fn() })
    ).rejects.toThrow(INCOMPLETE_STREAM_MESSAGE);
  });

  it("ignora frammenti non JSON", async () => {
    const onResult = vi.fn();
    await readSseStream(sseResponse(["data: {rotto\n\n", ": commento\n\n", sseEvent({ result: 2 }), SSE_DONE]), {
      onResult,
    });
    expect(onResult).toHaveBeenCalledWith(2);
  });

  it.each([
    [{ details: "Il documento supera 200000 caratteri" }, 413, "Il documento supera 200000 caratteri"],
    [null, 429, "Limite di utilizzo raggiunto. Riprova più tardi."],
    [null, 403, "Il tuo piano non include questa funzione."],
    [null, 500, "Errore server: 500"],
  ])("risposta HTTP di errore %j (%i) → messaggio leggibile", async (body, status, message) => {
    const response = new Response(body ? JSON.stringify(body) : "x", { status });
    await expect(readSseStream(response, { onResult: vi.fn() })).rejects.toThrow(message);
  });
});
