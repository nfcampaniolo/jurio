import React, { useEffect, useState } from "react";
import { PromptOption, PromptsResponse, postWordAgent } from "../api/wordApi";
import { useMemoryState } from "../tools/memoryState";
import { PLAYBOOK_URL } from "./AiQuota";

interface Props {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

/** Scelta dei criteri di revisione: standard, prompt di analisi Jurio o playbook personali. */
export const PromptSelector: React.FC<Props> = ({ value, onChange, disabled }) => {
  const [prompts, setPrompts] = useMemoryState<PromptsResponse | null>("review_prompts", null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (prompts) return undefined;
    let cancelled = false;
    postWordAgent<PromptsResponse>({ action: "prompts" })
      .then((data) => !cancelled && setPrompts(data))
      .catch(() => !cancelled && setError("Impossibile caricare prompt e playbook."));
    return () => {
      cancelled = true;
    };
  }, [prompts, setPrompts]);

  const all: PromptOption[] = [...(prompts?.jurio ?? []), ...(prompts?.playbook ?? [])];
  const selected = all.find((p) => p.id === value);

  return (
    <div className="form-group">
      <div className="form-group-header">
        <label htmlFor="review-prompt">Criteri di revisione</label>
        <a href={PLAYBOOK_URL} target="_blank" rel="noopener noreferrer" className="btn-link">
          Crea un playbook
        </a>
      </div>
      <select
        id="review-prompt"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || (!prompts && !error)}
      >
        <option value="">Standard: verifica di tesi e clausole</option>
        {prompts && prompts.jurio.length > 0 && (
          <optgroup label="Prompt di analisi Jurio">
            {prompts.jurio.map((p) => (
              <option key={p.id} value={p.id}>
                {p.titolo}
              </option>
            ))}
          </optgroup>
        )}
        {prompts && prompts.playbook.length > 0 && (
          <optgroup label="I tuoi playbook">
            {prompts.playbook.map((p) => (
              <option key={p.id} value={p.id}>
                {p.titolo}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      {selected?.obiettivo && <p className="field-help">{selected.obiettivo}</p>}
      {error && <span className="validation-msg">{error}</span>}
    </div>
  );
};
