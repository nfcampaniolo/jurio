import React from "react";
import {
  BookSearch20Regular,
  ChatMultiple20Regular,
  DocumentEdit20Regular,
  DocumentSearch20Regular,
  ShieldCheckmark20Regular,
  TextQuote20Regular,
} from "@fluentui/react-icons";

export type ToolId = "database" | "ask" | "compliance" | "caseLaw" | "search" | "redrafting";

export interface ToolInfo {
  id: ToolId;
  titolo: string;
  /** Una riga: cosa fa lo strumento. */
  descrizione: string;
  ai: boolean;
  icon: React.ReactElement;
}

export const TOOLS: ToolInfo[] = [
  {
    id: "database",
    titolo: "Ricerca in banca dati",
    descrizione:
      "Trova provvedimenti per concetto, per estremi (numero o ECLI) o per articolo di legge e inserisci la citazione.",
    ai: false,
    icon: <BookSearch20Regular aria-hidden />,
  },
  {
    id: "ask",
    titolo: "Chiedi al documento",
    descrizione: "Fai domande sull'atto aperto: risposte motivate con la giurisprudenza Jurio.",
    ai: true,
    icon: <ChatMultiple20Regular aria-hidden />,
  },
  {
    id: "compliance",
    titolo: "Revisione con semaforo",
    descrizione:
      "Esamina clausole e tesi, segnala i rischi con precedenti conformi e difformi e li annota a margine. Anche con i tuoi playbook.",
    ai: true,
    icon: <ShieldCheckmark20Regular aria-hidden />,
  },
  {
    id: "caseLaw",
    titolo: "Giurisprudenza per il documento",
    descrizione: "Sintetizza l'atto e individua in un clic i precedenti pertinenti.",
    ai: true,
    icon: <DocumentSearch20Regular aria-hidden />,
  },
  {
    id: "search",
    titolo: "Redazione con fonti",
    descrizione:
      "Redige un paragrafo argomentato su un concetto, con citazioni tratte dalla banca dati.",
    ai: true,
    icon: <TextQuote20Regular aria-hidden />,
  },
  {
    id: "redrafting",
    titolo: "Riscrittura",
    descrizione:
      "Riscrive la clausola selezionata secondo la tua direttiva, anche alla luce di un fascicolo.",
    ai: true,
    icon: <DocumentEdit20Regular aria-hidden />,
  },
];

export const toolById = (id: ToolId): ToolInfo => TOOLS.find((t) => t.id === id) as ToolInfo;
