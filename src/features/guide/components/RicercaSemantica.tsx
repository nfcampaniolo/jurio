export default function RicercaSemantica() {
  return (
    <div className="space-y-8">
      {/* Intestazione Sezione */}
      <div>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="text-md font-bold tracking-widest text-(--color-text) uppercase bg-(--color-surface) border border-(--color-border) px-2.5 py-1 rounded-sm shadow-xs">
            1. Casi d'uso
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-(--color-text) bg-(--color-surface) border border-(--color-border) px-2.5 py-0.5 rounded-sm shadow-xs">
            Piano Essential / Business / Prova Gratuita
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-medium text-(--color-text) tracking-tight mt-1 mb-2.5" >
          Ricerca Semantica
        </h1>
        <p className="text-md  text-(--color-muted) font-light leading-relaxed">
          L'interfaccia della ricerca semantica è progettata per consentire l'interrogazione dell'archivio giurisprudenziale tramite linguaggio naturale, andando oltre la semplice ricerca per parole chiave.
        </p>
      </div>

      <hr className="border-(--color-border)" />

      {/* SEZIONE 1: Come funziona l'inserimento query */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            Funzionamento e Inserimento del Quesito
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            Al centro della schermata si trova la barra di inserimento principale, dove è possibile digitare il quesito giuridico o la descrizione del caso. Il motore semantico indicizza e confronta i concetti chiave estraendoli dalle componenti a maggior densità informativa delle pronunce: <strong className="font-semibold text-(--color-text)">massime, descrizione della fattispecie, precedenti citati e riferimenti normativi</strong>.
          </p>
        </div>

        <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) text-md text-(--color-muted) font-light leading-relaxed shadow-xs overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
          <span className="font-bold uppercase tracking-widest text-(--color-text) block mb-1 text-[10px]">Suggerimento per la formulazione:</span>
          Per ottenere risultati più mirati e pertinenti, formula l'input descrivendo con precisione gli elementi di fatto e di diritto rilevanti, evitando parole chiave isolate o query eccessivamente generiche.
        </div>

        <p className="text-md  text-(--color-muted) font-light leading-relaxed">
          <strong className="font-semibold text-(--color-text)">Comando vocale:</strong> In alternativa alla digitazione da tastiera, è disponibile il pulsante per il comando vocale. Attivando il microfono, il testo dettato viene trascritto e inserito automaticamente nel campo di ricerca.
        </p>

        {/* --- PLACEHOLDER IMMAGINE 1 (Barra di Ricerca e Filtri) --- */}
        <div className="my-4">
          <div className="flex justify-center">
            <img
              src="https://jurio.it/guida-image/ricerca.webp"
              alt="Schermata di autenticazione con opzione Single Sign-On e recupero credenziali"
              loading="lazy"
            />
          </div>
          <p className="text-md text-(--color-muted) font-light mt-2 text-center italic">
            Figura 1: Interfaccia di inserimento query con opzioni di raffinamento avanzato.
          </p>
        </div>

        {/* Raffinamento e Filtri */}
        <div className="space-y-3 pt-1">
          <h3 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight" >Livelli di Raffinamento</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
              <h4 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Filtra per argomento</h4>
              <p className="text-md text-(--color-muted) font-light leading-relaxed">
                Consente di restringere il perimetro tematico selezionando una specifica area del diritto e la relativa sottocategoria.
              </p>
            </div>

            <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
              <h4 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Filtri avanzati di ricerca</h4>
              <ul className="text-md text-(--color-muted) font-light space-y-1.5 mt-2 leading-relaxed">
                <li>• <strong className="font-semibold text-(--color-text)">Corte:</strong> es. Tutte le corti, Corte Suprema di Cassazione.</li>
                <li>• <strong className="font-semibold text-(--color-text)">Tipo massima:</strong> repertorio completo o tipologie specifiche.</li>
                <li>• <strong className="font-semibold text-(--color-text)">Tipo documento:</strong> sentenze, ordinanze, ecc.</li>
                <li>• <strong className="font-semibold text-(--color-text)">Ordinamento:</strong> rilevanza semantica (default) o data.</li>
                <li>• <strong className="font-semibold text-(--color-text)">Numero risultati:</strong> configurabile per pagina (default: 15).</li>
                <li>• <strong className="font-semibold text-(--color-text)">Intervallo temporale (Dal / Al):</strong> delimitazione per date di deposito.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <hr className="border-(--color-border)" />

      {/* SEZIONE 2: Consultazione Risultati e Scheda */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            Consultazione e Struttura dei Risultati
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            All'avvio della ricerca, il sistema adatta automaticamente la logica di recupero: applica un matching mirato sui riferimenti normativi se citati nell'input (articoli di legge, codici), oppure esegue un'analisi semantica e tipologica del contesto fattuale.
          </p>
        </div>

        {/* Struttura Scheda */}
        <div className="relative p-5 sm:p-6 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-3">
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
          <h3 className="text-md font-bold uppercase tracking-wider text-(--color-text) mt-1">Anatomia della Scheda Risultato</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-md text-(--color-muted) font-light">
            <div className="p-3 bg-(--color-bg) border border-(--color-border) rounded-md shadow-xs">
              <span className="font-bold uppercase tracking-wider text-(--color-text) block mb-1 text-[10px]">Intestazione e Atto</span>
              Natura del provvedimento (SENTENZA / ORDINANZA), organo giudicante e sezione competente.
            </div>
            <div className="p-3 bg-(--color-bg) border border-(--color-border) rounded-md shadow-xs">
              <span className="font-bold uppercase tracking-wider text-(--color-text) block mb-1 text-[10px]">Identificatori Ufficiali</span>
              Numero/anno (es. n. 16906/2023), codice ECLI, codice URN NIR e link diretto alla fonte ufficiale (Italgiure).
            </div>
            <div className="p-3 bg-(--color-bg) border border-(--color-border) rounded-md shadow-xs">
              <span className="font-bold uppercase tracking-wider text-(--color-text) block mb-1 text-[10px]">Corpo della Massima</span>
              Principio di diritto o massima ufficiale che sintetizza la decisione e la regola applicata.
            </div>
            <div className="p-3 bg-(--color-bg) border border-(--color-border) rounded-md shadow-xs">
              <span className="font-bold uppercase tracking-wider text-(--color-text) block mb-1 text-[10px]">Strumenti di Sintesi</span>
              Pulsante interattivo "Mostra sintesi pertinente" per evidenziare i passaggi motivazionali affini al quesito.
            </div>
          </div>
        </div>

        {/* --- PLACEHOLDER IMMAGINE 2 (Scheda Risultato) --- */}
        <div className="my-4">
          <div className="flex justify-center">
            <img
              src="https://jurio.it/guida-image/risultati.webp"
              alt="Schermata di autenticazione con opzione Single Sign-On e recupero credenziali"
              loading="lazy"
            />
          </div>
          <p className="text-md text-(--color-muted) font-light mt-2 text-center italic">
            Figura 2: Visualizzazione delle schede ordinate per rilevanza e indicatori di provenienza.
          </p>
        </div>
        {/* Disclaimer Legale Box */}
        <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) text-md text-(--color-muted) font-light leading-relaxed shadow-xs overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
          <span className="font-bold uppercase tracking-widest text-(--color-text) block mb-1 text-[10px]">Disclaimer Legale e Note di Utilizzo:</span>
          Le informazioni, le massime e le sintesi fornite costituiscono un supporto alla ricerca giuridica e all'analisi documentale. I contenuti non sostituiscono l'interpretazione autentica degli atti ufficiali, la consulenza legale professionale o il parere di un avvocato iscritto all'albo. Si raccomanda di verificare sempre il testo integrale dei provvedimenti attraverso i canali istituzionali prima dell'utilizzo in sede giudiziale o stragiudiziale.
        </div>
      </section>

      <hr className="border-(--color-border)" />

      {/* SEZIONE 3: Visualizzazione del Documento Giuridico */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            Visualizzazione del Documento Giuridico
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            Selezionando una scheda dall'elenco, si accede al dettaglio del provvedimento giurisprudenziale, organizzato per consentire una rapida disamina del quadro fattuale e motivazionale.
          </p>
        </div>

        {/* Griglia Dettaglio e Azioni */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2.5">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
            <h3 className="text-md font-bold uppercase tracking-wider text-(--color-text) mt-1">Struttura e Analisi Contenuto</h3>
            <ul className="text-md text-(--color-muted) font-light space-y-1.5 leading-relaxed">
              <li>• <strong className="font-semibold text-(--color-text)">Metadati Istituzionali:</strong> Autorità, Sezione, Estremi di Deposito (es. n. 6636/2023) ed ECLI.</li>
              <li>• <strong className="font-semibold text-(--color-text)">Fattispecie:</strong> Inquadramento della materia e sintesi delle vicende processuali di merito.</li>
              <li>• <strong className="font-semibold text-(--color-text)">Questione di diritto:</strong> Quesito giuridico centrale esaminato dalla Corte.</li>
              <li>• <strong className="font-semibold text-(--color-text)">Massima e Orientamento:</strong> Principio di diritto e orientamento (Conforme/Difforme).</li>
              <li>• <strong className="font-semibold text-(--color-text)">Ratio decidendi:</strong> Ragionamento logico-giuridico a fondamento della decisione.</li>
              <li>• <strong className="font-semibold text-(--color-text)">Riferimenti Normativi & Precedenti:</strong> Articoli applicati e sentenze richiamate con link diretto alla banca dati ufficiale.</li>
            </ul>
          </div>

          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2.5">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
            <h3 className="text-md font-bold uppercase tracking-wider text-(--color-text) mt-1">Strumenti Operativi e Azioni</h3>
            <ul className="text-md text-(--color-muted) font-light space-y-1.5 leading-relaxed">
              <li>• <strong className="font-semibold text-(--color-text)">Pannello Azioni:</strong> Scarica PDF originale, Condividi link o Salva nel proprio archivio personale.</li>
              <li>• <strong className="font-semibold text-(--color-text)">Anteprima Documento:</strong> Visualizzatore integrato per sfogliare il testo integrale con comando Apri per file nativo.</li>
              <li>• <strong className="font-semibold text-(--color-text)">Documenti Correlati:</strong> Selezione automatica di ulteriori pronunce affini.</li>
            </ul>
          </div>
        </div>

        {/* Upload Documenti Esterni */}
        <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
          <h3 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Caricamento e Analisi Documenti Esterni</h3>
          <p className="text-md text-(--color-muted) font-light leading-relaxed">
            Se il provvedimento non è presente nei repertori indicizzati, la sezione <em>"Non trovi il provvedimento? Caricalo"</em> consente l'upload di sentenze o atti esterni nel proprio cloud privato. Jurio estrarrà automaticamente ratio decidendi, massima e passaggi rilevanti.
          </p>
        </div>

        {/* --- PLACEHOLDER IMMAGINE 3 (Dettaglio Provvedimento) --- */}
        <div className="my-4">
          <div className="flex justify-center">
            <img
              src="https://jurio.it/guida-image/massima.webp"
              alt="Schermata di autenticazione con opzione Single Sign-On e recupero credenziali"
              loading="lazy"
            />
          </div>
          <p className="text-md text-(--color-muted) font-light mt-2 text-center italic">
            Figura 3: Scheda di disamina del provvedimento e pannello strumenti operativi.
          </p>
        </div>
      </section>
    </div>
  );
}