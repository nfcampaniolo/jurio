export default function ConsulenteLegale() {
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
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-medium text-(--color-text) tracking-tight mt-1 mb-2.5" >
          Consulente Legale
        </h1>
        <p className="text-md  text-(--color-muted) font-light leading-relaxed">
          La sezione <strong className="font-semibold text-(--color-text)">Consulente Legale</strong> costituisce l'ambiente di lavoro interattivo della piattaforma, progettato per supportare l'analisi giuridica, lo studio delle questioni controverse e l'esame documentale tramite intelligenza artificiale. L'accesso completo è incluso nel piano Business ed è fruibile senza limitazioni durante l'intero periodo di prova gratuita.
        </p>
      </div>

      <hr className="border-(--color-border)" />

      {/* SEZIONE: Le 3 Modalità Operative */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            Modalità Operative
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            Dalla schermata principale del modulo è possibile scegliere la modalità operativa più adatta alle proprie esigenze tra tre opzioni:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
            <div className="w-7 h-7 rounded-sm border border-(--color-border) bg-(--color-bg) text-(--color-text) flex items-center justify-center font-bold text-md mt-1 shadow-xs">
              1
            </div>
            <h3 className="text-sm sm:text-base font-medium text-(--color-text) tracking-tight" >Chat Temporanea</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Per avviare una sessione rapida di ricerca ed elaborazione giurisprudenziale senza salvare dati o cronologia nel cloud.
            </p>
          </div>

          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
            <div className="w-7 h-7 rounded-sm border border-(--color-border) bg-(--color-bg) text-(--color-text) flex items-center justify-center font-bold text-md mt-1 shadow-xs">
              2
            </div>
            <h3 className="text-sm sm:text-base font-medium text-(--color-text) tracking-tight" >Nuovo Fascicolo</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Per strutturare una pratica continuativa, organizzare atti specifici e mantenere una memoria di contesto persistente.
            </p>
          </div>

          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
            <div className="w-7 h-7 rounded-sm border border-(--color-border) bg-(--color-bg) text-(--color-text) flex items-center justify-center font-bold text-md mt-1 shadow-xs">
              3
            </div>
            <h3 className="text-sm sm:text-base font-medium text-(--color-text) tracking-tight" >Sfoglia Archivio</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Per consultare, riprendere o gestire le pratiche e le sessioni di analisi già aperte in precedenza.
            </p>
          </div>
        </div>

        {/* --- PLACEHOLDER IMMAGINE 1 (Dashboard Consulente Legale) --- */}
        <div className="my-4">
          <div className="flex justify-center">
            <img
              src="https://jurio.it/guida-image/consulente.webp"
              alt="Schermata di autenticazione con opzione Single Sign-On e recupero credenziali"
              loading="lazy"
            />
          </div>
          <p className="text-md text-(--color-muted) font-light mt-2 text-center italic">
            Figura 1: Hub principale del modulo Consulente Legale con scelta della modalità di lavoro.
          </p>
        </div>
      </section>

      <hr className="border-(--color-border)" />

      {/* SEZIONE: Chat Temporanea e Flusso Conversazionale */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            La Chat Temporanea e il Flusso Conversazionale
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            Avviando una sessione di chat temporanea si accede a un'interfaccia conversazionale immediata. Il campo di input accetta istruzioni in linguaggio naturale — digitabili da tastiera oppure dettabili tramite il pulsante per il comando vocale — e consente di porre quesiti giuridici o richiedere pareri preliminari.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <h3 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Motore Giurisprudenziale e Filtri</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Il motore interroga le pronunce indicizzate nei repertori pubblici oppure i file specificamente allegati. Tramite il pulsante dei <strong className="font-semibold text-(--color-text)">Filtri di Ricerca Avanzati</strong> è sempre possibile parametrizzare organo giudicante, tipo massima, tipologia di atto e intervallo temporale.
            </p>
          </div>

          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <h3 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Documenti di Sessione (fino a 10)</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Nel pannello laterale è possibile caricare e gestire fino a 10 allegati (da dispositivo o archivio personale). Una volta elaborato, il file può essere richiamato nella chat per confronti di merito, estrazioni di clausole o sintesi.
            </p>
          </div>
        </div>

        {/* Box Fonti Citate */}
        <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) text-md text-(--color-muted) font-light leading-relaxed shadow-xs overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
          <span className="font-bold uppercase tracking-widest text-(--color-text) block mb-1 text-[10px]">Pannello delle Fonti Citate e Zero Allucinazioni:</span>
          A destra della conversazione compare il pannello delle Fonti Citate: cliccando su ciascun riferimento citato nella risposta, si apre la scheda di dettaglio del provvedimento o dell'atto di provenienza. Questo ancoraggio continuo alle fonti garantisce la totale verificabilità di ogni affermazione e azzera il rischio di allucinazioni del modello.
        </div>

        {/* --- PLACEHOLDER IMMAGINE 2 (Interfaccia Chat e Pannello Fonti) --- */}
         <div className="my-4">
          <div className="flex justify-center">
            <img
              src="https://jurio.it/guida-image/chat.webp"
              alt="Schermata di autenticazione con opzione Single Sign-On e recupero credenziali"
              loading="lazy"
            />
          </div>
          <p className="text-md text-(--color-muted) font-light mt-2 text-center italic">
            Figura 2: Sessione conversazionale con ancoraggio puntuale alle fonti e agli allegati.
          </p>
        </div>
      </section>

      <hr className="border-(--color-border)" />

      {/* SEZIONE: Creazione e Gestione Fascicoli */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            Creazione e Gestione dei Fascicoli
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            Per esigenze di studio continuative o pratiche articolate, la piattaforma introduce il concetto di <strong className="font-semibold text-(--color-text)">Fascicolo</strong>. A differenza della chat temporanea, il fascicolo consente di strutturare l'attività difensiva o di consulenza mantenendo memoria persistente di tutti gli atti e dei punti di diritto affrontati.
          </p>
        </div>

        <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2.5">
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
          <h3 className="text-md font-bold uppercase tracking-wider text-(--color-text) mt-1">Configurazione e Creazione della Pratica</h3>
          <p className="text-md text-(--color-muted) font-light leading-relaxed">
            Un fascicolo può essere generato da zero tramite il comando <em>Nuovo Fascicolo</em> oppure convertito direttamente a partire da una chat temporanea già svolta:
          </p>
          <ul className="text-md text-(--color-muted) font-light space-y-1.5">
            <li>• <strong className="font-semibold text-(--color-text)">Nome del Fascicolo:</strong> la denominazione o identificativo della pratica (es. <em>Pratica Rossi vs Bianchi</em>).</li>
            <li>• <strong className="font-semibold text-(--color-text)">Documenti Collegati:</strong> selezione degli atti di parte, perizie o sentenze da associare come base documentale stabile.</li>
          </ul>
          <p className="text-md text-(--color-muted) font-light leading-relaxed pt-1">
            All'interno di ciascun fascicolo le informazioni generali restano visibili in alto a destra. È possibile aprire e organizzare molteplici thread di conversazione distinti, con la garanzia che l'assistente manterrà sempre come contesto l'intero patrimonio informativo della pratica.
          </p>
        </div>
      </section>

      <hr className="border-(--color-border)" />

      {/* SEZIONE: Archivio e Collaborazione Team */}
      <section className="space-y-4">
        <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
          Archivio e Collaborazione nel Gruppo di Lavoro
        </h2>
        <p className="text-md  text-(--color-muted) font-light leading-relaxed">
          L'<strong className="font-semibold text-(--color-text)">Archivio Fascicoli e Storico Chat</strong> raccoglie tutte le attività pregresse e le pratiche condivise. Da questo pannello è possibile rinominare, organizzare o eliminare le proprie conversazioni e i fascicoli personali.
        </p>

        <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
          <h3 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Permessi e Condivisione nel Team</h3>
          <p className="text-md text-(--color-muted) font-light leading-relaxed">
            In caso di appartenenza a un team, l'archivio consente di visualizzare i fascicoli creati dagli altri membri. Per garantire la riservatezza e l'integrità dei flussi, le conversazioni e i documenti rimangono modificabili esclusivamente dal proprietario: i colleghi del team possono consultare le analisi svolte, ma non intervenire o scrivere nei thread altrui.
          </p>
        </div>
      </section>
    </div>
  );
}