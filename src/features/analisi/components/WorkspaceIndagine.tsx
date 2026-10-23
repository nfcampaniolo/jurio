import React, { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import { useDeepAnalysisSession } from "../hooks/useDeepAnalysis";
import { ReportSintesi } from "./ReportSintesi";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { DraftPhase } from "./DraftPhase";
import { ReviewPhase } from "./ReviewPhase";
import { AccessDenied } from "@/shared/components/AccessDenied";
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
    isCompleted,
    isAccessDenied
  } = useDeepAnalysisSession(sessioneId);

  const [titoloLocale, setTitoloLocale] = useState<string | null>(null);
  const [quesitoLocale, setQuesitoLocale] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  const [mostraHitlBox, setMostraHitlBox] = useState(false);
  const [direttivaPersonalizzata, setDirettivaPersonalizzata] = useState("");
  const [messaggioEsito, setMessaggioEsito] = useState<{ tipo: 'info' | 'success'; testo: string } | null>(null);
  const previousJobRef = useRef<{ id: string; status: string } | null>(null);

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

  useEffect(() => {
    const job = activeSession?.job;
    if (!job) return;

    const previous = previousJobRef.current;
    if (previous?.id === job.id && previous.status !== job.status) {
      if (job.status === "completed") {
        toast.success("Il risultato dell'approfondimento è pronto.");
      } else if (job.status === "failed") {
        toast.error("L'elaborazione non è riuscita. Puoi riprovare dall'indagine.");
      }
    }
    previousJobRef.current = { id: job.id, status: job.status };
  }, [activeSession?.job]);

  const handleSalvaTitolo = async () => {
    setIsEditingTitle(false);
    if (activeSession && titoloEditabile.trim() !== activeSession.title) {
      void updateTitle(titoloEditabile.trim());
    }
  };

  const handleApriHitlConPreset = (preset: string) => {
    setDirettivaPersonalizzata(preset);
    setMostraHitlBox(true);
    setMessaggioEsito(null);
  };

  const handleEseguiRicercaConLog = async () => {
    if (!quesito.trim()) return;
    try {
      await avviaRicercaPrecedenti(quesito, configurazione, attachedDocs, onSessionCreated);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Errore imprevisto durante l'indagine.";
      console.error("Dettaglio errore:", err);
      toast.error(errorMsg);
    }
  };

  const handleEseguiHitlAction = async () => {
    if (!direttivaPersonalizzata.trim()) return;
    const direttivaInvio = direttivaPersonalizzata;
    setMostraHitlBox(false);
    setDirettivaPersonalizzata("");
    setMessaggioEsito(null);

    try {
      await avviaIntegrazioneRicerca(direttivaInvio);
      setMessaggioEsito({ tipo: "info", testo: "Approfondimento avviato. Puoi continuare a usare Jurio; riceverai una notifica al completamento." });
    } catch (err: unknown) {
      console.error(err);
      const errorMsg = err instanceof Error ? err.message : "Errore imprevisto durante l'approfondimento.";
      toast.error(errorMsg);
    }
  };

  const handleGeneraSintesi = async () => {
    await avviaGenerazioneSintesi();
  };

  const fontiFav = activeSession?.mappaDialettica?.orientamentoFavorevole?.fonti || [];
  const fontiCont = activeSession?.mappaDialettica?.orientamentoContrario?.fonti || [];
  const tutteLeFonti: PrecedenteReperito[] = [...fontiFav, ...fontiCont];
  const fontiApprovateCount = tutteLeFonti.filter((p: PrecedenteReperito) => !p.escluso).length;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative print:h-auto print:overflow-visible print:block">
      {/* 🛡️ Access Gate attivabile in caso di 401/403 o permessi negati */}
      {isAccessDenied && <AccessDenied />}

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
              configurazione={configurazione}
              documentiAllegatiCount={attachedDocs.length}
            />
          )}
          {(activeSession?.job?.status === "queued" || activeSession?.job?.status === "processing") && (
            <section className="flex items-start gap-3 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4" role="status" aria-live="polite">
              <div className="mt-0.5 h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-blue-500" />
              <div>
                <p className="text-sm font-medium text-(--color-text)">
                  {activeSession.job.status === "queued" ? "Analisi in coda" : "Analisi in corso"}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-(--color-muted)">
                  {activeSession.progress?.message || "Stiamo elaborando la tua indagine."}
                  {" "}Puoi chiudere questa pagina: il lavoro prosegue sui nostri server.
                </p>
              </div>
            </section>
          )}
          {activeSession?.job?.status === "failed" && (
            <section className="rounded-xl border border-red-500/30 bg-red-500/5 p-4" role="alert">
              <p className="text-sm font-medium text-(--color-text)">Elaborazione non completata</p>
              <p className="mt-1 text-xs text-(--color-muted)">
                {activeSession.progress?.message || "Puoi riprovare l'analisi o la sintesi."}
              </p>
            </section>
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
              avviaGenerazioneSintesi={handleGeneraSintesi}
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