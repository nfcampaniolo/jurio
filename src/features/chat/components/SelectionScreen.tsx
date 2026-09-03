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
    <section className="w-full h-full overflow-y-auto bg-neutral-50 dark:bg-neutral-950 scroll-smooth">
      <div className="min-h-full w-full flex flex-col items-center justify-start md:justify-center px-4 py-8 md:py-20">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          exit={{ opacity: 0, scale: 0.98 }} 
          transition={{ duration: 0.4, ease: "easeOut" }} 
          className="max-w-4xl w-full flex flex-col items-center"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 w-full mb-8 md:mb-10">
            <button 
              onClick={startTempChat} 
              className="group relative p-5 sm:p-6 md:p-8 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-yellow-500 dark:hover:border-yellow-500 hover:shadow-2xl hover:shadow-yellow-500/5 transition-all duration-300 text-left overflow-hidden"
            >
              {/* Linea superiore di rigore: invisibile di default, compare e si ingrandisce all'hover */}
              <div className="absolute top-0 left-0 right-0 h-0 bg-(--color-primary, #eab308) opacity-0 group-hover:opacity-100 group-hover:h-1 transition-all duration-200 z-10" />

              <div className="p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl w-fit group-hover:scale-110 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 transition-all mb-4 sm:mb-5">
                <MessageSquare className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg sm:text-xl md:text-2xl font-bold mb-2 text-neutral-900 dark:text-white">Chat Temporanea</h3>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Avvia una sessione rapida di ricerca giurisprudenziale senza salvare dati nel cloud.
              </p>
            </button>
            
            <button 
              onClick={startFascicoloSetup} 
              className="group relative p-5 sm:p-6 md:p-8 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-yellow-500 dark:hover:border-yellow-500 hover:shadow-2xl hover:shadow-yellow-500/5 transition-all duration-300 text-left overflow-hidden"
            >
              {/* Linea superiore di rigore: invisibile di default, compare e si ingrandisce all'hover */}
              <div className="absolute top-0 left-0 right-0 h-0 bg-(--color-primary, #eab308) opacity-0 group-hover:opacity-100 group-hover:h-1 transition-all duration-200 z-10" />

              <div className="p-3 sm:p-4 bg-stone-50 dark:bg-stone-900/20 rounded-2xl w-fit group-hover:scale-110 group-hover:bg-stone-100 dark:group-hover:bg-stone-900/40 transition-all mb-4 sm:mb-5">
                <FolderPlus className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-yellow-600 dark:text-yellow-400" />
              </div>
              <h3 className="text-lg sm:text-xl md:text-2xl font-bold mb-2 text-neutral-900 dark:text-white">Nuovo Fascicolo</h3>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Organizza i tuoi documenti e crea una memoria persistente per analisi complesse.
              </p>
            </button>
          </div>

          <motion.button 
            whileHover={{ x: 5 }} 
            onClick={() => navigate('/storico')} 
            className="group flex items-center gap-3 px-6 py-4 text-sm sm:text-base text-neutral-600 dark:text-neutral-300 font-bold hover:text-yellow-600 dark:hover:text-yellow-400 transition-all mb-8"
          >
            <div className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg group-hover:bg-stone-50 dark:group-hover:bg-stone-900/30 transition-colors">
                {isLoadingData ? <Loader2 size={18} className="animate-spin text-yellow-600" /> : <FolderOpen size={18} />}
            </div>
            <span>Sfoglia Archivio Fascicoli</span>
            <ChevronRight size={18} className="opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          </motion.button>
          
          <div className="text-center space-y-3 md:space-y-4 mb-10 md:mb-16">
            <div className="relative inline-block">
              <Scale className="w-12 h-12 md:w-16 md:h-16 text-yellow-600 dark:text-yellow-500 mx-auto" />
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-5xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
              Nuova Consultazione
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-neutral-500 dark:text-neutral-400 max-w-md mx-auto leading-relaxed px-2">
              Scegli come procedere con la tua analisi legale intelligente.
            </p>
          </div>
        </motion.div>
      </div>
    <Footer />
    </section>
  );
};