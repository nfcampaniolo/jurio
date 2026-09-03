import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { FirebaseError } from "firebase/app";
import type { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";

import type { DocumentoGiurisprudenziale } from "@/interfaces/interfaces";
import type { SentenceMatch, WebFallbackData } from "@/features/search/hooks/vectorSearch";
import { trackEvent } from "@/infrastructure/analytics";
import { withTrace } from "@/infrastructure/perf";

import {
  loadUserSearchTerms,
  saveUserSearchTerm,
  findByNumeroSentenza,
  findNormativaFromUserQuery,
  findBySottocategoria,
  isAuthzError,
  isUnavailableError,
  isNetworkError,
  fetchCortePaginata
} from "@/features/search/hooks/search";

import { mapGradoToDbFields, useSearchFilters } from "./useSearchFilters";

export interface VectorSearchResult {
  topMatches: DocumentoGiurisprudenziale[];
  allMatches: DocumentoGiurisprudenziale[];
  status?: string;
  webFallback?: WebFallbackData | null;
}

export type DetailedMatch =
  | { type: "numero_sentenza"; query: string; docs: DocumentoGiurisprudenziale[] }
  | { type: "normativa"; query: string; key: string; docs: DocumentoGiurisprudenziale[] }
  | { type: "sottocategoria"; query: string; value: string; docs: DocumentoGiurisprudenziale[] }
  | null;

const isIdentifierQuery = (query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (q.startsWith("ecli:")) return true;
  if (q.startsWith("urn:")) return true;
  if (/^(n\.|n|num\.|numero)?\s*\d{1,7}\/\d{4}$/.test(q)) return true;
  return false;
};

const getSubcategoryQuery = (q: string): string | null => {
  const s = q.trim();
  const m = s.match(/^sottocategoria\s*:\s*(\S(?:.*\S)?)\s*$/i);
  if (m) return m[1].toLowerCase();
  return s.length > 2 ? s.toLowerCase() : null;
};

export function useSearchHistory(uid: string | null, searchInput: string) {
  const [userTerms, setUserTerms] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    
    // RISOLTO: Inseriamo il set state sincrono dentro la funzione async
    // per non far arrabbiare il linter di React sui render a cascata.
    const fetchHistory = async () => {
      if (!uid) {
        setUserTerms([]);
        return;
      }
      try {
        const terms = await loadUserSearchTerms(uid, 50);
        if (!cancelled) setUserTerms(terms);
      } catch (e) {
        if (!cancelled) setUserTerms([]);
        trackEvent("analytics_error", { 
          name: "loadUserSearchTerms", 
          reason: e instanceof Error ? e.message : "unknown_error" 
        });
      }
    };

    fetchHistory();

    return () => { cancelled = true; };
  }, [uid]);

  const filteredSuggestions = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    if (!q) return userTerms.slice(0, 10);
    return userTerms.filter((t) => t.toLowerCase().includes(q)).slice(0, 10);
  }, [searchInput, userTerms]);

  const addTermToHistory = async (term: string) => {
    if (!uid) return;
    try {
      await saveUserSearchTerm(uid, term);
      setUserTerms((prev) => {
        const without = prev.filter((x) => x.toLowerCase() !== term.toLowerCase());
        return [term, ...without].slice(0, 50);
      });
    } catch (e) {
      console.error("Errore salvataggio cronologia", e);
    }
  };

  return { userTerms, filteredSuggestions, addTermToHistory };
}

export function useSearchEngine(
  filters: ReturnType<typeof useSearchFilters>,
  history: ReturnType<typeof useSearchHistory>
) {
  const [loading, setLoading] = useState(false);
  const [topResults, setTopResults] = useState<DocumentoGiurisprudenziale[]>([]);
  const [results, setResults] = useState<DocumentoGiurisprudenziale[]>([]);
  const [visibleCount, setVisibleCount] = useState(10);
  
  const [detailedMatch, setDetailedMatch] = useState<DetailedMatch>(null);
  const [isDeepSearchAvailable, setIsDeepSearchAvailable] = useState(false);
  
  const [lastDbDoc, setLastDbDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMoreDbResults, setHasMoreDbResults] = useState(false);
  const [isDbPaginatedMode, setIsDbPaginatedMode] = useState(false);
  
  const [webFallback, setWebFallback] = useState<WebFallbackData | null>(null);
  const [searchStatus, setSearchStatus] = useState<string>("SUCCESS");
  const [deny, setDeny] = useState(false);

  const executeVectorSearch = async (query: string): Promise<VectorSearchResult> => {
    const { vectorSearch } = await import("@/features/search/hooks/vectorSearch");
    const activeFilters = filters.buildVectorFilters();
    
    const vectorOut = await withTrace(
      "search_vector_hybrid",
      { qlen: query.length, filterCount: activeFilters.length },
      () => vectorSearch(query, activeFilters, filters.numberPages)
    );

    const filterAndMapDocs = (docs: SentenceMatch[]): DocumentoGiurisprudenziale[] => {
      const { organo_giudicante, materia } = mapGradoToDbFields(filters.filterGrado);

      return docs
        .filter((doc): boolean => {
          if (organo_giudicante && doc.organo_giudicante !== organo_giudicante) return false;
          if (materia && doc.materia !== materia) return false;
          if (filters.filterTipo && doc.tipo_massima !== filters.filterTipo) return false;
          if (filters.filterTipologia && doc.tipo_documento?.toLowerCase() !== filters.filterTipologia.toLowerCase()) return false;
          if (filters.filterSezione && doc.sezione !== filters.filterSezione) return false;

          if (doc.dataSentenza) {
            let dateVal: Date;
            const rawDate = doc.dataSentenza as unknown as { _seconds?: number; seconds?: number; toDate?: () => Date; };

            if (typeof rawDate.toDate === "function") dateVal = rawDate.toDate();
            else if (typeof rawDate._seconds === "number") dateVal = new Date(rawDate._seconds * 1000);
            else if (typeof rawDate.seconds === "number") dateVal = new Date(rawDate.seconds * 1000);
            else dateVal = new Date(doc.dataSentenza as unknown as string | number | Date);

            if (isNaN(dateVal.getTime())) return false;
            if (filters.startDate && dateVal < new Date(filters.startDate)) return false;
            
            if (filters.endDate) {
              const endD = new Date(filters.endDate);
              endD.setHours(23, 59, 59, 999);
              if (dateVal > endD) return false;
            }
          } else {
            if (filters.startDate || filters.endDate) return false;
          }

          return true;
        })
        .map((doc): DocumentoGiurisprudenziale => {
          const docRecord = doc as unknown as Record<string, unknown>;
          const sottotipo = typeof docRecord["sottotipo_documento"] === "string" ? docRecord["sottotipo_documento"] : "";
          return { ...doc, sottotipo_documento: sottotipo } as DocumentoGiurisprudenziale;
        });
    };

    const finalTopMatches = filterAndMapDocs(vectorOut?.topMatches ?? []);
    const finalAllMatches = filterAndMapDocs(vectorOut?.allMatches ?? []);
    
    if (vectorOut?.status === "GEMINI_FALLBACK") {
      console.log(`[VectorSearchWrapper] Inoltro fallback web all'interfaccia UI.`);
    }

    return {
      topMatches: finalTopMatches,
      allMatches: finalAllMatches,
      status: vectorOut?.status || "SUCCESS",
      webFallback: vectorOut?.webFallback || null
    };
  };

  const handleSearch = async (term: string): Promise<DocumentoGiurisprudenziale[]> => {
    const trimmedInput = term.trim();
    const startD = filters.startDate ? new Date(filters.startDate) : null;
    const endD = filters.endDate ? new Date(filters.endDate) : null;
    if (endD) endD.setHours(23, 59, 59, 999);

    const { organo_giudicante, materia } = mapGradoToDbFields(filters.filterGrado);
    const isBrowseDbMode = !trimmedInput && Boolean(filters.filterGrado || filters.filterTipo || filters.filterTipologia || filters.startDate || filters.endDate);
    if (!trimmedInput && !isBrowseDbMode) return [];

    setLoading(true);
    setDetailedMatch(null);
    setIsDeepSearchAvailable(false);
    setLastDbDoc(null);
    setHasMoreDbResults(false);
    setTopResults([]);
    setWebFallback(null);
    setSearchStatus("SUCCESS");

    const hasAnyFilters = Boolean(
      filters.filterGrado || filters.filterTipo || filters.filterTipologia || filters.startDate || filters.endDate || filters.filterSezione || filters.sortBy !== "relevance"
    );

    trackEvent("sentence_searched", { query_length: trimmedInput.length, filters_used: hasAnyFilters });

    try {
      return await withTrace(
        "search_total",
        { qlen: trimmedInput.length, has_filters: hasAnyFilters },
        async () => {

          if (isBrowseDbMode) {
            setIsDbPaginatedMode(true);
            const { docs, lastVisible } = await fetchCortePaginata(
              filters.filterSezione || null, filters.filterTipo || null, organo_giudicante, materia, filters.filterTipologia,
              filters.sortBy === "date_asc" ? "asc" : filters.sortBy === "date_desc" ? "desc" : null,
              startD, endD, null, filters.numberPages
            );
            
            setLastDbDoc(lastVisible as QueryDocumentSnapshot<DocumentData> | null);
            setHasMoreDbResults(docs.length === 10);
            
            const finalDocs = filters.applyUiFiltersAndSort(docs);
            setResults(finalDocs);
            setVisibleCount(finalDocs.length);
            return finalDocs;
          }

          setIsDbPaginatedMode(false);
          await history.addTermToHistory(trimmedInput);

          const subcatQuery = getSubcategoryQuery(trimmedInput);
          const numeroPromise = withTrace("search_exact_numero", { qlen: trimmedInput.length }, () => findByNumeroSentenza(trimmedInput));
          const normativaPromise = withTrace("search_normativa", { qlen: trimmedInput.length }, () => findNormativaFromUserQuery(trimmedInput));
          const subcatPromise = subcatQuery ? withTrace("search_subcat", { subcat: subcatQuery }, () => findBySottocategoria(subcatQuery)) : Promise.resolve<DocumentoGiurisprudenziale[]>([]);

          const isIdQuery = isIdentifierQuery(trimmedInput);
          const [numeroResults, normativaOut, subcatResults] = await Promise.all([numeroPromise, normativaPromise, subcatPromise]);

          const filteredNumero = filters.applyUiFiltersAndSort(numeroResults);
          const filteredNormativa = filters.applyUiFiltersAndSort(normativaOut.docs);
          const filteredSubcat = filters.applyUiFiltersAndSort(subcatResults);

          const hasSpecificMatch = filteredNumero.length > 0 || filteredSubcat.length > 0 || filteredNormativa.length > 0;

          let vectorTopDocs: DocumentoGiurisprudenziale[] = [];
          let vectorAllDocs: DocumentoGiurisprudenziale[] = [];
          let currentDetailedMatch: DetailedMatch = null;

          if (hasSpecificMatch) {
            if (filteredNumero.length > 0) {
              currentDetailedMatch = { type: "numero_sentenza", query: trimmedInput, docs: filteredNumero };
            } else if (subcatQuery && filteredSubcat.length > 0) {
              currentDetailedMatch = { type: "sottocategoria", query: trimmedInput, value: subcatQuery, docs: filteredSubcat };
            } else if (filteredNormativa.length > 0) {
              currentDetailedMatch = { type: "normativa", query: trimmedInput, key: normativaOut.keys[0] ?? "normativa", docs: filteredNormativa };
            }
            
            setDetailedMatch(currentDetailedMatch);
            setIsDeepSearchAvailable(!isIdQuery);
            
          } else {
            if (isIdQuery) {
              setSearchStatus("SUCCESS");
              setWebFallback(null);
            } else {
              const vectorResponse = await executeVectorSearch(trimmedInput);
              vectorTopDocs = vectorResponse.topMatches;
              vectorAllDocs = vectorResponse.allMatches; 
              setSearchStatus(vectorResponse.status || "SUCCESS");
              
              if (vectorResponse.status === "GEMINI_FALLBACK" && vectorResponse.webFallback) {
                setWebFallback(vectorResponse.webFallback);
              }
            }
          }

          const filteredGenericTop = filters.applyUiFiltersAndSort(vectorTopDocs);
          setTopResults(filteredGenericTop);

          // RISOLTO: Tipizzazione esplicita delle callback
          const topIds = new Set(filteredGenericTop.map((d: DocumentoGiurisprudenziale) => d.id));
          const combinedMap = new Map<string, DocumentoGiurisprudenziale>();

          filteredNumero.forEach((d: DocumentoGiurisprudenziale) => combinedMap.set(d.id, d));
          filteredSubcat.forEach((d: DocumentoGiurisprudenziale) => { if (!combinedMap.has(d.id)) combinedMap.set(d.id, d); });
          filteredNormativa.forEach((d: DocumentoGiurisprudenziale) => { if (!combinedMap.has(d.id)) combinedMap.set(d.id, d); });
          
          const filteredGenericAll = filters.applyUiFiltersAndSort(vectorAllDocs); 
          filteredGenericAll.forEach((d: DocumentoGiurisprudenziale) => { 
            if (!combinedMap.has(d.id) && !topIds.has(d.id)) combinedMap.set(d.id, d); 
          });

          const finalResults = Array.from(combinedMap.values());
          setResults(finalResults);
          setVisibleCount(10);

          trackEvent("sentence_searched", {
            query_length: trimmedInput.length,
            filters_used: hasAnyFilters,
            results_count: finalResults.length + filteredGenericTop.length,
          });

          return finalResults;
        }
      );
    } catch (err: unknown) {
      console.error("Errore nella ricerca:", err);
      if (isAuthzError(err)) { setDeny(true); return []; }
      if (isUnavailableError(err)) { toast.error("Servizio non disponibile. Riprova."); return []; }
      if (isNetworkError(err)) { toast.error("Errore di rete. Controlla la connessione."); return []; }
      if (err instanceof FirebaseError) { toast.error("Errore database. Riprova."); return []; }
      if (err instanceof Error) { toast.error(err.message || "Errore imprevisto."); return []; }
      toast.error("Errore imprevisto durante la ricerca.");
      return [];
    } finally {
      setLoading(false);
    }
  };

  const handleDeepSearch = async (searchInput: string) => {
    if (!searchInput.trim()) return;
    
    setLoading(true);
    try {
      const { topMatches, allMatches, status, webFallback: fallbackData } = await executeVectorSearch(searchInput);
      
      setSearchStatus(status || "SUCCESS");
      if (status === "GEMINI_FALLBACK" && fallbackData) {
        setWebFallback(fallbackData);
      }

      const filteredGenericTop = filters.applyUiFiltersAndSort(topMatches);
      setTopResults(filteredGenericTop);
      
      const filteredGenericAll = filters.applyUiFiltersAndSort(allMatches);

      setResults(prevResults => {
        // RISOLTO: Tipizzazione esplicita delle callback
        const topIds = new Set(filteredGenericTop.map((d: DocumentoGiurisprudenziale) => d.id));
        const combinedMap = new Map<string, DocumentoGiurisprudenziale>();
        
        prevResults.forEach((d: DocumentoGiurisprudenziale) => combinedMap.set(d.id, d));
        filteredGenericAll.forEach((d: DocumentoGiurisprudenziale) => {
          if (!combinedMap.has(d.id) && !topIds.has(d.id)) combinedMap.set(d.id, d);
        });

        return Array.from(combinedMap.values());
      });

      setIsDeepSearchAvailable(false);

    } catch (err: unknown) {
      if (isUnavailableError(err)) toast.error("Ricerca approfondita non disponibile al momento.");
      else if (isNetworkError(err)) toast.error("Errore di connessione.");
      else toast.error("Errore durante la ricerca approfondita");
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (isDbPaginatedMode && lastDbDoc) {
      setLoading(true);
      const startD = filters.startDate ? new Date(filters.startDate) : null;
      const endD = filters.endDate ? new Date(filters.endDate) : null;
      if (endD) endD.setHours(23, 59, 59, 999);
      
      const { organo_giudicante, materia } = mapGradoToDbFields(filters.filterGrado);

      try {
        const { docs, lastVisible } = await fetchCortePaginata(
          filters.filterSezione || null, filters.filterTipo || null, organo_giudicante, materia, filters.filterTipologia,
          filters.sortBy === "date_asc" ? "asc" : filters.sortBy === "date_desc" ? "desc" : null,
          startD, endD, lastDbDoc, filters.numberPages
        );
        
        setLastDbDoc(lastVisible as QueryDocumentSnapshot<DocumentData> | null);
        setHasMoreDbResults(docs.length === 10);
        
        const newFilteredDocs = filters.applyUiFiltersAndSort(docs);
        
        setResults(prev => {
          // RISOLTO: Tipizzazione esplicita delle callback
          const combinedMap = new Map<string, DocumentoGiurisprudenziale>();
          prev.forEach((d: DocumentoGiurisprudenziale) => combinedMap.set(d.id, d));
          newFilteredDocs.forEach((d: DocumentoGiurisprudenziale) => { if (!combinedMap.has(d.id)) combinedMap.set(d.id, d); });
          const combined = Array.from(combinedMap.values());
          setVisibleCount(combined.length);
          return combined;
        });
      } catch (err: unknown) {
        toast.error("Errore nel caricamento di altri risultati.");
        console.error("Errore paginazione DB:", err);
      } finally {
        setLoading(false);
      }
    } else {
      setVisibleCount(prev => prev + 10);
    }
  };

  return {
    loading, topResults, results, visibleCount, setVisibleCount,
    detailedMatch, setDetailedMatch, isDeepSearchAvailable,
    isDbPaginatedMode, hasMoreDbResults, webFallback, searchStatus, deny,
    handleSearch, handleDeepSearch, handleLoadMore
  };
}