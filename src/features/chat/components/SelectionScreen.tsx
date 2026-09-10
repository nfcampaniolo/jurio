import { motion } from "framer-motion";
import { Scale, MessageSquare, FolderPlus, FolderOpen, Loader2, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Footer } from "@/shared/components/Footer";

interface SelectionScreenProps {
  startTempChat: () => void;
  startFascicoloSetup: () => void;
  isLoadingData: boolean;
}

export const SelectionScreen = ({ 
  startTempChat, 
  startFascicoloSetup, 
  isLoadingData 
}: SelectionScreenProps) => {
  const navigate = useNavigate();

  return (
    <section aria-labelledby="selection-screen-heading" className="w-full h-full overflow-y-auto bg-(--color-bg) scroll-smooth">
      <div className="min-h-full w-full flex flex-col items-center justify-start px-6 py-10 md:py-16">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          exit={{ opacity: 0, scale: 0.98 }} 
          transition={{ duration: 0.4, ease: "easeOut" }} 
          className="max-w-5xl w-full flex flex-col items-center"
        >
          
          {/* HEADER SEZIONE (Spostato in alto per coerenza con DeepAnalysisLanding) */}
          <div className="text-center max-w-4xl mb-14">
            <div className="mb-6 flex justify-center">
              <span className="inline-flex items-center justify-center w-14 h-14 rounded-lg border border-(--color-border) bg-(--color-surface) text-(--color-text)">
                <Scale size={26} className="opacity-80" />
              </span>
            </div>

            <h1
              id="selection-screen-heading"
              className="text-3xl md:text-4xl lg:text-5xl text-(--color-text) tracking-tight mb-5 leading-tight"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              Il tuo <em>Consulente Legale</em>
            </h1>

            <p className="text-lg text-(--color-muted) font-light leading-relaxed mx-auto max-w-2xl">
              Ricerca giurisprudenziale avanzata e analisi dei tuoi documenti,
              in un unico spazio di lavoro.
            </p>
          </div>

          {/* GRIGLIA OPZIONI PRINCIPALI */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 w-full max-w-4xl mb-12">
            
            {/* Card: Chat Temporanea */}
            <button 
              onClick={startTempChat} 
              className="group relative flex flex-col text-left p-8 rounded-lg border border-(--color-border) bg-(--color-surface) transition-all duration-300 overflow-hidden shadow-sm"
            >
              {/* Linea superiore di rigore animata */}
              <div className="absolute top-0 left-0 right-0 h-0 bg-(--color-primary) opacity-0 group-hover:opacity-100 group-hover:h-1 transition-all duration-200 z-10" />

              <span 
                className="mb-8 mt-2 inline-flex items-center justify-center w-12 h-12 rounded-md bg-(--color-border) opacity-80 text-(--color-text) transition-transform group-hover:scale-105 relative z-10" 
                aria-hidden="true"
              >
                <MessageSquare size={20} />
              </span>

              <h3 
                className="text-xl mb-3 font-medium text-(--color-text) leading-snug relative z-10"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                Chat Temporanea
              </h3>
              
              <p className="text-sm leading-relaxed text-(--color-muted) font-light relative z-10">
                Avvia una sessione rapida di ricerca giurisprudenziale senza salvare dati nel cloud.
              </p>
            </button>
            
            {/* Card: Nuovo Fascicolo */}
            <button 
              onClick={startFascicoloSetup} 
              className="group relative flex flex-col text-left p-8 rounded-lg border border-(--color-border) bg-(--color-surface)  transition-all duration-300 overflow-hidden shadow-sm"
            >
              {/* Linea superiore di rigore animata */}
              <div className="absolute top-0 left-0 right-0 h-0 bg-(--color-primary) opacity-0 group-hover:opacity-100 group-hover:h-1 transition-all duration-200 z-10" />

              <span 
                className="mb-8 mt-2 inline-flex items-center justify-center w-12 h-12 rounded-md bg-(--color-border) opacity-80 text-(--color-text) transition-transform group-hover:scale-105 relative z-10" 
                aria-hidden="true"
              >
                <FolderPlus size={20} />
              </span>

              <h3 
                className="text-xl mb-3 font-medium text-(--color-text) leading-snug relative z-10"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                Nuovo Fascicolo
              </h3>
              
              <p className="text-sm leading-relaxed text-(--color-muted) font-light relative z-10">
                Organizza i tuoi documenti e crea una memoria persistente per analisi complesse.
              </p>
            </button>

          </div>

          {/* AZIONE SECONDARIA (Archivio) */}
          <motion.button 
            whileHover={{ x: 5 }} 
            onClick={() => navigate('/storico')} 
            className="group flex items-center gap-3 px-6 py-4 mt-4 text-(--color-text) hover:opacity-80 transition-all mb-16 mx-auto outline-none"
          >
            <div className="flex items-center justify-center w-8 h-8 bg-(--color-surface) border border-(--color-border) rounded-md group- transition-colors">
              {isLoadingData ? (
                <Loader2 size={14} className="animate-spin text-(--color-primary)" />
              ) : (
                <FolderOpen size={14} className="text-(--color-muted) group-hover:text-(--color-text) transition-colors" />
              )}
            </div>
            <span className="uppercase tracking-widest text-[11px] font-bold">
              Sfoglia Archivio Fascicoli
            </span>
            <ChevronRight size={16} className="opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-(--color-muted)" />
          </motion.button>
          
        </motion.div>
      </div>
      <Footer />
    </section>
  );
};