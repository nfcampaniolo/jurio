import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

/* ---------- mock dei singoli componenti della guida ---------- */
vi.mock("@/components/Guida/Introduzione", () => ({
  default: () => <div data-testid="guida-introduzione">Introduzione</div>,
}));
vi.mock("@/components/Guida/InterfacceNavigazione", () => ({
  default: () => <div data-testid="guida-interfacce">Interfacce Navigazione</div>,
}));
vi.mock("@/components/Guida/RicercaSemantica", () => ({
  default: () => <div data-testid="guida-ricerca-semantica">Ricerca Semantica</div>,
}));
vi.mock("@/components/Guida/ConsulenteLegale", () => ({
  default: () => <div data-testid="guida-consulente-legale">Consulente Legale</div>,
}));
vi.mock("@/components/Guida/AnalisiDocumenti", () => ({
  default: () => <div data-testid="guida-analisi-documenti">Analisi Documenti</div>,
}));
vi.mock("@/components/Guida/Accesso", () => ({
  default: () => <div data-testid="guida-accesso">Accesso</div>,
}));
vi.mock("@/components/Guida/ProvaGratuita", () => ({
  default: () => <div data-testid="guida-prova-gratuita">Prova Gratuita</div>,
}));
vi.mock("@/components/Guida/GestionePiano", () => ({
  default: () => <div data-testid="guida-gestione-piano">Gestione Piano</div>,
}));
vi.mock("@/components/Guida/ModificaProfilo", () => ({
  default: () => <div data-testid="guida-preferenze">Modifica Profilo</div>,
}));
vi.mock("@/components/Guida/PianiLicenze", () => ({
  default: () => <div data-testid="guida-piani">Piani e Licenze</div>,
}));
vi.mock("@/components/Guida/AssistenzaSupporto", () => ({
  default: () => <div data-testid="guida-assistenza">Assistenza Supporto</div>,
}));
vi.mock("@/components/Guida/AggiornamentoForzato", () => ({
  default: () => <div data-testid="guida-aggiornamento-forzato">Aggiornamento Forzato</div>,
}));
vi.mock("@/components/Guida/GestioneTeam", () => ({
  default: () => <div data-testid="guida-gestione-team">Gestione Team</div>,
}));
vi.mock("@/components/Guida/Cassazione", () => ({
  default: () => <div data-testid="guida-cassazione">Cassazione</div>,
}));
vi.mock("@/components/Guida/ConsiglioStato", () => ({
  default: () => <div data-testid="guida-consiglio-di-stato">Consiglio di Stato</div>,
}));
vi.mock("@/components/Guida/CorteCostituzionale", () => ({
  default: () => <div data-testid="guida-corte-costituzionale">Corte Costituzionale</div>,
}));
vi.mock("@/components/Guida/QuoteUtilizzo", () => ({
  default: () => <div data-testid="guida-quote">Quote Utilizzo</div>,
}));
vi.mock("@/components/Guida/ConfigurazioneLeChat", () => ({
  default: () => <div data-testid="guida-mcp-vibe">Configurazione MCP</div>,
}));

/* ---------- subject under test ---------- */
import { guideContent } from "@/hooks/guideContent"; // <-- adegua il path di import se necessario

describe("Guide Content Registry Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const expectedEntries: Array<[string, string]> = [
    ["introduzione", "guida-introduzione"],
    ["interfacce", "guida-interfacce"],
    ["ricerca-semantica", "guida-ricerca-semantica"],
    ["consulente-legale", "guida-consulente-legale"],
    ["analisi-documenti", "guida-analisi-documenti"],
    ["accesso", "guida-accesso"],
    ["prova-gratuita", "guida-prova-gratuita"],
    ["gestione-piano", "guida-gestione-piano"],
    ["preferenze", "guida-preferenze"],
    ["piani", "guida-piani"],
    ["assistenza", "guida-assistenza"],
    ["aggiornamento-forzato", "guida-aggiornamento-forzato"],
    ["gestione-team", "guida-gestione-team"],
    ["cassazione", "guida-cassazione"],
    ["consiglio-di-stato", "guida-consiglio-di-stato"],
    ["corte-costituzionale", "guida-corte-costituzionale"],
    ["quote", "guida-quote"],
    ["mcp-vibe", "guida-mcp-vibe"],
  ];

  describe("Integrità del Registro delle Rotte", () => {
    test("contiene esattamente le 18 sezioni censite", () => {
      expect(Object.keys(guideContent)).toHaveLength(18);
    });

    test("tutti gli slug rispettano il pattern kebab-case minuscolo", () => {
      const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
      Object.keys(guideContent).forEach((slug) => {
        expect(slug).toMatch(slugRegex);
      });
    });

    test("ogni entry è un elemento React valido", () => {
      Object.entries(guideContent).forEach(([, element]) => {
        expect(React.isValidElement(element)).toBe(true);
      });
    });

    test("restituisce undefined per slug inesistenti o non censiti", () => {
      expect(guideContent["sezione-inesistente"]).toBeUndefined();
      expect(guideContent[""]).toBeUndefined();
    });
  });

  describe("Rendering dei Singoli Componenti Mappati", () => {
    test.each(expectedEntries)(
      "renderizza correttamente il componente associato allo slug '%s'",
      (slug, expectedTestId) => {
        const { unmount } = render(<>{guideContent[slug]}</>);

        expect(screen.getByTestId(expectedTestId)).toBeInTheDocument();
        unmount();
      }
    );
  });
});