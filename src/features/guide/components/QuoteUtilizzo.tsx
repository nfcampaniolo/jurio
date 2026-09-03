import { Link } from 'react-router-dom';

export default function QuoteUtilizzo() {
  return (
    <div className="space-y-8">
      {/* Intestazione Sezione */}
      <div>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="text-md font-bold tracking-widest text-(--color-text) uppercase bg-(--color-surface) border border-(--color-border) px-2.5 py-1 rounded-sm shadow-xs">
            4. Supporto
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-(--color-text) bg-(--color-surface) border border-(--color-border) px-2.5 py-0.5 rounded-sm shadow-xs">
            Report & Metriche di Produttività
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-medium text-(--color-text) tracking-tight mt-1 mb-2.5" >
          Quote di Utilizzo, Servizi e Limiti Tecnici
        </h1>
        <p className="text-md  text-(--color-muted) font-light leading-relaxed">
          La piattaforma applica logiche di monitoraggio e soglie di sicurezza per garantire prestazioni elevate, tracciare il tempo risparmiato dallo studio e assicurare un'elaborazione fluida dei documenti.
        </p>
      </div>

      <hr className="border-(--color-border)" />

      {/* SEZIONE 1: Differenziazione per Servizi e non per Quote */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            Differenziazione dei Piani per Servizi
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            In Jurio la differenza tra i piani <strong className="font-semibold text-(--color-text)">Essential</strong> e <strong className="font-semibold text-(--color-text)">Business</strong> si basa sull'<strong className="font-semibold text-(--color-text)">accesso ai singoli moduli operativi</strong> e non su limiti artificiali di consultazione:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
            <span className="inline-block text-md font-bold text-(--color-text) uppercase tracking-widest bg-(--color-bg) border border-(--color-border) px-2 py-0.5 rounded-sm shadow-xs mt-1">
              Piano Essential
            </span>
            <h3 className="text-sm sm:text-base font-medium text-(--color-text) tracking-tight" >Ricerca & Giurisprudenza Illimitata</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Accesso illimitato alla banca dati delle Corti Supreme (Cassazione, Consiglio di Stato, Corte Costituzionale), ricerca semantica, consultazione massime e strumenti di navigazione avanzata.
            </p>
          </div>

          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
            <span className="inline-block text-md font-bold text-(--color-text) uppercase tracking-widest bg-(--color-bg) border border-(--color-border) px-2 py-0.5 rounded-sm shadow-xs mt-1">
              Piano Business / Trial
            </span>
            <h3 className="text-sm sm:text-base font-medium text-(--color-text) tracking-tight" >Suite Completa di Agenti AI</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Abilita l'intero ecosistema di intelligenza artificiale: <em>Legal Agent</em> (Consulente Legale e Fascicoli), <em>Review Agent</em> (Analisi Documentale, OCR e Trascrizioni Audio), <em>Drafting Agent</em> (Redazione Assistita e Add-in Word) e <em>Prompt Builder</em>.
            </p>
          </div>
        </div>

      </section>

      <hr className="border-(--color-border)" />

      {/* SEZIONE 2: Calcolo del Report Mensile e Tempo Risparmiato */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            Tracciamento dell'Efficienza Operativa
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            Il sistema aggrega costantemente le operazioni svolte nell'account calcolando la stima del tempo di studio e redazione risparmiato:
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <span className="text-md font-bold uppercase tracking-widest text-(--color-muted) block mt-0.5">Ricerca Giurisprudenziale</span>
            <h3 className="font-medium text-(--color-text) text-md  tracking-tight" >~10 minuti risparmiati</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Per ogni indagine condotta da <code>research_agent</code> e modulo di ricerca approfondita.
            </p>
          </div>

          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <span className="text-md font-bold uppercase tracking-widest text-(--color-muted) block mt-0.5">Analisi, Reasoning & OCR</span>
            <h3 className="font-medium text-(--color-text) text-md  tracking-tight" >~30 minuti risparmiati</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Per ogni elaborazione di <code>review_agent</code>, catene di <code>reasoning</code> e trascrizioni <code>speech_to_text</code>.
            </p>
          </div>

          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <span className="text-md font-bold uppercase tracking-widest text-(--color-muted) block mt-0.5">Sintesi & Redazione Atti</span>
            <h3 className="font-medium text-(--color-text) text-md  tracking-tight" >~15 minuti risparmiati</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Per ogni bozza, compendio o sintesi generata da <code>drafting_agent</code>.
            </p>
          </div>
        </div>

        {/* Box Rate Limit di Sicurezza */}
        <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-2 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
          <span className="font-bold text-md uppercase tracking-wider text-(--color-text) block mt-1">Soglie di Protezione e Rate Limiting per Servizio:</span>
          <p className="text-md text-(--color-muted) font-light leading-relaxed">
            Tutti i micro-servizi integrati applicano soglie standard di protezione dell'infrastruttura contro chiamate anomale o loop automatizzati:
          </p>
          <div className="flex flex-wrap gap-2.5 pt-1">
            <span className="px-3 py-1.5 bg-(--color-bg) border border-(--color-border) rounded-sm font-mono text-(--color-text) text-md shadow-xs">
              Soglia al Minuto: max 20 richieste / min
            </span>
            <span className="px-3 py-1.5 bg-(--color-bg) border border-(--color-border) rounded-sm font-mono text-(--color-text) text-md shadow-xs">
              Soglia Giornaliera: max 200 richieste / giorno per servizio
            </span>
          </div>
        </div>
      </section>

      <hr className="border-(--color-border)" />

      {/* SEZIONE 3: Limiti di Caricamento File e Contesto Documentale */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            Limiti di Caricamento e Gestione del Contesto Documentale
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            Per garantire la massima precisione ed evitare dispersioni di memoria o allucinazioni nei compendi complessi, l'acquisizione dei file rispetta i seguenti parametri tecnici:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
            <h3 className="text-md font-bold uppercase tracking-wider text-(--color-text) mt-1">Specifiche Tecniche per Documento</h3>
            <ul className="text-md text-(--color-muted) font-light space-y-1.5 leading-relaxed">
              <li>• <strong className="font-semibold text-(--color-text)">Dimensione massima per singolo file:</strong> fino a <strong className="font-semibold text-(--color-text)">30 MB</strong>.</li>
              <li>• <strong className="font-semibold text-(--color-text)">Capacità di contesto per sessione:</strong> fino a circa <strong className="font-semibold text-(--color-text)">800.000 caratteri</strong> o <strong className="font-semibold text-(--color-text)">150 pagine</strong> per file scansionati acquisiti via OCR.</li>
              <li>• <strong className="font-semibold text-(--color-text)">Memoria di lavoro:</strong> include sia i testi degli allegati sia lo storico dei messaggi scambiati nel thread attivo.</li>
            </ul>
          </div>

          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
            <h3 className="text-md font-bold uppercase tracking-wider text-(--color-text) mt-1">Formati Supportati Nativamente</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed mb-2">
              Elaborazione automatica per tutti i formati informatici adoperati negli studi legali:
            </p>
            <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
              <span className="px-2 py-0.5 bg-(--color-bg) border border-(--color-border) rounded-sm text-(--color-text)">.pdf (anche firmati .p7m)</span>
              <span className="px-2 py-0.5 bg-(--color-bg) border border-(--color-border) rounded-sm text-(--color-text)">.docx / .doc</span>
              <span className="px-2 py-0.5 bg-(--color-bg) border border-(--color-border) rounded-sm text-(--color-text)">.txt</span>
              <span className="px-2 py-0.5 bg-(--color-bg) border border-(--color-border) rounded-sm text-(--color-text)">.eml</span>
              <span className="px-2 py-0.5 bg-(--color-bg) border border-(--color-border) rounded-sm text-(--color-text)">.png / .jpg / .jpeg</span>
              <span className="px-2 py-0.5 bg-(--color-bg) border border-(--color-border) rounded-sm text-(--color-text)">.xlsx</span>
              <span className="px-2 py-0.5 bg-(--color-bg) border border-(--color-border) rounded-sm text-(--color-text)">.pptx / .ppt</span>
              <span className="px-2 py-0.5 bg-(--color-bg) border border-(--color-border) rounded-sm text-(--color-text)">.mp3 (audio)</span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-lg border border-(--color-border) bg-(--color-surface) text-md text-(--color-muted) font-light leading-relaxed shadow-xs">
          <strong className="font-bold text-(--color-text)">Best Practice:</strong> Quando una conversazione diventa molto lunga e include svariati allegati corposi, è consigliabile aprire un nuovo thread all'interno dello stesso fascicolo per mantenere la massima reattività e accuratezza analitica dell'AI.
        </div>

        <div className="p-4 rounded-lg border border-(--color-border) bg-(--color-surface) text-md text-(--color-text) flex items-center justify-between flex-wrap gap-2 shadow-xs">
          <span className="font-light">Per esigenze infrastrutturali dedicate, volumi massivi o integrazioni personalizzate:</span>
          <Link to="/contatti" className="font-bold uppercase tracking-wider text-(--color-text) hover:underline underline-offset-2">
            Contatta il Reparto Tecnico (/contatti) →
          </Link>
        </div>
      </section>
    </div>
  );
}