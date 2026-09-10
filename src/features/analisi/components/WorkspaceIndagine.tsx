// src/features/analisi/components/WorkspaceIndagine.tsx

import React, { useState, useRef, useEffect } from "react";
import { useDeepAnalysisSession } from "../hooks/useDeepAnalysis";
import { ReportSintesi } from "./ReportSintesi";
import { ExecutionLogModal, type LogStep } from "./ExecutionLogModal";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { DraftPhase } from "./DraftPhase";
import { ReviewPhase } from "./ReviewPhase";
import type { AttachedDocument } from "@/interfaces/interfaces";
import type { DeepAnalysisConfig, PrecedenteReperito } from "../hooks/types";

interface Props {
  sessioneId: string | null;
  onSessionCreated: (id: string) => void;
  configurazione: DeepAnalysisConfig;
  attachedDocs: AttachedDocument[];
  onOpenDocsModal: () => void;
  onRemoveAttachment: (id: string) => void;
  onSyncDocs: (docs: AttachedDocument[]) => void;
}

export const WorkspaceIndagine: React.FC<Props> = ({
  sessioneId,
  onSessionCreated,
  configurazione,
  attachedDocs,
  onSyncDocs,
}) => {
  const {
    activeSession,
    isProcessing,
    updateTitle,
    toggleEsclusionePrecedente,
    avviaRicercaPrecedenti,
    avviaIntegrazioneRicerca,
    avviaGenerazioneSintesi,
    isLogModalOpen,
    setIsLogModalOpen,
    isCompleted
  } = useDeepAnalysisSession(sessioneId);

  const [titoloLocale, setTitoloLocale] = useState<string | null>(null);
  const [quesitoLocale, setQuesitoLocale] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  const [mostraHitlBox, setMostraHitlBox] = useState(false);
  const [direttivaPersonalizzata, setDirettivaPersonalizzata] = useState("");
  const [messaggioEsito, setMessaggioEsito] = useState<{ tipo: 'info' | 'success'; testo: string } | null>(null);
  const [logModalTitle, setLogModalTitle] = useState("");
  const [executionSteps, setExecutionSteps] = useState<LogStep[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const titoloEditabile = titoloLocale !== null ? titoloLocale : (activeSession?.title || "Approfondimento Giurisprudenziale");
  const quesito = quesitoLocale !== null ? quesitoLocale : (activeSession?.promptOriginale || "");

  const [prevSessionId, setPrevSessionId] = useState(sessioneId);

  if (prevSessionId !== sessioneId) {
    setPrevSessionId(sessioneId);
    setTitoloLocale(null);
    setQuesitoLocale(null);
    setIsEditingTitle(false);
    setMostraHitlBox(false);
    setDirettivaPersonalizzata("");
    setMessaggioEsito(null);
  }

  useEffect(() => {
    if (activeSession?.documentiAllegati && activeSession.documentiAllegati.length > 0) {
      onSyncDocs(activeSession.documentiAllegati as unknown as AttachedDocument[]);
    } else {
      onSyncDocs([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession?.id]);

  const handleSalvaTitolo = () => {
    setIsEditingTitle(false);
    if (activeSession && titoloEditabile.trim() !== activeSession.title) {
      updateTitle(titoloEditabile.trim());
    }
  };

  const handleApriHitlConPreset = (preset: string) => {
    setDirettivaPersonalizzata(preset);
    setMostraHitlBox(true);
    setMessaggioEsito(null);
  };

  const handleEseguiRicercaConLog = async () => {
    if (!quesito.trim()) return;

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setLogModalTitle("Costruzione Mappa Dialettica Iniziale");
    setIsLogModalOpen(true);

    const ora = new Date().toLocaleTimeString();
    setExecutionSteps([
      { id: '1', timestamp: ora, message: "Inizializzazione parametri di ricerca e filtri di confidenza...", status: "success" },
      { id: '2', timestamp: ora, message: "Interrogazione dei tool attivi (Database Interno, Web Search, Fascicolo)...", status: "pending" }
    ]);

    try {
      setTimeout(() => {
        setExecutionSteps(prev => [
          ...prev.map(s => s.id === '2' ? { ...s, status: 'success' as const } : s),
          { id: '3', timestamp: new Date().toLocaleTimeString(), message: "Analisi multi-turno e strutturazione tesi Favorevole/Contraria...", status: "pending" }
        ]);
      }, 2000);

      await avviaRicercaPrecedenti(quesito, configurazione, attachedDocs, onSessionCreated, signal);

      setExecutionSteps(prev => [
        ...prev.map(s => s.id === '3' ? { ...s, status: 'success' as const } : s),
        { id: '4', timestamp: new Date().toLocaleTimeString(), message: "Mappa Dialettica completata e persistita su Firestore.", status: "success" }
      ]);

      setTimeout(() => setIsLogModalOpen(false), 850);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Errore imprevisto durante l'indagine.";
      console.error("Dettaglio errore:", err);

      setExecutionSteps((prev) => [
        ...prev.map((s) => s.status === "pending" ? { ...s, status: "error" as const } : s),
        {
          id: "err",
          timestamp: new Date().toLocaleTimeString(),
          message: `Fallito: ${errorMsg}`,
          status: "error" as const,
        },
      ]);
    }
  };

  const handleEseguiHitlAction = async () => {
    if (!direttivaPersonalizzata.trim()) return;
    const direttivaInvio = direttivaPersonalizzata;
    setMostraHitlBox(false);
    setDirettivaPersonalizzata("");
    setMessaggioEsito(null);

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setLogModalTitle("Approfondimento Mirato in Corso");
    setIsLogModalOpen(true);

    const ora = new Date().toLocaleTimeString();
    setExecutionSteps([
      { id: '1', timestamp: ora, message: `Ricevuta direttiva: "${direttivaInvio}"`, status: "success" },
      { id: '2', timestamp: ora, message: "Estrazione ID già acquisiti ed esclusione duplicati...", status: "success" },
      { id: '3', timestamp: ora, message: "Esecuzione ricerca mirata con i tool di backend...", status: "pending" }
    ]);

    const fontiFavOld = activeSession?.mappaDialettica?.orientamentoFavorevole?.fonti || [];
    const fontiContOld = activeSession?.mappaDialettica?.orientamentoContrario?.fonti || [];
    
    // Creiamo un Set con gli ID già presenti prima dell'affondo
    const oldIds = new Set([
      ...fontiFavOld.map((f: { id: string }) => f.id),
      ...fontiContOld.map((f: { id: string }) => f.id)
    ]);

    try {
      const result = await avviaIntegrazioneRicerca(direttivaInvio, signal);

      setExecutionSteps(prev => [
        ...prev.map(s => s.id === '3' ? { ...s, status: 'success' as const } : s),
        { id: '4', timestamp: new Date().toLocaleTimeString(), message: "Merge delle fonti e validazione schema Zod completati.", status: "success" }
      ]);

      const mappaAggiornata = result?.mappaDialettica || result;
      const fontiFavNew = mappaAggiornata?.orientamentoFavorevole?.fonti || [];
      const fontiContNew = mappaAggiornata?.orientamentoContrario?.fonti || [];

      // Calcoliamo esattamente quante nuove fonti hanno un ID inedito
      const tutteLeNuoveFonti = [...fontiFavNew, ...fontiContNew];
      const fontiEffettivamenteNuove = tutteLeNuoveFonti.filter((f: { id: string }) => !oldIds.has(f.id));
      const aggiunte = fontiEffettivamenteNuove.length;

      if (aggiunte === 0) {
        setMessaggioEsito({
          tipo: 'info',
          testo: "L'Approfondimento è completato, ma non sono emerse nuove fonti o argomentazioni inedite rispetto a quelle già mappate."
        });
      } else {
        setMessaggioEsito({
          tipo: 'success',
          testo: `Approfondimento completato con successo: integrati ${aggiunte} nuovi elementi/fonti nella mappa.`
        });
      }

      setTimeout(() => setIsLogModalOpen(false), 850);
    } catch (err: unknown) {
      console.error(err);
      const errorMsg = err instanceof Error ? err.message : "Errore imprevisto durante l'approfondimento.";
      
      setExecutionSteps((prev) => [
        ...prev.map((s) => s.status === "pending" ? { ...s, status: "error" as const } : s),
        {
          id: "err",
          timestamp: new Date().toLocaleTimeString(),
          message: `Fallito: ${errorMsg}`,
          status: "error" as const,
        },
      ]);
    }
  };

  const fontiFav = activeSession?.mappaDialettica?.orientamentoFavorevole?.fonti || [];
  const fontiCont = activeSession?.mappaDialettica?.orientamentoContrario?.fonti || [];
  const tutteLeFonti: PrecedenteReperito[] = [...fontiFav, ...fontiCont];
  const fontiApprovateCount = tutteLeFonti.filter((p: PrecedenteReperito) => !p.escluso).length;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative print:h-auto print:overflow-visible print:block">
      <ExecutionLogModal
        isOpen={isLogModalOpen}
        title={logModalTitle}
        steps={executionSteps}
      />

      <div className="print:hidden">
        <WorkspaceHeader
          activeSession={activeSession}
          titoloEditabile={titoloEditabile}
          isEditingTitle={isEditingTitle}
          setIsEditingTitle={setIsEditingTitle}
          setTitoloLocale={setTitoloLocale}
          handleSalvaTitolo={handleSalvaTitolo}
          isProcessing={isProcessing}
        />
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin print:overflow-visible print:h-auto print:block">
        <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 pb-32 space-y-8 print:py-0 print:pb-0">
          {(!activeSession || activeSession.status === "draft")  && !isCompleted && (
            <DraftPhase
              quesito={quesito}
              setQuesito={setQuesitoLocale}
              isProcessing={isProcessing}
              onEseguiRicerca={handleEseguiRicercaConLog}
            />
          )}
          {activeSession?.status === "review" && activeSession?.mappaDialettica && !isCompleted &&(
            <ReviewPhase
              activeSession={activeSession}
              messaggioEsito={messaggioEsito}
              setMessaggioEsito={setMessaggioEsito}
              onApriHitlPreset={handleApriHitlConPreset}
              toggleEsclusionePrecedente={toggleEsclusionePrecedente}
              mostraHitlBox={mostraHitlBox}
              setMostraHitlBox={setMostraHitlBox}
              direttivaPersonalizzata={direttivaPersonalizzata}
              setDirettivaPersonalizzata={setDirettivaPersonalizzata}
              handleEseguiHitlAction={handleEseguiHitlAction}
              isProcessing={isProcessing}
              avviaGenerazioneSintesi={avviaGenerazioneSintesi}
              fontiApprovateCount={fontiApprovateCount}
            />
          )}

            {((activeSession?.status === "completed" || isCompleted) && activeSession?.sintesiStrategica) && (
              <ReportSintesi session={activeSession} />
            )}
        </div>
      </div>
    </div>
  );
};