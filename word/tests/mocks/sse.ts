/**
 * Costruisce una Response finta con body in streaming, suddiviso esattamente nei pezzi indicati.
 * Serve per verificare il parsing SSE anche quando un evento arriva spezzato su più letture di rete.
 */
export function sseResponse(pieces: string[], init: { ok?: boolean; status?: number } = {}) {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    body: {
      getReader: () => ({
        read: async () =>
          i < pieces.length
            ? { value: encoder.encode(pieces[i++]), done: false }
            : { value: undefined, done: true },
      }),
    },
  } as unknown as Response;
}

export const sseEvent = (payload: unknown) => `data: ${JSON.stringify(payload)}\n\n`;
export const SSE_DONE = "data: [DONE]\n\n";
