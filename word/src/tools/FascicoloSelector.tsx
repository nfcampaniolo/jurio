import React from "react";
import { Folder16Regular } from "@fluentui/react-icons";
import { PastFascicolo } from "../firebase/functions";
import { useFascicoloSelector } from "./utils";

interface Props {
  selected: PastFascicolo | null;
  onSelect: (f: PastFascicolo | null) => void;
  disabled?: boolean; // Disabilita la scelta durante le chiamate AI
}

export const FascicoloSelector: React.FC<Props> = ({ selected, onSelect, disabled }) => {
  const { searchQuery, setSearchQuery, isLoading, error, filteredFascicoli, handleSelect } =
    useFascicoloSelector(onSelect);

  return (
    <div className="form-group fascicolo-group">
      <label htmlFor="fascicolo-search">Fascicolo di riferimento (facoltativo)</label>

      {selected ? (
        <div className="selected-tag">
          <span className="selected-name">
            <Folder16Regular aria-hidden />
            <strong>{selected.title}</strong>
          </span>
          {!disabled && (
            <button type="button" onClick={() => handleSelect(null)} className="btn-link">
              Cambia
            </button>
          )}
        </div>
      ) : (
        <>
          <input
            id="fascicolo-search"
            type="text"
            placeholder="Cerca tra i tuoi fascicoli..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={disabled}
          />

          <div className="fascicoli-list">
            {error ? (
              <p className="fascicoli-empty validation-msg">{error}</p>
            ) : isLoading ? (
              <p className="fascicoli-empty">Caricamento fascicoli...</p>
            ) : filteredFascicoli.length > 0 ? (
              filteredFascicoli.map((f) => (
                <button
                  type="button"
                  key={f.id}
                  className="fascicolo-item"
                  onClick={() => handleSelect(f)}
                  disabled={disabled}
                >
                  <span className="fascicolo-title">{f.title}</span>
                  {f.updatedAt && <span className="fascicolo-date">{f.updatedAt}</span>}
                </button>
              ))
            ) : (
              <p className="fascicoli-empty">Nessun fascicolo trovato.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};
