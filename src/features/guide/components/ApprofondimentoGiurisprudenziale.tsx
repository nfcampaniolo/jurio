export default function ApprofondimentoGiurisprudenziale() {
  return (
    <div className="space-y-8">
      {/* Intestazione Sezione */}
      <div>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="text-md font-bold tracking-widest text-(--color-text) uppercase bg-(--color-surface) border border-(--color-border) px-2.5 py-1 rounded-sm shadow-xs">
            1. Casi d'uso
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-(--color-text) bg-(--color-surface) border border-(--color-border) px-2.5 py-0.5 rounded-sm shadow-xs">
            Piano Business / Essential / Piano prova
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-medium text-(--color-text) tracking-tight mt-1 mb-2.5">
          Approfondimento Giurisprudenziale
        </h1>
        <p className="text-md text-(--color-muted) font-light leading-relaxed">
          Il modulo di Approfondimento Giurisprudenziale è progettato per supportare avvocati e professionisti legali nell'analisi complessa di questioni giuridiche controverse, generando una Mappa Dialettica strutturata per tesi contrapposte.
        </p>
      </div>

      <hr className="border-(--color-border)" />

      {/* SEZIONE 1: Configurazione e Avvio Indagine */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5">
            Configurazione e Avvio dell'Indagine
          </h2>
          <p className="text-md text-(--color-muted) font-light leading-relaxed">
            Inserendo il quesito o la fattispecie controversa, il sistema coordina in tempo reale la ricerca semantica sul database interno delle Corti Supreme, l'esplorazione web istituzionale e l'analisi vettoriale dei documenti allegati al fascicolo.
          </p>
        </div>

        <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) text-md text-(--color-muted) font-light leading-relaxed shadow-xs overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
          <span className="font-bold uppercase tracking-widest text-(--color-text) block mb-1 text-[10px]">Parametri di Configurazione:</span>
          Prima dell'avvio è possibile calibrare il livello di confidenza, attivare o escludere le fonti web e definire i limiti di recupero dei precedenti per orientare l'ampiezza dell'indagine.
        </div>

        {/* Raffinamento e Parametri */}
        <div className="space-y-3 pt-1">
          <h3 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight">Componenti del Flusso</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
              <h4 className="font-medium text-(--color-text) text-md tracking-tight mt-0.5">Inquadramento Giuridico Preliminare</h4>
              <p className="text-md text-(--color-muted) font-light leading-relaxed">
                Estrazione automatica della qualificazione giuridica della fattispecie e mappatura puntuale delle disposizioni normative e degli articoli di legge applicabili.
              </p>
            </div>

            <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
              <h4 className="font-medium text-(--color-text) text-md tracking-tight mt-0.5">Integrazione Documentale del Fascicolo</h4>
              <p className="text-md text-(--color-muted) font-light leading-relaxed">
                Analisi contestuale dei PDF e degli atti caricati nel workspace dell'utente, incrociando i dati fattuali del fascicolo con i precedenti giurisprudenziali tramite ricerca vettoriale.
              </p>
            </div>
          </div>
        </div>

        {/* --- PLACEHOLDER IMMAGINE 1 (Configurazione / Avvio) --- */}
        <div className="my-4">
          <div className="flex justify-center">
            <img
              src="https://jurio.it/guida-image/analisi_1.webp"
              alt="Schermata di configurazione e avvio dell'approfondimento giurisprudenziale"
              loading="lazy"
            />
          </div>
          <p className="text-md text-(--color-muted) font-light mt-2 text-center italic">
            Figura 1: Interfaccia di configurazione dei parametri e immissione della fattispecie.
          </p>
        </div>
      </section>

      <hr className="border-(--color-border)" />

      {/* SEZIONE 2: Mappa Dialettica e Tesi Contrapposte */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5">
            Mappa Dialettica e Tesi Contrapposte
          </h2>
          <p className="text-md text-(--color-muted) font-light leading-relaxed">
            Il cuore dell'analisi si sviluppa attraverso una struttura a doppia tesi che mappa in modo speculare gli orientamenti pro e contro la tesi difensiva.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2.5">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-emerald-500 opacity-90 z-20" />
            <h3 className="text-md font-bold uppercase tracking-wider text-(--color-text) mt-1">Orientamento Favorevole</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Analisi dettagliata delle argomentazioni pro-tesi, supportate da massime, precedenti conformi e richiami normativi cogenti finalizzati a tutelare la posizione del candidato o della parte assistita.
            </p>
          </div>

          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2.5">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-amber-500 opacity-90 z-20" />
            <h3 className="text-md font-bold uppercase tracking-wider text-(--color-text) mt-1">Orientamento Contrario</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Mappatura dei rischi, degli orientamenti difformi e delle eccezioni giurisprudenziali avverse, indispensabili per una valutazione strategica preventiva e la gestione di eventuali criticità.
            </p>
          </div>
        </div>

        {/* --- PLACEHOLDER IMMAGINE 2 (Mappa Dialettica) --- */}
        <div className="my-4">
          <div className="flex justify-center">
            <img
              src="https://jurio.it/guida-image/analisi_2.webp"
              alt="Visualizzazione della Mappa Dialettica con tesi favorevoli e contrarie"
              loading="lazy"
            />
          </div>
          <p className="text-md text-(--color-muted) font-light mt-2 text-center italic">
            Figura 2: Struttura della Mappa Dialettica e validazione interattiva delle fonti collegate.
          </p>
        </div>
      </section>

      <hr className="border-(--color-border)" />

      {/* SEZIONE 3: Sintesi Strategica e Operativa */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5">
            Sintesi Strategica e Esportazione Report
          </h2>
          <p className="text-md text-(--color-muted) font-light leading-relaxed">
            Al termine dell'elaborazione, il sistema compendia i risultati in una sintesi strategica pronta per l'utilizzo operativo e la redazione degli atti.
          </p>
        </div>

        <div className="relative p-5 sm:p-6 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-3">
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
          <h3 className="text-md font-bold uppercase tracking-wider text-(--color-text) mt-1">Strumenti e Output del Modulo</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-md text-(--color-muted) font-light">
            <div className="p-3 bg-(--color-bg) border border-(--color-border) rounded-md shadow-xs">
              <span className="font-bold uppercase tracking-wider text-(--color-text) block mb-1 text-[10px]">Executive Summary</span>
              Panoramica ad alto valore aggiunto per l'impostazione immediata della linea difensiva o consulenziale.
            </div>
            <div className="p-3 bg-(--color-bg) border border-(--color-border) rounded-md shadow-xs">
              <span className="font-bold uppercase tracking-wider text-(--color-text) block mb-1 text-[10px]">Argomentazioni e Rischi</span>
              Elenco strutturato dei punti di forza, delle eccezioni avverse e delle conclusioni operative.
            </div>
            <div className="p-3 bg-(--color-bg) border border-(--color-border) rounded-md shadow-xs">
              <span className="font-bold uppercase tracking-wider text-(--color-text) block mb-1 text-[10px]">Copia Rapida Appunti</span>
              Formattazione pulita del report strategico priva di metadati tecnici grezzi, pronta per bozze di atti o email.
            </div>
            <div className="p-3 bg-(--color-bg) border border-(--color-border) rounded-md shadow-xs">
              <span className="font-bold uppercase tracking-wider text-(--color-text) block mb-1 text-[10px]">Esportazione in PDF</span>
              Layout grafico dedicato ottimizzato per la generazione di pareri formali da allegare al fascicolo di studio.
            </div>
          </div>
        </div>

        {/* --- PLACEHOLDER IMMAGINE 3 (Report e Sintesi) --- */}
        <div className="my-4">
          <div className="flex justify-center">
            <img
              src="https://jurio.it/guida-image/analisi_3.webp"
              alt="Visualizzazione del report di sintesi strategica e opzioni di esportazione"
              loading="lazy"
            />
          </div>
          <p className="text-md text-(--color-muted) font-light mt-2 text-center italic">
            Figura 3: Sezione di sintesi strategica con strumenti di esportazione PDF e copia rapida.
          </p>
        </div>
      </section>
    </div>
  );
}