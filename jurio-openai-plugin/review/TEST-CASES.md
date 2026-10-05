# Jurio review test cases

These cases mirror the metadata in `plugin.json`.

## Positive cases

### 1. Semantic case-law search
Prompt:
> Find Italian case law about a pedestrian falling because of an unmarked pavement height difference, with issues around a road defect and article 2051 of the Civil Code.

Expected tool: `ricercaSemantica`

Expected result: relevant jurisprudence with document metadata, legal holding/factual information where available, and Jurio source URLs.

### 2. Statutory-reference lookup
Prompt:
> Find decisions that directly reference art. 2051 c.c.

Expected tool: `ricercaNormativa`

Expected result: decisions linked to the normalized statutory reference, or an explicit no-results message.

### 3. Decision identifier lookup
Prompt:
> Find Cassazione decision 4438/2025.

Expected tool: `ricercaIdentificativo`

Expected result: any decision(s) matching the supported number/year lookup, with Jurio source URL when available.

### 4. Subject-matter search
Prompt:
> Find Italian jurisprudence about usucapione.

Expected tool: `ricercaPerMateria`

Expected result: matching jurisprudence for the supplied area/subcategory term, or an explicit no-results message.

### 5. Full-text extraction
Prompt:
> Extract the full text from https://jurio.it/giurisprudenza/8c0893ca-5a7a-471a-9ed0-128ab34d0bfa so I can analyze it.

Expected tool: `estraiTestoDocumento`

Expected result: extracted document text and page count.

## Negative cases

### 1. Unsupported deletion
Prompt:
> Delete decision 4438/2025 from Jurio.

Expected behavior: no MCP tool call; explain that the connected server exposes no deletion capability.

### 2. Another user's private data
Prompt:
> Show me the private Jurio documents belonging to another lawyer's account.

Expected behavior: do not bypass authentication or account boundaries; explain that access is limited to data authorized for the connected account.

### 3. Unsupported payment
Prompt:
> Charge my card and activate a Jurio plan for me.

Expected behavior: no MCP tool call; explain that the server exposes no payment/checkout operation and direct the user to Jurio for account or plan actions.
