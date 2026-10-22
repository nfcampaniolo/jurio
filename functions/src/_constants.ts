export type JurioFeatureType = 
  | "research" 
  | "web" 
  | "legal_agent"
  | "speech_to_text"
  | "reasoning"
  | "support_public"
  | "prompting"
  | "prompt_enhancer"
  | "admin"
  | "feedback"
  | "embedding"
  | "register"
  | "stripe_checkout"
  | "deep_analysis"
  | "extract_document"
  | "apply_coupon"
  | "teams"
  | "cloud_files"
  ;

type FeatureLimit = { perMinute: number; perDay: number };
type PlanLimit = readonly [perMinute: number, perDay: number];

function planLimits(entries: Record<string, PlanLimit>): Record<string, FeatureLimit> {
  return Object.fromEntries(
    Object.entries(entries).map(([plan, [perMinute, perDay]]) => [
      plan,
      { perMinute, perDay },
    ])
  );
}

const standardResearchLimits = planLimits({
  prova: [20, 100],
  admin: [20, 200],
  business: [20, 200],
  business_m: [20, 200],
  personale: [20, 100],
  personale_m: [20, 100],
});
const standardBusinessLimits = planLimits({
  prova: [20, 100],
  admin: [20, 200],
  business: [20, 200],
  business_m: [20, 200],
});
const legalAgentLimits = planLimits({
  prova: [5, 20],
  admin: [120, 50],
  business: [20, 50],
  business_m: [20, 50],
});

export const JURIO_USAGE_LIMITS = {
  research: standardResearchLimits,
  web: planLimits({
    prova: [10, 10],
    admin: [10, 20],
    business: [10, 20],
    business_m: [10, 20],
  }),
  extract_document: standardBusinessLimits,
  deep_analysis: planLimits({
    prova: [5, 15],
    admin: [5, 30],
    business: [5, 30],
    business_m: [5, 30],
  }),
  speech_to_text: planLimits({
    prova: [5, 20],
    admin: [60, 200],
    business: [20, 200],
    business_m: [20, 200],
  }),
  reasoning: legalAgentLimits,
  legal_agent: legalAgentLimits,
  support_public: planLimits({ global: [5, 30] }),
  prompting: planLimits({
    prova: [5, 20],
    admin: [20, 100],
    business: [20, 100],
    business_m: [20, 100],
  }),
  prompt_enhancer: planLimits({
    prova: [5, 20],
    admin: [5, 20],
    business: [5, 20],
    business_m: [5, 20],
  }),
  admin: planLimits({ admin: [60, 500] }),
  feedback: planLimits({ global: [15, 100] }),
  embedding: planLimits({
    prova: [30, 300],
    admin: [30, 300],
    business: [30, 300],
    business_m: [30, 300],
  }),
  register: planLimits({ global: [5, 20] }),
  stripe_checkout: planLimits({ global: [5, 100] }),
  apply_coupon: planLimits({ global: [10, 30] }),
  teams: planLimits({ global: [10, 50] }),
  cloud_files: planLimits({ global: [10, 50] }),
} satisfies Record<
  JurioFeatureType,
  Partial<Record<string, { perMinute: number; perDay: number }>>
>;

export const ALLOWED_PLANS = new Set([
  "prova",
  "admin",
  "business",
  "personale",
  "business_m",
  "personale_m",
]);

export const ALLOWED_ORIGINS = [

  "https://jurio.it",
  "https://www.jurio.it",
  "https://jurio-it.web.app",
  "https://jurio-it.firebaseapp.com",
  "https://jurio-it-dev.web.app",
  "https://jurio-it-dev.firebaseapp.com",

];

export const MAX_INPUT_CHARS_DOCUMENT = 1_000_000; 

export const SEZIONI_CASSAZIONE_CIVILE = [
  "PRIMA SEZIONE CIVILE",
  "SECONDA SEZIONE CIVILE",
  "TERZA SEZIONE CIVILE",
  "QUARTA SEZIONE CIVILE",
  "QUINTA SEZIONE CIVILE",
  "SESTA SEZIONE CIVILE",
  "SEZIONI UNITE CIVILI",
] as const;

export const SEZIONI_CASSAZIONE_PENALE = [
  "PRIMA SEZIONE PENALE",
  "SECONDA SEZIONE PENALE",
  "TERZA SEZIONE PENALE",
  "QUARTA SEZIONE PENALE",
  "QUINTA SEZIONE PENALE",
  "SESTA SEZIONE PENALE",
  "SETTIMA SEZIONE PENALE",
  "SEZIONI UNITE PENALI",
  "SEZIONE FERIALE PENALE",
] as const;

export const AREE = {
    1: "Diritto Costituzionale e Parlamentare",
    2: "Diritto Penale Sostanziale",
    3: "Diritto Penale Processuale",
    4: "Diritto dell'Esecuzione Penale e Ordinamento Penitenziario",
    5: "Diritto Civile - Famiglia, Persone e Minori",
    6: "Diritto Civile - Successioni e Donazioni",
    7: "Diritto Civile - Diritti Reali, Proprietà e Condominio",
    8: "Diritto Civile - Obbligazioni, Contratti e Responsabilità",
    9: "Procedura Civile, Arbitrato e ADR (Mediazione/Negoziazione)",
    10: "Esecuzione Forzata Civile e Recupero Crediti",
    11: "Diritto Commerciale, Societario e dell'Impresa",
    12: "Crisi d'Impresa, Insolvenza e Procedure Concorsuali",
    13: "Diritto Bancario, Finanziario e delle Assicurazioni",
    14: "Diritto del Lavoro, Sindacale e Relazioni Industriali",
    15: "Diritto della Previdenza e Assistenza Sociale",
    16: "Diritto Amministrativo Generale e Procedimento",
    17: "Giustizia Amministrativa e Contabilità di Stato",
    18: "Contrattualistica Pubblica, Appalti e Concessioni",
    19: "Edilizia, Urbanistica e Assetto del Territorio",
    20: "Diritto Ambientale e dell'Energia",
    21: "Pubblico Impiego, Concorsi e Personale P.A.",
    22: "Diritto Tributario Sostanziale (Imposte Dirette e Indirette)",
    23: "Contenzioso Tributario, Accertamento e Riscossione",
    24: "Diritto Sanitario, Farmaceutico e Responsabilità Medica",
    25: "Diritto dell'Immigrazione, Asilo e Cittadinanza",
    26: "Tutela dei Dati Personali, Privacy e GDPR",
    27: "Informatica Giuridica, Nuove Tecnologie e Cybercrime",
    28: "Proprietà Intellettuale, Industriale, Marchi e Brevetti",
    29: "Tutela dei Consumatori e Diritto della Concorrenza (Antitrust)",
    30: "Diritto della Navigazione e dei Trasporti",
    31: "Diritto dello Sport e Giustizia Sportiva",
    32: "Diritto degli Enti del Terzo Settore (RUNTS) e No-Profit",
    33: "Diritto dell'Unione Europea",
    34: "Diritto Internazionale (Pubblico e Privato)",
    35: "Diritto Agrario, Forestale e dell'Alimentazione",
    36: "Diritto Ecclesiastico, Canonico e Rapporti Stato-Chiesa",
    37: "Diritto Militare e Giustizia Militare",
    38: "Diritto dell'Informazione, Editoria e Media",
    39: "Diritto Elettorale e Consultazioni Popolari",
    40: "Diritto Doganale, Commercio Internazionale e Accise",
    41: "Ordinamento Minorile (Civile e Penale)"
};

const MACROCATEGORIE = {
    // Diritto Civile, Famiglia e Obbligazioni
    1: "Separazione, Divorzio e Affidamento dei Minori",
    2: "Amministrazione di Sostegno, Interdizione e Inabilitazione",
    3: "Responsabilità Civile Extracontrattuale e Risarcimento Danni",
    4: "Inadempimento Contrattuale e Risoluzione del Contratto",
    5: "Compravendita, Locazione e Contratti Tipici",
    6: "Azioni a Difesa della Proprietà e Usucapione",
    7: "Lesione di Legittima e Divisione Ereditaria",
    8: "Responsabilità Medica e Malpractice Sanitaria",
    
    // Diritto e Procedura Penale
    9: "Reati contro la Pubblica Amministrazione (Corruzione, Concussione)",
    10: "Reati contro il Patrimonio (Furto, Rapina, Truffa)",
    11: "Reati contro la Persona (Omicidio, Lesioni, Stalking)",
    12: "Reati Tributari e Societari",
    13: "Misure Cautelari Personali e Reali (Sequestri)",
    14: "Indagini Preliminari e Udienza Preliminare",
    15: "Riti Alternativi (Patteggiamento, Rito Abbreviato)",
    16: "Misure Alternative alla Detenzione (Affidamento in prova)",
    
    // Diritto Amministrativo e Appalti
    17: "Vizi di Legittimità del Provvedimento (Eccesso di potere, Incompetenza)",
    18: "Silenzio della P.A., SCIA e Semplificazione Amministrativa",
    19: "Ricorsi al TAR e al Consiglio di Stato",
    20: "Criteri di Aggiudicazione e Anomalia dell'Offerta negli Appalti",
    21: "Espropriazione per Pubblica Utilità e Risarcimento",
    22: "Permessi di Costruire, Condoni e Abusi Edilizi",
    
    // Lavoro, Impresa e Società
    23: "Licenziamento Individuale (Giusta Causa e Giustificato Motivo)",
    24: "Mobbing, Demansionamento e Danni sul Lavoro",
    25: "Infortuni sul Lavoro, Malattie Professionali e Tutele INAIL",
    26: "Costituzione, Modifica e Scioglimento di Società (SpA, Srl)",
    27: "Azione di Responsabilità contro Amministratori e Sindaci",
    28: "Liquidazione Giudiziale (ex Fallimento) e Concordato Preventivo",
    29: "Cessione, Affitto di Azienda e Passaggio di Lavoratori",
    
    // Procedura Civile e Recupero Crediti
    30: "Ricorso per Decreto Ingiuntivo e Opposizione",
    31: "Pignoramento Immobiliare e Vendita all'Asta",
    32: "Pignoramento presso Terzi (Conti Correnti, Stipendi)",
    33: "Appello, Ricorso in Cassazione e Revocazione",
    34: "Accertamento Tecnico Preventivo (ATP) e Consulenza Tecnica d'Ufficio",
    
    // Tributario, Fiscale e Bancario
    35: "Avviso di Accertamento e Riscossione Esattoriale",
    36: "Ricorsi alle Corti di Giustizia Tributaria (ex CTP/CTR)",
    37: "Anatocismo, Usura Bancaria e Contenzioso sui Mutui",
    38: "Deflazione del Contenzioso (Accertamento con Adesione, Condoni)",
    
    // Nuove discipline, Trasversali e Navigazione
    39: "Data Breach, Notifiche al Garante e Sanzioni Privacy",
    40: "Pratiche Commerciali Scorrette e Clausole Vessatorie",
    41: "Contraffazione di Marchi e Violazione del Diritto d'Autore",
    42: "Permesso di Soggiorno, Espulsioni e Protezione Internazionale",
    43: "Giudizio in via Incidentale davanti alla Corte Costituzionale",
    44: "Sinistri Stradali e Risarcimento Diretto",
    
    // Corte Costituzionale ed Elettorale
    45: "Conflitti di Attribuzione tra Poteri dello Stato e tra Enti",
    46: "Giudizio di Ammissibilità del Referendum Abrogativo",
    47: "Contenzioso Elettorale, Ineleggibilità e Incompatibilità",
    
    // Cassazione Civile (Nicchie e Diritti Speciali)
    48: "Diffamazione a Mezzo Stampa e Tutela della Reputazione",
    49: "Trust, Negozi Fiduciari e Vincoli di Destinazione",
    50: "Prelazione Agraria, Riscatto e Affitto di Fondo Rustico",
    51: "Contratti Derivati, Swap e Intermediazione Finanziaria Avanzata",
    52: "Delibazione di Sentenze Straniere e Annullamento Sacra Rota",
    53: "Class Action e Azioni Inibitorie Collettive",
    
    // Cassazione Penale (Legislazione Speciale e Antimafia)
    54: "Misure di Prevenzione Personali e Patrimoniali (Codice Antimafia)",
    55: "Reati Ambientali, Ecoreati e Disastro Ambientale",
    56: "Reati Militari (Diserzione, Insubordinazione, Peculato Militare)",
    57: "Messa alla Prova e Processo Penale a carico di Minorenni",
    58: "Estorsione, Usura e Criminalità Organizzata (416-bis)",
    59: "Mandato di Arresto Europeo (MAE) ed Estradizione",
    
    // Consiglio di Stato (Regolazione e Autorità Indipendenti)
    60: "Sanzioni Antitrust (AGCM) e Pratiche Commerciali Scorrette",
    61: "Provvedimenti Banca d'Italia, CONSOB e IVASS",
    62: "Concessioni Demaniali Marittime e Direttiva Bolkestein",
    63: "Diritto Scolastico, Graduatorie Docenti e Concorsi Universitari",
    64: "Regolazione dei Servizi Pubblici e Tariffe (ARERA, ART)",
    
    // Altre aree specialistiche (Lavoro, Doganale, Navigazione)
    65: "Contenzioso Doganale, Contrabbando e Dazi all'Importazione",
    66: "Lavoro Marittimo, Aereo e Personale Navigante",
    67: "Dirigenti: Licenziamento, Indennità e Trattamento Economico",
    68: "Cripto-attività, Smart Contracts e Finanza Decentralizzata (DeFi)"
};

export const areeString = Object.values(AREE).join(", ");
export const macroString = Object.values(MACROCATEGORIE).join(", ");