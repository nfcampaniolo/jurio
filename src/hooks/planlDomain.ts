import { Timestamp } from "firebase/firestore";

export type RegisterDoc = {
  start?: Timestamp | { toDate: () => Date } | string | number | null;
};

export type StatusNormalized =
  | "admin"
  | "prova"
  | "trial"
  | "personale"
  | "personale_m"
  | "business"
  | "business_m"
  | "nessuno"
  | null;

export function isTimestampLike(v: unknown): v is { toDate: () => Date } {
  if (typeof v !== "object" || v === null) return false;
  const maybe: Record<string, unknown> = v as Record<string, unknown>;
  return typeof maybe.toDate === "function";
}

export function toStartDate(v: RegisterDoc["start"]): Date | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate();
  if (isTimestampLike(v)) {
    try {
      return v.toDate();
    } catch {
      return null;
    }
  }
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function trialDaysLeft(start: Date, now: Date = new Date()): number {
  const dayMs = 24 * 60 * 60 * 1000;
  const elapsed = Math.floor((now.getTime() - start.getTime()) / dayMs);
  return Math.max(0, 7 - elapsed);
}

export function normalizeStatus(raw: unknown): StatusNormalized {
  if (typeof raw !== "string") return null;
  const s = raw.trim().toLowerCase();
  if (!s) return null;

  if (s === "admin") return "admin";
  if (s === "prova") return "prova";
  if (s === "trial") return "trial";
  if (s === "personale") return "personale";
  if (s === "personale_m") return "personale_m";
  if (s === "business") return "business";
  if (s === "business_m") return "business_m";

  if (s === "nessuno" || s === "expired" || s === "scaduto" || s === "none") return "nessuno";
  return "nessuno";
}

export function isTrialStatus(status: StatusNormalized): boolean {
  return status === "prova" || status === "trial";
}

// REGOLA: prova -> personale, personale -> business, business/admin -> null
export function getUpgradeTarget(status: StatusNormalized): "personale" | "business" | "personale_m" | "business_m" | null {
  if (status === "admin" || status === "business") return null;
  if (isTrialStatus(status)) return "personale";
  if (status === "personale") return "business";
  if (status === "personale_m") return "business_m";
  return "personale";
}

export function findPlanByStatus<T extends { id: unknown; name: string }>(
  plans: T[],
  status: StatusNormalized
): T | null {
  if (!status || status === "nessuno" || status === "admin" || isTrialStatus(status)) return null;
  const s = status.toLowerCase();
  
  return (
    // 1. Cerca corrispondenza esatta dell'id (es. "personale_m" === "personale_m")
    plans.find((p) => String(p.id).toLowerCase() === s) ??
    // 2. Cerca se l'id del piano inizia con lo status (es. "personale_m" inizia con "personale")
    plans.find((p) => String(p.id).toLowerCase().startsWith(s)) ??
    // 3. Cerca per nome del piano nel caso l'id sia strutturato diversamente
    plans.find((p) => p.name.toLowerCase().includes(s)) ??
    null
  );
}

export function findPlanByKey<T extends { id: unknown; name: string }>(plans: T[], key: string): T | null {
  const k = key.trim().toLowerCase();
  return plans.find((p) => String(p.id).toLowerCase().includes(k)) ?? null;
}

export const planCellClass = (highlighted?: boolean): string =>
  `font-normal p-4 border-l border-[var(--color-border)] ${highlighted ? "bg-[var(--color-surface)]" : ""}`;

