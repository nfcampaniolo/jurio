/** Response JSON minima per le azioni senza AI di wordAgent. */
export const jsonResponse = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as unknown as Response;
