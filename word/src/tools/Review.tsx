// Review.tsx
/// <reference types="office-js" />
import React, { useState, useEffect, useRef } from "react";
import { fetchWithSecurity } from "../firebase/functions";
import { TesiReview } from "./types";
import { isWordEnvironment, formattaTitoloFonte, spezzaTesto } from "./utils";
import { DocumentInputArea } from "./DocumentInputArea";
import { readSseStream } from "./sse";
import { WORD_AGENT_URL, giurisprudenzaUrl } from "../config/env";
import { ArrowUpRight12Regular, Comment16Regular } from "@fluentui/react-icons";
import { useMemoryState } from "./memoryState";
import { PromptSelector } from "../components/PromptSelector";
import { AiQuotaNote } from "../components/AiQuota";
import { usePlan } from "../plan/PlanContext";

/** Solo link http(s): blocca javascript: e simili eventualmente prodotti dal modello. */
const safeHttpUrl = (url?: string): string | undefined =>
  url && /^https?:\/\//i.test(url) ? url : undefined;

const buildCommentText = (tesi: TesiReview): string => {
  let testo = `[SEMAFORO ${tesi.semaforo}]\n${tesi.motivazione}\n\nORIENTAMENTO:\n${tesi.orientamento}`;
  if (tesi.fonti && tesi.fonti.length > 0) {
    testo += `\n\nFONTI PRINCIPALI:\n`;
    tesi.fonti.forEach((f) => {
      testo += `- ${f.titolo || f.riferimento}\n`;
      if (f.id) testo += `  Link: ${giurisprudenzaUrl(f.id)}\n`;
    });
  }
  return testo;
};

const Review: React.FC = () => {
  // ─────────────────────────────────────────────
  // STATI CON CACHE E LOGS
  // ─────────────────────────────────────────────

  const { aiEsaurita, refresh } = usePlan();
  const [testoAtto, setTestoAtto] = useMemoryState("review_testoAtto", "");
  const [istruzioni, setIstruzioni] = useMemoryState("review_istruzioni", "");
  const [promptId, setPromptId] = useMemoryState("review_promptId", "");
  const [risultati, setRisultati] = useMemoryState<TesiReview[]>("review_risultati", []);

  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");

  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // ─────────────────────────────────────────────
  // SINCRONIZZAZIONE CACHE E AUTO-SCROLL
  // ─────────────────────────────────────────────

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // ─────────────────────────────────────────────
  // UTILS UI: Ripulisci e Svuota Cache
  // ─────────────────────────────────────────────

  const handleClear = () => {
    setRisultati([]);
    setTestoAtto("");
    setIstruzioni("");
    setStatusMessage("");
    setError("");
    setLogs([]);
  };

  // ─────────────────────────────────────────────
  // HELPER DI RICERCA ROBUSTA (Gestisce newline e troncamenti)
  // ─────────────────────────────────────────────
  const cercaRangePerTesto = async (
    context: Word.RequestContext,
    testoOriginale: string
  ): Promise<Word.Range | null> => {
    if (!testoOriginale) return null;

    const testoPulito = testoOriginale.replace(/[\r\n]+/g, " ").trim();

    let snippet = testoPulito.substring(0, 100);
    let searchResults = context.document.body.search(snippet, {
      matchCase: false,
      ignoreSpace: true,
    });
    searchResults.load("items");
    await context.sync();
    if (searchResults.items.length > 0) return searchResults.items[0];

    snippet = testoPulito.substring(0, 50);
    searchResults = context.document.body.search(snippet, { matchCase: false, ignoreSpace: true });
    searchResults.load("items");
    await context.sync();
    if (searchResults.items.length > 0) return searchResults.items[0];

    const parole = testoPulito.split(" ").slice(0, 4).join(" ");
    if (parole.length > 4) {
      searchResults = context.document.body.search(parole, { matchCase: false, ignoreSpace: true });
      searchResults.load("items");
      await context.sync();
      if (searchResults.items.length > 0) return searchResults.items[0];
    }

    return null;
  };

  // ─────────────────────────────────────────────
  // 2. OFFICE.JS: Iniezione Chirurgica Commenti
  // ─────────────────────────────────────────────

  const handleInsertComment = async (tesi: TesiReview) => {
    if (!isWordEnvironment(setError)) return;
    try {
      await Word.run(async (context) => {
        const targetRange = await cercaRangePerTesto(context, tesi.testoOriginale);

        if (targetRange) {
          targetRange.insertComment(buildCommentText(tesi));
          await context.sync();
        } else {
          console.error("❌ [ERRORE MATCH] Testo originale non trovato:", tesi.testoOriginale);
          setError(
            `Impossibile trovare una corrispondenza esatta nel documento per appuntare il commento.\n${tesi.testoOriginale}`
          );
        }
      });
    } catch (err) {
      console.error("Errore inserimento commento:", err);
      setError("Errore durante l'inserimento del commento a margine.");
    }
  };

  const handleInsertAllComments = async () => {
    if (!isWordEnvironment(setError) || risultati.length === 0) return;

    try {
      await Word.run(async (context) => {
        for (const tesi of risultati) {
          const targetRange = await cercaRangePerTesto(context, tesi.testoOriginale);

          if (targetRange) {
            targetRange.insertComment(buildCommentText(tesi));
          }
        }
        await context.sync();
      });
    } catch (err) {
      console.error("Errore inserimento multiplo commenti:", err);
      setError("Si è verificato un errore durante l'inserimento massivo dei commenti.");
    }
  };

  // ─────────────────────────────────────────────
  // 3. CHIAMATA API (Con Streaming Blindato)
  // ─────────────────────────────────────────────

  const handleReview = async () => {
    if (!testoAtto.trim()) {
      setError("Inserisci o cattura il testo da analizzare.");
      return;
    }

    setIsLoading(true);
    setError("");
    setRisultati([]);
    setLogs([]);
    setStatusMessage("Avvio analisi di conformità...");

    try {
      const chunks = spezzaTesto(testoAtto);
      const payload = {
        action: "review",
        chunks: chunks,
        promptIndirizzamento: istruzioni,
        ...(promptId ? { promptId } : {}),
      };

      const response = await fetchWithSecurity(WORD_AGENT_URL, payload);

      await readSseStream<{ tesi?: TesiReview[] }>(response, {
        onStatus: (statusText) => {
          setStatusMessage(statusText);
          setLogs((prev) => (prev[prev.length - 1] === statusText ? prev : [...prev, statusText]));
        },
        onResult: (result) => setRisultati(result?.tesi ?? []),
      });
    } catch (err: unknown) {
      console.error("Errore handleReview:", err);
      const errorMsg = err instanceof Error ? err.message : "Errore sconosciuto";
      setError(errorMsg);
    } finally {
      setIsLoading(false);
      setStatusMessage("");
      void refresh();
    }
  };

  // ─────────────────────────────────────────────
  // STILI SEMAFORO
  // ─────────────────────────────────────────────
  const getSemaforoClass = (colore: string) => {
    switch (colore) {
      case "VERDE":
        return "tesi-verde";
      case "GIALLO":
        return "tesi-giallo";
      case "ROSSO":
        return "tesi-rosso";
      default:
        return "";
    }
  };

  return (
    <div className="tool-body">
      <PromptSelector value={promptId} onChange={setPromptId} disabled={isLoading} />

      {/* INPUT AREA (Componentizzato) */}
      <DocumentInputArea
        testo={testoAtto}
        setTesto={setTestoAtto}
        istruzioni={istruzioni}
        setIstruzioni={setIstruzioni}
        isLoading={isLoading}
        onError={setError}
        labelIstruzioni="Istruzioni (facoltative)"
        placeholderIstruzioni="es. Fai attenzione alla validità della clausola risolutiva"
      />

      {/* ERRORI */}
      {error && <div className="error-box">{error}</div>}

      {/* BOTTONE PRINCIPALE */}
      {!isLoading && (
        <>
          <button
            onClick={handleReview}
            disabled={!testoAtto.trim() || aiEsaurita}
            className="btn-primary"
          >
            Analizza Conformità
          </button>
          <AiQuotaNote />
        </>
      )}

      {/* LOADER & TERMINALE */}
      {isLoading && (
        <div className="loader-container animate-slide-up" role="status">
          <div className="loader-header">
            <div className="loader-spinner-inline"></div>
            <span className="loader-status-text">{statusMessage || "Analisi in corso..."}</span>
          </div>

          {/* Terminale di Log */}
          <div className="terminal-logs">
            {logs.length === 0 && (
              <span className="terminal-empty">Inizializzazione connessione...</span>
            )}

            {logs.map((log, index) => (
              <div key={index} className="terminal-line">
                <span className="terminal-timestamp">[{new Date().toLocaleTimeString()}]</span>
                {log}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}

      {/* RISULTATI */}
      {!isLoading && risultati.length > 0 && (
        <div className="results-section">
          <div className="results-header">
            <h3>Elementi Rilevati ({risultati.length})</h3>
          </div>
          <div className="results-toolbar">
            <button onClick={handleInsertAllComments} className="btn-small primary">
              <Comment16Regular aria-hidden />
              Appunta Tutti
            </button>
            <button onClick={handleClear} className="btn-small">
              Ripulisci
            </button>
          </div>

          {risultati.map((tesi, idx) => (
            <div
              key={tesi.id || idx}
              className={`tesi-card animate-slide-up ${getSemaforoClass(tesi.semaforo)}`}
            >
              <div className="tesi-card-header">
                <span className={`tesi-badge ${getSemaforoClass(tesi.semaforo)}`}>
                  {tesi.semaforo}
                </span>
              </div>

              <div className="tesi-sintesi">
                <p className="tesi-label">Tesi</p>
                <p className="tesi-text">“{tesi.tesiGiuridica}”</p>
              </div>

              <div className="tesi-inner-box">
                <p className="verdetto-title">Verdetto</p>
                <p>{tesi.motivazione}</p>
                {tesi.notaRicerca && <p className="nota-ricerca">Nota: {tesi.notaRicerca}</p>}
              </div>

              {tesi.contrasti && tesi.contrasti.length > 0 && (
                <div className="contrasti-box">
                  <p className="verdetto-title">Orientamenti difformi</p>
                  <ul>
                    {tesi.contrasti.map((c, cIdx) => (
                      <li key={cIdx}>
                        <strong>{c.riferimento}</strong>
                        {c.descrizione ? ` — ${c.descrizione}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button onClick={() => handleInsertComment(tesi)} className="btn-card-action">
                <Comment16Regular aria-hidden />
                Appunta a margine
              </button>

              {tesi.fonti && tesi.fonti.length > 0 && (
                <div className="fonti-container">
                  <p className="fonti-title">Fonti di riferimento</p>
                  {tesi.fonti.map((fonte, fIdx) => (
                    <div key={fIdx} className="fonte-box">
                      {fonte.id || safeHttpUrl(fonte.url) ? (
                        <a
                          href={fonte.id ? giurisprudenzaUrl(fonte.id) : safeHttpUrl(fonte.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="fonte-header"
                        >
                          <span className="fonte-nome">
                            {formattaTitoloFonte(fonte.titolo || fonte.riferimento || "Fonte")}
                          </span>
                          <span className="fonte-icona" aria-hidden="true">
                            <ArrowUpRight12Regular />
                          </span>
                        </a>
                      ) : (
                        <span className="fonte-nome">{fonte.riferimento || fonte.titolo}</span>
                      )}
                      {fonte.rilevanza && (
                        <span className="fonte-rilevanza">{fonte.rilevanza}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Review;
