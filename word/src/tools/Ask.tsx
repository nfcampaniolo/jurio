import React, { useEffect, useRef, useState } from "react";
import { Add16Regular, ArrowUp20Filled, Comment16Regular } from "@fluentui/react-icons";
import { appendDictation, AutoTextarea } from "../components/AutoTextarea";
import { DictationButton } from "../components/DictationButton";
import { startWordAgentStream } from "../api/wordApi";
import { AiQuotaNote } from "../components/AiQuota";
import { RichText } from "../components/RichText";
import { usePlan } from "../plan/PlanContext";
import FonteCard from "./FonteCard";
import { useMemoryState } from "./memoryState";
import { readSseStream } from "./sse";
import { Fonte } from "./types";
import { insertCommentOnSelection, readDocumentText, readSelectionText } from "./word";

type Contesto = "selection" | "document" | "none";

interface Turno {
  role: "user" | "model";
  text: string;
  fonti?: Fonte[];
}

export const ASK_DOCUMENT_LIMIT = 60_000;

const CONTESTI: { id: Contesto; label: string }[] = [
  { id: "document", label: "Tutto il documento" },
  { id: "selection", label: "Selezione" },
  { id: "none", label: "Nessuno" },
];

const ESEMPI = [
  "Quali obblighi gravano sul conduttore?",
  "La clausola penale è valida secondo la giurisprudenza?",
  "Ci sono termini di decadenza da rispettare?",
];

async function leggiContesto(contesto: Contesto): Promise<string> {
  if (contesto === "none") return "";
  const testo = (
    contesto === "selection" ? await readSelectionText() : await readDocumentText()
  ).trim();
  if (!testo) {
    throw new Error(
      contesto === "selection"
        ? "Seleziona prima un passaggio nel documento."
        : "Il documento è vuoto."
    );
  }
  if (testo.length > ASK_DOCUMENT_LIMIT) {
    throw new Error("Il documento è troppo lungo per una domanda: seleziona la parte pertinente.");
  }
  return testo;
}

const Ask: React.FC = () => {
  const { aiEsaurita, refresh } = usePlan();
  const [turni, setTurni] = useMemoryState<Turno[]>("ask_turni", []);
  const [contesto, setContesto] = useMemoryState<Contesto>("ask_contesto", "document");
  const [domanda, setDomanda] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [turni, loading]);

  const invia = async (testoDomanda = domanda) => {
    const q = testoDomanda.trim();
    if (!q || loading) return;
    setError("");
    let documento = "";
    try {
      documento = await leggiContesto(contesto);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile leggere il documento.");
      return;
    }

    const cronologia = turni.map(({ role, text }) => ({ role, text }));
    setTurni((prev) => [...prev, { role: "user", text: q }]);
    setDomanda("");
    setLoading(true);
    setStatus("Invio della domanda...");
    try {
      const response = await startWordAgentStream({
        action: "ask",
        domanda: q,
        documento,
        cronologia,
      });
      await readSseStream<{ risposta?: string; fonti?: Fonte[] }>(response, {
        onStatus: setStatus,
        onResult: (r) =>
          setTurni((prev) => [
            ...prev,
            { role: "model", text: r?.risposta ?? "", fonti: r?.fonti ?? [] },
          ]),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Si è verificato un errore.");
      // La domanda non ha ricevuto risposta: la rimettiamo nel campo per poterla reinviare.
      setTurni((prev) => prev.slice(0, -1));
      setDomanda(q);
    } finally {
      setLoading(false);
      setStatus("");
      void refresh();
    }
  };

  const commenta = async (text: string) => {
    try {
      await insertCommentOnSelection(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile inserire il commento.");
    }
  };

  return (
    <div className="tool-body">
      <div className="form-group">
        <span className="field-label" id="ask-contesto">
          Contesto inviato con la domanda
        </span>
        <div className="segmented" role="radiogroup" aria-labelledby="ask-contesto">
          {CONTESTI.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={contesto === c.id}
              className={contesto === c.id ? "active" : ""}
              onClick={() => setContesto(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="chat" aria-live="polite">
        {turni.length === 0 && !loading && (
          <div className="chat-empty">
            <p>Esempi di domande:</p>
            {ESEMPI.map((e) => (
              <button key={e} type="button" className="chip" onClick={() => setDomanda(e)}>
                {e}
              </button>
            ))}
          </div>
        )}
        {turni.map((t, i) => (
          <div key={i} className={`chat-msg ${t.role}`}>
            {t.role === "user" ? <p>{t.text}</p> : <RichText text={t.text} />}
            {t.role === "model" && (
              <>
                {t.fonti && t.fonti.length > 0 && (
                  <div className="fonti-section">
                    <h4>Fonti</h4>
                    {t.fonti.map((f, j) => (
                      <FonteCard key={f.id || j} fonte={f} />
                    ))}
                  </div>
                )}
                <button type="button" className="btn-link" onClick={() => void commenta(t.text)}>
                  <Comment16Regular aria-hidden />
                  Inserisci come commento
                </button>
              </>
            )}
          </div>
        ))}
        {loading && (
          <div className="chat-msg model pending" role="status">
            <div className="loader-spinner-inline" />
            <span>{status || "Elaborazione..."}</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && <div className="error-box">{error}</div>}

      <div className={`composer ${loading ? "busy" : ""}`}>
        <label htmlFor="ask-domanda" className="sr-only">
          Domanda
        </label>
        <AutoTextarea
          id="ask-domanda"
          className="composer-input"
          value={domanda}
          onValueChange={setDomanda}
          placeholder="Chiedi qualcosa sul documento..."
          minRows={1}
          maxRows={7}
          dictation={false}
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void invia();
            }
          }}
        />
        <div className="composer-bar">
          <span className="composer-hint">Invio per inviare · Maiusc+Invio per andare a capo</span>
          <div className="composer-actions">
            <DictationButton
              disabled={loading}
              onError={setError}
              onText={(text) => setDomanda((prev) => appendDictation(prev, text))}
            />
            <button
              type="button"
              className="btn-send"
              aria-label="Invia domanda"
              onClick={() => void invia()}
              disabled={loading || !domanda.trim() || aiEsaurita}
            >
              <ArrowUp20Filled aria-hidden />
            </button>
          </div>
        </div>
      </div>
      <div className="chat-footer">
        <AiQuotaNote />
        {turni.length > 0 && !loading && (
          <button type="button" className="btn-link" onClick={() => setTurni([])}>
            <Add16Regular aria-hidden />
            Nuova conversazione
          </button>
        )}
      </div>
    </div>
  );
};

export default Ask;
