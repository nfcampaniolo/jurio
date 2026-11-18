import React from "react";
import { ChevronRight16Regular } from "@fluentui/react-icons";
import { AiBadge } from "../components/AiBadge";
import { PlanSummary } from "../components/AiQuota";
import { PrivacyNote } from "../components/PrivacyNote";
import { usePlan } from "../plan/PlanContext";
import { ToolId, ToolInfo, TOOLS } from "./catalog";

interface ToolHomeProps {
  onSelectTool: (tool: ToolId) => void;
}

const ToolButton: React.FC<{ tool: ToolInfo; index: number; onSelect: (id: ToolId) => void }> = ({
  tool,
  index,
  onSelect,
}) => (
  <button
    onClick={() => onSelect(tool.id)}
    className="btn-tool-card animate-slide-up"
    style={{ animationDelay: `${0.04 + index * 0.04}s` }}
  >
    <span className={`tool-icon ${tool.ai ? "ai" : ""}`}>{tool.icon}</span>
    <span className="btn-tool-item">
      <span className="btn-tool-title">{tool.titolo}</span>
      <span className="btn-tool-desc">{tool.descrizione}</span>
    </span>
    <ChevronRight16Regular className="tool-chevron" aria-hidden />
  </button>
);

function aiSectionNote(limiteMensile: number | null, pianoNoto: boolean): string {
  if (!pianoNoto) return "Essential: 10 richieste al mese · Business: incluse.";
  if (limiteMensile === null) return "Incluse nel tuo piano.";
  return `Ogni utilizzo consuma 1 richiesta AI: ${limiteMensile} al mese nel tuo piano.`;
}

const ToolHome: React.FC<ToolHomeProps> = ({ onSelectTool }) => {
  const { limiteMensile, piano } = usePlan();
  const senzaAi = TOOLS.filter((t) => !t.ai);
  const conAi = TOOLS.filter((t) => t.ai);

  return (
    <div className="page-container home">
      <div className="home-intro">
        <h1>Strumenti Jurio</h1>
        <p>Ricerca giuridica e revisione direttamente nel documento aperto.</p>
      </div>

      <PlanSummary />

      <section className="tool-section" aria-labelledby="sec-senza-ai">
        <div className="tool-section-head">
          <h2 id="sec-senza-ai">Ricerca</h2>
          <AiBadge ai={false} />
        </div>
        <p className="tool-section-note">Inclusa nel tuo piano, senza tetto mensile.</p>
        <div className="tools-grid">
          {senzaAi.map((tool, i) => (
            <ToolButton key={tool.id} tool={tool} index={i} onSelect={onSelectTool} />
          ))}
        </div>
      </section>

      <section className="tool-section" aria-labelledby="sec-ai">
        <div className="tool-section-head">
          <h2 id="sec-ai">Assistenza AI</h2>
          <AiBadge ai />
        </div>
        <p className="tool-section-note">{aiSectionNote(limiteMensile, Boolean(piano))}</p>
        <div className="tools-grid">
          {conAi.map((tool, i) => (
            <ToolButton
              key={tool.id}
              tool={tool}
              index={i + senzaAi.length}
              onSelect={onSelectTool}
            />
          ))}
        </div>
      </section>

      <p className="trust-note">
        Ogni proposta resta una bozza: nulla viene modificato nel documento finché non lo confermi
        tu.
      </p>
      <PrivacyNote />
    </div>
  );
};

export default ToolHome;
