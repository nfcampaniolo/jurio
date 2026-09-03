import React, { useEffect, useState } from "react";
import { PromptList } from "@/features/prompt/components/PromptList";
import { PromptCreator } from "@/features/prompt/components/PromptCreator";
import { ConfirmModal } from "@/shared/components/ConfirmModal";
import { usePromptDashboard } from "@/features/prompt/hooks/usePromptGenerator";
import { motion, AnimatePresence, useReducedMotion, type TargetAndTransition, type Transition } from "framer-motion";
import { FaShieldAlt, FaArrowLeft, FaInfoCircle, FaFolderOpen, FaChevronRight } from "react-icons/fa";

export const PromptDashboard: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  const [showGuideTooltip, setShowGuideTooltip] = useState(false);

  const {
    view,
    prompts,
    isLoading,
    selectedTemplate,
    isDeleteModalOpen,
    handleOpenCreator,
    handleBackToList,
    requestDelete,
    confirmDelete,
    cancelDelete
  } = usePromptDashboard();

  useEffect(() => {
    if (window.location.hash.includes("#crea")) {
      handleOpenCreator();
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, [handleOpenCreator]); 

  const animationProps = {
    initial: shouldReduceMotion ? false : ({ opacity: 0, y: 10 } as TargetAndTransition),
    animate: shouldReduceMotion ? {} : ({ opacity: 1, y: 0 } as TargetAndTransition),
    exit: shouldReduceMotion ? {} : ({ opacity: 0, y: -10 } as TargetAndTransition),
    transition: shouldReduceMotion ? {} : ({ duration: 0.22, ease: "easeOut" } as Transition),
  };

  return (
    <div className="w-full min-h-screen bg-(--color-bg) text-(--color-text) relative">
      
      {/* BARRA SUPERIORE ISTITUZIONALE & BREADCRUMB */}
      <div className="border-b border-(--color-border) bg-(--color-surface)/70 backdrop-blur-md sticky top-0 z-30 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          
          {/* Navigazione contestuale e hover guidato */}
          <div className="flex items-center gap-2 text-xs text-(--color-muted)">
            <button 
              type="button"
              onClick={handleBackToList}
              className={`group flex items-center gap-2 font-medium transition-all duration-200 cursor-pointer ${
                view === "create" 
                  ? "text-(--color-text) hover:opacity-80" 
                  : "text-(--color-muted) hover:text-(--color-text)"
              }`}
              title="Torna all'elenco generale dei prompt"
            >
              <span className="p-1 rounded-sm bg-(--color-bg) border border-(--color-border) group-hover:border-(--color-text) transition-colors">
                {view === "create" ? (
                  <FaArrowLeft className="w-2.5 h-2.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
                ) : (
                  <FaFolderOpen className="w-2.5 h-2.5 opacity-75" />
                )}
              </span>
              <span className="tracking-wide">Archivio Prompt</span>
            </button>

            {view === "create" && (
              <>
                <FaChevronRight className="w-2 h-2 opacity-40" />
                <span className="font-semibold text-(--color-text) tracking-wide">
                  {selectedTemplate ? "Duplica / Modifica Modello" : "Nuova Regola di Estrazione"}
                </span>
              </>
            )}
          </div>

          {/* Indicatori di sicurezza e compliance con guida al passaggio del mouse */}
          <div className="flex items-center gap-3">
            <div 
              className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-(--color-bg) border border-(--color-border) text-[11px] font-medium text-(--color-muted) cursor-help transition-all duration-200 hover:border-(--color-text) hover:text-(--color-text)"
              onMouseEnter={() => setShowGuideTooltip(true)}
              onMouseLeave={() => setShowGuideTooltip(false)}
            >
              <FaShieldAlt className="w-3 h-3 text-(--color-primary) opacity-90" />
              <span className="hidden sm:inline tracking-wider uppercase text-[10px]">GDPR & E2E Encrypted</span>

              {/* Tooltip guidato al hover */}
              <AnimatePresence>
                {showGuideTooltip && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-72 p-3 bg-(--color-surface) border border-(--color-border) rounded-md shadow-(--shadow-soft) text-[11px] text-(--color-text) z-50 pointer-events-none"
                  >
                    <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[9px] text-(--color-muted) mb-1">
                      <FaInfoCircle className="text-(--color-primary)" /> Riservatezza Istituzionale
                    </div>
                    Le direttive personalizzate non vengono condivise con i modelli pubblici e rimangono circoscritte al perimetro protetto del tuo profilo.
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

        </div>
      </div>

      {/* STRISCIA INFORMATIVA DI ORIENTAMENTO (Hover interattivo per guidare l'utente) */}
      {view === "list" && prompts.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
          <div className="group relative flex items-start sm:items-center justify-between gap-3 px-4 py-3 bg-(--color-surface) border border-(--color-border) hover:border-(--color-text)/40 rounded-lg shadow-xs transition-all duration-200">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-(--color-primary) shrink-0 group-hover:scale-125 transition-transform duration-200" />
              <p className="text-xs text-(--color-muted) group-hover:text-(--color-text) transition-colors">
                <span className="font-semibold text-(--color-text)">Regole attive per l'analisi:</span> Seleziona un modello per riutilizzare la struttura logica o creane uno nuovo per standardizzare l'estrazione dai tuoi atti.
              </p>
            </div>
            <span className="hidden md:inline text-[10px] uppercase font-bold tracking-widest text-(--color-muted) opacity-60 group-hover:opacity-100 transition-opacity shrink-0">
              Ambiente di Produzione
            </span>
          </div>
        </div>
      )}

      {/* AREA APPLICATIVA PRINCIPALE */}
      <main className="py-6 sm:py-8 px-4 sm:px-6">
        <AnimatePresence mode="wait" initial={false}>
          {view === "list" ? (
            <motion.div key="list" {...animationProps}>
              <PromptList 
                prompts={prompts} 
                isLoading={isLoading}
                onCreateNew={handleOpenCreator} 
                onDelete={requestDelete}
              />
            </motion.div>
          ) : (
            <motion.div key="create" {...animationProps}>
              <PromptCreator 
                onBack={handleBackToList} 
                template={selectedTemplate}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Elimina Prompt Personalizzato"
        message="Confermi l'eliminazione definitiva del prompt dal tuo archivio? La rimozione interromperà le automazioni collegate a questo schema di analisi."
        confirmText="Elimina definitivamente"
        cancelText="Annulla"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
      
    </div>
  );
};

export default PromptDashboard;