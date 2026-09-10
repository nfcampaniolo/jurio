import React from "react";

interface RiquadroFonteProps {
  attivo: boolean;
  etichetta: string;
  descrizione: string;
}

export const RiquadroFonte: React.FC<RiquadroFonteProps> = ({
  attivo,
  etichetta,
  descrizione,
}) => (
  <div
    className={`rounded-lg border px-3 py-2.5 ${
      attivo
        ? "border-(--color-text)/20 bg-(--color-bg)"
        : "border-(--color-border) opacity-50"
    }`}
  >
    <div className="flex items-center gap-2">
      <div
        className={`h-1.5 w-1.5 rounded-full ${
          attivo ? "bg-(--color-text)" : "bg-(--color-muted)"
        }`}
      />
      <span className="text-[11px] font-semibold text-(--color-text)">
        {etichetta}
      </span>
    </div>

    <p className="mt-1 pl-3.5 text-[10px] leading-4 text-(--color-muted)">
      {descrizione}
    </p>
  </div>
);