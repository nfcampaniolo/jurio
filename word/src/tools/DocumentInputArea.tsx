// src/components/DocumentInputArea.tsx
/// <reference types="office-js" />
import React from "react";
import { isWordEnvironment } from "./utils";
import { AutoTextarea } from "../components/AutoTextarea";

interface Props {
  testo: string;
  setTesto: (val: string) => void;
  istruzioni: string;
  setIstruzioni: (val: string) => void;
  isLoading: boolean;
  onError: (msg: string) => void;
  labelIstruzioni?: string;
  placeholderIstruzioni?: string;
}

export const DocumentInputArea: React.FC<Props> = ({
  testo,
  setTesto,
  istruzioni,
  setIstruzioni,
  isLoading,
  onError,
  labelIstruzioni = "Istruzioni (facoltative)",
  placeholderIstruzioni = "es. Fai attenzione alla validità della clausola...",
}) => {
  const handleGetSelection = async () => {
    if (!isWordEnvironment(onError)) return;
    try {
      await Word.run(async (context) => {
        const selection = context.document.getSelection();
        selection.load("text");
        await context.sync();
        if (selection.text.trim()) setTesto(selection.text);
      });
    } catch (err) {
      console.error("Errore lettura Word:", err);
      onError("Assicurati di aver selezionato del testo.");
    }
  };

  const handleGetFullDocument = async () => {
    if (!isWordEnvironment(onError)) return;
    try {
      await Word.run(async (context) => {
        const body = context.document.body;
        body.load("text");
        await context.sync();
        if (body.text.trim()) setTesto(body.text);
      });
    } catch (err) {
      console.error("Errore lettura documento Word:", err);
      onError("Impossibile leggere il documento intero.");
    }
  };

  return (
    <div className="form-layout">
      <div className="form-group">
        <div className="form-group-header">
          <label htmlFor="doc-testo">Testo in esame</label>
          <div className="actions-inline">
            <button
              type="button"
              onClick={handleGetSelection}
              className="btn-link"
              disabled={isLoading}
            >
              Selezione
            </button>
            <span className="sep" aria-hidden="true">
              ·
            </span>
            <button
              type="button"
              onClick={handleGetFullDocument}
              className="btn-link"
              disabled={isLoading}
            >
              Tutto l'atto
            </button>
          </div>
        </div>
        <AutoTextarea
          id="doc-testo"
          minRows={5}
          maxRows={12}
          placeholder="Clicca 'Selezione' o 'Tutto l'atto' per caricare il testo da analizzare..."
          value={testo}
          onValueChange={setTesto}
          onDictationError={onError}
          disabled={isLoading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="doc-istruzioni">{labelIstruzioni}</label>
        <AutoTextarea
          id="doc-istruzioni"
          minRows={1}
          maxRows={5}
          placeholder={placeholderIstruzioni}
          value={istruzioni}
          onValueChange={setIstruzioni}
          onDictationError={onError}
          disabled={isLoading}
        />
      </div>
    </div>
  );
};
