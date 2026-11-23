import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerRicercaSemantica } from "./tools/ricercaSemantica";
import { registerdoctrineSearch } from "./tools/ricercaDottrina";
import { registerRicercaNormativa } from "./tools/ricercaNormativa";
import { registerRicercaIdentificativo } from "./tools/ricercaIdentificativo";
import { registerRicercaPerMateria } from "./tools/ricercaPerMateria";
import { registerGetPromptList } from "./tools/ricercaPrompt";
import { registerEstraiTestoDocumento } from "./tools/estraiTestoDocumento";
import { recordMcpToolCall, type McpUsageContext } from "./usage";

type AnyToolCallback = (...args: unknown[]) => unknown;

/**
 * Avvolge ogni tool registrato per misurarne durata ed esito e registrare la chiamata.
 * Così il tracciamento resta in un punto solo e i singoli tool non ne sanno nulla.
 */
function instrumentToolCalls(server: McpServer, usage: McpUsageContext): void {
  const registerTool = server.registerTool.bind(server) as (name: string, config: unknown, cb: AnyToolCallback) => unknown;

  server.registerTool = ((name: string, config: unknown, cb: AnyToolCallback) =>
    registerTool(name, config, async (...args: unknown[]) => {
      const startedAt = Date.now();
      let ok = false;
      try {
        const result = await cb(...args);
        ok = !(result && typeof result === "object" && (result as { isError?: unknown }).isError === true);
        return result;
      } finally {
        await recordMcpToolCall({ ...usage, tool: name, ok, durationMs: Date.now() - startedAt });
      }
    })) as unknown as typeof server.registerTool;
}

export function createMcpServer(authHeader: string, usage?: McpUsageContext): McpServer {
  const server = new McpServer({
    name: "jurio-mcp",
    version: "1.1.0",
  });

  if (usage) instrumentToolCalls(server, usage);

  registerRicercaSemantica(server, authHeader);
  registerdoctrineSearch(server, authHeader);
  registerRicercaNormativa(server, authHeader);
  registerRicercaIdentificativo(server, authHeader);
  registerRicercaPerMateria(server, authHeader);
  registerGetPromptList(server, authHeader);
  registerEstraiTestoDocumento(server, authHeader);

  return server;
}
