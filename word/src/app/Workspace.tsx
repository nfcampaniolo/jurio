import React, { Suspense, lazy, useState } from "react";
import type { User } from "firebase/auth";
import { ArrowLeft16Regular, SignOut20Regular } from "@fluentui/react-icons";

import { logout } from "../firebase/auth";
import { LOGO_URL } from "../config/env";
import { PlanProvider } from "../plan/PlanContext";
import { AiBadge } from "../components/AiBadge";
import { ToolId, toolById } from "../tools/catalog";

import ToolHome from "../tools/ToolHome";

interface WorkspaceProps {
  user: User;
}

// Ogni strumento è un file separato scaricato solo quando lo si apre: il pannello parte più leggero.
const TOOL_COMPONENTS: Record<ToolId, React.LazyExoticComponent<React.FC>> = {
  database: lazy(() => import(/* webpackChunkName: "tool-database" */ "../tools/DatabaseSearch")),
  ask: lazy(() => import(/* webpackChunkName: "tool-ask" */ "../tools/Ask")),
  compliance: lazy(() => import(/* webpackChunkName: "tool-review" */ "../tools/Review")),
  caseLaw: lazy(() => import(/* webpackChunkName: "tool-caselaw" */ "../tools/CaseLaw")),
  search: lazy(() => import(/* webpackChunkName: "tool-search" */ "../tools/Search")),
  redrafting: lazy(() => import(/* webpackChunkName: "tool-redrafting" */ "../tools/Redrafting")),
};

const ToolLoading: React.FC = () => (
  <div className="tool-loading" role="status">
    <span className="loader-spinner-inline" aria-hidden />
    Caricamento...
  </div>
);

const ToolView: React.FC<{ id: ToolId; onBack: () => void }> = ({ id, onBack }) => {
  const tool = toolById(id);
  const Component = TOOL_COMPONENTS[id];
  return (
    <div className="page-container">
      <div className="tool-card">
        <div className="card-header-bar" />
        <div className="card-content">
          <button type="button" className="back-link" onClick={onBack}>
            <ArrowLeft16Regular aria-hidden />
            Strumenti
          </button>
          <div className="card-title">
            <div className="title-row">
              <h1>{tool.titolo}</h1>
              <AiBadge ai={tool.ai} />
            </div>
            <p>{tool.descrizione}</p>
          </div>
          <Suspense fallback={<ToolLoading />}>
            <Component />
          </Suspense>
        </div>
      </div>
    </div>
  );
};

const Workspace: React.FC<WorkspaceProps> = ({ user }) => {
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const iniziale = (user.displayName || user.email || "?").trim().charAt(0);

  return (
    <PlanProvider>
      <div className="app-shell">
        <header className="app-header">
          <button onClick={() => setActiveTool(null)} className="app-logo">
            <img src={LOGO_URL} alt="" />
            Jurio
          </button>

          <div className="user-info">
            <span className="user-avatar" aria-hidden="true">
              {iniziale}
            </span>
            <span className="user-email" title={user.email ?? undefined}>
              {user.email}
            </span>
            <button
              onClick={() => void logout()}
              className="btn-icon"
              aria-label="Esci"
              title="Esci"
            >
              <SignOut20Regular aria-hidden />
            </button>
          </div>
        </header>

        <main className="app-main">
          {activeTool ? (
            <ToolView key={activeTool} id={activeTool} onBack={() => setActiveTool(null)} />
          ) : (
            <ToolHome onSelectTool={setActiveTool} />
          )}
        </main>
      </div>
    </PlanProvider>
  );
};

export default Workspace;
