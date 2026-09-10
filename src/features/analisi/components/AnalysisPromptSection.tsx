// src/features/deep-analysis/components/AnalysisPromptSection.tsx
import React, { useRef, useEffect, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import type {
  SpeechRecognitionEvent,
  SpeechRecognitionErrorEvent
} from "@/shared/hooks/speech-recognition"; 

export interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((this: ISpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: ISpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: ISpeechRecognition, ev: Event) => void) | null;
}

export interface SpeechWindow extends Window {
  SpeechRecognition?: { new (): ISpeechRecognition };
  webkitSpeechRecognition?: { new (): ISpeechRecognition };
}

interface AnalysisPromptSectionProps {
  prompt: string;
  setPrompt: (value: string) => void;
  isProcessing: boolean;
}

export const AnalysisPromptSection: React.FC<AnalysisPromptSectionProps> = ({
  prompt,
  setPrompt,
  isProcessing
}) => {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const promptRef = useRef(prompt);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);

  // Mantieni aggiornato il ref del prompt per evitare closure obsolete
  useEffect(() => {
    promptRef.current = prompt;
  }, [prompt]);

  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = "auto";
      textAreaRef.current.style.height = `${Math.min(textAreaRef.current.scrollHeight, 400)}px`;
    }
  }, [prompt]);

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
        const currentText = promptRef.current;
        const newText = currentText ? `${currentText.trim()} ${finalTranscript.trim()}` : finalTranscript.trim();
        setPrompt(newText);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Errore riconoscimento vocale:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  return (
    <section className="group relative bg-(--color-surface) border border-(--color-border) rounded-lg p-5 sm:p-6 shadow-(--shadow-soft) overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-0 group-hover:opacity-90 group-focus-within:opacity-90 transition-opacity duration-200 z-20 pointer-events-none" />
      
      <div className="flex items-center justify-between pb-5">
        <h3 className="text-sm font-medium tracking-tight" style={{ fontFamily: "var(--font-serif)" }}>
          Istruzioni di Analisi
        </h3>

        <button
          type="button"
          onClick={toggleListening}
          disabled={isProcessing}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest transition cursor-pointer outline-none ${
            isListening 
              ? "bg-red-500 text-white animate-pulse shadow-sm" 
              : "bg-(--color-bg) border border-(--color-border) text-(--color-muted) hover:text-(--color-text)"
          }`}
          title={isListening ? "Ferma registrazione" : "Avvia dettatura vocale"}
        >
          {isListening ? <MicOff size={13} /> : <Mic size={13} />}
          <span>{isListening ? "Ascoltando..." : "Detta"}</span>
        </button>
      </div>
      
      <textarea
        ref={textAreaRef}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Descrivi l'analisi legale, la ricerca giurisprudenziale profonda o l'atto che vuoi elaborare..."
        className="w-full min-h-32.5 p-4 bg-(--color-bg) border border-(--color-border) rounded-md text-xs sm:text-sm font-light text-(--color-text) placeholder:text-(--color-muted) focus:border-(--color-text) outline-none resize-none transition-all shadow-xs leading-relaxed"
        disabled={isProcessing}
      />
    </section>
  );
};