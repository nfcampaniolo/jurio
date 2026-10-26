![Logo Jurio](assets/logo.png)

# Jurio per Mistral

Plugin per Vibe Code nel formato Agent Plugins 1.0, con skill di ricerca giuridica e server MCP remoto. Il server Jurio usa HTTPS, Streamable HTTP e OAuth.

## Vibe Code

Copia la cartella del plugin in `~/.vibe/plugins/jurio` oppure in `.vibe/plugins/jurio` nel progetto. Avvia o ricarica la sessione con `/reload-plugins`; poi usa `/plugins` per controllare che Jurio sia caricato e `/mcp login jurio` per autorizzare il server.

## Vibe Work

Apri **Connectors → + Add Connector → Custom MCP Connector**, inserisci `Jurio` e `https://jurio.it/mcp`, quindi completa OAuth. Vibe Work usa il connettore remoto dalla UI; il pacchetto plugin in questa cartella è per Vibe Code.

## Contenuto

- `plugin.json`: manifest Agent Plugins 1.0 con estensione Vibe.
- `mcp.json`: endpoint MCP Streamable HTTP.
- `skills/ricerca-giuridica/SKILL.md`: istruzioni di ricerca.
- `assets/logo.png`: logo quadrato locale del progetto.
- `vibe-mcp.toml`: configurazione alternativa da aggiungere a `config.toml` se non si installa il plugin.

Il manifest dei plugin Vibe non espone un campo per l'icona del plugin: il file logo è incluso nel pacchetto, ma non viene mostrato automaticamente nell'interfaccia.

Riferimenti: [plugin Vibe Code](https://docs.mistral.ai/vibe/code/cli/plugins) · [connettori MCP di Vibe Work](https://docs.mistral.ai/vibe/work/connectors/mcp-connectors).
