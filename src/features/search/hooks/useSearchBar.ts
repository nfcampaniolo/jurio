import { useState } from "react";
import type { KeyboardEvent } from "react";
import type { DocumentoGiurisprudenziale } from "@/interfaces/interfaces";
import { useAuth } from "@/context/useAuth";
import { trackEvent } from "@/infrastructure/analytics";
import { loadDistinctSottocategorie } from "@/features/search/hooks/search";

import { useSearchFilters } from "../hooks/useSearchFilters";
import { useSearchHistory, useSearchEngine } from "./useSearchEngine";

export function useSearchBar() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [searchInput, setSearchInput] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filters = useSearchFilters();
  const history = useSearchHistory(uid, searchInput);
  const engine = useSearchEngine(filters, history);

  const handleKeyDown = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) return;
    if (e.key === "ArrowDown") { 
      e.preventDefault(); 
      setActiveIndex((i) => Math.min(i + 1, history.filteredSuggestions.length - 1)); 
      return; 
    }
    if (e.key === "ArrowUp") { 
      e.preventDefault(); 
      setActiveIndex((i) => Math.max(i - 1, -1)); 
      return; 
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const picked = activeIndex >= 0 ? history.filteredSuggestions[activeIndex] : searchInput;
      setShowSuggestions(false);
      setActiveIndex(-1);
      await engine.handleSearch(picked);
      return;
    }
    if (e.key === "Escape") { 
      setShowSuggestions(false); 
      setActiveIndex(-1); 
    }
  };

  const handleClick = (doc: DocumentoGiurisprudenziale) => {
    trackEvent("sentence_opened", { source: "search" });
    const isMobile = window.innerWidth < 768;
    const target = isMobile ? "_self" : "_blank";
    const newWindow = window.open(`/giurisprudenza/${doc.id}`, target);
    if (!isMobile && newWindow) {
      window.focus();
    }
  };

return {
    // 1. Prima espandiamo tutti i moduli base
    ...filters,
    ...history,
    ...engine,
    
    // 2. Poi dichiariamo gli stati locali
    searchInput, setSearchInput,
    activeIndex, setActiveIndex,
    showSuggestions, setShowSuggestions,
    
    // 3. Infine sovrascriviamo i metodi con i nostri wrapper custom (che vincono)
    handleKeyDown,
    handleClick,
    handleDeepSearch: () => engine.handleDeepSearch(searchInput),
    handleSearch: (term: string) => engine.handleSearch(term),
    loadDistinctSottocategorie
  };
}