import { Link } from 'react-router-dom';

export default function AnalisiDocumenti() {
  return (
    <div className="space-y-8">
      {/* Intestazione Sezione */}
      <div>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="text-md font-bold tracking-widest text-(--color-text) uppercase bg-(--color-surface) border border-(--color-border) px-2.5 py-1 rounded-sm shadow-xs">
            1. Casi d'uso
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-(--color-text) bg-(--color-surface) border border-(--color-border) px-2.5 py-0.5 rounded-sm shadow-xs">
            Piano Business / Prova Gratuita
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-medium text-(--color-text) tracking-tight mt-1 mb-2.5">
          Analisi Documentale
        </h1>
        <p className="text-md  text-(--color-muted) font-light leading-relaxed">
          La sezione <strong className="font-semibold text-(--color-text)">Analisi Documentale</strong> è lo strumento dedicato all'elaborazione avanzata, all'estrazione dati e alla strutturazione di file esterni all'interno dell'ambiente riservato dell'utente. La funzionalità è inclusa nei piani Business ed è utilizzabile per tutta la durata del periodo di prova.
        </p>
      </div>

      <hr className="border-(--color-border)" />

      {/* SEZIONE: Formati Supportati & Caricamento */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            Formati Supportati e Caricamento
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            Il sistema accetta qualsiasi tipologia di provvedimento giurisprudenziale (sentenze, ordinanze, decreti) o atto giuridico e contrattuale. È possibile elaborare un file alla volta attraverso diverse modalità di inserimento:
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <h3 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Drag & Drop</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">Trascina direttamente il documento all'interno dell'area di caricamento.</p>
          </div>
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <h3 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Dispositivo Locale</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">Seleziona e carica file direttamente dalla memoria del tuo computer o smartphone.</p>
          </div>
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <h3 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Cloud Personale</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">Importa documenti già salvati nel tuo archivio cloud privato su Jurio.</p>
          </div>
        </div>

        {/* Formati file ammessi */}
        <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) text-md text-(--color-muted) font-light leading-relaxed shadow-xs overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
          <span className="font-bold uppercase tracking-widest text-(--color-text) block mb-2 text-[10px]">Estensioni e tipologie di file supportate:</span>
          <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
            <span className="px-2.5 py-1 bg-(--color-bg) border border-(--color-border) rounded-sm text-(--color-text)">PDF</span>
            <span className="px-2.5 py-1 bg-(--color-bg) border border-(--color-border) rounded-sm text-(--color-text)">Word (.docx)</span>
            <span className="px-2.5 py-1 bg-(--color-bg) border border-(--color-border) rounded-sm text-(--color-text)">EML (Email)</span>
            <span className="px-2.5 py-1 bg-(--color-bg) border border-(--color-border) rounded-sm text-(--color-text)">PowerPoint</span>
            <span className="px-2.5 py-1 bg-(--color-bg) border border-(--color-border) rounded-sm text-(--color-text)">Excel</span>
            <span className="px-2.5 py-1 bg-(--color-bg) border border-(--color-border) rounded-sm text-(--color-text)">Immagini (PNG, JPG)</span>
            <span className="px-2.5 py-1 bg-(--color-bg) border border-(--color-border) rounded-sm text-(--color-text)">Audio MP3</span>
          </div>
        </div>

        {/* --- PLACEHOLDER IMMAGINE 1 (Area Upload e Drag & Drop) --- */}
        <div className="my-4">
          <div className="flex justify-center">
            <img
              src="https://jurio.it/guida-image/analisi.webp"
              alt="Schermata di autenticazione con opzione Single Sign-On e recupero credenziali"
              loading="lazy"
            />
          </div>
          <p className="text-md text-(--color-muted) font-light mt-2 text-center italic">
            Figura 1: Interfaccia di upload file con selezione automatica del motore di acquisizione.
          </p>
        </div>
      </section>

      <hr className="border-(--color-border)" />

      {/* SEZIONE: Motore OCR e Trascrizione Audio */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            Motore di Estrazione e Riconoscimento
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            All'atto del caricamento, il motore di intelligenza artificiale avvia automaticamente il modulo di acquisizione idoneo al tipo di dato:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <h3 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Elaboratore OCR (Immagini e PDF Scansionati)</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Converte scansioni cartacee e immagini in testo digitale leggibile e indicizzabile.
            </p>
          </div>

          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <h3 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Modulo di Trascrizione Audio</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Elabora file vocali e registrazioni (es. tracce MP3), trasformando il parlato in testo continuo pronto per l'analisi.
            </p>
          </div>
        </div>

        <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) text-md text-(--color-muted) font-light leading-relaxed shadow-xs overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
          <strong className="font-bold uppercase tracking-wider text-(--color-text) block mb-1 text-[10px]">Generazione Documento Strutturato:</strong> 
          Una volta estratto il testo grezzo, il sistema genera metadati analitici (autorità, parti in causa, date, massime, questioni giuridiche o clausole chiave) che alimentano i matching semantici all'interno del Consulente Legale.
        </div>
      </section>

      <hr className="border-(--color-border)" />

      {/* SEZIONE: Schemi di Elaborazione e Prompt Builder */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            Schemi di Elaborazione e Prompt Builder
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            Per indirizzare l'analisi verso specifici obiettivi di studio, la piattaforma mette a disposizione diversi profili di elaborazione:
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <h3 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Prompt Standard</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">Ottimizzato per la repertoriazione di sentenze, ordinanze e provvedimenti giudiziari.</p>
          </div>

          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <h3 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Prompt Verticali Predefiniti</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Schemi mirati per <em>Analisi contrattuale</em>, <em>Analisi conversazionali e verbali</em>, e <em>Individuazione rischi e criticità operative</em>.
            </p>
          </div>
        </div>

        {/* Box Prompt Builder Personalizzato */}
        <div className="relative p-5 sm:p-6 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2.5">
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
          <div className="flex items-center justify-between flex-wrap gap-2 mt-1">
            <h3 className="text-md font-bold uppercase tracking-wider text-(--color-text)">Prompt Builder Personalizzato</h3>
            <Link 
              to="/profilo/prompt-builder#crea" 
              className="text-md font-bold uppercase tracking-widest text-(--color-text) hover:underline underline-offset-2"
            >
              Vai al Prompt Builder (/profilo/prompt-builder#crea) →
            </Link>
          </div>
          <p className="text-md text-(--color-muted) font-light leading-relaxed">
            Raggiungibile dall'area profilo, consente di configurare schemi di estrazione su misura definendo:
          </p>
          <ul className="text-md text-(--color-muted) font-light space-y-1.5 leading-relaxed">
            <li>• <strong className="font-semibold text-(--color-text)">Informazioni Generali:</strong> nome identificativo del prompt, obiettivo strategico e linee guida/note operative (es. formattazione date in formato YYYY-MM-DD).</li>
            <li>• <strong className="font-semibold text-(--color-text)">Struttura Dati da Estrarre:</strong> singoli campi personalizzati in formato testo/stringa con le relative istruzioni semantiche per l'AI.</li>
          </ul>
        </div>

        {/* --- PLACEHOLDER IMMAGINE 2 (Prompt Builder UI) --- */}
        <div className="my-4">
          <div className="flex justify-center">
            <img
              src="https://jurio.it/guida-image/prompting.webp"
              alt="Schermata di autenticazione con opzione Single Sign-On e recupero credenziali"
              loading="lazy"
            />
          </div>
          <p className="text-md text-(--color-muted) font-light mt-2 text-center italic">
            Figura 2: Creazione di regole di estrazione customizzate tramite il Prompt Builder.
          </p>
        </div>
      </section>

      <hr className="border-(--color-border)" />

      {/* SEZIONE: Gestione dell'Archivio Documenti */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1" >
            Gestione dell'Archivio Documenti
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            I file elaborati confluiscono nell'archivio della schermata, suddiviso tra <strong className="font-semibold text-(--color-text)">Documenti Caricati personali</strong> e <strong className="font-semibold text-(--color-text)">Provvedimenti Pubblici Salvati</strong> attinti dalla banca dati istituzionale.
          </p>
        </div>

        <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-2 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
          <h3 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Azioni disponibili sulle schede archivio:</h3>
          <ul className="text-md text-(--color-muted) font-light space-y-1.5 leading-relaxed">
            <li>• <strong className="font-semibold text-(--color-text)">Consultazione Dettagliata:</strong> apri la scheda di dettaglio per visualizzare l'estrazione strutturata o il testo originale.</li>
            <li>• <strong className="font-semibold text-(--color-text)">Manutenzione Archivio:</strong> rinomina o elimina i documenti elaborati per mantenere ordinate le cartelle di studio.</li>
            <li>• <strong className="font-semibold text-(--color-text)">Integrazione con il Consulente Legale:</strong> richiama i file caricati nelle chat e nei fascicoli per interrogazioni puntuali e confronti di merito.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}