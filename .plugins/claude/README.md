![Logo Jurio](assets/logo.png)

# Jurio per Claude

Pacchetto plugin per Claude Code con skill di ricerca e connessione al server MCP remoto Jurio. Richiede un account Jurio e OAuth.

## Claude Code

Per provare il plugin dal checkout locale, avvia Claude Code con `claude --plugin-dir ./jurio-claude-plugin`. Per distribuirlo stabilmente, pubblicalo in un marketplace Claude Code. La struttura segue il formato Claude Code: `.claude-plugin/plugin.json`, `.mcp.json`, `skills/` e `assets/`. Dopo il caricamento, autorizza Jurio dal prompt OAuth o dal comando `/mcp`.

Per aggiungere solo il server MCP senza plugin:

```sh
claude mcp add --transport http jurio https://jurio.it/mcp
```

## Claude.ai e Claude Desktop

I connettori MCP remoti si aggiungono da **Impostazioni → Connettori → Aggiungi connettore personalizzato**, con URL `https://jurio.it/mcp`; completa quindi l'accesso OAuth. Claude Desktop gestisce i server remoti da questa schermata, non tramite `claude_desktop_config.json`.

## Contenuto

- `.claude-plugin/plugin.json`: metadati del plugin, icona di directory e collegamenti a documentazione, supporto e policy.
- `.mcp.json`: server MCP remoto HTTP.
- `skills/ricerca-giuridica/SKILL.md`: istruzioni riutilizzabili per la ricerca giuridica.
- `assets/logo.png`: logo quadrato locale del progetto.

Riferimenti: [plugin Claude Code](https://docs.anthropic.com/en/docs/claude-code/plugins) · [server MCP remoti](https://support.anthropic.com/en/articles/11503834-building-custom-integrations-via-remote-mcp-servers).
