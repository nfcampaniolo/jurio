![Logo Jurio](assets/logo.png)

# Jurio — plugin MCP

Pacchetto Agent Plugins 1.0 per collegare ChatGPT e Codex al server MCP remoto di Jurio. La connessione richiede un account Jurio e usa OAuth.

## Contenuto

- `plugin.json`: identità, metadati di presentazione e collegamenti del pacchetto.
- `mcp.json`: endpoint MCP Streamable HTTP.
- `skills/ricerca-giuridica/SKILL.md`: istruzioni per la ricerca giuridica con le fonti.
- `assets/`: logo e icona quadrati derivati dal logo del progetto.

## Prova locale

Nel prodotto compatibile, aggiungi/importa il pacchetto e completa l'autorizzazione OAuth quando richiesta. Per una connessione manuale ChatGPT usa **Impostazioni → App** e l'URL `https://jurio.it/mcp`; per Codex usa l'importazione plugin oppure la configurazione MCP del client.

## Pubblicazione

Il pacchetto contiene manifest e file locali richiesti per il formato Agent Plugins. La pubblicazione nella directory OpenAI richiede anche la verifica del publisher e il completamento delle informazioni di revisione nel dashboard; non ho inserito casi di test o registrazioni non eseguiti.

Riferimento: [formato e invio dei plugin OpenAI](https://developers.openai.com/plugins/deploy/submission).
