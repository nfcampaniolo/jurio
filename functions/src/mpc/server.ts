import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerRicercaSemantica } from "./tools/ricercaSemantica";
import { registerdoctrineSearch } from "./tools/ricercaDottrina";
import { registerRicercaNormativa } from "./tools/ricercaNormativa";
import { registerRicercaIdentificativo } from "./tools/ricercaIdentificativo";
import { registerRicercaPerMateria } from "./tools/ricercaPerMateria";
import { registerEstraiTestoDocumento } from "./tools/estraiTestoDocumento";
import { registerGetPromptList } from "./tools/ricercaPrompt";

export function createMcpServer(authHeader: string): McpServer {
  const server = new McpServer({
    name: "jurio-mcp",
    version: "1.1.0",
  });

  registerRicercaSemantica(server, authHeader);
  registerdoctrineSearch(server, authHeader);
  registerRicercaNormativa(server, authHeader);
  registerRicercaIdentificativo(server, authHeader);
  registerRicercaPerMateria(server, authHeader);
  registerEstraiTestoDocumento(server, authHeader);
  registerGetPromptList(server, authHeader);
  
  return server;
}