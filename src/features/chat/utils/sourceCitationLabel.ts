import type { Source } from "@/interfaces/interfaces";

function normalizeLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase();
}

export function getSourceCitationLabel(source: Source, fallback = "Documento"): string {
  const court = source.organo_giudicante?.trim() ?? "";
  const section = source.sezione?.trim() ?? "";
  const identifier = source.identificativo?.trim() ?? "";
  const number = source.numero_sentenza?.trim() ?? "";

  if (!number && (court || section)) {
    return [court, section].filter(Boolean).join(" · ");
  }

  if (identifier) {
    if (court && normalizeLabel(identifier) === normalizeLabel(court)) {
      return `${court} n. ${number}`;
    }

    const normalizedIdentifier = normalizeLabel(identifier);
    const normalizedCourt = normalizeLabel(court);
    return court && !normalizedIdentifier.startsWith(normalizedCourt)
      ? `${court}: ${identifier}`
      : identifier;
  }

  if (number) return `${court || "Sent."} n. ${number}`;
  return fallback;
}
