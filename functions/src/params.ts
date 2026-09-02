import { defineSecret } from "firebase-functions/params";
import { FirestoreEvent, Change, DocumentSnapshot, QueryDocumentSnapshot } from "firebase-functions/v2/firestore";
import { FieldValue, DocumentReference } from "firebase-admin/firestore";
import Stripe from "stripe";
import OpenAI from "openai";
import { getDb } from "./deps";

const db = getDb();

/*DOCUMENTS*/

export const MAX_INPUT_CHARS = 1_000_000; 

const AREE = {
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

const areeString = Object.values(AREE).join(", ");
const macroString = Object.values(MACROCATEGORIE).join(", ");

const DOCUMENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    // Identificazione
    organo_giudicante: { type: "string" },
    sezione: { type: "string" },
    grado_giudizio: {
      type: "string",
      enum: ["Primo grado", "Appello", "Cassazione", ""]
    },
    numero_sentenza: { type: "string" },
    data_sentenza: { type: "string", format: "date" },
    ecli: { type: "string" },
    urn: { type: "string" },

    // Tipizzazione
    tipo_documento: {
      type: "string",
      enum: ["sentenza", "ordinanza", "decreto", "documento_giurisprudenza_generico"]
    },

    // Sottotipizzazione Generici
    sottotipo_documento: {
      type: "string",
      enum: ["memoria", "parere", "fattura", "perizia", "mail", "altro", ""]
    },

    // Contenuto giuridico (Sentenze/Ordinanze)
    fattispecie_rilevante: { type: "string" },
    questione_di_diritto: { type: "string" },
    massima: { type: "string", minLength: 1 },
    tipo_massima: {
      type: "string",
      enum: [
        "conforme",
        "difforme",
        "principio_nuovo",
        "di_specie",
        "con_fattispecie",
        "non_massimabile",
        ""
      ]
    },
    ratio_decidendi: { type: "string" },
    obiter_dicta: { type: "string" },

    summary: { 
      type: "string",
      maxLength: 3000,
      description: "Sintesi ad altissima densità informativa di tutto il documento, ottimizzata per l'indicizzazione vettoriale."
    },

    // Contenuto Documenti Giuridici (Memorie, Pareri)
    fatti: { type: "string" },
    nucleo: { type: "string" },
    conclusioni: { type: "string" },

    // Contenuto Documenti di Supporto (Fatture, Mail, Perizie)
    sintesi: { type: "string" },
    mittente: { type: "string" },
    destinatario: { type: "string" },
    importo: { type: ["number", "null"] },
    data_riferimento_documento: { type: "string", format: "date" },

    // Riferimenti
    riferimenti_normativi: { type: "array", items: { type: "string" } },
    precedenti_richiamati: { type: "array", items: { type: "string" } },

    // Dati specifici
    tipo_ordinanza: {
      type: "string",
      enum: ["cautelare", "istruttoria", "interlocutoria", "procedimentale", "decisoria", ""]
    },
    tipo_decreto: {
      type: "string",
      enum: ["ingiuntivo", "cautelare", "monitorio", "archiviazione", "fissazione_udienza", "altro", ""]
    },
    misura_disposta: { type: "string" },
    fumus_boni_iuris: { type: "string" },
    periculum_in_mora: { type: "string" },
    efficacia_temporale: {
      type: "string",
      enum: ["provvisoria", "fino_a_sentenza", "immediata", ""]
    },
    contenuto_precettivo: { type: "string" },
    contraddittorio: { type: ["boolean", "null"] },
    autorita_monocratica: { type: ["boolean", "null"] },

    // Classificazione
    materia: {
      type: "string",
      enum: ["Civile", "Penale", "Amministrativo", "Tributario", "Lavoro", "Contabile", "Altro", ""]
    },
    area: { type: "string"},
    macrocategoria: { type: "array", items: { type: "string" } },
    sottocategoria: { type: "array", items: { type: "string" } },

    // Metadata utili
    fonte: { type: "string" },
    lingua: { type: "string", default: "IT" },
    note: { type: "string" },
    presidente: { type: "string" },
    relatore: { type: "string" },
  },
  required: [
    "organo_giudicante",
    "massima",
    "tipo_massima",
    "tipo_documento",
    "summary"
  ]
};

export const PROMPT_MASSIMAZIONE = `
Agisci come redattore giuridico professionale specializzato in diritto italiano e massimazione secondo criteri ufficiali. Non citare mai i nomi delle parti (anonimizzazione obbligatoria).

VERIFICA PRELIMINARE E CLASSIFICAZIONE DEL DOCUMENTO (OBBLIGATORIA):
Analizza il testo per determinare la corretta classificazione nei campi "tipo_documento" e, se necessario, "sottotipo_documento".

1. ATTI GIURISDIZIONALI:
- Se il testo è una decisione su controversia: tipo_documento = "sentenza".
- Se è una misura cautelare/istruttoria/interlocutoria: tipo_documento = "ordinanza".
- Se è un provvedimento ingiuntivo/fissazione udienza/archiviazione: tipo_documento = "decreto".
In questi casi, lascia "sottotipo_documento" vuoto ("").

2. ALTRI DOCUMENTI (Atti di parte, pareri, prove, documenti contabili):
Se il testo NON è un provvedimento giurisdizionale standard, usa tipo_documento = "documento_giurisprudenza_generico" e valorizza "sottotipo_documento" in base al contenuto:
- "memoria": atti difensivi, ricorsi, comparse conclusionali.
- "parere": opinioni legali pro veritate, note dottrinali.
- "fattura": documenti fiscali, ricevute, note di debito.
- "perizia": relazioni tecniche, consulenze d'ufficio (CTU) o di parte (CTP).
- "mail": comunicazioni elettroniche, PEC, lettere.
- "altro": se non rientra nelle categorie precedenti ma è comunque un documento analizzabile.

VINCOLO FUNZIONALE SUL CAMPO "massima" (OBBLIGATORIO E SEMPRE RICHIESTO):
- Il campo "massima" DEVE essere sempre valorizzato (stringa non vuota) perché utilizzato per l'indicizzazione.
- Per le SENTENZE: se emerge un principio di diritto generalizzabile, estrai il principio generale, astratto e impersonale e assegna il corretto "tipo_massima" (conforme/difforme/principio_nuovo/di_specie/con_fattispecie).
- Per ORDINANZE, DECRETI o documenti per cui non emerge un principio: tipo_massima = "non_massimabile" (o "") e "massima" = "massima descrittiva" (descrizione standardizzata del contenuto decisorio in 1-2 frasi, senza nomi propri).
- Per MEMORIE, PARERI, FATTURE, MAIL, PERIZIE (tipo_documento = "documento_giurisprudenza_generico"): tipo_massima = "non_massimabile" (o "") e "massima" = breve sintesi descrittiva dell'oggetto o della finalità del documento (es. "Fattura per fornitura di servizi IT", "Memoria difensiva relativa a licenziamento per giusta causa").

ISTRUZIONI SPECIFICHE PER TIPO DI DOCUMENTO:

A. REGOLE PER SENTENZE:
- Distingui chiaramente: fattispecie rilevante, questione di diritto, ratio decidendi, obiter dicta.
- Escludi argomentazioni accessorie non decisive.
- Formula il principio in modo generale e impersonale.

B. REGOLE PER ORDINANZE E DECRETI:
- Ordinanza cautelare: privilegia "misura_disposta", "fumus_boni_iuris", "periculum_in_mora", "efficacia_temporale".
- Ordinanza processuale: descrivi la "misura_disposta" e la ratio essenziale.
- Decreto: privilegia "contenuto_precettivo", "contraddittorio", "autorita_monocratica".

C. REGOLE PER ATTI E PARERI (sottotipo: "memoria", "parere"):
- Compila "fatti" (circostanze esposte), "nucleo" (argomentazione giuridica centrale/tesi sostenuta) e "conclusioni" (richieste finali o esito del parere).

D. REGOLE PER DOCUMENTI DI SUPPORTO/PROVE (sottotipo: "fattura", "mail", "perizia", "altro"):
- Compila "sintesi" (descrizione generale del documento), "mittente" e "destinatario" (anonimizzati o descritti per ruolo, es. "Fornitore", "Società Cliente"), "importo" (se presente, estrai il valore numerico totale, altrimenti null), "data_riferimento_documento" (formato YYYY-MM-DD).

GESTIONE CAMPI NON RICAVABILI (OBBLIGATORIA):
- Se un campo stringa non è ricavabile: usa "".
- Se un campo array non è ricavabile: usa [].
- Se un campo boolean o number non è ricavabile: usa null.
- Non inventare mai dati.

OUTPUT JSON OBBLIGATORIO:
${JSON.stringify(DOCUMENT_SCHEMA)}

LINEE GUIDA CAMPO PER CAMPO:
- organo_giudicante: indicare esclusivamente, in forma estesa e normalizzata, l’autorità giudiziaria che ha emesso la sentenza, senza includere la sezione. Tutto in maiuscolo seguendo gli esempi: "CORTE DI CASSAZIONE", "CORTE COSTITUZIONALE", "CORTE D’APPELLO DI MILANO", "TRIBUNALE DI ROMA", "CORTE D’ASSISE DI TORINO", "CORTE D’ASSISE D’APPELLO DI NAPOLI", "TAR LAZIO –  DI ROMA", "CONSIGLIO DI STATO".
- sezione: se indicata nel provvedimento, riportare la sezione separatamente, scrivendo l’ordinalità in lettere maiuscole (es. "PRIMA", "SECONDA", "TERZA", "QUARTA", ecc.) e completando, ove presente, con l’indicazione del settore (es. "CIVILE", "PENALE"). Esempi: "QUARTA SEZIONE PENALE", "SECONDA SEZIONE CIVILE", "TERZA SEZIONE". Se non disponibile, usare stringa vuota.
- grado_giudizio: indicare il grado del giudizio ["Primo grado", "Appello", "Cassazione"].
- numero_sentenza: numero di raccolta generale ufficiale del provvedimento nel formato numeroProvvedimento/anno (es. 12345/2023). Lasciare vuoto nel caso non sia disponibile o ricavabile.
- data_sentenza: data ufficiale della sentenza in formato ISO (YYYY-MM-DD).
- ecli: inserire solo se disponibile l’ECLI ufficiale della sentenza; se non presente, lasciare vuoto.
- urn: se l’URN NIR ufficiale è esplicitamente presente nel testo o in metadati affidabili, riportarlo integralmente. In mancanza, tentare una ricostruzione **solo se** tutti gli elementi strutturali necessari sono certi (organo, tipo atto, data, numero). Se anche uno solo di questi elementi è incerto, lasciare il campo vuoto. Non inventare mai URN.
- fattispecie_rilevante: fatti giuridicamente rilevanti, sintetici, senza dettagli superflui.
- questione_di_diritto: problema giuridico centrale risolto dalla sentenza, una sola questione.
- massima: principio generale applicabile a casi analoghi se emerge un principio; in mancanza, massima descrittiva non vuota e indicizzabile (1–2 frasi).
- tipo_massima: uno dei valori consentiti ["conforme","difforme","principio_nuovo","di_specie","con_fattispecie","non_massimabile"].
- ratio_decidendi: nucleo logico-giuridico essenziale coerente con la massima.
- obiter_dicta: considerazioni non decisive, vuoto se assenti.
- riferimenti_normativi: (Array di stringhe) 
   - UN SOLO articolo per stringa (es. non "artt. 1 e 2 c.c.", ma "art. 1 c.c.", "art. 2 c.c.").
   - SINTASSI ARTICOLO: Sempre "art. [numero]" (es. "art. 1453", "art. 132-bis").
   - CODICI AMMESSI: "c.c.", "c.p.c.", "c.p.", "c.p.p.", "preleggi", "t.u.b.", "t.u.f.", "tuel", "ord. pen.", "disp. att. cod. proc. civ.", "disp. att. cod. proc. pen.".
   - LEGGI/DECRETI: "[tipo] n. [numero]/[anno]". Tipi: "d.lgs.", "d.l.", "d.p.r.", "r.d.", "l." (es. "art. 3 d.lgs. n. 50/2016").
   - UE: "Reg. [UE/CE/CEE] n. [numero]/[anno]" o "Dir. [UE/CE/CEE] n. [numero]/[anno]".
   - CEDU: "CEDU" o "Protocollo n. [numero] CEDU".
   - DETTAGLI: Ordine comma, lettera, numero (es. "art. 132, comma 2, lett. a, n. 1, c.p.c.").
- precedenti_richiamati: (Array di stringhe) Solo precedenti decisivi. Formato: "[Autorità], [Sezione], [Data], n. [numero]" (es. "Cass. civ., Sez. Un., 15 marzo 2016, n. 5068").
- materia: campo opzionale; se identificabile, usare ["Civile", "Penale", "Amministrativo", "Tributario", "Lavoro", "Contabile", "Altro"].
- area: Se identificabile: inserisci esattamente uno dei valori presenti in questo elenco: ${areeString}
- macrocategoria: array di stringhe: se identificabile, inserisci esattamente uno o più dei valori presenti in questo elenco: ${macroString}
- sottocategoria: array di stringhe. Utilizza lo stile di un "indice generale" di un manuale giuridico. Se il tema è specifico, risali di un grado nella gerarchia del diritto fino a trovare la categoria madre.
- fonte: indicare la fonte della sentenza se nota (es. "DeJure").
- lingua: opzionale, default "IT".
- note: eventuali annotazioni aggiuntive, opzionali.
- presidente: il presidente della sezione o del collegio che ha emesso la sentenza, se indicato; altrimenti stringa vuota.
- relatore: il relatore della sentenza, se indicato; altrimenti stringa vuota.

ISTRUZIONI SPECIFICHE PER IL CAMPO "summary" (OBBLIGATORIO):
- Obiettivo: Creare un testo ad altissima densità informativa che funga da "motore" per la ricerca semantica vettoriale. Il testo deve essere autosufficiente e permettere di comprendere l'intero documento senza doverlo leggere.
- Limite di lunghezza: Tassativamente sotto i 3000 caratteri. Usa uno stile telegrafico ma fluido, elimina le formule di rito, gli avverbi inutili e le premesse formali.
- Contenuto per Provvedimenti Giurisdizionali (Sentenze, Ordinanze, Decreti): Devi fondere in un unico testo logicamente consequenziale: 1) il nucleo del fatto storico; 2) la questione di diritto dibattuta; 3) le norme fondamentali applicate (es. "art. 2043 c.c."); 4) l'argomentazione logica del giudice (ratio decidendi); 5) il principio di diritto o l'esito finale.
- Contenuto per Documenti Generici (Memorie, Pareri, Perizie, Mail, ecc.): Sintetizza in modo denso l'oggetto materiale o contrattuale, le posizioni/tesi sostenute dalle parti coinvolte (anonimizzate per ruolo, es. "Fornitore" e "Committente"), i dati numerici o tecnici determinanti (es. importi contestati, patologie valutate in perizia) e le conclusioni/richieste formulate.
- Lessico: Usa la massima precisione terminologica giuridica. Le parole chiave legali (istituti, definizioni, azioni) devono essere presenti e chiare, poiché il campo servirà all'AI per trovare il documento tramite matching concettuale. Non inserire MAI i nomi propri delle parti fisiche o giuridiche reali.

LINEE GUIDA CAMPI PER DOCUMENTI GENERICI:
- fatti: sintesi storica degli eventi (per memorie/pareri).
- nucleo: fulcro logico o tesi giuridica sostenuta dall'autore del documento.
- conclusioni: le richieste al giudice o il responso finale.
- sintesi: contenuto essenziale per mail, fatture o perizie.
- mittente / destinatario: chi invia/riceve (anonimizzato in ruoli).
- importo: valore numerico (es. 1500.50), null se non presente.
- data_riferimento_documento: data del documento generico (YYYY-MM-DD).

CONTROLLI FINALI:
1. "massima" e "tipo_documento" NON devono mai essere vuoti.
2. Rispetta rigorosamente i valori consentiti per gli ENUM.
3. Se "tipo_documento" è "documento_giurisprudenza_generico", compila i campi dedicati (fatti/nucleo/conclusioni o sintesi/mittente/destinatario/importo) a seconda del "sottotipo_documento".
4. Usa un linguaggio formale, tecnico, senza identificativi personali.

VINCOLO ASSOLUTO:
Restituisci esclusivamente un JSON valido conforme allo schema, senza markdown tag non necessari se non supportati, e senza commenti, spiegazioni o testo aggiuntivo.
`;

/*VECTOR*/

export async function handleEmbeddingCreation(
  event: FirestoreEvent<QueryDocumentSnapshot | undefined, { docId: string }>
) {
  const snap = event.data;
  if (!snap || !snap.exists) return;

  const data = snap.data();
  if (!data || data.isEmbeddingFinished || data.isEmbeddingFailed) return;

  const docId = event.params.docId;

  // Selezione del testo
  let textToEmbed = data.summary || data.massima;
  if (!textToEmbed) {
    textToEmbed = data.tipo_documento === "documento_giurisprudenza_generico" 
      ? (data.nucleo || data.sintesi) 
      : data.fattispecie_rilevante;
  }

  if (!textToEmbed || typeof textToEmbed !== "string" || textToEmbed.trim() === "") {
    await snap.ref.update({ isEmbeddingFinished: true });
    return;
  }

  try {
    const oaClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await oaClient.embeddings.create({
      model: "text-embedding-3-small", 
      input: textToEmbed.trim(),
      dimensions: 1536
    });
    
    const embedding = response.data[0].embedding;

    await snap.ref.update({
      isEmbeddingFinished: true,
      embedding: FieldValue.vector(embedding),
      lastVectorizedAt: FieldValue.serverTimestamp(),
      // Pulizia eventuale array se presente
      ...(Array.isArray(data.testo_integrale) ? { testo_integrale: FieldValue.delete() } : {})
    });

    console.log(`✅ Embedding creato per sentence: ${docId}`);
  } catch (error) {
    console.error(`❌ Error embedding sentence ${docId}:`, error);
    await snap.ref.update({ isEmbeddingFailed: true });
  }
}

export async function handleEmbeddingManualCreation(
  event: FirestoreEvent<QueryDocumentSnapshot | undefined, { docId: string }>
) {
  const snap = event.data;
  if (!snap || !snap.exists) return;

  const data = snap.data();
  if (!data || data.isEmbeddingFinished || data.isEmbeddingFailed) return;

  const docId = event.params.docId;

  // Selezione del testo
  let textToEmbed = data.text;

  if (!textToEmbed || typeof textToEmbed !== "string" || textToEmbed.trim() === "") {
    await snap.ref.update({ isEmbeddingFinished: true });
    return;
  }

  try {
    const oaClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await oaClient.embeddings.create({
      model: "text-embedding-3-small", 
      input: textToEmbed.trim(),
      dimensions: 1536
    });
    
    const embedding = response.data[0].embedding;

    await snap.ref.update({
      isEmbeddingFinished: true,
      embedding: FieldValue.vector(embedding),
      lastVectorizedAt: FieldValue.serverTimestamp(),
    });
    console.log(`✅ Embedding creato per sentence: ${docId}`);
  } catch (error) {
    console.error(`❌ Error embedding sentence ${docId}:`, error);
    await snap.ref.update({ isEmbeddingFailed: true });
  }
}
/**
 * HANDLER 2: Embedding con Chunking (per documenti complessi)
 */
export async function handleEmbeddingDocumentCreation(
  event: FirestoreEvent<QueryDocumentSnapshot | undefined, { docId: string }>
) {
  const snap = event.data;
  if (!snap || !snap.exists) return;

  const data = snap.data();
  if (!data || data.isEmbeddingFinished || data.isEmbeddingFailed) return;

  const parentId = event.params.docId;
  
  // Prepariamo gli input per OpenAI
  const inputsToEmbed: string[] = [];
  const metadataMapping: string[] = []; 
  const chunksToEmbed: string[] = Array.isArray(data.testo_integrale) ? data.testo_integrale : [];

  // Gestione testo principale (Metadata)
  let mainText = data.summary || data.massima || data.text || data.contenuto;
  if (!mainText && typeof data.testo_integrale === "string") {
    mainText = data.testo_integrale;
  }

  if (mainText && typeof mainText === "string" && mainText.trim() !== "") {
    inputsToEmbed.push(mainText.trim());
    metadataMapping.push("embedding"); // Il campo nel doc padre dove salvare il vettore principale
  }

  // Se non c'è nulla da processare
  if (inputsToEmbed.length === 0 && chunksToEmbed.length === 0) {
    await snap.ref.update({ isEmbeddingFinished: true });
    return;
  }

  // Uniamo tutto in un'unica chiamata batch per risparmiare tempo e costi
  const fullInputArray = [...inputsToEmbed, ...chunksToEmbed];

  try {
    const oaClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await oaClient.embeddings.create({
      model: "text-embedding-3-small", 
      input: fullInputArray,
      dimensions: 1536
    });
    const embeddingsResult = response.data.map(d => d.embedding);

    const batch = db.batch();
    
    // A. Update Padre
    const parentUpdate: any = {
      isEmbeddingFinished: true,
      testo_integrale: FieldValue.delete(),
      lastVectorizedAt: FieldValue.serverTimestamp()
    };

    metadataMapping.forEach((fieldName, index) => {
      parentUpdate[fieldName] = FieldValue.vector(embeddingsResult[index]);
    });
    batch.update(snap.ref, parentUpdate);

    // B. Creazione Chunks
    const metadataCount = metadataMapping.length;
    chunksToEmbed.forEach((chunkText, i) => {
      const vectorIndex = metadataCount + i;
      const chunkDocRef = db.collection("document_chunks").doc(`${parentId}_chunk_${i}`);
      
      batch.set(chunkDocRef, {
        parentId: parentId,
        text: chunkText,
        index: i,
        embedding: FieldValue.vector(embeddingsResult[vectorIndex]),
        urn: data.urn || null,
        organo_giudicante: data.organo_giudicante || null,
        sezione: data.sezione || null,
        dataSentenza: data.dataSentenza || null,
        tipo_documento: data.tipo_documento || null,
        tipo_ordinanza: data.tipo_ordinanza || null,
        tipo_massima: data.tipo_massima || null,
        fascicoloId: data.fascicoloId || null,
        user: data.user || null,
        nome_file: data.nome_file || null,
        createdAt: FieldValue.serverTimestamp()
      });
    });

    await batch.commit();
    console.log(`✅ Documento ${parentId} completato con ${chunksToEmbed.length} chunk.`);
    await applyTeamVisibility(snap.ref, snap.data(), "user")

  } catch (error) {
    console.error(`❌ Critical error embedding document ${parentId}:`, error);
    await snap.ref.update({ isEmbeddingFailed: true });
  }
}

export async function handleChunkEmbedding(
  event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { docId: string }>
) {
  const snap = event.data?.after;
  if (!snap || !snap.exists) return; // Documento eliminato

  const data = snap.data();
  if (!data) return;

  // 1. GUARDIA: Evitiamo loop infiniti
  // Se l'embedding esiste già o abbiamo segnato un fallimento, usciamo.
  if (data.embedding || data.isEmbeddingFailed) return;

  // 2. Controllo presenza testo
  const textToEmbed = data.text;
  if (!textToEmbed || typeof textToEmbed !== "string") {
    console.warn(`Chunk ${event.params.docId} non contiene testo valido.`);
    return;
  }

  try {
    const oaClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 3. Generazione Embedding (Singolo input)
    const response = await oaClient.embeddings.create({
      model: "text-embedding-3-small",
      input: textToEmbed,
      dimensions: 1536
    });

    const vector = response.data[0].embedding;

    // 4. Salvataggio del vettore nel documento del chunk
    await snap.ref.update({
      embedding: FieldValue.vector(vector),
      processedAt: FieldValue.serverTimestamp(),
      isEmbeddingFailed: FieldValue.delete() // Rimuoviamo eventuali flag di errore precedenti
    });

    console.log(`✅ Embedding creato con successo per il chunk: ${event.params.docId}`);
    await applyTeamVisibility(snap.ref, snap.data(), "user")
  } catch (error) {
    console.error(`❌ Errore embedding per chunk ${event.params.docId}:`, error);
    
    // Segnamo il fallimento per evitare loop infiniti e per monitoraggio
    await snap.ref.update({ 
      isEmbeddingFailed: true,
      errorDetails: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

export async function handleFascicoloCreation(
  event: FirestoreEvent<QueryDocumentSnapshot | undefined, Record<string, string>>
) {
  const snap = event.data;
  if (!snap) return;
  await applyTeamVisibility(snap.ref, snap.data(), "ownerId");
}

export async function applyTeamVisibility(
  docRef: DocumentReference, 
  data: any, 
  userIdField: string
): Promise<void> {
  
  // 1. Recuperiamo l'ID dell'utente dal documento appena creato
  const userId = data[userIdField];
  if (!userId) {
    console.warn(`Campo utente '${userIdField}' non trovato nel doc ${docRef.id}`);
    return;
  }

  const db = getDb();
  
  try {
    // 2. Cerchiamo se esiste un team di cui questo utente fa parte
    const teamsQuery = await db.collection("teams")
      .where("member_ids", "array-contains", userId)
      .limit(1)
      .get();

    if (!teamsQuery.empty) {
      const teamDoc = teamsQuery.docs[0];
      const teamData = teamDoc.data();

      // 3. ORA facciamo il controllo sul campo del TEAM
      if (teamData.visibility_default === "team") {
        const teamMembers = teamData.member_ids || [];

        if (teamMembers.length > 0) {
          // 4. Il team è configurato per condividere: aggiungiamo i membri al documento
          await docRef.update({
            visibleTo: FieldValue.arrayUnion(...teamMembers)
          });
          console.log(`Aggiunti ${teamMembers.length} membri a visibleTo per ${docRef.path}`);
        }
      } else {
        // L'utente ha un team, ma il team non ha come default la condivisione.
        console.log(`Il team ${teamDoc.id} ha visibility_default = "${teamData.visibility_default}". Nessuna condivisione applicata.`);
      }
    } else {
      console.log(`Nessun team trovato per l'utente ${userId}`);
    }
  } catch (error) {
    console.error(`Errore in applyTeamVisibility per ${docRef.path}:`, error);
  }
}
/**
 * CATALOGO PROVVEDIMENTI (2021 - 2026)
 * Struttura dati ottimizzata per applicazioni web e consultazione rapida.
 */

export const CATALOGO_PROVVEDIMENTI = {
  periodo: "2021-2026",
  corti: {
    cassazioneCivile: {
      nome: "Corte di Cassazione - Civile",
      id: "CORTE DI CASSAZIONE",
      desc: "Organo supremo della giustizia ordinaria con funzione nomofilattica: assicura l'esatta osservanza e l'uniforme interpretazione della legge nell'ambito dei rapporti privatistici.",
      sezioni: [
        { id: "PRIMA SEZIONE CIVILE", nome: "Prima Sezione", descrizione: "Diritto di famiglia, stato delle persone, diritti d'autore, bancario e procedure concorsuali." },
        { id: "SECONDA SEZIONE CIVILE", nome: "Seconda Sezione", descrizione: "Proprietà, diritti reali, successioni, condominio e responsabilità professionale." },
        { id: "TERZA SEZIONE CIVILE", nome: "Terza Sezione", descrizione: "Responsabilità extracontrattuale (danni), contratti atipici, assicurazioni e locazioni." },
        { id: "QUARTA SEZIONE CIVILE", nome: "Quarta Sezione (Lavoro)", descrizione: "Diritto del lavoro, previdenza sociale e pubblico impiego contrattualizzato." },
        { id: "QUINTA SEZIONE CIVILE", nome: "Quinta Sezione (Tributaria)", descrizione: "Controversie tra contribuenti e amministrazione finanziaria." },
        { id: "SESTA SEZIONE CIVILE", nome: "Sesta Sezione", descrizione: "Filtro per l'inammissibilità dei ricorsi (vizi formali o sostanziali)." },
        { id: "SEZIONI UNITE CIVILI", nome: "Sezioni Unite", descrizione: "Risoluzione di contrasti interpretativi tra sezioni e questioni di massima importanza o giurisdizione." }
      ]
    },
    cassazionePenale: {
      nome: "Corte di Cassazione - Penale",
      id: "CORTE DI CASSAZIONE",
      desc: "Giudice di legittimità di ultima istanza che verifica la corretta applicazione delle norme penali e procedurali, senza entrare nel merito della ricostruzione del fatto.",
      sezioni: [
        { id: "PRIMA SEZIONE PENALE", nome: "Prima Sezione", descrizione: "Omicidi, criminalità organizzata, misure di prevenzione ed esecuzione penale." },
        { id: "SECONDA SEZIONE PENALE", nome: "Seconda Sezione", descrizione: "Delitti contro il patrimonio (furti, rapine) e reati informatici." },
        { id: "TERZA SEZIONE PENALE", nome: "Terza Sezione", descrizione: "Reati ambientali, urbanistici, tributari e delitti contro la libertà sessuale." },
        { id: "QUARTA SEZIONE PENALE", nome: "Quarta Sezione", descrizione: "Reati colposi: responsabilità medica, infortuni sul lavoro e circolazione stradale." },
        { id: "QUINTA SEZIONE PENALE", nome: "Quinta Sezione", descrizione: "Reati contro la persona (lesioni, diffamazione), fallimentari e reati a mezzo stampa." },
        { id: "SESTA SEZIONE PENALE", nome: "Sesta Sezione", descrizione: "Reati contro la Pubblica Amministrazione e contro l'amministrazione della giustizia." },
        { id: "SETTIMA SEZIONE PENALE", nome: "Settima Sezione", descrizione: "Filtro per l'inammissibilità dei ricorsi (vizi formali o sostanziali)." },
        { id: "SEZIONE FERIALE PENALE", nome: "Feriale", descrizione: "Urgenze e indagati detenuti durante la sospensione estiva." },
        { id: "SEZIONI UNITE PENALI", nome: "Sezioni Unite", descrizione: "Uniformità dell'applicazione della legge e risoluzione conflitti tra sezioni." }
      ]
    },
    consiglioStato: {
      nome: "Consiglio di Stato",
      id: "CONSIGLIO DI STATO",
      desc: "Organo di ultimo grado della giustizia amministrativa e di consulenza giuridico-amministrativa, preposto alla tutela degli interessi legittimi e dei diritti soggettivi nei confronti della P.A.",
      sezioni: [
        { id: "SEZIONE II", nome: "Sezione II", descrizione: "Funzioni giurisdizionali varie e ricorsi straordinari al Capo dello Stato." },
        { id: "SEZIONE III", nome: "Sezione III", descrizione: "Sanità, assistenza sociale, immigrazione e misure interdittive antimafia." },
        { id: "SEZIONE IV", nome: "Sezione IV", descrizione: "Urbanistica, edilizia, espropriazioni e tutela dell'ambiente." },
        { id: "SEZIONE V", nome: "Sezione V", descrizione: "Appalti pubblici, contratti pubblici e procedure di gara degli enti locali." },
        { id: "SEZIONE VI", nome: "Sezione VI", descrizione: "Istruzione, università, antitrust, energia e beni culturali." },
        { id: "SEZIONE VII", nome: "Sezione VII", descrizione: "Smaltimento arretrato su materie trasversali (appalti e pubblico impiego)." },
        { id: "SEZIONE PLENARIA", nome: "Sezione Plenaria", descrizione: "Funzione nomofilattica e risoluzione contrasti tra sezioni amministrative." }
      ]
    },
    corteCostituzionale: {
      nome: "Corte Costituzionale",
      id: "CORTE COSTITUZIONALE",
      desc: "Organo di garanzia costituzionale incaricato di giudicare la conformità delle leggi alla Costituzione, i conflitti di attribuzione tra poteri dello Stato e l'ammissibilità dei referendum."
    }
  }
} as const;

/*SUPPORT*/

export const SYSTEM_PROMPT_JURIO_SUPPORT = `
# PROMPT DI SISTEMA: ASSISTENTE JURIO - SUPPORTO UFFICIALE

## 1. IDENTITÀ E PERIMETRO OPERATIVO
Sei l'Assistente Ufficiale di Jurio, la piattaforma di intelligenza giuridica per avvocati e professionisti. Il tuo compito è assistere l'utente nella navigazione della piattaforma, nella comprensione delle funzionalità (Ricerca Semantica, Consulente Legale, Analisi Documentale, Add-in Word), nella gestione dell'account e nella scelta dei piani di abbonamento.

**VINCOLO TASSATIVO:**
- Rispondi esclusivamente su funzionalità, guide d'uso, limiti tecnici, piani, abbonamenti e policy di Jurio.
- Per qualsiasi dubbio operativo o tecnico, **DEVI SEMPRE UTILIZZARE IL TOOL "ricercaManualeTool"** per recuperare le informazioni aggiornate dalla documentazione ufficiale prima di rispondere.

## 2. REGOLE DI INTERAZIONE E STILE
* **Uso dei Tool:** Interroga \`ricercaManualeTool\` inserendo la query dell'utente per estrarre le linee guida, i link o i prezzi esatti. Non affidarti solo alla memoria statica per dati amministrativi o tecnici complessi.
* **Proattività e Accuratezza:** Fornisci risposte dirette, professionali e cordiali. Rimanda l'utente agli URL ufficiali della piattaforma presenti nei documenti (es. \`/contatti\`, \`/ricerca\`, \`/termini\`) quando pertinente.
* **Rigorismo e Sintesi:** Mantieni un tono formale, efficiente e orientato al problem solving. Evita preamboli prolissi.
* **Formattazione:** Usa il Markdown (grassetto per i concetti chiave, elenchi puntati, link cliccabili completi di dominio \`https://jurio.it/...\`).
`;

/*PAYMENTS*/

export const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
export const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");

export type PlanDoc = { price: number; currency?: string; durationDays?: number; stripePriceId?: string };

export function getStripe(): Stripe {
  const sk = STRIPE_SECRET_KEY.value();
  if (!sk) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(sk);
}

export function getWebhookSecret(): string {
  const whsec = STRIPE_WEBHOOK_SECRET.value();
  if (!whsec) throw new Error("Missing STRIPE_WEBHOOK_SECRET");
  return whsec;
}

export function normalizePlanId(id: unknown):
  | "personale" | "business" | "personale_m" | "business_m"
  | null {
  if (typeof id !== "string") return null;
  const v = id.toLowerCase().trim();
  if (v === "personale" || v === "business" || v === "personale_m" || v === "business_m") return v;
  return null;
}
