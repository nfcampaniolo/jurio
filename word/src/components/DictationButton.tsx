import React, { useEffect, useRef, useState } from "react";
import { Mic20Regular, Stop16Filled } from "@fluentui/react-icons";
import { postWordAgent } from "../api/wordApi";
import { MAX_RECORDING_SECONDS, Recording, startRecording, wavToBase64 } from "../tools/recorder";

interface Props {
  onText: (text: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
  className?: string;
}

type Stato = "idle" | "recording" | "transcribing";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Detta invece di scrivere: registra, trascrive (italiano) e aggiunge il testo al campo. */
export const DictationButton: React.FC<Props> = ({ onText, onError, disabled, className }) => {
  const [stato, setStato] = useState<Stato>("idle");
  const [secondi, setSecondi] = useState(0);
  const recording = useRef<Recording | null>(null);

  const stop = async () => {
    const rec = recording.current;
    if (!rec) return;
    recording.current = null;
    setStato("transcribing");
    try {
      const audio = wavToBase64(await rec.stop());
      const { testo } = await postWordAgent<{ testo: string }>({ action: "transcribe", audio });
      if (testo.trim()) onText(testo.trim());
      else onError("Non ho riconosciuto parole: riprova parlando più vicino al microfono.");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Trascrizione non riuscita.");
    } finally {
      setStato("idle");
    }
  };

  const start = async () => {
    try {
      recording.current = await startRecording();
      setSecondi(0);
      setStato("recording");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Impossibile avviare la registrazione.");
    }
  };

  useEffect(() => {
    if (stato !== "recording") return undefined;
    const timer = setInterval(() => setSecondi((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [stato]);

  useEffect(() => {
    if (stato === "recording" && secondi >= MAX_RECORDING_SECONDS) void stop();
  }, [stato, secondi]);

  // Smontaggio durante la registrazione: libera il microfono.
  useEffect(() => () => recording.current?.cancel(), []);

  if (stato === "recording") {
    return (
      <button
        type="button"
        className={`btn-dictation recording ${className ?? ""}`}
        onClick={() => void stop()}
        aria-label="Termina la dettatura"
        title="Termina la dettatura"
      >
        <Stop16Filled aria-hidden />
        <span className="dictation-time">{mmss(secondi)}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`btn-dictation ${stato === "transcribing" ? "busy" : ""} ${className ?? ""}`}
      onClick={() => void start()}
      disabled={disabled || stato === "transcribing"}
      aria-label={stato === "transcribing" ? "Trascrizione in corso" : "Detta"}
      title={stato === "transcribing" ? "Trascrizione in corso" : "Detta (massimo 55 secondi)"}
    >
      {stato === "transcribing" ? (
        <span className="loader-spinner-inline" aria-hidden />
      ) : (
        <Mic20Regular aria-hidden />
      )}
    </button>
  );
};
