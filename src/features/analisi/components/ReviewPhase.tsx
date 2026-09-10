// src/features/analisi/components/ReviewPhase.tsx

import React, { useRef, useState } from "react";
import { HelpCircle, Info, Loader2, Search, Play, Mic, MicOff, Sparkles, Scale } from "lucide-react";
import { ComparisonGrid } from "./ComparisonGrid";
import { FontiOrientamentoSwitch } from "./FontiOrientamentoSwitch";
import type { DeepAnalysisSession } from "../hooks/types";

import type {
  ISpeechRecognition,
  SpeechWindow,
  SpeechRecognitionEvent
} from "@/shared/hooks/speech-recognition"; 


interface Props {
  activeSession: DeepAnalysisSession;
  messaggioEsito: { tipo: 'info' | 'success'; testo: string } | null;
  setMessaggioEsito: (val: { tipo: 'info' | 'success'; testo: string } | null) => void;
  onApriHitlPreset: (preset: string) => void | Promise<void>;
  toggleEsclusionePrecedente: (precedenteId: string, escluso: boolean) => Promise<void>;
  mostraHitlBox: boolean;
  setMostraHitlBox: (val: boolean) => void;
  direttivaPersonalizzata: string;
  setDirettivaPersonalizzata: (val: string) => void;
  handleEseguiHitlAction: () => void | Promise<void>;
  isProcessing: boolean;
  avviaGenerazioneSintesi: () => void | Promise<void>;
  fontiApprovateCount: number;
}

export const ReviewPhase: React.FC<Props> = ({
  activeSession,
  messaggioEsito,
  setMessaggioEsito,
  onApriHitlPreset,
  toggleEsclusionePrecedente,
  mostraHitlBox,
  setMostraHitlBox,
  direttivaPersonalizzata,
  setDirettivaPersonalizzata,
  handleEseguiHitlAction,
  isProcessing,
  avviaGenerazioneSintesi,
  fontiApprovateCount,
}) => {
  const mappa = activeSession.mappaDialettica;
  const [isListening, setIsListening] = useState(false);
  const [localHitlLoading, setLocalHitlLoading] = useState(false);
  const [localSynthesisLoading, setLocalSynthesisLoading] = useState(false);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);

  const toggleListening = () => {
    const win = window as unknown as SpeechWindow;
    const SpeechRecognitionAPI = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      alert("La dettatura vocale non è supportata da questo browser.");
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "it-IT";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript.trim()) {
        setDirettivaPersonalizzata(
          direttivaPersonalizzata 
            ? `${direttivaPersonalizzata.trim()} ${finalTranscript.trim()}` 
            : finalTranscript.trim()
        );
      }
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const handleHitlSubmit = async () => {
    if (localHitlLoading || isProcessing || !direttivaPersonalizzata.trim()) return;
    setLocalHitlLoading(true);
    try {
      await handleEseguiHitlAction();
    } finally {
      setLocalHitlLoading(false);
    }
  };

  const handleSynthesisSubmit = async () => {
    if (localSynthesisLoading || isProcessing || fontiApprovateCount === 0) return;
    setLocalSynthesisLoading(true);
    try {
      await avviaGenerazioneSintesi();
    } finally {
      setLocalSynthesisLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-24">
      {/* CARD QUESITO ANALIZZATO */}
      <div className="relative bg-(--color-surface) border border-(--color-border) p-5 rounded-2xl shadow-xs overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-(--color-primary) opacity-80" />
        <div className="flex items-center gap-2 mb-2 text-(--color-muted)">
          <Scale size={14} className="opacity-70" />
          <h3 className="text-[10px] font-bold uppercase tracking-widest">
            Quesito Analizzato
          </h3>
        </div>
        <p className="text-sm font-medium leading-relaxed" style={{ fontFamily: "var(--font-serif)" }}>
          {activeSession.promptOriginale}
        </p>
      </div>

      {/* ALERT ESITO */}
      {messaggioEsito && (
        <div
          className={`p-4 rounded-2xl border flex items-start gap-3 text-xs transition-all shadow-xs ${
            messaggioEsito.tipo === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
              : "bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-300"
          }`}
        >
          <Info size={16} className="shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed font-light">{messaggioEsito.testo}</div>
          <button
            onClick={() => setMessaggioEsito(null)}
            className="text-[10px] font-bold uppercase tracking-widest opacity-60 hover:opacity-100 cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      )}

      {/* COMPARISON GRID */}
      <ComparisonGrid
        orientamentoFavorevole={mappa?.orientamentoFavorevole}
        orientamentoContrario={mappa?.orientamentoContrario}
        onApriHitlPreset={onApriHitlPreset}
        isProcessing={isProcessing}
      />

      {/* FONTI E PRECEDENTI */}
      <FontiOrientamentoSwitch
        orientamentoFavorevole={mappa?.orientamentoFavorevole}
        orientamentoContrario={mappa?.orientamentoContrario}
        onToggleEsclusione={toggleEsclusionePrecedente}
      />

      {/* PUNTI APERTI */}
      {mappa?.puntiAperti && mappa.puntiAperti.length > 0 && (
        <div className="bg-(--color-surface) border border-(--color-border) p-5 rounded-2xl shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-(--color-text)">
            <HelpCircle size={16} className="text-blue-500" />
            <h4 className="text-xs font-bold uppercase tracking-widest">Punti Aperti e Profili di Incertezza</h4>
          </div>
          <ul className="list-disc list-inside space-y-2 text-xs text-(--color-muted) font-light">
            {mappa.puntiAperti.map((punto: string, idx: number) => (
              <li key={idx} className="leading-relaxed">{punto}</li>
            ))}
          </ul>
        </div>
      )}

      {/* BARRA FLUIDA INFERIORE (FLOATING ACTION BAR & HITL BOX) */}
      <div className="fixed bottom-6 left-0 right-0 flex flex-col items-center gap-3 px-4 z-40 pointer-events-none">
        {mostraHitlBox && (
          <div className="w-full max-w-xl bg-(--color-surface) border border-(--color-border) p-4 rounded-2xl shadow-2xl flex flex-col gap-3 pointer-events-auto backdrop-blur-xl bg-opacity-95 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-(--color-muted)">
                <Sparkles size={13} className="text-amber-500" /> Direttiva di Approfondimento & Note (HITL)
              </span>
              <button
                onClick={() => {
                  if (isListening && recognitionRef.current) recognitionRef.current.stop();
                  setIsListening(false);
                  setMostraHitlBox(false);
                }}
                className="text-xs text-(--color-muted) hover:text-(--color-text) cursor-pointer"
              >
                Annulla
              </button>
            </div>

            <div className="relative">
              <textarea
                autoFocus
                rows={3}
                value={direttivaPersonalizzata}
                onChange={(e) => setDirettivaPersonalizzata(e.target.value)}
                placeholder="Modifica il comando o detta note specifiche..."
                className="w-full text-xs bg-(--color-bg) border border-(--color-border) rounded-xl p-3 pr-10 outline-none resize-none text-(--color-text) font-light leading-relaxed focus:border-(--color-text) transition-all shadow-xs"
              />
              <button
                type="button"
                onClick={toggleListening}
                className={`absolute right-2.5 top-2.5 p-2 rounded-lg transition-all cursor-pointer ${
                  isListening 
                    ? "bg-red-500 text-white animate-pulse" 
                    : "bg-(--color-surface) text-(--color-muted) hover:text-(--color-text) border border-(--color-border)"
                }`}
                title={isListening ? "Ferma dettatura" : "Detta direttiva"}
              >
                {isListening ? <MicOff size={14} /> : <Mic size={14} />}
              </button>
            </div>

            <div className="flex justify-between items-center pt-1">
              <span className="text-[10px] text-(--color-muted) font-light">
                {isListening ? "🔴 Registrazione vocale attiva..." : "💡 Suggerimento: puoi dettare o scrivere istruzioni mirate."}
              </span>
              <button
                onClick={handleHitlSubmit}
                disabled={!direttivaPersonalizzata.trim() || isProcessing || localHitlLoading}
                className="flex items-center gap-2 px-4 py-2 bg-(--color-text) text-(--color-surface) rounded-lg text-[10px] font-bold uppercase tracking-widest disabled:opacity-50 cursor-pointer shadow-sm hover:opacity-90 transition"
              >
                {isProcessing || localHitlLoading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />} 
                {localHitlLoading || isProcessing ? "Elaborazione..." : "Esegui Approfondimento"}
              </button>
            </div>
          </div>
        )}

        <div className="bg-(--color-surface)/90 border border-(--color-border) p-2 px-4 rounded-full shadow-2xl flex flex-wrap items-center justify-center gap-4 pointer-events-auto backdrop-blur-md">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-(--color-muted) px-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {fontiApprovateCount} Fonti Approvate
          </div>

          <button
            onClick={handleSynthesisSubmit}
            disabled={isProcessing || localSynthesisLoading || fontiApprovateCount === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-(--color-primary) text-white rounded-full text-xs font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-md transition-all active:scale-95"
          >
            {isProcessing || localSynthesisLoading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Play size={13} className="fill-current" />
            )}
            {localSynthesisLoading || isProcessing ? "Generazione in corso..." : "Genera Sintesi Strategica"}
          </button>
        </div>
      </div>
    </div>
  );
};