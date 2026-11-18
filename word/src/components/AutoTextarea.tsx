/* global window */
import React, { useLayoutEffect, useRef, useState } from "react";
import { DictationButton } from "./DictationButton";

type TextareaProps = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange" | "rows"
>;

interface Props extends TextareaProps {
  value: string;
  onValueChange: (value: string) => void;
  minRows?: number;
  maxRows?: number;
  /** Pulsante di dettatura dentro il campo (default: sì). */
  dictation?: boolean;
  /** Errori di dettatura; se assente vengono mostrati sotto il campo. */
  onDictationError?: (message: string) => void;
}

/** Aggiunge il testo dettato in coda a quello già scritto. */
export const appendDictation = (current: string, dictated: string) =>
  current.trim() ? `${current.replace(/\s+$/, "")} ${dictated}` : dictated;

/** Campo di testo che si allarga col contenuto (fino a maxRows) e offre la dettatura. */
export const AutoTextarea: React.FC<Props> = ({
  value,
  onValueChange,
  minRows = 1,
  maxRows = 8,
  dictation = true,
  onDictationError,
  className,
  disabled,
  ...rest
}) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [dictationError, setDictationError] = useState("");

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const style = window.getComputedStyle(el);
    const line = parseFloat(style.lineHeight) || 21;
    const extra =
      (parseFloat(style.paddingTop) || 0) +
      (parseFloat(style.paddingBottom) || 0) +
      (parseFloat(style.borderTopWidth) || 0) +
      (parseFloat(style.borderBottomWidth) || 0);
    const min = line * minRows + extra;
    const max = line * maxRows + extra;
    el.style.height = "auto";
    const borders =
      (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0);
    const next = Math.min(Math.max(el.scrollHeight + borders, min), max);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, [value, minRows, maxRows]);

  const reportError = (message: string) => {
    if (onDictationError) onDictationError(message);
    else setDictationError(message);
  };

  return (
    <div className={`auto-field ${dictation ? "with-dictation" : ""}`}>
      <textarea
        {...rest}
        ref={ref}
        rows={minRows}
        value={value}
        disabled={disabled}
        className={className}
        onChange={(e) => {
          setDictationError("");
          onValueChange(e.target.value);
        }}
      />
      {dictation && (
        <DictationButton
          className="in-field"
          disabled={disabled}
          onError={reportError}
          onText={(text) => {
            setDictationError("");
            onValueChange(appendDictation(value, text));
          }}
        />
      )}
      {dictationError && <span className="validation-msg">{dictationError}</span>}
    </div>
  );
};
