export type OnboardingSlide = {
  title: string;
  description: string;
  bullets: string[];
  manualHref?: string;
  manualLabel?: string;
};

export type OnboardingSection = {
  id: string;
  title: string;
  slides: OnboardingSlide[];
  paths: string[];
};

export const ONBOARDING_STORAGE_KEY = "jurio:onboarding:v2";

export const ONBOARDING_SECTIONS: OnboardingSection[] = [
  {
    id: "search",
    title: "Ricerca Giurisprudenza",
    slides: [
      {
        title: "Imposta il quesito con densità informativa",
        description:
          "Dalla guida Ricerca Semantica: il motore confronta soprattutto massime, fattispecie, precedenti e riferimenti normativi.",
        bullets: [
          "Descrivi insieme fatto concreto + questione giuridica.",
          "Evita query troppo brevi o solo keyword isolate.",
          "Usa il comando vocale quando devi dettare casi complessi.",
        ],
        manualHref: "/guida/ricerca-semantica",
        manualLabel: "Apri manuale Ricerca Semantica",
      },
      {
        title: "Raffina i risultati in due fasi",
        description:
          "Prima ottieni un set ampio; poi riduci con i livelli di filtraggio mostrati nella guida.",
        bullets: [
          "Filtra per argomento e sottocategoria legale.",
          "Usa i filtri avanzati dopo la prima risposta del sistema.",
          "Confronta rilevanza e provenienza prima di aprire il documento.",
        ],
        manualHref: "/guida/ricerca-semantica",
      },
      {
        title: "Dalla lista al provvedimento",
        description:
          "Ogni scheda è pensata per passare rapidamente da screening a disamina operativa.",
        bullets: [
          "Apri prima i risultati con segnali più allineati al caso.",
          "Verifica i riferimenti normativi già in scheda.",
          "Usa la vista documento per valutare tenuta argomentativa.",
        ],
        manualHref: "/guida/interfacce",
        manualLabel: "Apri guida Interfacce",
      },
    ],
    paths: ["/", "/ricerca", "/giurisprudenza", "/documento"],
  },
  {
    id: "chat",
    title: "Consulente Legale",
    slides: [
      {
        title: "Scegli la modalità operativa corretta",
        description:
          "La guida del Consulente descrive modalità diverse per obiettivi diversi: risposta rapida, analisi guidata e lavoro documentale.",
        bullets: [
          "Dichiara subito output atteso: parere, bozza, strategia o revisione.",
          "Se il caso è articolato, parti da un perimetro specifico.",
          "Evita richieste miste in un unico prompt iniziale.",
        ],
        manualHref: "/guida/consulente-legale",
        manualLabel: "Apri manuale Consulente Legale",
      },
      {
        title: "Costruisci contesto probatorio essenziale",
        description:
          "Le performance migliorano quando il contesto è ordinato prima della richiesta finale.",
        bullets: [
          "Carica gli atti realmente decisivi, non tutto il fascicolo.",
          "Indica ruoli delle parti e obiettivo processuale.",
          "Segnala termini, udienze o vincoli temporali rilevanti.",
        ],
        manualHref: "/guida/analisi-documenti",
      },
      {
        title: "Itera in micro-step controllati",
        description:
          "Per output professionali, converte il lavoro in blocchi progressivi invece che in una sola richiesta enorme.",
        bullets: [
          "Step 1: outline; Step 2: argomenti; Step 3: testo finale.",
          "Fai validare prima struttura e fonti, poi stile.",
          "Usa feedback brevi e puntuali per la revisione.",
        ],
        manualHref: "/guida/interfacce",
      },
    ],
    paths: ["/chat"],
  },
  {
    id: "analysis",
    title: "Approfondimento",
    slides: [
      {
        title: "Definisci una fattispecie unica",
        description:
          "Nel manuale Approfondimento Giurisprudenziale, la qualità dipende dalla precisione del quesito iniziale.",
        bullets: [
          "Una sola domanda centrale per analisi.",
          "Inserisci confini: materia, fase processuale, obiettivo.",
          "Evita più ipotesi alternative nello stesso avvio.",
        ],
        manualHref: "/guida/analisi",
        manualLabel: "Apri manuale Approfondimento",
      },
      {
        title: "Leggi la Mappa Dialettica per decisione",
        description:
          "La guida evidenzia l’uso della mappa per confrontare tesi, antitesi e fonti collegate.",
        bullets: [
          "Controlla i nodi con maggior impatto sul caso.",
          "Valida i collegamenti normativi e giurisprudenziali.",
          "Annota le debolezze prima di procedere alla sintesi.",
        ],
        manualHref: "/guida/analisi",
      },
      {
        title: "Chiudi con sintesi strategica esportabile",
        description:
          "L’ultima sezione del manuale punta a una sintesi pratica, pronta per uso interno o difensivo.",
        bullets: [
          "Estrarre solo precedenti davvero spendibili.",
          "Concludi con rischi, opportunità e priorità operative.",
          "Esporta/copia quando la traccia è validata.",
        ],
        manualHref: "/guida/analisi",
      },
    ],
    paths: ["/analisi"],
  },
  {
    id: "profile",
    title: "Profilo e Impostazioni",
    slides: [
      {
        title: "Allinea identità e preferenze",
        description:
          "Da Modifica Profilo: tenere aggiornati dati e preferenze migliora continuità operativa e riconoscibilità interna.",
        bullets: [
          "Aggiorna informazioni personali e avatar.",
          "Mantieni coerenza con account team e ruolo.",
          "Rivedi preferenze quando cambia il tuo workflow.",
        ],
        manualHref: "/guida/preferenze",
        manualLabel: "Apri guida Profilo",
      },
      {
        title: "Controlla piani e licenze",
        description:
          "Le sezioni Gestione Piano e Piani/Licenze spiegano status piano, cicli e impostazioni workspace.",
        bullets: [
          "Verifica piano attivo e frequenza di acquisto.",
          "Controlla sconti/voucher applicati al workspace.",
          "Gestisci eventuali variazioni prima del rinnovo.",
        ],
        manualHref: "/guida/gestione-piano",
      },
      {
        title: "Monitora quote di utilizzo",
        description:
          "La guida Quote di Utilizzo aiuta a prevenire interruzioni operative e a pianificare consumo crediti.",
        bullets: [
          "Verifica trend di utilizzo con frequenza regolare.",
          "Identifica i moduli più intensivi in anticipo.",
          "Pianifica upgrade prima dei picchi operativi.",
        ],
        manualHref: "/guida/quote",
      },
    ],
    paths: ["/profilo", "/profilo/piani", "/profilo/utilizzi", "/profilo/modifica"],
  },
  {
    id: "team",
    title: "Team",
    slides: [
      {
        title: "Governance workspace prima di tutto",
        description:
          "Nel manuale Gestione Team, il pannello è pensato per controllo centralizzato di licenze e membri.",
        bullets: [
          "Definisci owner e responsabilità operative.",
          "Tieni visibile il riepilogo licenze attive.",
          "Traccia chi accede ai moduli più sensibili.",
        ],
        manualHref: "/guida/gestione-team",
        manualLabel: "Apri manuale Team",
      },
      {
        title: "Inviti e ruoli con criterio operativo",
        description:
          "La guida prevede onboarding membri con logiche di ruolo e separazione delle attività.",
        bullets: [
          "Invita nuovi componenti solo con ruolo necessario.",
          "Evita privilegi amministrativi non indispensabili.",
          "Aggiorna ruoli al cambio di mansione.",
        ],
        manualHref: "/guida/gestione-team",
      },
      {
        title: "Audit periodico degli accessi",
        description:
          "Per una postura solida, la guida suggerisce verifiche ricorrenti su utenze e accessi residui.",
        bullets: [
          "Rimuovi membri inattivi o non più autorizzati.",
          "Verifica consistenza tra licenze e utenti reali.",
          "Documenta le modifiche di governance rilevanti.",
        ],
        manualHref: "/guida/assistenza",
      },
    ],
    paths: ["/profilo/team"],
  },
  {
    id: "notifications",
    title: "Notifiche",
    slides: [
      {
        title: "Usa le notifiche come centro eventi",
        description:
          "Dalla guida Interfacce: campanella e Centro Notifiche servono a concentrare eventi personali e di sistema.",
        bullets: [
          "Consulta la campanella per segnali immediati.",
          "Apri /notifiche per lavorare in batch.",
          "Distingui aggiornamenti operativi da informativi.",
        ],
        manualHref: "/guida/interfacce",
        manualLabel: "Apri guida Interfacce",
      },
      {
        title: "Riduci interruzioni durante il lavoro",
        description:
          "La gestione a blocchi evita contesto frammentato mentre lavori su ricerca, chat o analisi.",
        bullets: [
          "Processa notifiche in finestre dedicate.",
          "Chiudi prima le azioni ad alta priorità.",
          "Archivia subito ciò che non richiede follow-up.",
        ],
        manualHref: "/guida/interfacce",
      },
      {
        title: "Collega notifiche e supporto",
        description:
          "Se emerge un’anomalia persistente, la guida indirizza a canali di assistenza e procedure di aggiornamento.",
        bullets: [
          "Per problemi tecnici apri /contatti.",
          "In caso di cache/UI anomale, usa aggiornamento forzato.",
          "Mantieni una breve traccia del problema riscontrato.",
        ],
        manualHref: "/guida/assistenza",
      },
    ],
    paths: ["/notifiche"],
  },
];

export const resolveOnboardingSection = (pathname: string): OnboardingSection | null => {
  const normalizedPath = pathname.toLowerCase();

  for (const section of ONBOARDING_SECTIONS) {
    for (const basePath of section.paths) {
      const normalizedBasePath = basePath.toLowerCase();

      if (normalizedBasePath === "/") {
        if (normalizedPath === "/") return section;
        continue;
      }

      if (
        normalizedPath === normalizedBasePath ||
        normalizedPath.startsWith(`${normalizedBasePath}/`)
      ) {
        return section;
      }
    }
  }

  return null;
};
