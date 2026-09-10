import { describe, test, expect } from "vitest";
import { LIMITE_MASSIMO_DOCUMENTI } from "@/features/analisi/hooks/types";
import type {
  DeepAnalysisSession,
  DeepAnalysisConfig,
  PrecedenteReperito,
  MappaDialettica,
  SintesiStrategica,
  LogStep,
} from "@/features/analisi/hooks/types";

describe("Deep Analysis Types and Constants Suite", () => {
  test("verifica il valore della costante LIMITE_MASSIMO_DOCUMENTI", () => {
    expect(LIMITE_MASSIMO_DOCUMENTI).toBe(10);
  });

  test("consente la creazione di oggetti strutturalmente conformi alle interfacce di sessione", () => {
    const config: DeepAnalysisConfig = {
      confidenceLevel: 85,
      sourceWeb: true,
      sourceInternalDB: true,
      temperature: 0.2,
      topK: 5,
    };

    const precedente: PrecedenteReperito = {
      id: "cass-100",
      fonte: "interna",
      gradoPertinenza: 90,
    };

    const mappa: MappaDialettica = {
      orientamentoFavorevole: {
        titoloTesi: "Tesi a favore",
        argomentazioneLogica: "Motivazione logica",
        fonti: [precedente],
      },
      orientamentoContrario: null,
      puntiAperti: ["Punto 1"],
    };

    const sintesi: SintesiStrategica = {
      titoloReport: "Report",
      executiveSummary: "Summary",
      contestoENorme: "Contesto",
      argomentazioniAzione: ["Arg 1"],
      rischiEEccezioni: ["Rischio 1"],
      conclusioniStrategiche: "Conclusioni",
    };

    const session: DeepAnalysisSession = {
      id: "sess-1",
      userId: "user-1",
      title: "Indagine Test",
      status: "review",
      promptOriginale: "Quesito",
      documentiAllegati: [],
      configurazione: config,
      mappaDialettica: mappa,
      sintesiStrategica: sintesi,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(session.id).toBe("sess-1");
    expect(session.status).toBe("review");
    expect(session.configurazione.confidenceLevel).toBe(85);
    expect(session.mappaDialettica?.orientamentoFavorevole?.fonti[0].id).toBe("cass-100");
  });

  test("valida i tipi letterali per LogStep", () => {
    const logStep: LogStep = {
      id: "1",
      timestamp: "12:00",
      message: "Inizializzazione completata",
      status: "success",
    };

    expect(logStep.status).toBe("success");
  });
});