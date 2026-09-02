"use client";

import React from "react";
import { FiUploadCloud, FiX, FiPlay, FiStopCircle, FiTrash2 } from "react-icons/fi";
import { usePdfAnalyzerAdminBatch } from "@/hooks/usePdfAnalyzerBatch";

function statusBadge(status: string) {
  const base =
    "inline-flex items-center rounded-sm px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border shadow-xs";
  switch (status) {
    case "queued":
      return `${base} border-(--color-border) bg-(--color-bg) text-(--color-muted)`;
    case "extracting":
    case "ocr":
      return `${base} border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400`;
    case "analyzing":
      return `${base} border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400`;
    case "saving":
      return `${base} border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400`;
    case "done":
      return `${base} border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400`;
    case "skipped":
      return `${base} border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400`;
    case "error":
      return `${base} border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400`;
    default:
      return `${base} border-(--color-border) bg-(--color-bg) text-(--color-muted)`;
  }
}

export const UploadMaxima: React.FC = () => {
  const {
    items,
    dragActive,
    loading,
    progress,
    currentIndex,
    totals,
    inputRef,
    validateAndQueue,
    startBatch,
    cancel,
    reset,
    removeItem,
    clearFailedAndSkipped,
  } = usePdfAnalyzerAdminBatch();

  const totalPct =
    totals.total > 0 ? Math.round(((totals.done + totals.error + totals.skipped) / totals.total) * 100) : 0;

  const activeItem = currentIndex >= 0 ? items[currentIndex] : null;

  return (
    <div className="w-full mx-auto max-w-5xl text-start px-4 md:px-0">
      {/* HEADER */}
      <header className="mb-8">
        <h1 className="text-2xl md:text-3xl font-medium mb-2 text-(--color-text) tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
          Sezione Admin
        </h1>
        <p className="text-xs sm:text-sm text-(--color-muted) font-light leading-relaxed">
          Sezione amministrativa. Puoi caricare fino a 100 sentenze ufficiali in formato PDF.
          L’elaborazione avviene in sequenza. Gli scarti (troppo lunghi/non sentenza) e gli
          errori vengono tracciati per file.
        </p>
      </header>

      {/* UPLOAD PDF */}
      <section className="mb-6">
        <div
          role="button"
          tabIndex={loading ? -1 : 0}
          className={`relative w-full overflow-hidden rounded-lg border-2 border-dashed p-8 text-left transition-all outline-none
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
            shadow-(--shadow-soft)
          `}
          onDragEnter={(e) => {
            if (loading) return;
            e.preventDefault();
            e.stopPropagation();
          }}
          onDragOver={(e) => {
            if (loading) return;
            e.preventDefault();
            e.stopPropagation();
          }}
          onDragLeave={(e) => {
            if (loading) return;
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (loading) return;
            if (e.dataTransfer.files) validateAndQueue(e.dataTransfer.files);
          }}
          onClick={() => {
            if (loading) return;
            inputRef.current?.click();
          }}
          onKeyDown={(e) => {
            if (loading) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
        >
          {/* LA LINEA DELLO STILE DI RIGORE */}
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

          <div className="relative flex flex-col items-center text-center mt-2">
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

            {items.length === 0 ? (
              <>
                <p className="text-base font-medium text-(--color-text) tracking-tight">
                  Trascina qui fino a 100 file
                </p>
                <p className="mt-1 text-xs text-(--color-muted) font-light">
                  oppure{" "}
                  <span className="text-(--color-text) font-bold underline underline-offset-2">
                    seleziona file
                  </span>
                </p>
                <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-(--color-muted)">
                  Formato accettato: .pdf o .docx • fino a 100 file • elaborazione sequenziale
                </p>
              </>
            ) : (
              <div className="w-full max-w-3xl text-left">
                <div className="flex items-center justify-between gap-3 rounded-md border border-(--color-border) bg-(--color-bg) px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-(--color-text) tracking-tight">
                      {items.length} file in coda
                    </p>
                    <p className="mt-0.5 text-xs text-(--color-muted) font-light">
                      Done: {totals.done} • Errori: {totals.error} • Scarti: {totals.skipped} • Totale:{" "}
                      {totals.total}
                    </p>
                  </div>

                  {!loading && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        reset();
                      }}
                      className="inline-flex items-center gap-2 rounded-md border border-red-500/20 bg-(--color-surface) px-3 py-2 text-xs font-bold uppercase tracking-widest text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors relative z-10 outline-none"
                    >
                      <FiTrash2 size={14} />
                      Svuota
                    </button>
                  )}
                </div>

                <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-(--color-muted)">
                  Clicca nell’area per sostituire la selezione.
                </p>
              </div>
            )}

            {loading && (
              <div className="mt-6 w-full max-w-3xl">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-(--color-text) border-t-transparent" />
                  <p className="self-center text-xs text-(--color-muted) font-light ml-2">
                    {activeItem?.progress || progress || "Elaborazione batch…"}
                  </p>
                  <span className="ml-auto text-xs tabular-nums text-(--color-text) font-bold">
                    {totalPct}%
                  </span>
                </div>

                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-(--color-bg) border border-(--color-border)">
                  <div
                    className="h-full rounded-full bg-(--color-text) transition-[width] duration-200 ease-out"
                    style={{ width: `${totalPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept="application/pdf,.pdf"
            multiple
            disabled={loading}
            onChange={(e) => {
              if (loading) return;
              if (e.target.files) validateAndQueue(e.target.files);
            }}
          />
        </div>
      </section>

      {/* ACTION BAR */}
      {items.length > 0 && (
        <div className="mb-6 w-full p-4 bg-(--color-surface) border border-(--color-border) rounded-lg flex flex-col md:flex-row md:justify-between gap-3 shadow-xs ">
          <div className="flex flex-wrap items-center gap-3">
            {!loading ? (
              <button
                type="button"
                onClick={startBatch}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-(--color-text) text-(--color-surface) text-xs font-bold uppercase tracking-widest hover:opacity-95 transition-all outline-none"
              >
                <FiPlay size={14} />
                Avvia batch
              </button>
            ) : (
              <button
                type="button"
                onClick={cancel}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-red-600 text-white text-xs font-bold uppercase tracking-widest hover:bg-red-700 transition-all outline-none"
              >
                <FiStopCircle size={14} />
                Interrompi
              </button>
            )}

            <button
              type="button"
              onClick={clearFailedAndSkipped}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-(--color-border) bg-(--color-surface) text-(--color-text) text-xs font-bold uppercase tracking-widest hover:bg-(--color-bg) transition-all disabled:opacity-30 disabled:cursor-not-allowed outline-none"
            >
              Pulisci errori/scarti
            </button>
          </div>

          <div className="text-xs text-(--color-muted) font-light flex items-center">
            {loading && currentIndex >= 0 ? (
              <span>
                File {currentIndex + 1}/{items.length}:{" "}
                <span className="font-medium text-(--color-text)">{items[currentIndex]?.file.name}</span>
              </span>
            ) : (
              <span>Pronto.</span>
            )}
          </div>
        </div>
      )}

      {/* QUEUE TABLE */}
      {items.length > 0 && (
        <div className="rounded-lg border border-(--color-border) bg-(--color-surface) overflow-hidden shadow-(--shadow-soft) relative">
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

          <div className="grid grid-cols-12 bg-(--color-bg) px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-(--color-muted) border-b border-(--color-border) mt-1">
            <div className="col-span-5">File</div>
            <div className="col-span-2">Stato</div>
            <div className="col-span-4">Dettagli</div>
            <div className="col-span-1 text-right">Azioni</div>
          </div>

          <div className="divide-y divide-(--color-border)">
            {items.map((it, idx) => (
              <div
                key={it.id}
                className={`grid grid-cols-12 px-4 py-3.5 text-sm items-center ${
                  idx === currentIndex ? "bg-(--color-bg)/60" : "bg-(--color-surface)"
                }`}
              >
                <div className="col-span-5 min-w-0 pr-2">
                  <p className="truncate font-medium text-xs text-(--color-text) tracking-tight">
                    {it.file.name}
                  </p>
                  <p className="text-[10px] font-light text-(--color-muted)">
                    {(it.file.size / 1024).toFixed(1)} KB
                  </p>
                </div>

                <div className="col-span-2 flex items-start">
                  <span className={statusBadge(it.status)}>{it.status}</span>
                </div>

                <div className="col-span-4 pr-2">
                  {it.status === "error" || it.status === "skipped" ? (
                    <p className="text-xs text-red-600 dark:text-red-400 font-light whitespace-pre-line">
                      {it.error || "Errore/Scarto"}
                    </p>
                  ) : (
                    <p className="text-xs text-(--color-muted) font-light">
                      {it.progress || "—"}
                    </p>
                  )}
                </div>

                <div className="col-span-1 flex justify-end">
                  {!loading && (
                    <button
                      type="button"
                      onClick={() => removeItem(it.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-(--color-border) bg-(--color-surface) text-(--color-muted) hover:text-red-600 hover:border-red-500/30 transition-colors outline-none"
                      aria-label="Rimuovi file"
                    >
                      <FiX size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};