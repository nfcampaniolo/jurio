// src/features/analisi/ApprofondimentoGiurisprudenziale.tsx

import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Plus, PanelLeftClose, PanelLeftOpen, Settings2, Info, FileText } from "lucide-react";
import { Helmet } from "@dr.pogodin/react-helmet";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/shared/components/Header";
import { useAuth } from "@/context/useAuth";
import { useLegalChat } from "@/features/chat/hooks/useLegalChat";
import { DocumentSelectorPanel } from "@/features/chat/components/DocumentSelectorPanel";
import { ConfirmModal } from "@/shared/components/ConfirmModal";
import { DeepAnalysisLanding } from "./components/DeepAnalysisLanding";
import { SidebarStorico } from "./components/SidebarStorico";
import { WorkspaceIndagine } from "./components/WorkspaceIndagine";
import { AnalysisSettingsSection } from "./components/AnalysisSettingsSection";
import { RiquadroFonte } from "./components/RiquadroFonte";

import { eliminaSessione } from "./hooks/useDeepAnalysis";

import  { type DeepAnalysisConfig, LIMITE_MASSIMO_DOCUMENTI } from "./hooks/types";
import type { AttachedDocument } from "@/interfaces/interfaces";

export const ApprofondimentoGiurisprudenziale: React.FC = () => {
  const { user, status } = useAuth();
  
  const { analisiId } = useParams<{ analisiId: string }>();
  const navigate = useNavigate();
  
  const sessioneAttivaId = analisiId || null;
  
  const [sidebarAperta, setSidebarAperta] = useState(false);
  const [mostraImpostazioni, setMostraImpostazioni] = useState<boolean>(false);
  const [mostraGuida, setMostraGuida] = useState<boolean>(false);

  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [sessioneDaEliminare, setSessioneDaEliminare] = useState<{ id: string; titolo: string } | null>(null);

  const [configurazione, setConfigurazione] = useState<DeepAnalysisConfig>({
    confidenceLevel: 80,
    sourceWeb: true,
    sourceInternalDB: true,
    temperature: 0.2,
    topK: 10,
  });

  const logicaChat = useLegalChat();
  const {
    showDocsModal,
    setShowDocsModal,
    attachedDocs,
    setAttachedDocs,
    archiveDocs,
    isLoadingData,
    isProcessingFiles,
    toggleDocSelection,
    removeAttachment,
    processFilesParallel,
    handleToggleFascicoloLink,
    handleRenameDocumento,
    handleDeleteDocumento,
  } = logicaChat;

  const handleCambioSessione = (nuovoId: string | null) => {
    if (nuovoId) {
      navigate(`/analisi/${nuovoId}`);
    } else {
      navigate("/analisi");
    }
    setSidebarAperta(false);
  };

  const handleSyncDocs = React.useCallback((docs: AttachedDocument[]) => {
    if (setAttachedDocs) {
      setAttachedDocs(docs);
    }
  }, [setAttachedDocs]);

  const handleConfermaEliminazione = async () => {
    if (!sessioneDaEliminare) return;
    const id = sessioneDaEliminare.id;

    try {
      setEliminandoId(id);
      setSessioneDaEliminare(null);
      await eliminaSessione(id);
      if (sessioneAttivaId === id) {
        handleCambioSessione(null);
      }
    } catch (error) {
      console.error("Errore durante l'eliminazione:", error);
    } finally {
      setEliminandoId(null);
    }
  };
  
  if (status === "loading") return null;

  if (!user) {
    return (
      <>
        <Helmet><title>Approfondimento Giurisprudenziale | Jurio</title></Helmet>
        <Header />
        <DeepAnalysisLanding />
      </>
    );
  }

  return (
    <div className="flex flex-col h-dvh bg-(--color-bg) font-sans text-(--color-text) overflow-hidden print:h-auto print:overflow-visible print:block">
      <Helmet>
        <title>Approfondimento Giurisprudenziale | Jurio</title>
        <meta name="description" content="Indagine degli orientamenti giurisprudenziali mediante analisi semantica e fonti istituzionali." />
      </Helmet>
      
      <div className="print:hidden">
        <Header />
      </div>

      <div className="flex flex-1 overflow-hidden relative print:overflow-visible print:h-auto print:block">
        <AnimatePresence>
          {sidebarAperta && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarAperta(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs z-40 md:hidden print:hidden"
            />
          )}
        </AnimatePresence>

        <div className={`
          fixed md:relative inset-y-0 left-0 z-50
          ${sidebarAperta ? "w-72 translate-x-0 shadow-2xl md:shadow-none" : "w-0 -translate-x-full md:translate-x-0"} 
          transition-all duration-300 shrink-0 border-r border-(--color-border) bg-(--color-surface) overflow-hidden flex flex-col print:hidden
        `}>
          <div className="p-4 border-b border-(--color-border) flex items-center justify-between gap-2">
            <button
              onClick={() => handleCambioSessione(null)}
              className="flex flex-1 items-center justify-center gap-2 rounded-md bg-(--color-text) px-4 py-2 text-xs font-bold uppercase tracking-widest text-(--color-surface) transition hover:opacity-90 shadow-xs outline-none cursor-pointer"
            >
              <Plus size={14} /> Nuova Ricerca
            </button>
            <button
              onClick={() => setSidebarAperta(false)}
              className="md:hidden p-2 rounded-md text-(--color-muted) hover:text-(--color-text)"
              title="Chiudi storico"
            >
              <PanelLeftClose size={16} />
            </button>
          </div>
          <SidebarStorico 
            sessioneAttivaId={sessioneAttivaId} 
            onSelectSession={handleCambioSessione}
            onOpenDeleteConfirm={(id, titolo) => setSessioneDaEliminare({ id, titolo })}
            eliminandoId={eliminandoId}
          />
        </div>

        <main className="flex-1 flex flex-col min-w-0 bg-(--color-bg) relative overflow-hidden print:overflow-visible print:h-auto print:block">
          <button 
            onClick={() => setSidebarAperta(!sidebarAperta)}
            className="absolute top-4 left-4 z-30 p-1.5 rounded-md bg-(--color-surface) border border-(--color-border) text-(--color-muted) hover:text-(--color-text) cursor-pointer print:hidden shadow-xs"
            title="Mostra/Nascondi Storico"
          >
            {sidebarAperta ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </button>

          <div className="shrink-0 border-b border-(--color-border) bg-(--color-surface) pl-14 pr-6 md:px-16 py-3 flex items-center justify-end gap-3 z-20 print:hidden">
            <button
              type="button"
              onClick={() => setMostraGuida((prev) => !prev)}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition outline-none cursor-pointer shadow-xs ${
                mostraGuida
                  ? "border-(--color-text) bg-(--color-text) text-(--color-surface)"
                  : "border-(--color-border) bg-(--color-surface) text-(--color-text) hover:border-(--color-text)"
              }`}
            >
              <Info size={13} className="opacity-80" />
              <span className="hidden sm:inline">Guida Operativa</span>
            </button>

            <button
              type="button"
              onClick={() => setMostraImpostazioni((prev) => !prev)}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition outline-none cursor-pointer shadow-xs ${
                mostraImpostazioni
                  ? "border-(--color-text) bg-(--color-text) text-(--color-surface)"
                  : "border-(--color-border) bg-(--color-surface) text-(--color-text) hover:border-(--color-text)"
              }`}
            >
              <Settings2 size={13} className="opacity-80" />
              <span className="hidden sm:inline">Parametri Avanzati</span>
            </button>

            <button
              type="button"
              onClick={() => setShowDocsModal(true)}
              className="inline-flex items-center gap-2 rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-(--color-text) hover:border-(--color-text) transition outline-none cursor-pointer shadow-xs"
            >
              <FileText size={13} className="opacity-80" />
              <span>Allegati ({attachedDocs.length}/{LIMITE_MASSIMO_DOCUMENTI})</span>
            </button>
          </div>

          <AnimatePresence>
            {mostraGuida && (
              <motion.section
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="border-b border-(--color-border) bg-(--color-surface)/80 backdrop-blur-md overflow-hidden shrink-0 z-20 print:hidden"
              >
                <div className="p-6 mx-auto max-w-5xl grid gap-8 lg:grid-cols-[1.6fr_1fr] items-center">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-(--color-muted)">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Guida Operativa • Mappa Dialettica
                    </div>
                    <h3 className="text-sm sm:text-base font-medium tracking-tight text-(--color-text)" style={{ fontFamily: "var(--font-serif)" }}>
                      Dall&apos;analisi del quesito alla costruzione della strategia difensiva.
                    </h3>
                    <p className="text-xs leading-relaxed text-(--color-muted) font-light">
                      Jurio scompone il caso in orientamenti <strong className="text-(--color-text) font-normal">favorevoli e contrari</strong>, incrociando banche dati e fascicolo. Usa l&apos;<strong>Approfondimento</strong> per perfezionare la ricerca e generare la sintesi finale.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 bg-(--color-bg)/50 p-3 rounded-xl border border-(--color-border)">
                    <RiquadroFonte 
                      attivo={configurazione.sourceWeb} 
                      etichetta="Web Giuridico" 
                      descrizione="Portali e giurisprudenza online." 
                    />
                    <RiquadroFonte 
                      attivo={configurazione.sourceInternalDB} 
                      etichetta="Banca Dati" 
                      descrizione="Archivio storico interno." 
                    />
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative print:h-auto print:overflow-visible print:block">
            <AnimatePresence mode="wait">
              <motion.div
                key="workspace-fisso" 
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="flex-1 flex flex-col h-full overflow-hidden print:h-auto print:overflow-visible print:block"
              >
                <WorkspaceIndagine 
                  sessioneId={sessioneAttivaId} 
                  onSessionCreated={handleCambioSessione}
                  configurazione={configurazione}
                  attachedDocs={attachedDocs}
                  onOpenDocsModal={() => setShowDocsModal(true)}
                  onRemoveAttachment={removeAttachment}
                  onSyncDocs={handleSyncDocs}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      <DocumentSelectorPanel
        isOpen={showDocsModal}
        onClose={() => setShowDocsModal(false)}
        archiveDocs={archiveDocs}
        attachedDocs={attachedDocs}
        onToggleDoc={toggleDocSelection}
        onProcessFiles={processFilesParallel}
        onToggleFascicoloLink={handleToggleFascicoloLink}
        isLoading={isLoadingData}
        isProcessing={isProcessingFiles}
        onRenameDocumento={handleRenameDocumento}
        onDeleteDocumento={handleDeleteDocumento}
      />

      <AnalysisSettingsSection
        isOpen={mostraImpostazioni}
        onClose={() => setMostraImpostazioni(false)}
        config={configurazione}
        setConfig={setConfigurazione}
        isProcessing={false}
        canStart={true}
        onStartAnalysis={() => setMostraImpostazioni(false)}
      />

      <ConfirmModal
        isOpen={Boolean(sessioneDaEliminare)}
        title="Elimina Indagine"
        message={`Sei sicuro di voler eliminare definitivamente l'indagine "${sessioneDaEliminare?.titolo}"? L'azione non può essere annullata.`}
        confirmText="Elimina"
        cancelText="Annulla"
        onConfirm={handleConfermaEliminazione}
        onCancel={() => setSessioneDaEliminare(null)}
      />
    </div>
  );
};

export default ApprofondimentoGiurisprudenziale;