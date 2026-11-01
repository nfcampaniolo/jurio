import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MassimaCard } from "@/features/document/components/Massima";
import { AccessDenied } from "@/shared/components/AccessDenied";
import { ConfirmModal } from "@/shared/components/ConfirmModal";
import { vectorSearch } from "@/features/search/hooks/vectorSearch"; 
import type { DocumentoGiurisprudenziale } from "@/interfaces/interfaces";
import { trackEvent } from "@/infrastructure/analytics";
import { usePdfAnalyzer } from "@/features/profile/hooks/usePdfAnalyzer";
import { FiX } from "react-icons/fi";
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
    sourceFiles,
    dragActive,
    loading,
    progress,
    extractedText,
    analysisResult,
    inputRef,
    analyzeReason,
    handleDrag,
    setFile,
    setSourceFiles,
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
  const [sourceFileUrl, setSourceFileUrl] = useState<string | null>(null);
  const [visibleAllMatches, setVisibleAllMatches] = useState<DocumentoGiurisprudenziale[]>([]);
  const [isSearchingVector, setIsSearchingVector] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const searchCache = useRef<DocumentoGiurisprudenziale[] | null>(null);
  const [selectedDocumentIndex, setSelectedDocumentIndex] = useState<number | null>(null);

  // --- STATO SINGOLO PER IL PROMPT (Tutto il resto lo fa PromptSelector) ---
  const [selectedPromptId, setSelectedPromptId] = useState<string>("default");

  const parsedPayload = analysisResult ? JSON.parse(analysisResult) : null;
  const parsedResults = Array.isArray(parsedPayload)
    ? parsedPayload as DocumentoGiurisprudenziale[]
    : parsedPayload ? [parsedPayload as DocumentoGiurisprudenziale] : [];
  const parsedResult = selectedDocumentIndex === null ? null : parsedResults[selectedDocumentIndex] ?? null;
  const documentSourceFile = parsedResult
    ? sourceFiles.find((sourceFile) => sourceFile.name === parsedResult.nome_file) || file
    : file;
  const hasMassima = !!parsedResult?.massima;
  const hasFattispecie = !!parsedResult?.fattispecie_rilevante;

  // --- ESECUZIONE ANALISI CON PROMPT ---
  const handleAnalyzeClick = () => {
    void analyzeReason(selectedPromptId); 
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
      if (showText || denyOpen || isCloudModalOpen || selectedDocumentIndex !== null) {
        document.body.style.overflow = "hidden";
      } else {
        document.body.style.overflow = "unset";
      }
      return () => {
        document.body.style.overflow = "unset";
      };
  }, [showText, denyOpen, isCloudModalOpen, selectedDocumentIndex]);

  useEffect(() => {
    setSelectedDocumentIndex(null);
  }, [analysisResult]);

  useEffect(() => {
    if (!documentSourceFile) {
      setSourceFileUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(documentSourceFile);
    setSourceFileUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [documentSourceFile]);

  useEffect(() => {
    if (selectedDocumentIndex === null) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedDocumentIndex(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedDocumentIndex]);

  useEffect(() => {
    setVisibleAllMatches([]);
    setHasSearched(false);
    searchCache.current = null;
  }, [selectedDocumentIndex]);

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
    void trackEvent("sentence_opened", { source: "search" });
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
            Carica fino a 10 provvedimenti giurisprudenziali (sentenze, ordinanze o decreti) in
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
            sourceFiles={sourceFiles}
            dragActive={dragActive}
            loading={loading}
            progress={progress}
            uiProgress={uiProgress}
            inputRef={inputRef}
            handleDrag={(e) => handleDrag(e as React.DragEvent<HTMLElement>)}
            validateFile={validatePdf}
            setFile={setFile}
            setSourceFiles={setSourceFiles}
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

      {parsedResults.length > 0 && (
        <section className="mt-10 rounded-lg border border-(--color-border) bg-(--color-surface) p-5 text-left shadow-(--shadow-soft)" aria-label="Documenti estratti">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-medium text-(--color-text)" style={{ fontFamily: "var(--font-serif)" }}>Documenti individuati</h2>
            <span className="text-xs text-(--color-muted)">{parsedResults.length} {parsedResults.length === 1 ? "documento" : "documenti"}</span>
          </div>
          <ul className="divide-y divide-(--color-border)">
            {parsedResults.map((doc, index) => {
              const title = [doc.organo_giudicante, doc.numero_sentenza, doc.data_sentenza]
                .filter(Boolean).join(" · ") || doc.nome_file || `Documento ${index + 1}`;
              return (
                <li key={`${doc.numero_sentenza || doc.nome_file || "documento"}-${index}`} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-(--color-text)">{title}</h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-(--color-muted)">{doc.massima || doc.summary || "Documento giuridico estratto"}</p>
                  </div>
                  <button type="button" onClick={() => setSelectedDocumentIndex(index)} className="shrink-0 rounded-md bg-(--color-text) px-4 py-2 text-xs font-bold uppercase tracking-widest text-(--color-surface) hover:opacity-90">
                    Apri documento
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <AnimatePresence>
        {parsedResult && file && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" aria-label="Chiudi documento" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedDocumentIndex(null)} />
            <motion.div role="dialog" aria-modal="true" aria-label="Documento completo" initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.98 }} className="relative z-10 flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-lg border border-(--color-border) bg-(--color-bg) shadow-2xl">
              <header className="flex shrink-0 items-center justify-between border-b border-(--color-border) bg-(--color-surface) px-5 py-3">
                <h2 className="text-sm font-semibold text-(--color-text)">Documento completo {parsedResults.length > 1 ? `(${(selectedDocumentIndex ?? 0) + 1} di ${parsedResults.length})` : ""}</h2>
                <button type="button" onClick={() => setSelectedDocumentIndex(null)} aria-label="Chiudi modale" className="rounded-md p-2 text-(--color-muted) hover:bg-(--color-bg) hover:text-(--color-text)"><FiX size={18} /></button>
              </header>
              <div className="overflow-y-auto p-3 sm:p-6">
                <MassimaCard result={parsedResult} file={sourceFileUrl} />
                <VectorSearchResults
                  hasMassima={hasMassima}
                  hasFattispecie={hasFattispecie}
                  isSearchingVector={isSearchingVector}
                  hasSearched={hasSearched}
                  visibleAllMatches={visibleAllMatches}
                  handleVectorSearch={handleVectorSearch}
                  handleClick={handleClick}
                />
              </div>
            </motion.div>
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
          void executeAnalysis(selectedPromptId, duplicateId || undefined);
        }}
        onCancel={() => setIsDuplicateModalOpen(false)}
      />
    </div>
  );
};
