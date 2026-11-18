// FonteCard.tsx
import React from "react";
import { Fonte } from "./types";
import { formattaScore, formattaTitoloFonte } from "./utils";
import { giurisprudenzaUrl } from "../config/env";

interface FonteCardProps {
  fonte: Fonte;
}

const FonteCard: React.FC<FonteCardProps> = ({ fonte }) => {
  const titolo = formattaTitoloFonte(fonte.titolo || "");
  return (
    <div className="fonte-item">
      {fonte.id ? (
        <a
          href={giurisprudenzaUrl(fonte.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="fonte-link"
          title={fonte.titolo}
        >
          {titolo}
        </a>
      ) : (
        <span className="fonte-link">{titolo}</span>
      )}
      {typeof fonte.score === "number" && (
        <span className="fonte-score">{formattaScore(fonte.score)}</span>
      )}
    </div>
  );
};

export default FonteCard;
