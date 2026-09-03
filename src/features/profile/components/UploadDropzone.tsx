import React from "react";
import { FiUploadCloud, FiX } from "react-icons/fi";
import type { DocumentoGiurisprudenziale } from "@/interfaces/interfaces";

interface UploadDropzoneProps {
  file: File | null;
  dragActive: boolean;
  loading: boolean;
  progress: string | null;
  uiProgress: number;
  inputRef: React.RefObject<HTMLInputElement | null>;
  handleDrag: (e: React.SyntheticEvent) => void;
  validateFile: (files: FileList) => void; // Rinominato per coerenza
  setFile: (file: File | null) => void;
  setExtractedText: (text: string | null) => void;
  setAnalysisResult: (res: string | null) => void;
  setShowText: (show: boolean) => void;
  setVisibleAllMatches: (matches: DocumentoGiurisprudenziale[]) => void;
  setHasSearched: (searched: boolean) => void;
}

export const UploadDropzone: React.FC<UploadDropzoneProps> = ({
  file,
  dragActive,
  loading,
  progress,
  uiProgress,
  inputRef,
  handleDrag,
  validateFile,
  setFile,
  setExtractedText,
  setAnalysisResult,
  setShowText,
  setVisibleAllMatches,
  setHasSearched,
}) => {
  return (
    <div
      role="button"
      tabIndex={loading ? -1 : 0}
      className={`relative w-full overflow-hidden rounded-lg border-2 border-dashed p-8 transition-all shadow-(--shadow-soft) text-left outline-none
        ${
          dragActive
            ? "border-(--color-text) bg-(--color-bg)"
            : "border-(--color-border) bg-(--color-surface)"
        }
        ${
          loading
            ? "opacity-70 cursor-not-allowed"
            : "cursor-pointer hover:border-(--color-text)"
        }
      `}
      onDragEnter={(e) => { if (!loading) handleDrag(e); }}
      onDragOver={(e) => { if (!loading) handleDrag(e); }}
      onDragLeave={(e) => { if (!loading) handleDrag(e); }}
      onDrop={(e) => {
        e.preventDefault();
        if (loading) return;
        if (e.dataTransfer.files) validateFile(e.dataTransfer.files);
      }}
      onClick={() => { if (!loading) inputRef.current?.click(); }}
      onKeyDown={(e) => {
        if (!loading && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
    >
      <div className="relative flex flex-col items-center text-center mt-2">
        <div className={`mb-4 grid h-14 w-14 place-items-center rounded-md border ${dragActive ? "border-(--color-text) bg-(--color-bg)" : "border-(--color-border) bg-(--color-bg)"}`}>
          <FiUploadCloud className="text-(--color-text) opacity-70" size={26} />
        </div>

        {!file ? (
          <>
            <p className="text-base font-medium text-(--color-text) tracking-tight">
              Trascina qui il file
            </p>
            <p className="mt-1 text-xs text-(--color-muted) font-light">
              oppure{" "}
              <span className="text-(--color-text) font-bold underline underline-offset-2">
                seleziona un file
              </span>
            </p>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-(--color-muted)">
              Qualsiasi formato accettato • 1 file alla volta
            </p>
          </>
        ) : (
          <div className="w-full max-w-xl">
            <div className="flex items-center justify-between gap-3 rounded-md border border-(--color-border) bg-(--color-bg) px-4 py-3">
              <div className="min-w-0 text-left">
                <p className="truncate text-xs font-medium text-(--color-text) tracking-tight">
                  {file.name}
                </p>
                <p className="mt-0.5 text-[10px] font-light text-(--color-muted)">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              {!loading && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setExtractedText(null);
                    setAnalysisResult(null);
                    setShowText(false);
                    setVisibleAllMatches([]);
                    setHasSearched(false);
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-(--color-border) bg-(--color-surface) text-(--color-muted) hover:text-red-600 hover:border-red-500/30 transition-colors relative z-10 outline-none"
                  aria-label="Rimuovi file"
                >
                  <FiX size={15} />
                </button>
              )}
            </div>
          </div>
        )}

        {loading && (
          <div className="mt-6 w-full max-w-xl">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-(--color-text) border-t-transparent" />
              <p className="self-center text-xs leading-none text-(--color-muted) font-light">
                {progress || "Analisi in corso…"}
              </p>
              <span className="ml-auto text-xs tabular-nums text-(--color-text) font-bold">
                {uiProgress}%
              </span>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-(--color-bg) border border-(--color-border)">
              <div
                className="h-full rounded-full bg-(--color-text) transition-[width] duration-200 ease-out"
                style={{ width: `${uiProgress}%` }}
              />
            </div>
          </div>
        )}

        <input
          type="file"
          ref={inputRef}
          className="hidden"
          /* Attributo accept rimosso per supportare tutti i tipi di file */
          disabled={loading}
          onChange={(e) => {
            if (loading) return;
            if (e.target.files) validateFile(e.target.files);
          }}
        />
      </div>
    </div>
  );
};