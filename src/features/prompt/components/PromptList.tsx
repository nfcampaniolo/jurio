import React from "react";
import { FaPlus, FaRobot, FaCalendarAlt, FaTrash, FaCopy, FaClone } from "react-icons/fa";
import { type SavedPrompt } from "@/interfaces/interfaces";
import { toast } from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { motion, useReducedMotion } from "framer-motion";

interface PromptListProps {
  prompts: SavedPrompt[];
  isLoading: boolean;
  onCreateNew: (template?: SavedPrompt) => void;
  onDelete: (id: string) => void;
}

export const PromptList: React.FC<PromptListProps> = ({ prompts, isLoading, onCreateNew, onDelete }) => {
  const shouldReduceMotion = useReducedMotion();

  const handleCopy = (e: React.MouseEvent, content: string) => {
    e.stopPropagation();
    void navigator.clipboard.writeText(content);
    toast.success("Prompt copiato negli appunti!");
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDelete(id); 
  };

  const handleUseAsTemplate = (e: React.MouseEvent, prompt: SavedPrompt) => {
    e.stopPropagation();
    onCreateNew(prompt);
  };

  const formatDate = (dateData: Timestamp | Date | string | number | null | undefined): string => {
    if (!dateData) return "Data sconosciuta";

    let date: Date;

    if (dateData instanceof Date) {
      date = dateData;
    } else if (typeof dateData === "object" && "toDate" in dateData) {
      date = dateData.toDate();
    } else {
      date = new Date(dateData);
    }

    if (isNaN(date.getTime())) return "Data non valida";

    return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
  };
   
  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      
      {/* HEADER */}
      <motion.div 
        initial={shouldReduceMotion ? false : { opacity: 0, y: -10 }}
        animate={shouldReduceMotion ? {} : { opacity: 1, y: 0 }}
        transition={shouldReduceMotion ? {} : { duration: 0.3, ease: "easeOut" }}
        className="flex justify-between items-center"
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-medium text-(--color-text) tracking-tight flex items-center gap-2.5" style={{ fontFamily: 'var(--font-serif)' }}>
            I Miei Prompt
          </h1>
          <p className="text-xs sm:text-sm text-(--color-muted) font-light mt-1.5 leading-relaxed">
            Gestisci e riutilizza i tuoi estrattori AI personalizzati.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onCreateNew()}
          className="flex items-center gap-2 px-4 py-2.5 bg-(--color-text) text-(--color-surface) rounded-md text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all shadow-xs outline-none cursor-pointer"
        >
          <FaPlus size={12} /> Nuovo Prompt
        </button>
      </motion.div>

      {/* STATO DI CARICAMENTO PROFESSIONALE */}
      {isLoading ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20 px-4 rounded-xl border border-(--color-border) bg-(--color-surface)/50 shadow-xs mt-6"
        >
          <div className="w-14 h-14 rounded-2xl bg-(--color-bg) border border-(--color-border) flex items-center justify-center mb-5 relative overflow-hidden">
            <div className="absolute inset-0 bg-linear-to-br from-transparent via-(--color-text)/5 to-transparent animate-pulse" />
            <Loader2 className="animate-spin text-(--color-text) opacity-80" size={24} />
          </div>
          <h3 className="text-base font-medium text-(--color-text) tracking-tight mb-1" style={{ fontFamily: 'var(--font-serif)' }}>
            Inizializzazione Archivio
          </h3>
          <p className="text-xs text-(--color-muted)">Sincronizzazione dei modelli di estrazione in corso...</p>
        </motion.div>
      ) : prompts.length === 0 ? (
        
        /* STATO VUOTO COMMERCIALE */
        <motion.div 
          initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.98 }}
          animate={shouldReduceMotion ? {} : { opacity: 1, scale: 1 }}
          transition={shouldReduceMotion ? {} : { duration: 0.3, ease: "easeOut" }}
          className="flex flex-col items-center justify-center text-center p-8 sm:p-14 bg-(--color-surface) rounded-lg border border-(--color-border) shadow-(--shadow-soft) mt-10 mx-auto"
        >
          <div className="w-12 h-12 rounded-full bg-(--color-bg) border border-(--color-border) flex items-center justify-center mb-5 text-(--color-text) shadow-xs">
            <FaRobot size={22} className="opacity-80" />
          </div>

          <span className="text-[10px] sm:text-[11px] font-bold text-(--color-text) uppercase tracking-widest bg-(--color-bg) border border-(--color-border) px-2.5 py-1 rounded-sm shadow-xs mb-3">
            Workflow & Automazione
          </span>

          <h2 
            className="text-lg sm:text-2xl font-medium text-(--color-text) tracking-tight mb-3"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Personalizza l’intelligenza di Jurio sui tuoi documenti
          </h2>

          <p className="text-xs sm:text-sm text-(--color-muted) font-light leading-relaxed max-w-xl mb-6">
            Configura istruzioni proprietarie ed estrattori verticali per automatizzare l’esame di atti, contratti e fascicoli processuali. Integrando i tuoi modelli direttamente nel motore di Jurio, ottieni analisi su misura perfettamente allineate agli standard redazionali del tuo studio.
          </p>

          <button
            type="button"
            onClick={() => onCreateNew()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-(--color-text) text-(--color-surface) rounded-md text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all shadow-xs cursor-pointer"
          >
            <FaPlus size={11} /> Crea il tuo primo prompt
          </button>
        </motion.div>
      ) : (

        /* LISTA PROMPT (GRIGLIA) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {prompts.map((prompt, index) => (
            <motion.div 
              key={prompt.id} 
              initial={shouldReduceMotion ? false : { opacity: 0, y: 15 }}
              animate={shouldReduceMotion ? {} : { opacity: 1, y: 0 }}
              transition={shouldReduceMotion ? {} : { duration: 0.3, delay: index * 0.05, ease: "easeOut" }}
              className="relative flex flex-col bg-(--color-surface) border border-(--color-border) rounded-lg shadow-(--shadow-soft) transition-all overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

              <div className="p-6 sm:p-7 flex-1 mt-1">
                <h3 className="text-base sm:text-lg font-medium mb-2 text-(--color-text) tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
                  {prompt.title}
                </h3>
                <p className="text-xs sm:text-sm text-(--color-muted) font-light mb-6 line-clamp-3 leading-relaxed">
                  {prompt.objective}
                </p>
                <p className="text-xs text-(--color-muted) font-light flex items-center gap-1.5">
                  <FaCalendarAlt size={13} className="opacity-70" /> {formatDate(prompt.createdAt)}
                </p>
              </div>

              <div className="grid grid-cols-3 border-t border-(--color-border) bg-(--color-bg) divide-x divide-(--color-border)">
                <button 
                  type="button"
                  onClick={(e) => handleCopy(e, prompt.content || "")}
                  className="flex flex-col items-center justify-center gap-1.5 p-3.5 text-(--color-muted) hover:text-(--color-text) hover:bg-(--color-surface) transition-colors outline-none cursor-pointer"
                  title="Copia il prompt"
                >
                  <FaCopy size={14} className="opacity-80" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Copia</span>
                </button>
                
                <button 
                  type="button"
                  onClick={(e) => handleUseAsTemplate(e, prompt)}
                  className="flex flex-col items-center justify-center gap-1.5 p-3.5 text-(--color-muted) hover:text-(--color-text) hover:bg-(--color-surface) transition-colors outline-none cursor-pointer"
                  title="Usa come base per uno nuovo"
                >
                  <FaClone size={14} className="opacity-80" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Modello</span>
                </button>
                
                <button 
                  type="button"
                  onClick={(e) => handleDelete(e, prompt.id)}
                  className="flex flex-col items-center justify-center gap-1.5 p-3.5 text-(--color-muted) hover:text-red-600 dark:hover:text-red-400 hover:bg-(--color-surface) transition-colors outline-none cursor-pointer"
                  title="Elimina"
                >
                  <FaTrash size={14} className="opacity-80" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Elimina</span>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};