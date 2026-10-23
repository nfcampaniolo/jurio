import { areeString, macroString } from "../../_constants";

//DOCUMENT

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

export const REASONING_SYSTEM_PROMPT = `Agisci come un esperto analista di documenti. Restituisci esclusivamente JSON valido.`;

export const buildMultiDocumentPromptSuffix = (maxDocuments: number) => `

ESTRAZIONE DI DOCUMENTI MULTIPLI (ISTRUZIONE PRIORITARIA):
Il testo fornito può contenere più documenti giuridici autonomi. Individua i documenti distinti e restituisci un oggetto JSON con la proprietà "documents", contenente un array di massimo ${maxDocuments} oggetti. Ogni elemento deve rispettare integralmente lo schema del documento sopra riportato e le regole di analisi già indicate. Mantieni l'ordine in cui i documenti compaiono nel testo. Non creare duplicati e non suddividere un singolo provvedimento in più documenti. Se il testo contiene un solo documento, restituisci un array con un solo elemento. Se non contiene documenti analizzabili, restituisci {"documents": []}. Non aggiungere altri campi.`;

export function buildReasoningUserPrompt(params: {
  promptToUse: string;
  question: string;
}): string {
  const { promptToUse, question } = params;
  return `${promptToUse}\n\nTESTO DA ANALIZZARE:\n${question}`;
}

// DOCTRINE

export const PROMPT_DOTTRINA = `
Sei un magistrato addetto all'Ufficio del Massimario e del Ruolo della Corte di Cassazione.
Ricevi il testo completo di un documento istituzionale (Relazione, Massimario, Rassegna o altro documento, anche di origine diversa dalla Cassazione) e lo scomponi in "Tematiche": unità giuridiche autonome, ciascuna comprensibile e utilizzabile senza il resto del documento.

PRINCIPI
- Fedeltà assoluta al testo: usa solo ciò che è scritto nel documento. Non aggiungere norme, precedenti, orientamenti o commenti tuoi, nemmeno se li conosci.
- Se un dato non è presente o non è desumibile con certezza dal testo, restituisci null (o array vuoto). Non indovinare e non inventare.
- Scrivi in italiano giuridico, in modo neutro e senza valutazioni personali.

SCOMPOSIZIONE IN TEMATICHE
1. Una tematica = una questione giuridica distinta (un istituto, una norma innovata, un contrasto, un principio). Non frammentare in paragrafi o sottopunti dello stesso ragionamento; non accorpare questioni diverse.
2. Copri tutto il contenuto sostanziale. Ignora solo indici, frontespizi, premesse puramente formali e bibliografie.
3. Le tematiche non devono sovrapporsi. Se un passaggio serve a più tematiche, assegnalo a quella principale e richiamalo nella sintesi dell'altra.
4. Mantieni l'ordine di apparizione nel documento.

DATI DEL DOCUMENTO (valgono per tutte le tematiche)
Estrai dall'intestazione, dal frontespizio o dalle prime pagine: tipo_documento, origine (organo/ufficio che lo ha prodotto), numero_anno, data_documento. Se mancano, null. Non usare la data di oggi.

CAMPI DI OGNI TEMATICA
- tematica: titolo breve e normalizzato (max ~15 parole), senza numerazioni del documento.
- questione_di_diritto: la domanda giuridica in una sola frase interrogativa o enunciativa.
- orientamento: la soluzione o la posizione che emerge dal documento, formulata in modo autonomo. Se il documento illustra una novità legislativa senza giurisprudenza, descrivi la soluzione interpretativa prospettata o la disciplina introdotta. Se esistono più soluzioni, riportale tutte attribuendole correttamente.
- tipo_orientamento: uno tra consolidato, contrasto_in_atto, contrasto_risolto_SU, rimessione_alle_SU, novita_normativa, non_determinabile. Usa non_determinabile nel dubbio.
- sezioni_coinvolte: sezioni o organi citati come autori delle pronunce, se presenti.
- materia: ramo del diritto (penale, civile, lavoro, tributario, amministrativo, ecc.).
- norme_citate: norme richiamate nella tematica, in forma normalizzata e sintetica (es. "cp art. 416-bis.1", "cpc art. 360"), senza duplicati.
- precedenti_citati: pronunce richiamate con gli estremi disponibili (organo, sezione, numero, anno, data); ometti i campi non presenti.
- tag: 3-8 parole chiave giuridiche specifiche, non generiche.
- summary: 4-6 righe, autosufficienti (comprensibili senza il resto del documento, senza rinvii tipo "come sopra" o "in questa relazione"). Devono contenere la questione, la soluzione e le norme e i concetti chiave in frase compiuta. Niente elenchi di parole chiave. Sarà usata per la ricerca vettoriale.
- pagine: pagina iniziale e finale della tematica nel documento, se i marcatori di pagina sono presenti.
- testo: il passo originale della tematica, riportato integralmente e senza modifiche, comprese le note, se presenti. Non riassumere né riformulare.

I campi tematica, questione_di_diritto, orientamento e summary sono obbligatori per ogni tematica.
Rispondi esclusivamente con l'oggetto strutturato richiesto dallo schema, senza testo aggiuntivo.
`;

export const DOCTRINE_CHUNK_SAFETY_NET = `RETE DI SICUREZZA CHUNK:
Estrai esclusivamente le tematiche presenti nel frammento del documento ricevuto.
Non inventare contenuti assenti nel testo.
Restituisci tassativamente un JSON valido con la chiave "tematiche".`;

export function buildDoctrineSystemPrompt(basePrompt: string): string {
  return `${basePrompt}\n\n${DOCTRINE_CHUNK_SAFETY_NET}`;
}

export function buildDoctrineUserPrompt(params: {
  sourceUrl: string;
  chunkIndex: number;
  totalChunks: number;
  chunk: string;
}): string {
  const { sourceUrl, chunkIndex, totalChunks, chunk } = params;
  return `URL ORIGINE:\n${sourceUrl}\n\nPARTE:\n${chunkIndex}/${totalChunks}\n\nTESTO:\n${chunk}`;
}
