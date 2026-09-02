import { useMemo, useState, useEffect, useDeferredValue, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Search, Loader2, Info } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AREE } from "@/interfaces/interfaces";

type LeftPickerPanelProps = {
  open: boolean;
  onClose: () => void;
  disabled?: boolean;
  setSearchInput: (v: string) => void;
  runSearch: (term: string) => Promise<unknown>;
  items: string[];
  loadingItems: boolean;
  errorItems: string | null;
  setItems?: (items: string[]) => void;
};

const getWeekNumber = (date: Date): string => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo}`;
};

const CACHE_KEY_ITEMS = "jurio_sottocategorie_cache_v1";
const CACHE_KEY_WEEK = "jurio_sottocategorie_week_v1";

export function LeftPickerPanel({
  open,
  onClose,
  disabled = false,
  setSearchInput,
  runSearch,
  items,
  loadingItems,
  errorItems,
  setItems,
}: LeftPickerPanelProps) {
  
  const [q, setQ] = useState("");
  // DIFFERITA: React non bloccherà l'UI mentre digiti, aggiornerà deferredQ in background
  const deferredQ = useDeferredValue(q); 
  const [activeTab, setActiveTab] = useState<"aree" | "sottocategorie">("aree");

  // Ref per il contenitore scrollabile (necessario per la virtualizzazione)
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!setItems) return;
    try {
      const currentWeek = getWeekNumber(new Date());
      const cachedWeek = localStorage.getItem(CACHE_KEY_WEEK);
      const cachedData = localStorage.getItem(CACHE_KEY_ITEMS);

      if (cachedWeek === currentWeek && cachedData) {
        const parsed = JSON.parse(cachedData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setItems(parsed);
        }
      }
    } catch (e) {
      console.error("Errore lettura cache sottocategorie:", e);
    }
  }, [setItems]);

  useEffect(() => {
    if (items && items.length > 0) {
      try {
        const currentWeek = getWeekNumber(new Date());
        localStorage.setItem(CACHE_KEY_ITEMS, JSON.stringify(items));
        localStorage.setItem(CACHE_KEY_WEEK, currentWeek);
      } catch (e) {
        console.error("Errore scrittura cache sottocategorie:", e);
      }
    }
  }, [items]);

  const areeList = useMemo(() => Object.values(AREE), []);
  const currentItems = activeTab === "sottocategorie" ? items : areeList;
  const isLoading = activeTab === "sottocategorie" ? loadingItems : false;
  const errorMsg = activeTab === "sottocategorie" ? errorItems : null;

  // Filtro utilizzando la stringa "differita" invece di quella in tempo reale
  const filtered = useMemo(() => {
    const s = deferredQ.trim().toLowerCase();
    if (!s) return currentItems;
    return currentItems.filter((x) => x.toLowerCase().includes(s));
  }, [deferredQ, currentItems]);

  // Inizializzazione della Virtualizzazione
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40, // Altezza stimata di ogni bottone in pixel (padding + font)
    overscan: 5, // Elementi extra renderizzati fuori schermo per evitare sfarfallii
  });

  const pick = async (word: string) => {
    onClose();
    setSearchInput(word);
    await runSearch(word);
  };

  // Resetta lo scroll al top quando cambi tab o cerchi
  useEffect(() => {
    if (parentRef.current) {
      parentRef.current.scrollTop = 0;
    }
  }, [activeTab, deferredQ]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.aside
            className="fixed left-0 top-0 bottom-0 z-50 w-90 max-w-[90vw]
                       bg-(--color-surface) border-r border-(--color-border)
                       shadow-(--shadow-soft) flex flex-col overflow-hidden"
            initial={{ x: -380 }}
            animate={{ x: 0 }}
            exit={{ x: -380 }}
            transition={{ type: "tween", duration: 0.22 }}
          >
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

            <div className="px-5 py-4 border-b border-(--color-border) flex items-center justify-between bg-(--color-bg) mt-1">
              <div className="text-base font-medium text-(--color-text) tracking-tight">
                Filtra per argomento
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={disabled}
                className="p-2 rounded-md hover:bg-(--color-surface) text-(--color-muted) hover:text-(--color-text) transition-colors disabled:opacity-60 disabled:cursor-not-allowed outline-none"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex border-b border-(--color-border) bg-(--color-bg) px-3 pt-2 gap-2">
              <button
                type="button"
                onClick={() => { setActiveTab("aree"); setQ(""); }}
                className={`flex-1 pb-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors outline-none ${
                  activeTab === "aree"
                    ? "border-(--color-text) text-(--color-text)"
                    : "border-transparent text-(--color-muted) hover:text-(--color-text)"
                }`}
              >
                Aree ({areeList.length})
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab("sottocategorie"); setQ(""); }}
                className={`flex-1 pb-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors outline-none ${
                  activeTab === "sottocategorie"
                    ? "border-(--color-text) text-(--color-text)"
                    : "border-transparent text-(--color-muted) hover:text-(--color-text)"
                }`}
              >
                Sottocategorie
              </button>
            </div>

            <div className="p-5 border-b border-(--color-border) bg-(--color-surface)">
              <div className="relative flex items-center">
                <Search size={16} className="absolute left-3.5 text-(--color-muted) pointer-events-none" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={activeTab === "sottocategorie" ? "Cerca sottocategoria…" : "Cerca area…"}
                  disabled={disabled || isLoading}
                  className="w-full rounded-md border border-(--color-border)
                             bg-(--color-bg) pl-10 pr-3.5 py-2.5 text-sm
                             text-(--color-text) font-light placeholder:text-(--color-muted)
                             focus:outline-none focus:border-(--color-text)
                             disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                />
              </div>
              <div className="mt-2.5 text-[10px] font-bold uppercase tracking-widest text-(--color-muted) px-1 flex justify-between">
                <span>{isLoading ? "Caricamento…" : `${filtered.length} risultati`}</span>
                {/* Mostra un piccolo indicatore se la UI sta ricalcolando la lista */}
                {q !== deferredQ && <span>Filtraggio in corso...</span>}
              </div>
            </div>

            {/* LISTA VIRTUALIZZATA */}
            <div 
              ref={parentRef} 
              className="p-3 flex-1 overflow-y-auto scrollbar-hide bg-(--color-surface)"
            >
              {isLoading && (
                <div className="flex flex-col items-center justify-center py-12 text-(--color-muted) gap-3">
                  <Loader2 size={22} className="animate-spin text-(--color-text)" />
                  <span className="text-xs font-light italic">Caricamento…</span>
                </div>
              )}

              {!isLoading && errorMsg && (
                <div className="p-4 rounded-md border border-red-500/30 bg-red-500/5 text-xs text-red-600 font-medium">
                  {errorMsg}
                </div>
              )}

              {!isLoading && !errorMsg && filtered.length === 0 && (
                <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                  <Info size={20} className="text-(--color-muted) opacity-60" />
                  <p className="text-xs text-(--color-muted) font-light">Nessun risultato.</p>
                </div>
              )}

              {!isLoading && !errorMsg && filtered.length > 0 && (
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                    const w = filtered[virtualItem.index];
                    return (
                      <div
                        key={virtualItem.key}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: `${virtualItem.size}px`,
                          transform: `translateY(${virtualItem.start}px)`,
                          paddingBottom: '4px' // spazio tra i bottoni simulato
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => void pick(w)}
                          disabled={disabled}
                          className="block w-full h-full text-left px-3.5 py-2 rounded-md
                                     hover:bg-(--color-bg) text-xs font-bold uppercase tracking-wider
                                     text-(--color-text) transition-colors outline-none
                                     disabled:opacity-60 disabled:cursor-not-allowed border border-transparent hover:border-(--color-border)"
                        >
                          {w}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
