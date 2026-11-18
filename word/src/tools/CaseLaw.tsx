import React, { useState } from "react";
import { RisultatoRicerca, startWordAgentStream } from "../api/wordApi";
import { AiQuotaNote } from "../components/AiQuota";
import { ResultCard } from "../components/ResultCard";
import { usePlan } from "../plan/PlanContext";
import { useMemoryState } from "./memoryState";
import { readSseStream } from "./sse";
import { readDocumentText, readSelectionText } from "./word";

export const CASE_LAW_DOCUMENT_LIMIT = 120_000;

interface Esito {
  sintesi: string;
  query: string[];
  risultati: RisultatoRicerca[];
}

const CaseLaw: React.FC = () => {
  const { aiEsaurita, refresh } = usePlan();
  const [ambito, setAmbito] = useMemoryState<"document" | "selection">(
    "caselaw_ambito",
    "document"
  );
  const [esito, setEsito] = useMemoryState<Esito | null>("caselaw_esito", null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const avvia = async () => {
    setError("");
    let documento: string;
    try {
      documento = (
        ambito === "selection" ? await readSelectionText() : await readDocumentText()
      ).trim();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile leggere il documento.");
      return;
    }
    if (!documento) {
      setError(
        ambito === "selection"
          ? "Seleziona prima un passaggio nel documento."
          : "Il documento è vuoto."
      );
      return;
    }
    if (documento.length > CASE_LAW_DOCUMENT_LIMIT) {
      setError(
        "Il documento è molto esteso: seleziona la sezione da analizzare e scegli 'Solo selezione'."
      );
      return;
    }

    setLoading(true);
    setEsito(null);
    setStatus("Lettura del documento...");
    try {
      const response = await startWordAgentStream({ action: "case_law", documento });
      await readSseStream<Esito>(response, {
        onStatus: setStatus,
        onResult: (r) =>
          setEsito({
            sintesi: r?.sintesi ?? "",
            query: r?.query ?? [],
            risultati: r?.risultati ?? [],
          }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Si è verificato un errore.");
    } finally {
      setLoading(false);
      setStatus("");
      void refresh();
    }
  };

  return (
    <div className="tool-body">
      <div className="form-group">
        <span className="field-label" id="caselaw-ambito">
          Testo da analizzare
        </span>
        <div className="segmented" role="radiogroup" aria-labelledby="caselaw-ambito">
          {(
            [
              ["document", "Tutto il documento"],
              ["selection", "Solo selezione"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={ambito === id}
              className={ambito === id ? "active" : ""}
              onClick={() => setAmbito(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="field-help">
          Funziona con contratti, atti, memorie e pareri. Jurio redige una sintesi giuridica
          dell&apos;atto e la usa per cercare i precedenti in banca dati.
        </p>
      </div>

      {error && <div className="error-box">{error}</div>}

      <button className="btn-primary" onClick={() => void avvia()} disabled={loading || aiEsaurita}>
        {loading ? "Analisi in corso..." : "Trova la giurisprudenza"}
      </button>
      <AiQuotaNote />

      {loading && (
        <div className="loader-container animate-slide-up" role="status">
          <div className="loader-header">
            <div className="loader-spinner-inline"></div>
            <span className="loader-status-text">{status}</span>
          </div>
        </div>
      )}

      {esito && !loading && (
        <section className="result-section">
          <details className="summary-box" open>
            <summary>Sintesi del documento</summary>
            <p>{esito.sintesi}</p>
            {esito.query.length > 0 && (
              <div className="query-chips" aria-label="Ricerche eseguite">
                {esito.query.map((q) => (
                  <span key={q} className="chip static">
                    {q}
                  </span>
                ))}
              </div>
            )}
          </details>

          <div className="results-header">
            <h3>
              {esito.risultati.length > 0
                ? `Precedenti pertinenti (${esito.risultati.length})`
                : "Nessun precedente trovato"}
            </h3>
          </div>
          {esito.risultati.map((r) => (
            <ResultCard key={r.id} risultato={r} onError={setError} />
          ))}
        </section>
      )}
    </div>
  );
};

export default CaseLaw;
