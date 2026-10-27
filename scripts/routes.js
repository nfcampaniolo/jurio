export const routes = [
  {
    path: '/',
    title: 'Jurio — Ricerca giuridica con intelligenza artificiale',
    description:
      'Jurio è la piattaforma di ricerca giuridica con intelligenza artificiale pensata per avvocati e professionisti del diritto. Cerca precedenti, analizza documenti e collega i tuoi fascicoli alla giurisprudenza rilevante.',
    changefreq: 'weekly',
    priority: '1.0'
  },

  {
    path: '/fonti',
    title: 'Fonti | Jurio',
    description:
      'Fonti giuridiche e documentali utilizzate da Jurio per la ricerca e l’analisi della giurisprudenza.',
    changefreq: 'monthly',
    priority: '0.8'
  },

  {
    path: '/prezzi',
    title: 'Piani e Tariffe | Jurio',
    description:
      'Scopri i piani e le tariffe di Jurio. Ricerca giurisprudenziale avanzata, analisi automatica degli atti e soluzioni Workspace scalabili per studi legali.',
    changefreq: 'monthly',
    priority: '0.9'
  },

  {
    path: '/casi-studio',
    title: 'Casi di Studio e Automazioni Legali AI | Jurio',
    description:
      'Scopri come Jurio applica l’intelligenza artificiale ai workflow degli studi legali per automatizzare attività complesse, strutturare la giurisprudenza e ridurre il lavoro manuale.',
    changefreq: 'weekly',
    priority: '0.8'
  },

  {
    path: '/caso-studio/analisi-consiglio-di-stato-adunanza-plenaria',
    title: 'Analisi del Consiglio di Stato — Adunanza Plenaria | Jurio',
    description:
      'Caso studio di analisi giuridica dedicato a una decisione del Consiglio di Stato, Adunanza Plenaria.',
    changefreq: 'monthly',
    priority: '0.7'
  },

  {
    path: '/caso-studio/analisi-corte-costituzionale',
    title: 'Analisi Corte Costituzionale | Jurio',
    description:
      'Caso studio dedicato all’analisi di una decisione della Corte Costituzionale attraverso gli strumenti di ricerca e analisi di Jurio.',
    changefreq: 'monthly',
    priority: '0.7'
  },

  {
    path: '/caso-studio/come-affinare-ricerca-giurisprudenziale-semantica',
    title: 'Come Affinare una Ricerca Giurisprudenziale con AI | Jurio',
    description:
      'Scopri come funziona la ricerca semantica e il modello RAG applicato alla giurisprudenza: come viene indicizzato un testo denso e come formulare l\'input ideale.',
    changefreq: 'monthly',
    priority: '0.7'
  },

  {
    path: '/caso-studio/massimazione-cassazione-penale',
    title: 'Massimazione Cassazione Penale | Jurio',
    description:
      'Caso studio sulla massimazione automatica di provvedimenti e sentenze della Cassazione penale.',
    changefreq: 'monthly',
    priority: '0.7'
  },

  {
    path: '/caso-studio/massimazione-sentenze',
    title: 'Massimazione Sentenze | Jurio',
    description:
      'Caso studio dedicato alla massimazione delle sentenze e alla trasformazione dei contenuti giudiziari in principi di diritto strutturati.',
    changefreq: 'monthly',
    priority: '0.7'
  },

  {
    path: '/caso-studio/ricerca-giurisprudenziale-danno-ritardo-pubblica-amministrazione',
    title: 'Ricerca Giurisprudenziale sul Danno da Ritardo della Pubblica Amministrazione | Jurio',
    description:
      'Caso studio sulla ricerca giurisprudenziale relativa al danno da ritardo della Pubblica Amministrazione.',
    changefreq: 'monthly',
    priority: '0.7'
  },

  {
    path: '/caso-studio/consulente-legale-ai',
    title: 'Consulente Legale AI | Jurio',
    description:
      'Caso studio sulla consulenza legale ottimizzata con l\'ausilio dell\'intelligenza artificiale.',
    changefreq: 'monthly',
    priority: '0.7'
  },

  {
    path: '/caso-studio/modelli-analisi-ai-documenti',
    title: 'Modelli di Analisi dell\'Intelligenza Artificiale per la Gestione dei Documenti Giuridici | Jurio',
    description:
      'Caso studio sui modelli di analisi dell\'intelligenza artificiale per la gestione dei documenti giuridici.',
    changefreq: 'monthly',
    priority: '0.7'
  },

  {
    path: '/caso-studio/workspace-team',
    title: 'Workspace Team | Jurio',
    description:
      'Caso studio sulle best practices per la collaborazione in team e l\'utilizzo degli strumenti di gestione del lavoro.',
    changefreq: 'monthly',
    priority: '0.7'
  },

  {
    path: '/caso-studio/configurazione-claude-mcp',
    title: 'Integrazione MCP su Claude.ai: Porta la Giurisprudenza sull\'AI | Jurio',
    description:
      'Guida ufficiale per collegare il server MCP di Jurio a Claude.ai. Scopri come integrare la banca dati giuridica con registrazione dinamica OAuth2 in pochi clic.',
    changefreq: 'monthly',
    priority: '0.8'
  },

  {
    path: '/caso-studio/configurazione-vibe-mcp',
    title: 'Integrazione MCP su Vibe (Mistral AI): Giurisprudenza e AI Europea | Jurio',
    description:
      'Guida ufficiale per collegare il server MCP di Jurio a Vibe di Mistral AI. Scopri come integrare la banca dati giuridica con autenticazione OAuth in pochi clic.',
    changefreq: 'monthly',
    priority: '0.8'
  },

  {
    path: '/tecnologia',
    title: 'Tecnologia e Architettura Software | Jurio',
    description:
      'Scopri l\'architettura tecnologica dietro Jurio: dal sistema RAG per eliminare le allucinazioni dell\'AI, all\'orchestrazione software, fino al protocollo MCP.',
    changefreq: 'weekly',
    priority: '0.8'
  },

  {
    path: '/tecnologia/rag-allucinazioni-ai',
    title: 'RAG e AI Legale: Come Jurio Azzera le Allucinazioni | Jurio',
    description:
      'Scopri come la tecnologia RAG (Retrieval-Augmented Generation) permette a Jurio di fornire risposte giuridiche basate esclusivamente su sentenze reali della Cassazione.',
    changefreq: 'monthly',
    priority: '0.7'
  },

  {
    path: '/tecnologia/orchestrazione-ai',
    title: 'Orchestrazione AI nel LegalTech: L\'architettura di Jurio | Jurio',
    description:
      'Dietro le quinte di Jurio: come trasformiamo l\'imprevedibilità dei Large Language Models in pipeline software deterministiche, sicure e tracciabili.',
    changefreq: 'monthly',
    priority: '0.7'
  },

  {
    path: '/tecnologia/mcp-protocollo-ai-lavoro',
    title: 'Cos\'è l\'MCP? Come collegare Claude e ChatGPT ai tuoi dati | Jurio',
    description:
      'Scopri cos\'è il Model Context Protocol (MCP) e perché è la rivoluzione che permette a ChatGPT, Claude e altri LLM di leggere in modo sicuro i dati del tuo studio.',
    changefreq: 'monthly',
    priority: '0.7'
  },

  {
    path: '/tecnologia/intelligenza-artificiale-microsoft-word',
    title: 'Intelligenza Artificiale in Microsoft Word: L\'Add-in di Jurio | Jurio',
    description:
      'Non cambiare le tue abitudini. Scopri come l\'Add-in di Jurio porta la ricerca giurisprudenziale e l\'AI generativa direttamente nell\'editor di Microsoft Word.',
    changefreq: 'monthly',
    priority: '0.7'
  },

  {
    path: '/tecnologia/prompt-engineering-legale',
    title: 'Prompt Engineering per Avvocati: Come interrogare l\'AI | Jurio',
    description:
      'Guida al Prompt Engineering legale. Scopri come interrogare correttamente il motore RAG di Jurio e come utilizzare i flussi pre-impostati per Risk Management e Due Diligence.',
    changefreq: 'monthly',
    priority: '0.7'
  },
  
  {
    path: '/blog/fideiussioni-bancarie-schema-abi-sezioni-unite-24825-2026.html',
    title: 'Fideiussione Specifica e Clausole ABI: Cassazione SS.UU. 24825/2026 | Jurio',
    description:
      'Analisi di Cassazione SS.UU. n. 24825/2026: onere della prova sulle garanzie a valle dello schema ABI e interruzione dei termini di decadenza ex art. 1957 c.c.',
    changefreq: 'monthly',
    priority: '0.7'
  },

  {
    path: '/blog/art-103-cpp-avvocato-indagato-sezioni-unite.html',
    title: 'Art. 103 c.p.p. e Avvocato Indagato: Rimessione alle Sezioni Unite | Jurio',
    description:
      'La Sesta sezione penale rimette alle Sezioni Unite il contrasto giurisprudenziale sull’estensione delle garanzie difensive e dei limiti di perquisizione quando il legale è indagato.',
    changefreq: 'monthly',
    priority: '0.7'
  },

  {
    path: '/blog/curatore-speciale-minori-stranieri-tutore-consolare-sezioni-unite-24044-2026.html',
    title: 'Curatore Speciale e Minori Stranieri: Cassazione SS.UU. 24044/2026 | Jurio',
    description:
      'Analisi di Cassazione SS.UU. n. 24044/2026: presupposti di nomina del curatore speciale e raccordo con le funzioni del tutore consolare nei procedimenti minorili.',
    changefreq: 'monthly',
    priority: '0.7'
  },

  {
    path: '/blog/cittadinanza-minore-bipolide-sezioni-unite-24045-2026.html',
    title: 'Cittadinanza e Minore Bipolide: Cassazione SS.UU. 24045/2026 | Jurio',
    description:
      'Analisi di Cassazione SS.UU. n. 24045/2026: il figlio minore con doppia cittadinanza fin dalla nascita non perde lo status italiano per effetto della naturalizzazione del genitore.',
    changefreq: 'monthly',
    priority: '0.7'
  },

  {
    path: '/blog/incapacita-naturale-licenziamento-240-giorni.html',
    title: 'Incapacità Naturale e Licenziamento: Cassazione SS.UU. 23486/2026 | Jurio',
    description:
      'Impugnazione del licenziamento e lavoratore incapace: l\'analisi della sentenza delle Sezioni Unite n. 23486/2026 nel dialogo tra Cassazione e Corte Costituzionale.',
    changefreq: 'monthly',
    priority: '0.7'
  },

  {
    path: '/blog/riduzione-orario-scolastico-disabili-discriminazione-cassazione-23363-2026.html',
    title: 'Riduzione Orario Scolastico Disabili: Cassazione SS.UU. 23363/2026 | Jurio',
    description:
      'Analisi di Cassazione SS.UU. n. 23363/2026: discriminazione, diritto incomprimibile all\'istruzione per gli alunni con disabilità e ruolo vincolante del PEI.',
    changefreq: 'monthly',
    priority: '0.7'
  },

  {
  path: '/blog',
  title: 'Giurisprudenza: analisi di Cassazione, TAR e Consiglio di Stato | Jurio',
  description:
    'Analisi delle pronunce rilevanti di Cassazione, Sezioni Unite, TAR e Consiglio di Stato, per diritto civile, penale, amministrativo e del lavoro. A cura di Jurio.',
  changefreq: 'weekly',
  priority: '0.8'
},
 
{
  path: '/blog/accesso_difensivo_nominativo_agente_accertatore_tar_lazio_14477.html',
  title: 'Accesso Difensivo e Nominativo dell\'Agente Accertatore: TAR Lazio n. 14477 | Jurio',
  description:
    'Analisi della decisione del TAR Lazio n. 14477: il diritto di difesa prevale sulla riservatezza e le generalità dell\'agente di Polizia Locale non sono coperte da anonimato.',
  changefreq: 'monthly',
  priority: '0.7'
},
{
  path: '/blog/intercettazioni-captatore-informatico-cassazione-29131-2026.html',
  title: 'Intercettazioni con Captatore Informatico: Cassazione 29131/2026 | Jurio',
  description:
    'Analisi di Cassazione n. 29131/2026: trojan, omissis nei decreti, sospensione delle operazioni e attivazione a singhiozzo, con i limiti di utilizzabilità delle intercettazioni.',
  changefreq: 'monthly',
  priority: '0.7'
},
{
  path: '/blog/appalti_terzo_classificato_inversione_procedimentale_tar_catania.html',
  title: 'Terzo Classificato e Inversione Procedimentale: TAR Catania 2398/2026 | Jurio',
  description:
    'Analisi di TAR Catania n. 2398/2026: nelle gare con inversione procedimentale, il terzo classificato può limitarsi a censurare il primo? L\'onere di impugnazione.',
  changefreq: 'monthly',
  priority: '0.7'
},
{
  path: '/blog/omessa_comunicazione_variazioni_patrimoniali_dissociazione_mafiosa.html',
  title: 'Variazioni Patrimoniali e Dissociazione Mafiosa: Cassazione | Jurio',
  description:
    'Il condannato per mafia che si dissocia deve ancora comunicare i propri acquisti alla Guardia di Finanza? La Cassazione fissa i confini tra benefici di pena e obblighi di trasparenza.',
  changefreq: 'monthly',
  priority: '0.7'
},
{
  path: '/blog/scomputo-oneri-urbanizzazione-cessione-aree-consiglio-stato.html',
  title: 'Scomputo Oneri di Urbanizzazione e Cessione di Aree: Consiglio di Stato | Jurio',
  description:
    'Il Consiglio di Stato riforma la lettura del T.A.R. e ammette lo scomputo degli oneri convenzionali a fronte della cessione gratuita di aree.',
  changefreq: 'monthly',
  priority: '0.7'
},
{
  path: '/blog/lieve-entita-stupefacenti-decreto-sicurezza-2026.html',
  title: 'Spaccio di Lieve Entità e Decreto Sicurezza 2026: Occasionalità e Abitualità | Jurio',
  description:
    'Come cambia il fatto di lieve entità (art. 73 co. 5 d.P.R. 309/1990) con la nuova clausola di esclusione per condotte continuative e abituali: la prima lettura della Cassazione.',
  changefreq: 'monthly',
  priority: '0.7'
},
{
  path: '/blog/pas-fotovoltaico-opere-connesse-tar-campania.html',
  title: 'PAS Fotovoltaico e Opere Connesse: TAR Campania 4767/2026 | Jurio',
  description:
    'Analisi di TAR Campania n. 4767/2026: la PAS per impianti fotovoltaici consente l\'esproprio per le opere connesse? Lettura dell\'art. 8 d.lgs. 190/2024.',
  changefreq: 'monthly',
  priority: '0.7'
},
{
  path: '/blog/restituzione-termine-persona-offesa-art-175-cpp.html',
  title: 'Restituzione nel Termine della Persona Offesa: Art. 175 c.p.p. | Jurio',
  description:
    'Restituzione nel termine per la costituzione di parte civile: l\'evoluzione giurisprudenziale dall\'estraneità formale al ruolo di parte in senso tecnico della persona offesa.',
  changefreq: 'monthly',
  priority: '0.7'
},
{
  path: '/blog/bonifiche-ambientali-responsabilita-inquinamento-storico.html',
  title: 'Bonifiche e Inquinamento Storico: Consiglio di Stato 5712/2026 | Jurio',
  description:
    'Analisi di Consiglio di Stato n. 5712/2026 sull\'ex cokeria di Avenza: il principio «chi inquina paga» e la responsabilità per l\'inquinamento storico.',
  changefreq: 'monthly',
  priority: '0.7'
},

  {
    path: '/privacy',
    title: 'Privacy Policy | Jurio',
    description:
      'Informativa privacy di Jurio sul trattamento dei dati personali, sulla sicurezza e sulla gestione dei dati degli utenti.',
    changefreq: 'yearly',
    priority: '0.3'
  },

  {
    path: '/termini',
    title: 'Termini e Condizioni | Jurio',
    description:
      'Termini e condizioni di utilizzo della piattaforma Jurio. Diritti, obblighi, licenza d’uso, responsabilità e regole per l’utilizzo del servizio.',
    changefreq: 'yearly',
    priority: '0.3'
  },

  {
    path: '/gdpr',
    title: 'GDPR e Privacy | Jurio',
    description:
      'Informazioni sulla conformità GDPR di Jurio, sul trattamento dei dati personali e sulle misure adottate per proteggere sicurezza e privacy.',
    changefreq: 'yearly',
    priority: '0.3'
  },

  {
    path: '/cookie',
    title: 'Cookie Policy | Jurio',
    description:
      'Informativa sull’utilizzo dei cookie e degli strumenti di tracciamento sulla piattaforma Jurio.',
    changefreq: 'yearly',
    priority: '0.3'
  },

  {
    path: '/commerciali/guida-completa',
    title: 'Guida Ufficiale a Jurio | Ricerca Giuridica con Intelligenza Artificiale',
    description:
      'Guida completa a Jurio: banca dati giurisprudenziale, ricerca semantica con intelligenza artificiale, integrazioni MCP e piani di utilizzo.',
    changefreq: 'monthly',
    priority: '0.8'
  }

];