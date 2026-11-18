import React from "react";
import { Sparkle12Filled } from "@fluentui/react-icons";

/** Etichetta che distingue gli strumenti con modelli generativi da quelli senza. */
export const AiBadge: React.FC<{ ai: boolean }> = ({ ai }) =>
  ai ? (
    <span className="ai-badge ai" title="Usa l'intelligenza artificiale generativa">
      <Sparkle12Filled aria-hidden />
      AI
    </span>
  ) : (
    <span className="ai-badge free" title="Ricerca diretta in banca dati, senza AI generativa">
      Senza AI
    </span>
  );
