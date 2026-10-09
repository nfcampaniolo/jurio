"use client";

import React from "react";
import { FiUploadCloud, FiX, FiSave, FiTrash2, FiFileText, FiLink } from "react-icons/fi";
import { useSingleDocumentUpload } from "../hooks/useSingleDocumentUpload";

export const UploadDoctrine: React.FC = () => {
  const {
    file,
    url,
    setUrl,
    extractedText,
    setExtractedText,
    dragActive,
    setDragActive,
    loading,
    isExtracting,
    inputRef,
    handleFileSelect,
    removeFile,
    resetForm,
    validateAndSubmit,
  } = useSingleDocumentUpload();

  const handleContainerClick = () => {
    if (loading || isExtracting) return;
    inputRef.current?.click();
  };

  const handleContainerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (loading || isExtracting) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  return (
    <div className="w-full mx-auto max-w-5xl text-start px-4 md:px-0">
      {/* HEADER */}
      <header className="mb-8">
        <h1
          className="text-2xl md:text-3xl font-medium mb-2 text-(--color-text) tracking-tight"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Inserimento Dottrina Singola
        </h1>
        <p className="text-xs sm:text-sm text-(--color-muted) font-light leading-relaxed">
          Carica un singolo documento PDF, fornisci l'URL ufficiale della fonte e il testo estratto per
          avviare l'indicizzazione tematica.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* COLONNA SINISTRA: UPLOAD PDF */}
        <section className="flex flex-col gap-6">
          <div
            role="button"
            tabIndex={loading || isExtracting ? -1 : 0}
            aria-disabled={loading || isExtracting}
            className={`relative w-full overflow-hidden rounded-lg border-2 border-dashed p-8 text-left transition-all outline-none h-70 flex flex-col items-center justify-center
              ${
                dragActive
                  ? "border-(--color-text) bg-(--color-bg)"
                  : "border-(--color-border) bg-(--color-surface)"
              }
              ${
                loading || isExtracting
                  ? "opacity-70 cursor-not-allowed"
                  : "cursor-pointer hover:border-(--color-text)"
              }
              shadow-(--shadow-soft)
            `}
            onDragEnter={(e) => {
              if (loading || isExtracting) return;
              e.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(e) => {
              if (loading || isExtracting) return;
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(e) => {
              if (loading || isExtracting) return;
              e.preventDefault();
              setDragActive(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (loading || isExtracting) return;

              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                void handleFileSelect(e.dataTransfer.files[0]);
              }
            }}
            onClick={handleContainerClick}
            onKeyDown={handleContainerKeyDown}
          >
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

            {!file ? (
              <div className="flex flex-col items-center text-center">
                <div
                  className={`mb-4 grid h-14 w-14 place-items-center rounded-md border
                    ${
                      dragActive
                        ? "border-(--color-text) bg-(--color-bg)"
                        : "border-(--color-border) bg-(--color-bg)"
                    }
                  `}
                >
                  <FiUploadCloud className="text-(--color-text) opacity-70" size={26} />
                </div>
                <p className="text-base font-medium text-(--color-text) tracking-tight">
                  Trascina qui il file PDF
                </p>
                <p className="mt-1 text-xs text-(--color-muted) font-light">
                  oppure{" "}
                  <span className="text-(--color-text) font-bold underline underline-offset-2">
                    seleziona file
                  </span>
                </p>
              </div>
            ) : (
              <div
                className="w-full flex flex-col items-center text-center relative z-10"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                role="presentation"
              >
                <div className="mb-4 grid h-14 w-14 place-items-center rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-600">
                  <FiFileText size={26} />
                </div>
                <p className="text-sm font-medium text-(--color-text) tracking-tight truncate max-w-full px-4">
                  {file.name}
                </p>
                <p className="mt-0.5 text-xs text-(--color-muted) font-light">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>

                {!loading && !isExtracting && (
                  <button
                    type="button"
                    onClick={() => {
                      void removeFile();
                    }}
                    className="mt-4 inline-flex items-center gap-2 rounded-md border border-red-500/20 bg-(--color-bg) px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors outline-none cursor-pointer"
                  >
                    <FiX size={12} /> Rimuovi
                  </button>
                )}
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept="application/pdf,.pdf"
              disabled={loading || isExtracting}
              onChange={(e) => {
                if (loading || isExtracting) return;

                if (e.target.files && e.target.files[0]) {
                  void handleFileSelect(e.target.files[0]);
                }
              }}
            />
          </div>
        </section>

        {/* COLONNA DESTRA: URL E TESTO */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="source-url" className="text-xs font-bold uppercase tracking-widest text-(--color-muted) flex items-center gap-2">
              <FiLink size={14} /> URL Fonte Originale *
            </label>
            <input
              id="source-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading || isExtracting}
              placeholder="https://www.cortedicassazione.it/..."
              className="w-full rounded-md border border-(--color-border) bg-(--color-surface) px-4 py-3 text-sm text-(--color-text) focus:border-(--color-primary) focus:ring-1 focus:ring-(--color-primary) transition-all outline-none shadow-xs disabled:opacity-60"
            />
          </div>

          <div className="flex flex-col gap-2 flex-1">
            <label htmlFor="extracted-text" className="text-xs font-bold uppercase tracking-widest text-(--color-muted) flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FiFileText size={14} /> Testo Estratto *
              </div>

              {isExtracting && (
                <span className="text-[10px] text-(--color-primary) flex items-center gap-1 animate-pulse">
                  <div className="h-3 w-3 border-2 border-(--color-primary) border-t-transparent rounded-full animate-spin" />
                  Estrazione in corso...
                </span>
              )}
            </label>
            <textarea
              id="extracted-text"
              value={extractedText}
              onChange={(e) => setExtractedText(e.target.value)}
              disabled={loading || isExtracting}
              placeholder={
                isExtracting
                  ? "Attendere, sto leggendo il PDF..."
                  : "Il testo estratto apparirà qui automaticamente. Puoi anche modificarlo o incollarlo a mano..."
              }
              className={`w-full flex-1 min-h-40 resize-none rounded-md border px-4 py-3 text-sm font-light transition-all outline-none shadow-xs
                ${
                  isExtracting
                    ? "border-(--color-primary)/50 bg-(--color-primary)/5 text-(--color-muted) cursor-wait"
                    : "border-(--color-border) bg-(--color-surface) text-(--color-text) focus:border-(--color-primary) focus:ring-1 focus:ring-(--color-primary) disabled:opacity-60"
                }
              `}
            />
          </div>
        </section>
      </div>

      {/* ACTION BAR */}
      <div className="mt-8 w-full p-4 bg-(--color-surface) border border-(--color-border) rounded-lg flex justify-between items-center shadow-xs">
        <button
          type="button"
          onClick={() => {
            void resetForm();
          }}
          disabled={loading || isExtracting}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-(--color-border) bg-(--color-bg) text-(--color-text) text-xs font-bold uppercase tracking-widest hover:bg-(--color-border)/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed outline-none cursor-pointer"
        >
          <FiTrash2 size={14} /> Svuota Campi
        </button>

        <button
          type="button"
          onClick={() => {
            void validateAndSubmit();
          }}
          disabled={loading || isExtracting || !file || !url || !extractedText}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-md bg-(--color-text) text-(--color-surface) text-xs font-bold uppercase tracking-widest hover:opacity-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed outline-none cursor-pointer"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-(--color-surface) border-t-transparent" />
          ) : (
            <FiSave size={14} />
          )}

          {loading ? "Elaborazione..." : "Elabora e Salva"}
        </button>
      </div>
    </div>
  );
};