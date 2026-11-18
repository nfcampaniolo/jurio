// Search.tsx
/// <reference types="office-js" />
import React, { useState } from "react";
import { fetchWithSecurity } from "../firebase/functions";
import { Fonte } from "./types";
import { isWordEnvironment } from "./utils";
import { useMemoryState } from "./memoryState";
import { AiQuotaNote } from "../components/AiQuota";
import { usePlan } from "../plan/PlanContext";
import FonteCard from "./FonteCard";
import { readSseStream } from "./sse";
import { WORD_AGENT_URL } from "../config/env";
import { Comment16Regular, TextQuote16Regular } from "@fluentui/react-icons";
import { AutoTextarea } from "../components/AutoTextarea";

const Search: React.FC = () => {
  // ─────────────────────────────────────────────
  // 1. STATI CON CACHE (Inizializzazione Lazy)
  // ─────────────────────────────────────────────

  const { aiEsaurita, refresh } = usePlan();
  const [contesto, setContesto] = useMemoryState("search_contesto", "");
  const [istruzioni, setIstruzioni] = useMemoryState("search_istruzioni", "");
  const [testoQuote, setTestoQuote] = useMemoryState("search_testoQuote", "");
  const [fonti, setFonti] = useMemoryState<Fonte[]>("search_fonti", []);

  // Stati volatili
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");

  // ─────────────────────────────────────────────
  // 2. SINCRONIZZAZIONE CACHE (useEffect)
  // ─────────────────────────────────────────────

  const handleClear = () => {
    setContesto("");
    setIstruzioni("");
    setTestoQuote("");
    setFonti([]);
  };

  // ─────────────────────────────────────────────
  // 3. OFFICE.JS: Interazioni
  // ─────────────────────────────────────────────

  const handleGetSelection = async () => {
    if (!isWordEnvironment(setError)) return;
    try {
      await Word.run(async (context) => {
        const selection = context.document.getSelection();
        selection.load("text");
        await context.sync();
        if (selection.text.trim()) setContesto(selection.text);
      });
    } catch (err) {
      console.error("Errore lettura Word:", err);
      setError("Impossibile leggere il documento.");
    }
  };

  const handleInsertText = async () => {
    if (!isWordEnvironment(setError)) return;
    try {
      await Word.run(async (context) => {
        const selection = context.document.getSelection();
        selection.insertText(testoQuote, Word.InsertLocation.replace);
        await context.sync();
      });
    } catch (err) {
      console.error(err);
      setError("Impossibile inserire il testo nel documento.");
    }
  };

  const handleInsertComment = async () => {
    if (!isWordEnvironment(setError)) return;
    try {
      await Word.run(async (context) => {
        const selection = context.document.getSelection();
        selection.insertComment(testoQuote);
        await context.sync();
      });
    } catch (err) {
      console.error(err);
      setError("Impossibile inserire il commento.");
    }
  };

  // ─────────────────────────────────────────────
  // 4. CHIAMATA API
  // ─────────────────────────────────────────────

  const handleSearch = async () => {
    if (!contesto.trim()) {
      setError("Inserisci un concetto o cattura un testo.");
      return;
    }

    setIsLoading(true);
    setError("");
    setTestoQuote("");
    setFonti([]);
    setStatusMessage("Avvio ricerca...");

    try {
      const response = await fetchWithSecurity(WORD_AGENT_URL, {
        action: "research",
        contesto: contesto,
        promptIndirizzamento: istruzioni,
        filters: [],
      });

      await readSseStream<{ testoQuote?: string; fonti?: Fonte[] }>(response, {
        onStatus: setStatusMessage,
        onResult: (result) => {
          setTestoQuote(result?.testoQuote || "");
          setFonti(result?.fonti || []);
        },
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Si è verificato un errore durante la richiesta."
      );
      console.error(err);
    } finally {
      setIsLoading(false);
      setStatusMessage("");
      void refresh();
    }
  };

  return (
    <div className="tool-body">
      <div className="search-form">
        <div className="form-group">
          <div className="form-group-header">
            <label htmlFor="search-contesto">Concetto o tema chiave</label>
            <button type="button" onClick={handleGetSelection} className="btn-link">
              Cattura da Word
            </button>
          </div>
          <AutoTextarea
            id="search-contesto"
            minRows={4}
            maxRows={10}
            value={contesto}
            onValueChange={setContesto}
            onDictationError={setError}
            placeholder="Es. L'impatto dell'intelligenza artificiale generativa sulla produttività dei reparti legali nel settore bancario..."
          />
          <p className="field-hint">
            <strong>Consiglio:</strong> esprimi un <strong>singolo concetto dettagliato</strong> per
            volta. Evita elenchi o domande multiple: più il contesto è circoscritto, più accurati
            saranno i risultati.
          </p>
        </div>

        <div className="form-group">
          <label htmlFor="search-istruzioni">Istruzioni (facoltative)</label>
          <AutoTextarea
            id="search-istruzioni"
            minRows={1}
            maxRows={5}
            placeholder="es. Privilegia le pronunce di legittimità recenti"
            value={istruzioni}
            onValueChange={setIstruzioni}
            onDictationError={setError}
          />
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      {!isLoading && (
        <>
          <button
            onClick={handleSearch}
            disabled={!contesto.trim() || aiEsaurita}
            className="btn-primary"
          >
            Cerca Fonti e Redigi
          </button>
          <AiQuotaNote />
        </>
      )}

      {isLoading && (
        <div className="loader-container animate-slide-up" role="status">
          <div className="loader-header">
            <div className="loader-spinner-inline"></div>
            <span className="loader-status-text">{statusMessage || "Ricerca in corso..."}</span>
          </div>
        </div>
      )}

      {testoQuote && (
        <div className="result-section">
          <div className="result-box">
            <div className="result-header">
              <h3>Esito della ricerca</h3>
              <button onClick={handleClear} className="btn-link">
                Ripulisci
              </button>
            </div>
            <textarea
              className="result-textarea"
              rows={5}
              value={testoQuote}
              onChange={(e) => setTestoQuote(e.target.value)}
            />
          </div>

          <div className="actions-row">
            <button onClick={handleInsertText} className="btn-primary">
              <TextQuote16Regular aria-hidden />
              Inserisci
            </button>
            <button onClick={handleInsertComment} className="btn-secondary">
              <Comment16Regular aria-hidden />
              Commento
            </button>
          </div>

          {fonti.length > 0 && (
            <div className="fonti-section">
              <h4>Fonti utilizzate</h4>
              {fonti.map((fonte, idx) => (
                <FonteCard key={fonte.id || idx} fonte={fonte} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Search;
