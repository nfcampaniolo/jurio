import React, { useState } from "react";
import { ArrowUpRight12Regular } from "@fluentui/react-icons";
import type { RisultatoRicerca } from "../api/wordApi";
import { giurisprudenzaUrl } from "../config/env";
import { formattaScore } from "../tools/utils";
import { footnotesSupported, insertCitation, insertFootnote } from "../tools/word";

/** Stessi valori di `tipoMassimaLabels` in RenderGiurisprudenza (webapp). */
const TIPO_MASSIMA_LABEL: Record<string, string> = {
  conforme: "Conforme",
  difforme: "Difforme",
  principio_nuovo: "Principio nuovo",
  di_specie: "Di specie",
  con_fattispecie: "Con fattispecie",
  non_massimabile: "Non massimabile",
};

export const tipoMassimaLabel = (tipo: string | null): string | null => {
  if (!tipo) return null;
  const key = tipo.trim().toLowerCase().replace(/\s+/g, "_");
  return TIPO_MASSIMA_LABEL[key] ?? tipo.replace(/_/g, " ");
};

export const citazione = (r: RisultatoRicerca): string =>
  r.ecli ? `${r.titolo} (${r.ecli})` : r.titolo;

interface Props {
  risultato: RisultatoRicerca;
  onError: (message: string) => void;
}

/** Provvedimento trovato in banca dati, con azioni di inserimento nel documento. */
export const ResultCard: React.FC<Props> = ({ risultato, onError }) => {
  const [espanso, setEspanso] = useState(false);
  const [esito, setEsito] = useState("");
  const url = giurisprudenzaUrl(risultato.id);
  const tipo = tipoMassimaLabel(risultato.tipoMassima);

  const run = async (action: () => Promise<void>, ok: string) => {
    try {
      await action();
      setEsito(ok);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Operazione non riuscita.");
    }
  };

  return (
    <article className="result-card">
      <header className="result-card-head">
        <a href={url} target="_blank" rel="noopener noreferrer" className="result-title">
          {risultato.titolo}
          <ArrowUpRight12Regular aria-hidden />
        </a>
        {typeof risultato.score === "number" && (
          <span className="fonte-score">{formattaScore(risultato.score)}</span>
        )}
      </header>

      {(tipo || risultato.ecli) && (
        <div className="result-meta">
          {tipo && (
            <span className={`massima-tag ${risultato.tipoMassima?.toLowerCase() ?? ""}`}>
              {tipo}
            </span>
          )}
          {risultato.ecli && <span className="result-ecli">{risultato.ecli}</span>}
        </div>
      )}

      {risultato.massima && (
        <p className={`result-massima ${espanso ? "open" : ""}`}>{risultato.massima}</p>
      )}
      {risultato.massima.length > 280 && (
        <button type="button" className="btn-link" onClick={() => setEspanso((v) => !v)}>
          {espanso ? "Riduci" : "Leggi tutta la massima"}
        </button>
      )}

      <div className="result-actions">
        <button
          type="button"
          className="btn-small"
          onClick={() =>
            void run(() => insertCitation(citazione(risultato), url), "Citazione inserita")
          }
        >
          Cita nel testo
        </button>
        {footnotesSupported() && (
          <button
            type="button"
            className="btn-small"
            onClick={() =>
              void run(() => insertFootnote(`${citazione(risultato)}.`), "Nota inserita")
            }
          >
            Nota a piè di pagina
          </button>
        )}
        {esito && (
          <span className="result-ok" role="status">
            {esito}
          </span>
        )}
      </div>
    </article>
  );
};
