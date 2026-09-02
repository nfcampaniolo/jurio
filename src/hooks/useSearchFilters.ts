import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { Timestamp } from "firebase/firestore";
import type { DocumentoGiurisprudenziale, SearchFilter } from "@/interfaces/interfaces";

export const SEARCH_FILTERS_CACHE_KEY = "giurisprudenza_filters_cache";

export const DEFAULT_FILTERS = {
  filterGrado: "",
  filterTipo: "",
  filterTipologia: "",
  searchTarget: "massima" as const,
  startDate: "",
  endDate: "",
  sortBy: "relevance" as const,
  filterSezione: "",
  numberPages: 15,
};

export type SortBy = "relevance" | "date_desc" | "date_asc";

export type DocSezione = {
  sezione?: string;
  sez?: string;
};

export interface SerializedTimestamp {
  seconds?: number;
  _seconds?: number;
  nanoseconds?: number;
  _nanoseconds?: number;
  toDate?: () => Date;
}

export const isSerializedTimestamp = (value: unknown): value is SerializedTimestamp => {
  return typeof value === "object" && value !== null;
};

export const parseDataSentenzaMs = (raw: unknown): number | null => {
  if (!raw) return null;

  if (isSerializedTimestamp(raw)) {
    if (typeof raw.seconds === "number") return raw.seconds * 1000;
    if (typeof raw._seconds === "number") return raw._seconds * 1000;
    if (typeof raw.toDate === "function") return raw.toDate().getTime();
  }

  if (typeof raw === "string" || typeof raw === "number" || raw instanceof Date) {
    const parsed = new Date(raw);
    return isNaN(parsed.getTime()) ? null : parsed.getTime();
  }

  return null;
};

export const parseDocDateMs = (d: DocumentoGiurisprudenziale): number | null => {
  const target = d as unknown as { dataSentenza?: unknown };
  return parseDataSentenzaMs(target.dataSentenza);
};

export const hasSezione = (
  d: DocumentoGiurisprudenziale
): d is DocumentoGiurisprudenziale & DocSezione =>
  typeof d === "object" && d !== null && ("sezione" in d || "sez" in d);

export const mapGradoToDbFields = (grado: string) => {
  switch (grado) {
    case "Cassazione Civile": return { organo_giudicante: "CORTE DI CASSAZIONE", materia: "Civile" };
    case "Cassazione Penale": return { organo_giudicante: "CORTE DI CASSAZIONE", materia: "Penale" };
    case "Corte Costituzionale": return { organo_giudicante: "CORTE COSTITUZIONALE", materia: null };
    case "Consiglio di Stato": return { organo_giudicante: "CONSIGLIO DI STATO", materia: null };
    default: return { organo_giudicante: null, materia: null };
  }
};

// Funzione helper per l'inizializzazione "lazy" degli state,
// evita il doppio render iniziale causato dall'useEffect.
const getInitialFilters = () => {
  if (typeof window === "undefined") return DEFAULT_FILTERS;
  const savedFilters = localStorage.getItem(SEARCH_FILTERS_CACHE_KEY);
  if (savedFilters) {
    try {
      const parsed = JSON.parse(savedFilters);
      return { ...DEFAULT_FILTERS, ...parsed };
    } catch (e) {
      console.error("Errore nel parsing dei filtri salvati", e);
    }
  }
  return DEFAULT_FILTERS;
};

export function useSearchFilters() {
  const initialFilters = getInitialFilters();

  const [filterGrado, _setFilterGrado] = useState<string>(initialFilters.filterGrado);
  const [filterTipo, setFilterTipo] = useState<string>(initialFilters.filterTipo);
  const [filterTipologia, setFilterTipologia] = useState<string>(initialFilters.filterTipologia);
  const [startDate, setStartDate] = useState<string>(initialFilters.startDate);
  const [endDate, setEndDate] = useState<string>(initialFilters.endDate);
  const [sortBy, setSortBy] = useState<SortBy>(initialFilters.sortBy);
  const [filterSezione, setFilterSezione] = useState<string>(initialFilters.filterSezione);
  const [numberPages, setnumberPages] = useState<number>(initialFilters.numberPages);

  // FIX 1: Intercettiamo il cambio di Grado per resettare la Sezione nello stesso ciclo di render.
  // Invece di usare un useEffect che scatta "dopo" e causa un render a cascata, facciamo tutto qui.
  const setFilterGrado = useCallback((value: React.SetStateAction<string>) => {
    _setFilterGrado((prev) => {
      const nextGrado = typeof value === "function" ? value(prev) : value;
      if (nextGrado === "") {
        setFilterSezione("");
      }
      return nextGrado;
    });
  }, []);

  // Questo useEffect rimane perché è l'unico modo corretto per 
  // SINCRONIZZARE React con un sistema esterno (il LocalStorage) quando lo stato cambia.
  useEffect(() => {
    const filtersToSave = { filterGrado, filterTipo, filterTipologia, startDate, endDate, sortBy, filterSezione, numberPages };
    localStorage.setItem(SEARCH_FILTERS_CACHE_KEY, JSON.stringify(filtersToSave));
  }, [filterGrado, filterTipo, filterTipologia, startDate, endDate, sortBy, filterSezione, numberPages]);

  const clearFilters = useCallback(() => {
    _setFilterGrado(DEFAULT_FILTERS.filterGrado);
    setFilterTipo(DEFAULT_FILTERS.filterTipo);
    setFilterTipologia(DEFAULT_FILTERS.filterTipologia);
    setStartDate(DEFAULT_FILTERS.startDate);
    setEndDate(DEFAULT_FILTERS.endDate);
    setSortBy(DEFAULT_FILTERS.sortBy);
    setFilterSezione(DEFAULT_FILTERS.filterSezione);
    setnumberPages(DEFAULT_FILTERS.numberPages);
    
    localStorage.removeItem(SEARCH_FILTERS_CACHE_KEY);
    toast.success("Filtri resettati");
  }, []);

  const buildVectorFilters = useCallback((): SearchFilter[] => {
    const filters: SearchFilter[] = [];
    const { organo_giudicante, materia } = mapGradoToDbFields(filterGrado);

    if (organo_giudicante) filters.push({ field: "organo_giudicante", operator: "==", value: organo_giudicante });
    if (materia) filters.push({ field: "materia", operator: "==", value: materia });
    if (filterTipologia) filters.push({ field: "tipo_documento", operator: "==", value: filterTipologia.toLowerCase() });
    if (filterTipo) filters.push({ field: "tipo_massima", operator: "==", value: filterTipo });
    if (filterSezione) filters.push({ field: "sezione", operator: "==", value: filterSezione });

    if (startDate) {
      const startD = new Date(startDate);
      if (!isNaN(startD.getTime())) {
        filters.push({ field: "dataSentenza", operator: ">=", value: Timestamp.fromDate(startD) });
      }
    }

    if (endDate) {
      const endD = new Date(endDate);
      if (!isNaN(endD.getTime())) {
        endD.setHours(23, 59, 59, 999);
        filters.push({ field: "dataSentenza", operator: "<=", value: Timestamp.fromDate(endD) });
      }
    }

    return filters;
  }, [filterGrado, filterTipo, filterTipologia, filterSezione, startDate, endDate]);

  const applyUiFiltersAndSort = useCallback((docs: DocumentoGiurisprudenziale[]) => {
    const startMs = startDate ? new Date(startDate).getTime() : null;
    const endMs = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : null;
    const { organo_giudicante, materia } = mapGradoToDbFields(filterGrado);

    let out = docs.filter((d) => {
      if (organo_giudicante && d.organo_giudicante !== organo_giudicante) return false;
      if (materia && d.materia !== materia) return false;
      if (filterTipo && d.tipo_massima !== filterTipo) return false;

      if (filterSezione) {
        const sez = hasSezione(d) ? String(d.sezione ?? d.sez ?? "") : "";
        if (sez !== filterSezione) return false;
      }
      if (filterTipologia) {
        const docType = d.tipo_documento || "";
        if (docType.toLowerCase() !== filterTipologia.toLowerCase()) return false;
      }
      if (startMs !== null || endMs !== null) {
        const t = parseDocDateMs(d);
        if (t === null) return false; 
        if (startMs !== null && t < startMs) return false;
        if (endMs !== null && t > endMs) return false;
      }
      return true;
    });

    if (sortBy === "date_desc" || sortBy === "date_asc") {
      out = [...out].sort((a, b) => {
        const ta = parseDocDateMs(a) ?? -Infinity;
        const tb = parseDocDateMs(b) ?? -Infinity;
        return sortBy === "date_desc" ? tb - ta : ta - tb;
      });
    }

    return out;
  }, [startDate, endDate, filterGrado, filterTipo, filterSezione, sortBy, filterTipologia]);

  return {
    filterGrado, setFilterGrado, filterTipo, setFilterTipo,
    filterTipologia, setFilterTipologia, startDate, setStartDate,
    endDate, setEndDate, sortBy, setSortBy, filterSezione, setFilterSezione,
    numberPages, setnumberPages, clearFilters, buildVectorFilters, applyUiFiltersAndSort
  };
}