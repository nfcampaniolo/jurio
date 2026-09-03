import React, { useState, useRef } from "react";
import { FaFilePdf, FaShareAlt, FaFileAudio, FaEnvelope } from "react-icons/fa";
import { FiMail, FiPlay, FiPause, FiRotateCcw, FiRotateCw } from "react-icons/fi";
import { SaveSentenzaButton } from "./SaveSentenzaButton";
import toast from "react-hot-toast";

// IMPORTA IL COMPONENTE (Modifica il path secondo la tua alberatura)
import { FeedbackComponent } from "@/shared/components/FeedbackComponent"; 

// --- MICRO-COMPONENTE AUDIO ---
const CustomAudioPlayer = ({ file }: { file: string }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return "00:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const skipTime = (seconds: number) => {
    if (audioRef.current) audioRef.current.currentTime += seconds;
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  return (
    <div className="flex flex-col items-center w-full">
      <audio 
        ref={audioRef}
        src={file} 
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />

      <div className="w-20 h-20 rounded-full border border-(--color-border) bg-(--color-bg) flex items-center justify-center mb-6 shadow-xs relative overflow-hidden group">
        <div className={`absolute inset-0 bg-(--color-primary) opacity-5 transition-opacity ${isPlaying ? 'animate-pulse opacity-10' : ''}`} />
        <FaFileAudio className={`w-8 h-8 text-(--color-text) transition-transform duration-300 ${isPlaying ? 'scale-110' : 'opacity-80'}`} />
      </div>

      <div className="w-full flex items-center gap-3 mb-6">
        <span className="text-[10px] font-medium text-(--color-muted) w-8 text-right font-mono">
          {formatTime(currentTime)}
        </span>
        <input 
          type="range" 
          min="0" 
          max={duration || 100} 
          value={currentTime} 
          onChange={handleSeek}
          className="flex-1 h-1 bg-(--color-border) rounded-lg appearance-none cursor-pointer accent-(--color-text)"
        />
        <span className="text-[10px] font-medium text-(--color-muted) w-8 text-left font-mono">
          {formatTime(duration)}
        </span>
      </div>

      <div className="flex items-center justify-center gap-6">
        <button 
          onClick={() => skipTime(-15)}
          className="p-2 text-(--color-muted) hover:text-(--color-text) transition-colors flex flex-col items-center gap-1 cursor-pointer outline-none"
          title="Indietro di 15 secondi"
        >
          <FiRotateCcw className="w-5 h-5" />
          <span className="text-[8px] font-bold">15s</span>
        </button>

        <button 
          onClick={togglePlay}
          className="w-14 h-14 rounded-full bg-(--color-text) text-(--color-surface) flex items-center justify-center hover:opacity-90 transition-opacity shadow-md cursor-pointer outline-none"
        >
          {isPlaying ? <FiPause className="w-6 h-6 fill-current" /> : <FiPlay className="w-6 h-6 fill-current ml-1" />}
        </button>

        <button 
          onClick={() => skipTime(15)}
          className="p-2 text-(--color-muted) hover:text-(--color-text) transition-colors flex flex-col items-center gap-1 cursor-pointer outline-none"
          title="Avanti di 15 secondi"
        >
          <FiRotateCw className="w-5 h-5" />
          <span className="text-[8px] font-bold">15s</span>
        </button>
      </div>
    </div>
  );
};

// --- COMPONENTE PRINCIPALE ---
interface PdfPreviewSidebarProps {
  file: string;          
  nomeFile?: string;     
  share?: boolean;
  uid: string;
  id: string;
}

export const PdfPreviewSidebar: React.FC<PdfPreviewSidebarProps> = ({ 
  file, 
  nomeFile, 
  share, 
  uid, 
  id 
}) => {
  // 1. RILEVAMENTO TIPO FILE
  const stringToTest = (nomeFile || file).toLowerCase();
  
  const isAudio = stringToTest.includes('.mp3') || 
                  stringToTest.includes('.wav') || 
                  stringToTest.includes('.m4a') || 
                  stringToTest.includes('.ogg');
                  
  const isEmail = stringToTest.includes('.eml') || 
                  stringToTest.includes('.msg');

  // 2. ETICHETTE DINAMICHE
  let previewTitle = "Anteprima Documento";
  let downloadLabel = "Scarica PDF";
  let DownloadIcon = FaFilePdf;

  if (isAudio) {
    previewTitle = "Riproduzione Audio";
    downloadLabel = "Scarica Audio";
    DownloadIcon = FaFileAudio;
  } else if (isEmail) {
    previewTitle = "Messaggio Email";
    downloadLabel = "Scarica Email";
    DownloadIcon = FaEnvelope;
  }

  return (
    <div className="w-full lg:w-90 xl:w-96 shrink-0 lg:sticky lg:top-4 flex flex-col gap-6">
      <div className="flex flex-col items-center gap-4">
        <a
          href={file}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="group w-full inline-flex items-center justify-center gap-3 px-6 py-3 rounded-md border border-(--color-border) bg-(--color-surface) text-(--color-text) text-xs font-bold uppercase tracking-widest shadow-sm transition-all duration-200 hover:border-(--color-text) outline-none"
        >
          <DownloadIcon className="text-(--color-text) opacity-70 group-hover:opacity-100 transition-opacity" />
          <span>{downloadLabel}</span>
        </a>

        {share && (
          <div className="flex flex-row gap-3 w-full">
            <button
              onClick={async () => {
                try {
                  const currentUrl = window.location.href;
                  if (navigator.share) {
                    await navigator.share({ title: "Condivisione Documento", url: currentUrl });
                  } else {
                    await navigator.clipboard.writeText(currentUrl);
                    toast("Link copiato negli appunti");
                  }
                } catch (e) {
                  toast.error("Errore nella copia del link");
                  console.error(e);
                }
              }}
              className="group w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-md border border-(--color-border) bg-(--color-surface) text-(--color-text) text-xs font-bold uppercase tracking-widest shadow-sm transition-all duration-200 hover:border-(--color-text) outline-none"
            >
              <FaShareAlt className="text-(--color-text) opacity-70 group-hover:opacity-100 transition-opacity" />
              <span>Condividi</span>
            </button>
            <SaveSentenzaButton userId={uid} sentenzaId={id} />
          </div>
        )}

        {/* --- INTEGRAZIONE FEEDBACK COMPONENT --- */}
        <div className="w-full flex items-center justify-between px-4 py-2 rounded-md border border-(--color-border) bg-(--color-surface) shadow-sm">
          <span className="text-xs font-bold uppercase tracking-widest text-(--color-text) opacity-80">
            Valuta Documento
          </span>
          <FeedbackComponent sourceIds={id} />
        </div>
      </div>

      <div className="w-full">
        <div className="relative overflow-hidden rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft)">
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-(--color-border) bg-(--color-bg) mt-1">
            <span className="h-2.5 w-2.5 rounded-full border border-(--color-border) bg-(--color-surface)" />
            <span className="h-2.5 w-2.5 rounded-full border border-(--color-border) bg-(--color-surface)" />
            <span className="h-2.5 w-2.5 rounded-full border border-(--color-border) bg-(--color-surface)" />
            <div className="ml-2 text-xs font-medium text-(--color-muted) truncate" title={nomeFile || previewTitle}>
              {nomeFile ? nomeFile : previewTitle}
            </div>
            <a
              href={file}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-[10px] font-bold uppercase tracking-widest text-(--color-muted) hover:text-(--color-text) transition-colors outline-none"
            >
              Apri
            </a>
          </div>
          
          <div className={`relative ${isAudio ? 'p-6 bg-(--color-surface)' : 'aspect-3/4 bg-(--color-bg)'}`}>
            {isAudio ? (
              <CustomAudioPlayer key={file} file={file} />
            ) : isEmail ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-(--color-bg)">
                <div className="w-16 h-16 rounded-full border border-(--color-border) bg-(--color-surface) flex items-center justify-center mb-4 shadow-xs">
                  <FiMail className="w-6 h-6 text-(--color-text) opacity-80" />
                </div>
                <h4 className="text-sm font-bold text-(--color-text) mb-2">Archivio Email</h4>
                <p className="text-xs text-(--color-muted) font-light leading-relaxed max-w-62.5 mb-6">
                  I file di posta elettronica non possono essere visualizzati direttamente nel browser. Scarica il file per leggerlo.
                </p>
                <a
                  href={file}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-md border border-(--color-border) bg-(--color-surface) text-xs font-bold uppercase tracking-widest text-(--color-text) hover:border-(--color-text) transition-colors shadow-xs"
                >
                  Scarica Messaggio
                </a>
              </div>
            ) : (
              <>
                <iframe
                  title="Preview"
                  src={`${file}#view=FitH`}
                  className="absolute inset-0 h-full w-full"
                  loading="lazy"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-(--color-surface) to-transparent opacity-70" />
              </>
            )}
          </div>
        </div>
        
        {!isAudio && (
          <p className="mt-2 text-xs text-(--color-muted) font-light text-center">
            Se l’anteprima non appare, usa “Apri” o scarica il file.
          </p>
        )}
      </div>
    </div>
  );
};