// src/components/Redrafting.tsx
/// <reference types="office-js" />
import React, { useState } from "react";
import { FascicoloSelector } from "./FascicoloSelector";
import { DocumentInputArea } from "./DocumentInputArea";
import { PastFascicolo, fetchWithSecurity } from "../firebase/functions";
import { isWordEnvironment } from "./utils";
import { readSseStream } from "./sse";
import { WORD_AGENT_URL } from "../config/env";
import { ArrowSwap16Regular, Comment16Regular } from "@fluentui/react-icons";
import { AiQuotaNote } from "../components/AiQuota";
import { usePlan } from "../plan/PlanContext";

const Redrafting: React.FC = () => {
  const { aiEsaurita, refresh } = usePlan();
  // Stati di Input
  const [testoIniziale, setTestoIniziale] = useState("");
  const [direttiva, setDirettiva] = useState("");
  const [selectedFascicolo, setSelectedFascicolo] = useState<PastFascicolo | null>(null);

  // Stato di Output (Editabile)
  const [bozzaGenerata, setBozzaGenerata] = useState("");

  // Stati di UI e Streaming
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");

  // ─────────────────────────────────────────────
  // AZIONE 1: CHIAMATA ALL'AI (Re-Drafting)
  // ─────────────────────────────────────────────
  const handleRedraft = async () => {
    if (!testoIniziale.trim()) {
      setError("Devi acquisire del testo prima di procedere alla riscrittura.");
      return;
    }

    setIsProcessing(true);
    setError("");
    setBozzaGenerata("");
    setStatusMessage("Avvio riscrittura...");

    try {
      const payload = {
        action: "redraft",
        text: testoIniziale,
        fascicoloId: selectedFascicolo ? selectedFascicolo.id : null,
        promptDirettiva: direttiva,
      };

      const response = await fetchWithSecurity(WORD_AGENT_URL, payload);

      await readSseStream<{ risultato?: string }>(response, {
        onStatus: setStatusMessage,
        onResult: (result) => {
          if (result?.risultato) setBozzaGenerata(result.risultato);
        },
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Errore durante la generazione.");
      console.error(err);
    } finally {
      setIsProcessing(false);
      void refresh();
    }
  };

  // ─────────────────────────────────────────────
  // AZIONE 2: AZIONI SU WORD
  // ─────────────────────────────────────────────

  // Sostituisce il testo selezionato con la bozza
  const handleReplaceInWord = async () => {
    if (!isWordEnvironment(setError) || !bozzaGenerata) return;
    try {
      await Word.run(async (context) => {
        const selection = context.document.getSelection();
        selection.insertText(bozzaGenerata, Word.InsertLocation.replace);
        await context.sync();
      });
    } catch (err) {
      setError("Assicurati di avere il testo selezionato nel documento per poterlo sostituire.");
      console.log(err);
    }
  };

  // Aggiunge la bozza come commento a margine
  const handleCommentInWord = async () => {
    if (!isWordEnvironment(setError) || !bozzaGenerata) return;
    try {
      await Word.run(async (context) => {
        const selection = context.document.getSelection();
        selection.insertComment(`[PROPOSTA RE-DRAFTING]\n\n${bozzaGenerata}`);
        await context.sync();
      });
    } catch (err) {
      setError("Impossibile inserire il commento a margine.");
      console.log(err);
    }
  };

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <div className="tool-body">
      <DocumentInputArea
        testo={testoIniziale}
        setTesto={setTestoIniziale}
        istruzioni={direttiva}
        setIstruzioni={setDirettiva}
        isLoading={isProcessing}
        onError={setError}
        labelIstruzioni="Direttiva di riscrittura"
        placeholderIstruzioni="es. Rendi la clausola più stringente sul foro..."
      />

      <FascicoloSelector
        selected={selectedFascicolo}
        onSelect={setSelectedFascicolo}
        disabled={isProcessing}
      />

      {error && <div className="error-box">{error}</div>}

      {!isProcessing && !bozzaGenerata && (
        <>
          <button
            className="btn-primary"
            onClick={handleRedraft}
            disabled={!testoIniziale || aiEsaurita}
          >
            {selectedFascicolo ? `Riscrivi usando "${selectedFascicolo.title}"` : "Riscrivi Testo"}
          </button>
          <AiQuotaNote />
        </>
      )}

      {isProcessing && (
        <div className="loader-container animate-slide-up" role="status">
          <div className="loader-header">
            <div className="loader-spinner-inline"></div>
            <span className="loader-status-text">{statusMessage || "Riscrittura in corso..."}</span>
          </div>
        </div>
      )}

      {/* ZONA OUTPUT: Editabile dall'utente */}
      {!isProcessing && bozzaGenerata && (
        <div className="result-section">
          <div className="result-box">
            <div className="result-header">
              <h3>Testo proposto</h3>
              <span className="fonte-score">Modificabile</span>
            </div>
            <textarea
              className="result-textarea"
              aria-label="Testo proposto"
              value={bozzaGenerata}
              onChange={(e) => setBozzaGenerata(e.target.value)}
              rows={8}
            />
          </div>

          <div className="actions-stack">
            <button onClick={handleReplaceInWord} className="btn-primary">
              <ArrowSwap16Regular aria-hidden />
              Sostituisci nel Documento
            </button>
            <button onClick={handleCommentInWord} className="btn-secondary">
              <Comment16Regular aria-hidden />
              Appunta come Commento
            </button>
            <button onClick={() => setBozzaGenerata("")} className="btn-link">
              Annulla e riscrivi di nuovo
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Redrafting;
