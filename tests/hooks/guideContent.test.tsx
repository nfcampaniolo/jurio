import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

/* ---------- mock dei singoli componenti della guida ---------- */
vi.mock("@/features/guide/components/Introduzione", () => ({
  default: () => <div data-testid="guida-introduzione">Introduzione</div>,
}));
vi.mock("@/features/guide/components/InterfacceNavigazione", () => ({
  default: () => <div data-testid="guida-interfacce">Interfacce Navigazione</div>,
}));
vi.mock("@/features/guide/components/RicercaSemantica", () => ({
  default: () => <div data-testid="guida-ricerca-semantica">Ricerca Semantica</div>,
}));
vi.mock("@/features/guide/components/ConsulenteLegale", () => ({
  default: () => <div data-testid="guida-consulente-legale">Consulente Legale</div>,
}));
vi.mock("@/features/guide/components/AnalisiDocumenti", () => ({
  default: () => <div data-testid="guida-analisi-documenti">Analisi Documenti</div>,
}));
vi.mock("@/features/guide/components/Accesso", () => ({
  default: () => <div data-testid="guida-accesso">Accesso</div>,
}));
vi.mock("@/features/guide/components/ProvaGratuita", () => ({
  default: () => <div data-testid="guida-prova-gratuita">Prova Gratuita</div>,
}));
vi.mock("@/features/guide/components/GestionePiano", () => ({
  default: () => <div data-testid="guida-gestione-piano">Gestione Piano</div>,
}));
vi.mock("@/features/guide/components/ModificaProfilo", () => ({
  default: () => <div data-testid="guida-preferenze">Modifica Profilo</div>,
}));
vi.mock("@/features/guide/components/PianiLicenze", () => ({
  default: () => <div data-testid="guida-piani">Piani e Licenze</div>,
}));
vi.mock("@/features/guide/components/AssistenzaSupporto", () => ({
  default: () => <div data-testid="guida-assistenza">Assistenza Supporto</div>,
}));
vi.mock("@/features/guide/components/AggiornamentoForzato", () => ({
  default: () => <div data-testid="guida-aggiornamento-forzato">Aggiornamento Forzato</div>,
}));
vi.mock("@/features/guide/components/GestioneTeam", () => ({
  default: () => <div data-testid="guida-gestione-team">Gestione Team</div>,
}));
vi.mock("@/features/guide/components/Cassazione", () => ({
  default: () => <div data-testid="guida-cassazione">Cassazione</div>,
}));
vi.mock("@/features/guide/components/ConsiglioStato", () => ({
  default: () => <div data-testid="guida-consiglio-di-stato">Consiglio di Stato</div>,
}));
vi.mock("@/features/guide/components/CorteCostituzionale", () => ({
  default: () => <div data-testid="guida-corte-costituzionale">Corte Costituzionale</div>,
}));
vi.mock("@/features/guide/components/QuoteUtilizzo", () => ({
  default: () => <div data-testid="guida-quote">Quote Utilizzo</div>,
}));
vi.mock("@/features/guide/components/ConfigurazioneLeChat", () => ({
  default: () => <div data-testid="guida-mcp-vibe">Configurazione MCP</div>,
}));

/* ---------- subject under test ---------- */
import { guideContent } from "@/features/guide/hooks/guideContent"; // <-- adegua il path di import se necessario

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