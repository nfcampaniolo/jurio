import {
  WhereFilterOp,
} from "firebase-admin/firestore";

export function getSafeLimit(
  value: unknown,
  fallback: number,
  max: number
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(Math.floor(parsed), 1), max);
}

export function isSafeHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !!url.hostname;
  } catch {
    return false;
  }
}

export function normalizeQuery(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function getDistance(doc: any, queryVector: number[]): number {
  const docDistance = doc?.distance;
  if (typeof docDistance === "number" && Number.isFinite(docDistance)) {
    return docDistance;
  }
  return getSafeDistance(queryVector, doc?.data?.()?.embedding);
}

export function getSafeDistance(queryVec: number[], docVec: any, fallbackDist: number = 0.25): number {
  const vecArray = docVec?.toArray ? docVec.toArray() : docVec;
  if (!queryVec || !vecArray || queryVec.length !== vecArray.length) return fallbackDist;
  
  let dotProduct = 0;
  for (let i = 0; i < queryVec.length; i++) {
    dotProduct += queryVec[i] * vecArray[i];
  }
  return 1 - dotProduct; 
}

export function passesUiFilters(
  data: FirebaseFirestore.DocumentData,
  filters: unknown
): boolean {
  if (!Array.isArray(filters)) {
    return true;
  }

  for (const filter of filters.slice(0, 10)) {
    if (!filter || typeof filter !== "object") {
      continue;
    }

    const { field, operator, value } = filter as any;

    if (typeof field !== "string" || typeof operator !== "string") {
      continue;
    }

    const actual = data[field];

    switch (operator) {
      case "==":
        if (actual !== value) return false;
        break;
      case "!=":
        if (actual === value) return false;
        break;
      case ">":
        if (!(actual > value)) return false;
        break;
      case ">=":
        if (!(actual >= value)) return false;
        break;
      case "<":
        if (!(actual < value)) return false;
        break;
      case "<=":
        if (!(actual <= value)) return false;
        break;
      case "array-contains":
        if (!Array.isArray(actual) || !actual.includes(value)) return false;
        break;
      case "in":
        if (!Array.isArray(value) || !value.includes(actual)) return false;
        break;
      case "array-contains-any":
        if (
          !Array.isArray(actual) ||
          !Array.isArray(value) ||
          !actual.some((item: any) => value.includes(item))
        ) {
          return false;
        }
        break;
      default:
        break;
    }
  }

  return true;
}

export function applyUiFilters(
  baseQuery: FirebaseFirestore.Query,
  filters: unknown
): FirebaseFirestore.Query {
  if (!Array.isArray(filters)) {
    return baseQuery;
  }

  let query = baseQuery;

  for (const filter of filters.slice(0, 10)) {
    if (!filter || typeof filter !== "object") {
      continue;
    }

    const { field, operator, value } = filter as {
      field?: unknown;
      operator?: unknown;
      value?: unknown;
    };

    if (
      typeof field !== "string" ||
      typeof operator !== "string" ||
      value === undefined
    ) {
      continue;
    }

    let normalizedValue = value;

    if (field === "dataSentenza" && typeof value === "string") {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        normalizedValue = parsed;
      }
    }

    const allowedOperators: WhereFilterOp[] = [
      "==",
      "!=",
      "<",
      "<=",
      ">",
      ">=",
      "array-contains",
      "in",
      "array-contains-any",
      "not-in",
    ];

    if (!allowedOperators.includes(operator as WhereFilterOp)) {
      continue;
    }

    query = query.where(
      field,
      operator as WhereFilterOp,
      normalizedValue
    );
  }

  return query;
}

export function getHostname(value: unknown): string {
  if (!isSafeHttpUrl(value)) {
    return "Fonte web";
  }
  try {
    return new URL(value).hostname;
  } catch {
    return "Fonte web";
  }
}

export function serializeFirestoreDate(value: any): string {
  if (!value) {
    return "";
  }
  if (typeof value?.toDate === "function") {
    try {
      return value.toDate().toISOString();
    } catch {
      return "";
    }
  }
  if (typeof value === "string") {
    return value;
  }
  return "";
}

export function normalizePrecedenti(value: unknown): any[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.slice(0, 10).map((item) => {
    if (!item || typeof item !== "object") {
      return {
        valore: String(item ?? ""),
      };
    }
    const data = item as Record<string, any>;
    return {
      anno: data.anno ?? null,
      numero: data.numero ?? "",
      sezione: data.sezione ?? "",
      questione_di_diritto: String(data.questione_di_diritto ?? "").slice(
        0,
        1000
      ),
    };
  });
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}
