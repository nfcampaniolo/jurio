import React, { useEffect, useRef, useState } from "react";
import { postWordAgent, SearchMode, SearchResponse } from "../api/wordApi";
import { ResultCard } from "../components/ResultCard";
import { AutoTextarea } from "../components/AutoTextarea";
import { useMemoryState } from "./memoryState";
import { readSelectionText } from "./word";

const MODES: { id: SearchMode; label: string; placeholder: string; hint: string }[] = [
  {
    id: "semantic",
    label: "Concetto",
    placeholder: "es. recesso del conduttore per gravi motivi nella locazione commerciale",
    hint: "Descrivi un singolo principio o una fattispecie: la ricerca trova le massime più vicine per significato.",
  },
  {
    id: "exact",
    label: "Estremi",
    placeholder: "es. 1234/2020 oppure ECLI:IT:CASS:2020:1234CIV",
    hint: "Numero/anno, ECLI o URN del provvedimento.",
  },
  {
    id: "legal_reference",
    label: "Norma",
    placeholder: "es. art. 1456 c.c.",
    hint: "Articolo di legge o di codice: restituisce i provvedimenti che lo applicano.",
  },
];

const DatabaseSearch: React.FC = () => {
  const [mode, setMode] = useMemoryState<SearchMode>("db_mode", "semantic");
  const [query, setQuery] = useMemoryState("db_query", "");
  const [esito, setEsito] = useMemoryState<SearchResponse | null>("db_esito", null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const current = MODES.find((m) => m.id === mode) ?? MODES[0];
  const resultsRef = useRef<HTMLElement>(null);
  const pendingScroll = useRef(false);

  // A ricerca conclusa porta in vista il primo risultato (o il messaggio "Nessun risultato").
  useEffect(() => {
    if (!esito || !pendingScroll.current) return;
    pendingScroll.current = false;
    const target = resultsRef.current?.querySelector(".result-card") ?? resultsRef.current;
    target?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [esito]);

  const handleCapture = async () => {
    setError("");
    try {
      const text = (await readSelectionText()).trim();
      if (text) setQuery(text.slice(0, 1500));
      else setError("Seleziona prima un passaggio nel documento.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile leggere la selezione.");
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setEsito(null);
    try {
      pendingScroll.current = true;
      setEsito(
        await postWordAgent<SearchResponse>({ action: "search", mode, query: query.trim() })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante la ricerca.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tool-body">
      <div className="segmented" role="tablist" aria-label="Tipo di ricerca">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            className={mode === m.id ? "active" : ""}
            onClick={() => setMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="form-group">
        <div className="form-group-header">
          <label htmlFor="db-query">Cosa cerchi</label>
          <button type="button" className="btn-link" onClick={() => void handleCapture()}>
            Usa la selezione
          </button>
        </div>
        <AutoTextarea
          id="db-query"
          minRows={mode === "semantic" ? 3 : 1}
          maxRows={8}
          value={query}
          placeholder={current.placeholder}
          onValueChange={setQuery}
          onDictationError={setError}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (mode !== "semantic" || e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void handleSearch();
            }
          }}
        />
        <p className="field-help">{current.hint}</p>
      </div>

      {error && <div className="error-box">{error}</div>}

      <button
        className="btn-primary"
        onClick={() => void handleSearch()}
        disabled={loading || !query.trim()}
      >
        {loading ? "Ricerca in corso..." : "Cerca"}
      </button>

      {esito && (
        <section ref={resultsRef} className="result-section" aria-live="polite">
          <div className="results-header">
            <h3>
              {esito.risultati.length > 0
                ? `Risultati (${esito.risultati.length})`
                : "Nessun risultato"}
            </h3>
          </div>
          {esito.risultati.length === 0 && (
            <p className="muted-text">{esito.messaggio || "Prova a riformulare la ricerca."}</p>
          )}
          {esito.risultati.map((r) => (
            <ResultCard key={r.id} risultato={r} onError={setError} />
          ))}
        </section>
      )}
    </div>
  );
};

export default DatabaseSearch;
