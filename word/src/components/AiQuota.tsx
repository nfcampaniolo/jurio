import React from "react";
import { PIANO_LABEL, usePlan } from "../plan/PlanContext";

export const PIANI_URL = "https://jurio.it/profilo/piani";
export const PLAYBOOK_URL = "https://jurio.it/profilo/prompt-builder";

/** Riga sotto il pulsante di uno strumento AI: costo della richiesta e richieste residue. */
export const AiQuotaNote: React.FC = () => {
  const { loading, piano, limiteMensile, rimaste, aiEsaurita } = usePlan();
  if (loading || !piano) return null;

  if (aiEsaurita) {
    return (
      <div className="quota-box exhausted" role="status">
        <strong>Richieste AI del mese esaurite.</strong> Gli strumenti senza AI restano disponibili.
        Per un uso continuativo dell&apos;AI{" "}
        <a href={PIANI_URL} target="_blank" rel="noopener noreferrer">
          passa al piano Business
        </a>
        .
      </div>
    );
  }

  if (limiteMensile === null) {
    return <p className="quota-note">Richieste AI incluse nel piano {PIANO_LABEL[piano]}.</p>;
  }

  return (
    <p className="quota-note">
      Usa 1 richiesta AI · ne restano <strong>{rimaste}</strong> di {limiteMensile} questo mese.
    </p>
  );
};

/** Riepilogo del piano nella home degli strumenti. */
export const PlanSummary: React.FC = () => {
  const { loading, error, piano, limiteMensile, usateMese, rimaste } = usePlan();
  if (loading) return <div className="plan-summary muted">Lettura del piano...</div>;
  if (error || !piano) return null;

  const pct = limiteMensile ? Math.min(100, Math.round((usateMese / limiteMensile) * 100)) : 0;
  return (
    <div className="plan-summary">
      <div className="plan-row">
        <span className="plan-name">Piano {PIANO_LABEL[piano]}</span>
        <span className="plan-usage">
          {limiteMensile === null
            ? "Richieste AI incluse"
            : `${rimaste} di ${limiteMensile} richieste AI disponibili`}
        </span>
      </div>
      {limiteMensile !== null && (
        <div
          className="plan-meter"
          role="progressbar"
          aria-label="Richieste AI usate questo mese"
          aria-valuemin={0}
          aria-valuemax={limiteMensile}
          aria-valuenow={usateMese}
        >
          <span style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
};
