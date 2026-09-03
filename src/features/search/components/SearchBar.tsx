import { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Typewriter } from "@/shared/components/Typewriter";
import { useSearchBar } from "@/features/search/hooks/useSearchBar";
import { 
  Search, Sliders, X, Loader2, BookOpen, TextSearch, 
  CheckCircle2, ArrowLeft, MoreVertical, Mic 
} from "lucide-react";
import { LeftPickerPanel } from "./LeftPickerPanel";
import { AccessDenied } from "@/shared/components/AccessDenied";
import { SearchFilters } from "./SearchFilters";
import { SearchResultsList } from "./SearchResultsList";

import type {
  ISpeechRecognition,
  SpeechWindow,
  SpeechRecognitionEvent,
  SpeechRecognitionErrorEvent
} from "@/shared/hooks/speech-recognition"; 


export const SearchBar = () => {
  const {
      searchInput, setSearchInput,
      filteredSuggestions,
      activeIndex, setActiveIndex,
      showSuggestions, setShowSuggestions,
      topResults, results, visibleCount,
      filterGrado, setFilterGrado,
      filterTipo, setFilterTipo,
      handleSearch, handleKeyDown, handleClick,
      startDate, setStartDate,
      endDate, setEndDate,
      filterTipologia, setFilterTipologia,
      sortBy, setSortBy,
      filterSezione, setFilterSezione,
      numberPages, setnumberPages,
      detailedMatch,
      isDeepSearchAvailable, 
      handleDeepSearch,  
      loadDistinctSottocategorie,
      clearFilters,
      loading,
      deny,
      handleLoadMore,
      isDbPaginatedMode,
      hasMoreDbResults,
      webFallback,
      searchStatus
    } = useSearchBar();

  const [showFilters, setShowFilters] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerItems, setPickerItems] = useState<string[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const pickerLoadedRef = useRef(false);

  // --- STATI E REF PER RICONOSCIMENTO VOCALE ---
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);

  useEffect(() => {
    const isMobile = window.innerWidth < 640;
    if ((showSuggestions || showFilters || showMobileMenu) && isMobile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [showSuggestions, showFilters, showMobileMenu]);

  // --- LOGICA RICONOSCIMENTO VOCALE ---
  const handleVoiceResult = useCallback((transcript: string) => {
    // Rimuove la punteggiatura finale se presente e formatta
    const cleanTranscript = transcript.trim();
    setSearchInput(cleanTranscript);
    if (window.innerWidth >= 640) setShowSuggestions(true);
  }, [setSearchInput, setShowSuggestions]);

  useEffect(() => {
    const speechWindow = window as unknown as SpeechWindow;
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'it-IT';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        handleVoiceResult(transcript);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("Errore riconoscimento vocale:", event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }
  }, [handleVoiceResult]);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsRecording(true);
        } catch (e) {
          console.error("Microfono già in uso o errore di avvio", e);
        }
      } else {
        alert("Il tuo browser non supporta il riconoscimento vocale nativo.");
      }
    }
  };
  // ------------------------------------

  const openPicker = async () => {
    setPickerOpen(true);
    setPickerError(null);

    if (pickerLoadedRef.current) return;

    pickerLoadedRef.current = true;
    setPickerLoading(true);

    try {
      const data = await loadDistinctSottocategorie();
      setPickerItems(data);
    } catch (e: unknown) {
      setPickerError(e instanceof Error ? e.message : "Errore nel caricamento");
      setPickerItems([]);
      pickerLoadedRef.current = false;
    } finally {
      setPickerLoading(false);
    }
  };

  const isSearching = searchInput.trim().length > 0;

  const effectiveTopMatches = detailedMatch ? detailedMatch.docs : topResults;
  const effectiveAllMatches = detailedMatch 
    ? results.filter(doc => !detailedMatch.docs.some(d => d.id === doc.id)) 
    : results;

  const visibleTopMatches = effectiveTopMatches.slice(0, visibleCount);
  const remainingCount = Math.max(0, visibleCount - visibleTopMatches.length);
  const visibleAllMatches = effectiveAllMatches.slice(0, remainingCount);

  const totalResultsCount = effectiveTopMatches.length + effectiveAllMatches.length;

  if (deny) {
    return (
      <div className="w-full mx-auto max-w-7xl py-20">
        <AccessDenied />
      </div>
    );
  }

  const filtersProps = {
    loading,
    filterGrado,
    setFilterGrado,
    filterSezione,
    setFilterSezione,
    filterTipo,
    setFilterTipo,
    filterTipologia,
    setFilterTipologia,
    sortBy,
    setSortBy,
    numberPages,
    setnumberPages,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    clearFilters,
  };

  return (
    <>
      <div className="max-w-5xl mx-auto flex flex-col items-center text-center space-y-3 sm:space-y-4 py-6 sm:py-10 px-4 md:px-0">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-2xl sm:text-3xl md:text-4xl font-medium text-(--color-text) tracking-tight"
         
        >
          Consulta la giurisprudenza online
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-sm sm:text-base max-w-2xl text-(--color-muted) leading-relaxed font-light"
        >
          Jurio assicura la disamina sistematica di sentenze e ordinanze integrali attinte dai repertori ufficiali, mantenute in costante coordinamento con il diritto positivo vigente. L’accreditamento alla piattaforma è a titolo gratuito e ricomprende una finestra di valutazione per saggiare l’intera capacità euristica e analitica del sistema.
        </motion.p>
      </div>

      <div className="hidden sm:block">
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="max-w-5xl mx-auto px-4 mb-6 overflow-hidden"
            >
              <div className="p-6 bg-(--color-surface) border border-(--color-border) rounded-lg shadow-(--shadow-soft) relative">
                <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
                <SearchFilters {...filtersProps} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="sm:hidden fixed inset-0 z-100 bg-(--color-surface) flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-(--color-border) bg-(--color-surface) sticky top-0 z-10">
              <h2 className="text-base font-medium text-(--color-text)">Filtri di ricerca</h2>
              <button 
                onClick={() => setShowFilters(false)} 
                className="p-2 rounded-md bg-(--color-bg) border border-(--color-border) text-(--color-muted) hover:text-(--color-text) transition-colors outline-none"
                aria-label="Chiudi filtri"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pt-4 pb-20 bg-(--color-bg)">
              <SearchFilters {...filtersProps} />
            </div>
            <div className="p-4 border-t border-(--color-border) bg-(--color-surface)">
               <button 
                 onClick={() => { setShowFilters(false); if(isSearching) handleSearch(searchInput); }} 
                 className="w-full py-3 bg-(--color-text) text-(--color-surface) rounded-md text-xs font-bold uppercase tracking-widest shadow-xs transition-opacity hover:opacity-90 outline-none"
               >
                 Applica filtri
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-5xl mx-auto px-4 md:px-0 relative z-20 mb-6 sm:mb-10">
        <div className="flex items-center gap-2">
          
          <div className="hidden sm:flex gap-2">
            <button
              type="button"
              onClick={() => openPicker()}
              disabled={loading}
              className="p-3 rounded-md hover:bg-(--color-bg) transition-colors flex items-center justify-center disabled:opacity-60 bg-(--color-surface) border border-(--color-border) text-(--color-text) outline-none shadow-xs"
              title="Apri pannello termini"
              aria-label="Apri pannello termini"
            >
              <BookOpen size={18} className="opacity-80" />
            </button>

            <button
              onClick={() => setShowFilters(prev => !prev)}
              disabled={loading}
              className={`p-3 rounded-md transition-colors flex items-center justify-center disabled:opacity-60 outline-none border shadow-xs ${showFilters ? 'bg-(--color-text) text-(--color-surface) border-(--color-text)' : 'bg-(--color-surface) border-(--color-border) text-(--color-text) hover:bg-(--color-bg)'}`}
              title={showFilters ? "Nascondi filtri" : "Mostra filtri"}
              aria-label={showFilters ? "Nascondi filtri" : "Mostra filtri"}
            >
              {showFilters ? <X size={18} /> : <Sliders size={18} className="opacity-80" />}
            </button>
          </div>

          <div className="sm:hidden relative">
            <button
              type="button"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              disabled={loading}
              className={`p-2.5 rounded-md transition-colors flex items-center justify-center disabled:opacity-60 outline-none border shadow-xs ${showMobileMenu || showFilters ? 'bg-(--color-text) text-(--color-surface) border-(--color-text)' : 'bg-(--color-surface) border-(--color-border) text-(--color-text)'}`}
              aria-label="Menu opzioni"
            >
              {showMobileMenu ? <X size={18} /> : <MoreVertical size={18} className="opacity-80" />}
            </button>

            <AnimatePresence>
              {showMobileMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40 bg-transparent"
                    onClick={() => setShowMobileMenu(false)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowMobileMenu(false); }}
                    role="button"
                    tabIndex={0}
                    aria-label="Close menu"
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -5 }}
                    className="absolute top-full left-0 mt-2 w-52 bg-(--color-surface) rounded-md shadow-(--shadow-soft) z-50 border border-(--color-border) overflow-hidden py-1"
                  >
                    <button 
                      onClick={() => { setShowMobileMenu(false); setShowFilters(true); }} 
                      className="w-full text-left px-4 py-3 flex items-center gap-3 text-xs font-bold uppercase tracking-wider hover:bg-(--color-bg) transition-colors text-(--color-text) border-b border-(--color-border) outline-none"
                    >
                      <Sliders size={15} className="opacity-70" />
                      Filtri Avanzati
                    </button>
                    <button 
                      onClick={() => { setShowMobileMenu(false); openPicker(); }} 
                      className="w-full text-left px-4 py-3 flex items-center gap-3 text-xs font-bold uppercase tracking-wider hover:bg-(--color-bg) transition-colors text-(--color-text) outline-none"
                    >
                      <BookOpen size={15} className="opacity-70" />
                      Indice Termini
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <div className="relative flex-1">
            <input
              type="text"
              placeholder={
                loading ? "Ricerca in corso…" : 
                isRecording ? "In ascolto..." : "Cerca"
              }
              className={`w-full rounded-md border px-4 py-3 text-sm sm:text-base disabled:opacity-60 shadow-xs focus:border-(--color-text) outline-none bg-(--color-surface) font-light transition-colors
                ${isRecording ? 'border-(--color-text) text-(--color-text) placeholder:text-(--color-text)' : 'border-(--color-border) text-(--color-text) placeholder:text-(--color-muted)'}`}
              value={searchInput}
              disabled={loading || isRecording}
              onChange={e => {
                setSearchInput(e.target.value);
                if (window.innerWidth >= 640) setShowSuggestions(true);
                setActiveIndex(-1);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => { if (!loading && window.innerWidth >= 640) setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            />

            <AnimatePresence onExitComplete={() => { document.body.style.overflow = 'unset'; }}>
              {showSuggestions && !loading && !isRecording && (
                <motion.ul
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.2 }}
                  className={`
                    fixed inset-0 z-60 bg-(--color-surface) flex flex-col
                    sm:absolute sm:inset-auto sm:top-full sm:left-0 sm:right-0 
                    sm:w-full sm:h-auto sm:max-h-60 mt-30 sm:mt-1
                    sm:bg-(--color-surface) 
                    sm:border sm:border-(--color-border) 
                    sm:rounded-md sm:shadow-(--shadow-soft) sm:overflow-auto
                  `}
                >
                  <div className="sm:hidden p-4 border-b border-(--color-border) flex items-center gap-3 bg-(--color-surface)">
                    <button onClick={() => setShowSuggestions(false)} className="p-1.5 text-(--color-muted) hover:text-(--color-text) outline-none" aria-label="Chiudi suggerimenti">
                      <ArrowLeft size={20} />
                    </button>
                    <input 
                      autoFocus 
                      className="flex-1 bg-transparent text-sm outline-none text-(--color-text) font-light placeholder:text-(--color-muted)" 
                      placeholder="Cerca suggerimenti..."
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                    />
                    {searchInput && (
                      <button onClick={() => setSearchInput('')} className="p-1 outline-none" aria-label="Pulisci input">
                        <X size={16} className="text-(--color-muted)" />
                      </button>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto pb-6 sm:pb-0 bg-(--color-surface)">
                    {filteredSuggestions.length > 0 ? (
                      filteredSuggestions.map((term, index) => (
                        <li
                          key={term}
                          className={`
                            px-4 py-3.5 sm:px-4 sm:py-2.5 cursor-pointer flex items-center gap-3 border-b border-(--color-border) last:border-0
                            ${index === activeIndex ? "bg-(--color-bg) text-(--color-text) font-semibold" : "hover:bg-(--color-bg) text-(--color-muted)"}
                          `}
                          onMouseDown={(e) => {
                            e.preventDefault(); 
                            setSearchInput(term);
                            setShowSuggestions(false);
                            handleSearch(term);
                          }}
                        >
                          <div className="shrink-0 opacity-40 text-(--color-text)"><Search size={14} /></div>
                          <span className="text-sm font-light truncate text-(--color-text)">{term}</span>
                        </li>
                      ))
                    ) : (
                      <div className="p-6 sm:p-8 text-center text-(--color-muted) text-xs font-light italic">
                        Nessun suggerimento trovato
                      </div>
                    )}
                  </div>
                </motion.ul>
              )}
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={toggleRecording}
            disabled={loading}
            className={`p-3 rounded-md transition-all duration-300 flex items-center justify-center shrink-0 outline-none shadow-xs disabled:opacity-30
              ${isRecording 
                ? 'bg-(--color-text) text-(--color-surface) animate-pulse' 
                : 'bg-(--color-surface) border border-(--color-border) text-(--color-text) hover:bg-(--color-bg)'}`}
            title="Dettatura vocale"
            aria-label="Dettatura vocale"
          >
            <Mic size={18} className={isRecording ? "scale-110 transition-transform" : ""} />
          </button>

          <button
            onClick={() => handleSearch(searchInput)}
            disabled={loading || (!searchInput.trim() && !(filterGrado || filterTipo || startDate || endDate))}
            className="p-3 rounded-md bg-(--color-text) text-(--color-surface) hover:opacity-90 transition-opacity flex items-center justify-center disabled:opacity-30 shadow-xs shrink-0 outline-none"
            aria-label="Avvia ricerca"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
          </button>
        </div>

        {!showSuggestions && !loading && !isRecording && (
          <div className="sm:hidden flex justify-center mt-3">
            <button 
              onClick={() => setShowSuggestions(true)}
              className="bg-(--color-surface) border border-(--color-border) text-(--color-text) text-[10px] font-bold uppercase tracking-widest px-3.5 py-1.5 rounded-md shadow-xs flex items-center gap-1.5 active:scale-95 transition-transform outline-none"
            >
              <Search size={11} className="opacity-70" />
              Ultime ricerche
            </button>
          </div>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-0 mt-4 sm:mt-6 space-y-4">
        {detailedMatch && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative p-5 bg-(--color-surface) border border-(--color-border) rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90" />
            <div className="flex items-center gap-3 text-(--color-text)">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5 md:mt-0" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted) mb-0.5">
                  {detailedMatch.type === 'numero_sentenza' && 'Pronuncia Specifica'}
                  {detailedMatch.type === 'normativa' && 'Riferimento Normativo'}
                  {detailedMatch.type === 'sottocategoria' && 'Categoria'}
                </p>
                <p className="text-base font-medium text-(--color-text) tracking-tight">
                  Risultati per "{detailedMatch.type === 'sottocategoria' ? detailedMatch.value : detailedMatch.query}"
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {isDeepSearchAvailable && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex justify-center"
          >
            <button
              onClick={handleDeepSearch}
              disabled={loading}
              className="group flex items-center gap-3 px-6 py-3 bg-(--color-surface) border border-(--color-border) rounded-md shadow-xs hover:border-(--color-text) transition-all text-left outline-none"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin text-(--color-text) shrink-0" />
              ) : (
                <TextSearch size={16} className="text-(--color-muted) group-hover:text-(--color-text) transition-colors shrink-0" />
              )}
              <span className="text-(--color-muted) text-xs sm:text-sm leading-snug font-light">
                Non hai trovato quello che cercavi? <br className="sm:hidden" />
                <span className="font-semibold text-(--color-text) group-hover:underline">Ricerca semantica</span>
              </span>
            </button>
          </motion.div>
        )}
      </div>

      {!loading && searchStatus === "GEMINI_FALLBACK" && webFallback && (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="max-w-5xl mx-auto px-4 md:px-0 mt-6 sm:mt-8 mb-6"
        >
          <div className="relative bg-(--color-surface) border border-(--color-border) rounded-lg p-6 sm:p-8 shadow-(--shadow-soft) overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
            
            <div className="flex flex-col sm:flex-row items-start gap-4 mb-6 pb-5 border-b border-(--color-border)">
              <div className="p-2.5 bg-(--color-bg) border border-(--color-border) rounded-md shrink-0 text-(--color-text)">
                <svg className="w-5 h-5 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-(--color-text) mb-1">
                  Sintesi AI & Ricerca Estesa
                </h3>
                <p className="text-xs sm:text-sm text-(--color-muted) font-light leading-relaxed">
                  Nessuna sentenza strettamente pertinente trovata con la richiesta originale. Abbiamo elaborato una sintesi dell'istituto giuridico ed effettuato automaticamente una nuova ricerca.
                </p>
              </div>
            </div>

            <div className="mb-6 text-sm text-(--color-text) font-light">
              <Typewriter text={webFallback.sintesi} animate={true} speed={5} />
            </div>

            {webFallback.queryAlternativa && (
              <div className="pt-4 border-t border-(--color-border)">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted) shrink-0">
                    Documenti recuperati per:
                  </span>
                  <div className="px-3 py-1.5 bg-(--color-bg) border border-(--color-border) text-(--color-text) rounded-md text-xs sm:text-sm font-light italic w-fit">
                    "{webFallback.queryAlternativa}"
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      <SearchResultsList
        totalResultsCount={totalResultsCount}
        isSearching={isSearching}
        effectiveTopMatches={effectiveTopMatches}
        effectiveAllMatches={effectiveAllMatches}
        visibleTopMatches={visibleTopMatches}
        visibleAllMatches={visibleAllMatches}
        visibleCount={visibleCount}
        loading={loading}
        isDbPaginatedMode={isDbPaginatedMode}
        hasMoreDbResults={hasMoreDbResults}
        handleClick={handleClick}
        handleLoadMore={handleLoadMore}
      />

      {loading && totalResultsCount === 0 && (
        <div className="max-w-5xl mx-auto mt-10 flex flex-col items-center justify-center gap-3 text-(--color-muted)">
          <Loader2 size={28} className="animate-spin text-(--color-text)" />
          <span className="text-xs font-bold uppercase tracking-widest">Ricerca in corso…</span>
        </div>
      )}

      <LeftPickerPanel
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        disabled={loading}
        setSearchInput={setSearchInput}
        runSearch={handleSearch}
        items={pickerItems}
        loadingItems={pickerLoading}
        errorItems={pickerError}
      />
    </>
  );
};