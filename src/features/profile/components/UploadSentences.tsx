import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MassimaCard } from "@/features/document/components/Massima";
import { AccessDenied } from "@/shared/components/AccessDenied";
import { ConfirmModal } from "@/shared/components/ConfirmModal";
import { vectorSearch } from "@/features/search/hooks/vectorSearch"; 
import type { DocumentoGiurisprudenziale } from "@/interfaces/interfaces";
import { trackEvent } from "@/infrastructure/analytics";
import { usePdfAnalyzer } from "@/features/profile/hooks/usePdfAnalyzer";
import { Loader2 } from "lucide-react";
import { FaCloud } from "react-icons/fa";

import { UploadDropzone } from "./UploadDropzone";
import { ExtractedTextModal } from "./ExtractedTextModal";
import { VectorSearchResults } from "./VectorSearchResults";
import { CloudPickerModal } from "./CloudPickerModal"; 

// --- IMPORTA IL NUOVO COMPONENTE ---
import { PromptSelector } from "@/shared/components/PromptSelector"; // Controlla che il path sia corretto!

export const Upload: React.FC = () => {
  const {
    file,
    dragActive,
    loading,
    progress,
    extractedText,
    analysisResult,
    inputRef,
    analyzeReason,
    handleDrag,
    setFile,
    setExtractedText,
    setAnalysisResult,
    validatePdf,
    denyOpen,
    isDuplicateModalOpen, 
    setIsDuplicateModalOpen,
    executeAnalysis,
    duplicateId,
  } = usePdfAnalyzer();

  const [showText, setShowText] = useState(false);
  const [uiProgress, setUiProgress] = useState(0);
  const progressRef = useRef(0);

  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [visibleAllMatches, setVisibleAllMatches] = useState<DocumentoGiurisprudenziale[]>([]);
  const [isSearchingVector, setIsSearchingVector] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const searchCache = useRef<DocumentoGiurisprudenziale[] | null>(null);

  // --- STATO SINGOLO PER IL PROMPT (Tutto il resto lo fa PromptSelector) ---
  const [selectedPromptId, setSelectedPromptId] = useState<string>("default");

  const parsedResult = analysisResult ? JSON.parse(analysisResult) : null;
  const hasMassima = !!parsedResult?.massima;
  const hasFattispecie = !!parsedResult?.fattispecie_rilevante;

  // --- ESECUZIONE ANALISI CON PROMPT ---
  const handleAnalyzeClick = () => {
    analyzeReason(selectedPromptId); 
  };

  useEffect(() => {
    setVisibleAllMatches([]);
    setHasSearched(false);
    searchCache.current = null;
  }, [analysisResult]);

  useEffect(() => {
    progressRef.current = uiProgress;
  }, [uiProgress]);

  useEffect(() => {
    let finishTimer: NodeJS.Timeout;
    let resetTimer: NodeJS.Timeout;

    if (!loading) {
      const currentProgress = progressRef.current;
      
      if (currentProgress > 0 && currentProgress < 100) {
        finishTimer = setTimeout(() => {
          setUiProgress(100);
          resetTimer = setTimeout(() => setUiProgress(0), 450);
        }, 0);
      }
      return () => {
        clearTimeout(finishTimer);
        clearTimeout(resetTimer);
      };
    }

    setTimeout(() => setUiProgress(0), 0);

    const target = 92;
    const durationMs = 60_000;
    const tickMs = 120;
    const start = Date.now();

    const intervalTimer = setInterval(() => {
      const elapsed = Date.now() - start;
      const t = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.min(target, Math.round(eased * target));
      setUiProgress((prev) => (next > prev ? next : prev));
    }, tickMs);

    return () => clearInterval(intervalTimer);
  }, [loading]);

  useEffect(() => {
      if (showText || denyOpen || isCloudModalOpen) {
        document.body.style.overflow = "hidden";
      } else {
        document.body.style.overflow = "unset";
      }
      return () => {
        document.body.style.overflow = "unset";
      };
  }, [showText, denyOpen, isCloudModalOpen]);

  const handleVectorSearch = async () => {
    if (hasSearched) return;
    
    if (searchCache.current) {
      setVisibleAllMatches(searchCache.current);
      setHasSearched(true);
      return;
    }

    try {
      setIsSearchingVector(true);
      setVisibleAllMatches([]); 
      
      const queryText = [parsedResult?.massima, parsedResult?.fattispecie_rilevante]
        .filter(Boolean)
        .join(" ");
      
      const response = await vectorSearch(queryText, [], 15);
      
      if (response && response.allMatches) {
        const results = response.allMatches as unknown as DocumentoGiurisprudenziale[];
        searchCache.current = results;
        setVisibleAllMatches(results);
      }
      
      setHasSearched(true);
    } catch (error) {
      console.error("Errore durante la ricerca analoga:", error);
      setHasSearched(false);
    } finally {
      setIsSearchingVector(false);
    }
  };

  const handleClick = (doc: DocumentoGiurisprudenziale) => {
    trackEvent("sentence_opened", { source: "search" });
    const target = window.innerWidth < 768 ? "_self" : "_blank";
    window.open(`/giurisprudenza/${doc.id}`, target);
  };

  const handleSelectCloudFile = async (
    cloudFile: { name: string; blob: Blob }
  ) => {
    try {
      const fileObj = new File(
        [cloudFile.blob],
        cloudFile.name,
        {
          type:
            cloudFile.blob.type ||
            "application/pdf",
        }
      );

      // Usiamo esattamente lo stesso oggetto File
      // che usa l'upload locale.
      if (!validatePdf([fileObj] as unknown as FileList)) {
        return;
      }

      setFile(fileObj);
      setExtractedText("");
      setAnalysisResult(null);

      setVisibleAllMatches([]);
      setHasSearched(false);
      searchCache.current = null;

      setIsCloudModalOpen(false);
    } catch (error) {
      console.error(
        "Errore importazione file da Google Drive:",
        error
      );
    }
  };

  return (
    <div className="w-full mx-auto max-w-5xl pb-16 px-4 md:px-0">
      <div className="flex flex-col lg:flex-row gap-8 mb-8">
        <div className="flex-1 flex flex-col justify-center text-start">
          <h1 className="text-2xl sm:text-3xl font-medium mb-3 text-(--color-text) tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
            Analizza un documento
          </h1>
          <p className="text-xs sm:text-sm text-(--color-muted) font-light leading-relaxed mb-4">
            Carica un provvedimento giurisprudenziale (sentenza, ordinanza o decreto) in
            <strong className="font-semibold text-(--color-text)"> qualsiasi formato (inclusi PDF, Word, EML, PPT, XLSX, immagini o tracce audio MP3)</strong>, trascinandolo qui, selezionandolo dal computer o importandolo direttamente dal tuo Cloud.
          </p>

          <div>
            <button
              type="button"
              onClick={() => setIsCloudModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-(--color-border) bg-(--color-surface) text-(--color-text) text-xs font-bold uppercase tracking-widest hover:border-(--color-text) transition-all shadow-xs outline-none"
            >
              <FaCloud className="text-blue-500" size={14} />
              <span>Importa dal Cloud</span>
            </button>
          </div>
        </div>

        <div className="flex-1">
          <UploadDropzone
            file={file}
            dragActive={dragActive}
            loading={loading}
            progress={progress}
            uiProgress={uiProgress}
            inputRef={inputRef}
            handleDrag={(e) => handleDrag(e as React.DragEvent<HTMLElement>)}
            validateFile={validatePdf}
            setFile={setFile}
            setExtractedText={setExtractedText}
            setAnalysisResult={setAnalysisResult}
            setShowText={setShowText}
            setVisibleAllMatches={setVisibleAllMatches}
            setHasSearched={setHasSearched}
          />
        </div>
      </div>

      {/* --- BOX AZIONI PRE-ANALISI --- */}
      {extractedText && !analysisResult && (
        <div className="relative w-full p-5 bg-(--color-surface) border border-(--color-border) rounded-lg flex flex-col gap-4 shadow-(--shadow-soft) overflow-hidden mt-6">
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
            
            {/* SELETTORE PROMPT (A sinistra) */}
            <div className="w-full md:w-auto md:min-w-70">
              <PromptSelector 
                value={selectedPromptId}
                onChange={setSelectedPromptId}
                disabled={loading}
                label="Modello di Analisi" 
              />
            </div>
          </div>
          <hr className="border-(--color-border)" />

          {/* Pulsante Submit */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
            {/* Controllo Testo */}
            <div className="flex items-center flex-wrap gap-1.5 text-(--color-muted) font-light text-xs sm:text-sm">
              <span>Per verificare o correggere il testo estratto,</span>
              <button
                type="button"
                onClick={() => setShowText(true)}
                className="text-(--color-text) font-semibold underline text-xs sm:text-sm hover:opacity-80 focus-visible:ring-2 focus-visible:ring-blue-500 rounded transition-all outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                visualizza il documento sorgente
              </button>
            </div>

            {/* Bottone di Azione Principale */}
            <button
              type="button"
              onClick={handleAnalyzeClick}
              disabled={loading}
              className="px-6 py-2.5 rounded-md bg-(--color-text) text-(--color-surface) text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all shadow-xs disabled:opacity-30 disabled:cursor-not-allowed outline-none flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              <span>{selectedPromptId === "default" ? "Analizza il documento" : "Esegui Prompt Custom"}</span>
            </button>
          </div>
        </div>
      )}

      <ExtractedTextModal
        showText={showText}
        setShowText={setShowText}
        extractedText={extractedText}
        setExtractedText={setExtractedText}
        loading={loading}
      />

      <CloudPickerModal
        isOpen={isCloudModalOpen}
        onClose={() => setIsCloudModalOpen(false)}
        onSelectFile={handleSelectCloudFile}
      />

      <AnimatePresence>
        {parsedResult && file && (
          <motion.div
            key="massimaCard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4 }}
            className="mt-10"
          >
            <MassimaCard result={parsedResult} file={URL.createObjectURL(file)} />
            
            <VectorSearchResults
              hasMassima={hasMassima}
              hasFattispecie={hasFattispecie}
              isSearchingVector={isSearchingVector}
              hasSearched={hasSearched}
              visibleAllMatches={visibleAllMatches}
              handleVectorSearch={handleVectorSearch}
              handleClick={handleClick}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {denyOpen && <AccessDenied />}
      </AnimatePresence>

      <ConfirmModal
        isOpen={isDuplicateModalOpen}
        title="Attenzione: Documento Duplicato"
        message={file ? `Il documento "${file.name}" è già stato caricato in precedenza. Lo vuoi sovrascrivere?` : "Documento già presente. Lo vuoi sovrascrivere?"}
        confirmText="Sì, sovrascrivi"
        cancelText="Annulla"
        onConfirm={() => {
          setIsDuplicateModalOpen(false); 
          executeAnalysis(selectedPromptId, duplicateId || undefined);
        }}
        onCancel={() => setIsDuplicateModalOpen(false)}
      />
    </div>
  );
};