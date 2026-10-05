# Jurio — OpenAI plugin package

This package wraps the existing Jurio remote MCP server for the current OpenAI Agent Plugins format.

## Included

- `plugin.json` — portable plugin manifest and OpenAI listing/review metadata.
- `mcp.json` — remote MCP configuration pointing to `https://jurio.it/mcp`.
- `skills/get-started/SKILL.md` — onboarding and tool-selection guidance.
- `assets/logo.svg` and `assets/composer-icon.svg` — square plugin artwork.
- `review/TEST-CASES.md` — the five positive and three negative cases declared in the manifest, plus a manual execution checklist.

## Important

The ZIP does **not** contain Firebase credentials, OAuth secrets, Firestore configuration, or the backend source code. The MCP server is already deployed remotely and must remain the production service referenced by `mcp.json`.

The package was generated from the supplied Jurio MCP implementation. That implementation exposes five tools:

1. `ricercaSemantica`
2. `ricercaNormativa`
3. `ricercaIdentificativo`
4. `ricercaPerMateria`
5. `estraiTestoDocumento`

The MCP endpoint also exposes OAuth discovery and token endpoints under `https://jurio.it/mcp` and protects the MCP transport with a Bearer token.

## Before public submission

OpenAI currently requires four HTTPS listing URLs for MCP submissions: website, support, privacy policy, and terms of service. This draft contains the verified website URL and the Jurio contact page, but it intentionally does not invent privacy-policy or terms URLs. Add the real published URLs in `plugin.json` before submission.

OpenAI also requires a reviewer-accessible demo recording URL and a dedicated reviewer account entered in the dashboard. Reviewer credentials must not be stored in the ZIP.

See `SUBMISSION-CHECKLIST.md` for the remaining steps.
