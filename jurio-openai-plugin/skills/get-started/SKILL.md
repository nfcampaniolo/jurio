---
name: get-started
description: Guidance for using Jurio's Italian legal-research MCP tools effectively.
---

# Jurio: getting started

Use Jurio when the user needs Italian case-law research, a specific decision lookup, legal-subject search, or the full text of a Jurio document.

## Tool selection

- Use `ricercaSemantica` when the user describes a legal problem, fact pattern, disputed effect, or asks for analogous case law. Build a dense query combining the material facts with the relevant legal issue. Do not use it merely to retrieve one statutory article.
- Use `ricercaNormativa` when the user asks for decisions associated with a specific statutory provision. Pass one article/reference at a time; when several articles are supplied, call the tool separately for each.
- Use `ricercaIdentificativo` when the user provides a decision number/year, ECLI, or URN and wants that specific decision.
- Use `ricercaPerMateria` for a macro-area or legal-subject/subcategory search such as licenziamento, usucapione, or stupefacenti.
- Use `estraiTestoDocumento` only after obtaining a Jurio decision URL or when the user provides a Jurio jurisprudence URL and needs the full text for deeper analysis.

## How to present results

Keep the source identity visible. Preserve the Jurio document URL when returned by a tool. Distinguish between the court's holding, factual background, and any synthesis performed by the assistant.

When no result is found, say so explicitly and suggest a narrower or broader query only when useful.

Do not claim that a decision is controlling, current, unanimous, or applicable to the user's facts unless the retrieved material supports that characterization.

Access errors, expired sessions, plan restrictions, rate limits, and document-not-found responses should be reported as returned by Jurio rather than hidden or replaced with guessed data.
