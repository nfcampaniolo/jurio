import { Link } from 'react-router-dom';

export default function AggiornamentoForzato() {
  return (
    <div className="space-y-8">
      {/* Intestazione Sezione */}
      <div>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="text-md font-bold tracking-widest text-(--color-text) uppercase bg-(--color-surface) border border-(--color-border) px-2.5 py-1 rounded-sm shadow-xs">
            4. Supporto
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-(--color-text) bg-(--color-surface) border border-(--color-border) px-2.5 py-0.5 rounded-sm shadow-xs">
            Risoluzione Problemi & Cache
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-medium text-(--color-text) tracking-tight mt-1 mb-2.5" >
          Come Eseguire un Aggiornamento Forzato
        </h1>
        <p className="text-md  text-(--color-muted) font-light leading-relaxed">
          Durante la navigazione, il browser memorizza temporaneamente file e risorse all'interno della cache per velocizzare il caricamento. In caso di rilascio di nuove funzionalità o aggiornamenti della piattaforma, la presenza di dati obsoleti potrebbe causare anomalie visive o disallineamenti dell'interfaccia.
        </p>
      </div>

      <hr className="border-(--color-border)" />

      {/* SEZIONE 1: Cos'è l'aggiornamento forzato */}
      <section className="space-y-4">
        <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1" >
          Perché eseguire un Hard Refresh
        </h2>
        <p className="text-md  text-(--color-muted) font-light leading-relaxed">
          L'<strong className="font-semibold text-(--color-text)">aggiornamento forzato (hard refresh)</strong> consente di bypassare i file salvati localmente, costringendo il browser a riscaricare dal server l'ultima versione del codice sorgente, delle immagini e dei fogli di stile.
        </p>
      </section>

      <hr className="border-(--color-border)" />

      {/* SEZIONE 2: Scorciatoie da Tastiera per Browser */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            Scorciatoie da Tastiera per i Principali Browser
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            Identifica il tuo browser e sistema operativo per applicare la combinazione corretta di tasti:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card Google Chrome */}
          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2.5">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
            <div className="flex items-center justify-between mt-1">
              <h3 className="text-sm sm:text-base font-medium text-(--color-text) tracking-tight" >Google Chrome</h3>
              <span className="text-md font-bold text-(--color-text) uppercase tracking-widest bg-(--color-bg) border border-(--color-border) px-2 py-0.5 rounded-sm shadow-xs">Chrome</span>
            </div>
            
            <div className="space-y-2 text-md text-(--color-muted) font-light">
              <div>
                <span className="font-bold uppercase tracking-wider text-(--color-text) block mb-1 text-[10px]">Windows / Linux:</span>
                <p className="mb-1 leading-relaxed">
                  Premi <kbd className="px-1.5 py-0.5 bg-(--color-bg) border border-(--color-border) rounded-sm font-mono text-(--color-text) shadow-xs">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-(--color-bg) border border-(--color-border) rounded-sm font-mono text-(--color-text) shadow-xs">F5</kbd> oppure <kbd className="px-1.5 py-0.5 bg-(--color-bg) border border-(--color-border) rounded-sm font-mono text-(--color-text) shadow-xs">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-(--color-bg) border border-(--color-border) rounded-sm font-mono text-(--color-text) shadow-xs">Shift</kbd> + <kbd className="px-1.5 py-0.5 bg-(--color-bg) border border-(--color-border) rounded-sm font-mono text-(--color-text) shadow-xs">R</kbd>.
                </p>
                <p className="italic">Oppure tieni premuto Ctrl e clicca sul pulsante Ricarica ⟳.</p>
                <p className="mt-1">
                  <em>Opzione DevTools:</em> premi <kbd className="px-1.5 py-0.5 bg-(--color-bg) border border-(--color-border) rounded-sm font-mono text-(--color-text) shadow-xs">F12</kbd>, fai clic destro su Ricarica ⟳ e scegli <em>"Svuota la cache e ricarica forzatamente"</em>.
                </p>
              </div>

              <div className="pt-2 border-t border-(--color-border)">
                <span className="font-bold uppercase tracking-wider text-(--color-text) block mb-1 text-[10px]">macOS:</span>
                <p className="mb-1 leading-relaxed">
                  Premi <kbd className="px-1.5 py-0.5 bg-(--color-bg) border border-(--color-border) rounded-sm font-mono text-(--color-text) shadow-xs">⌘ Cmd</kbd> + <kbd className="px-1.5 py-0.5 bg-(--color-bg) border border-(--color-border) rounded-sm font-mono text-(--color-text) shadow-xs">Shift</kbd> + <kbd className="px-1.5 py-0.5 bg-(--color-bg) border border-(--color-border) rounded-sm font-mono text-(--color-text) shadow-xs">R</kbd>.
                </p>
                <p className="italic">Oppure tieni premuto Shift e clicca sul pulsante Ricarica ⟳.</p>
              </div>
            </div>
          </div>

          {/* Card Mozilla Firefox */}
          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2.5">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
            <div className="flex items-center justify-between mt-1">
              <h3 className="text-sm sm:text-base font-medium text-(--color-text) tracking-tight" >Mozilla Firefox</h3>
              <span className="text-md font-bold text-(--color-text) uppercase tracking-widest bg-(--color-bg) border border-(--color-border) px-2 py-0.5 rounded-sm shadow-xs">Firefox</span>
            </div>
            
            <div className="space-y-2 text-md text-(--color-muted) font-light">
              <div>
                <span className="font-bold uppercase tracking-wider text-(--color-text) block mb-1 text-[10px]">Windows / Linux:</span>
                <p className="leading-relaxed">
                  Premi <kbd className="px-1.5 py-0.5 bg-(--color-bg) border border-(--color-border) rounded-sm font-mono text-(--color-text) shadow-xs">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-(--color-bg) border border-(--color-border) rounded-sm font-mono text-(--color-text) shadow-xs">F5</kbd> oppure <kbd className="px-1.5 py-0.5 bg-(--color-bg) border border-(--color-border) rounded-sm font-mono text-(--color-text) shadow-xs">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-(--color-bg) border border-(--color-border) rounded-sm font-mono text-(--color-text) shadow-xs">Shift</kbd> + <kbd className="px-1.5 py-0.5 bg-(--color-bg) border border-(--color-border) rounded-sm font-mono text-(--color-text) shadow-xs">R</kbd>.
                </p>
              </div>

              <div className="pt-2 border-t border-(--color-border)">
                <span className="font-bold uppercase tracking-wider text-(--color-text) block mb-1 text-[10px]">macOS:</span>
                <p className="mb-1 leading-relaxed">
                  Premi <kbd className="px-1.5 py-0.5 bg-(--color-bg) border border-(--color-border) rounded-sm font-mono text-(--color-text) shadow-xs">⌘ Cmd</kbd> + <kbd className="px-1.5 py-0.5 bg-(--color-bg) border border-(--color-border) rounded-sm font-mono text-(--color-text) shadow-xs">Shift</kbd> + <kbd className="px-1.5 py-0.5 bg-(--color-bg) border border-(--color-border) rounded-sm font-mono text-(--color-text) shadow-xs">R</kbd>.
                </p>
                <p className="italic">Oppure tieni premuto Shift e clicca sul pulsante Ricarica ⟳.</p>
              </div>
            </div>
          </div>

          {/* Card Microsoft Edge */}
          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2.5">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
            <div className="flex items-center justify-between mt-1">
              <h3 className="text-sm sm:text-base font-medium text-(--color-text) tracking-tight" >Microsoft Edge</h3>
              <span className="text-md font-bold text-(--color-text) uppercase tracking-widest bg-(--color-bg) border border-(--color-border) px-2 py-0.5 rounded-sm shadow-xs">Edge</span>
            </div>
            
            <div className="space-y-2 text-md text-(--color-muted) font-light">
              <div>
                <span className="font-bold uppercase tracking-wider text-(--color-text) block mb-1 text-[10px]">Windows / Linux:</span>
                <p className="mb-1 leading-relaxed">
                  Premi <kbd className="px-1.5 py-0.5 bg-(--color-bg) border border-(--color-border) rounded-sm font-mono text-(--color-text) shadow-xs">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-(--color-bg) border border-(--color-border) rounded-sm font-mono text-(--color-text) shadow-xs">F5</kbd>.
                </p>
                <p className="italic">Oppure tieni premuto Ctrl e fai clic sul pulsante Ricarica ⟳.</p>
              </div>

              <div className="pt-2 border-t border-(--color-border)">
                <span className="font-bold uppercase tracking-wider text-(--color-text) block mb-1 text-[10px]">macOS:</span>
                <p className="leading-relaxed">
                  Premi <kbd className="px-1.5 py-0.5 bg-(--color-bg) border border-(--color-border) rounded-sm font-mono text-(--color-text) shadow-xs">⌘ Cmd</kbd> + <kbd className="px-1.5 py-0.5 bg-(--color-bg) border border-(--color-border) rounded-sm font-mono text-(--color-text) shadow-xs">Shift</kbd> + <kbd className="px-1.5 py-0.5 bg-(--color-bg) border border-(--color-border) rounded-sm font-mono text-(--color-text) shadow-xs">R</kbd>.
                </p>
              </div>
            </div>
          </div>

          {/* Card Apple Safari */}
          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2.5">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
            <div className="flex items-center justify-between mt-1">
              <h3 className="text-sm sm:text-base font-medium text-(--color-text) tracking-tight" >Apple Safari</h3>
              <span className="text-md font-bold text-(--color-text) uppercase tracking-widest bg-(--color-bg) border border-(--color-border) px-2 py-0.5 rounded-sm shadow-xs">Safari</span>
            </div>
            
            <div className="space-y-2 text-md text-(--color-muted) font-light">
              <div>
                <span className="font-bold uppercase tracking-wider text-(--color-text) block mb-1 text-[10px]">macOS:</span>
                <p className="mb-1 leading-relaxed">
                  Svuota la cache con <kbd className="px-1.5 py-0.5 bg-(--color-bg) border border-(--color-border) rounded-sm font-mono text-(--color-text) shadow-xs">⌘ Cmd</kbd> + <kbd className="px-1.5 py-0.5 bg-(--color-bg) border border-(--color-border) rounded-sm font-mono text-(--color-text) shadow-xs">⌥ Option</kbd> + <kbd className="px-1.5 py-0.5 bg-(--color-bg) border border-(--color-border) rounded-sm font-mono text-(--color-text) shadow-xs">E</kbd>, poi premi <kbd className="px-1.5 py-0.5 bg-(--color-bg) border border-(--color-border) rounded-sm font-mono text-(--color-text) shadow-xs">⌘ Cmd</kbd> + <kbd className="px-1.5 py-0.5 bg-(--color-bg) border border-(--color-border) rounded-sm font-mono text-(--color-text) shadow-xs">R</kbd>.
                </p>
                <p className="italic">In alternativa, tieni premuto Shift e fai clic sul pulsante Ricarica ⟳.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <hr className="border-(--color-border)" />

      {/* SEZIONE 3: Troubleshooting e Navigazione in Incognito */}
      <section className="space-y-4">
        <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-2 overflow-hidden text-md text-(--color-muted) font-light leading-relaxed">
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
          <span className="font-bold text-md uppercase tracking-wider text-(--color-text) block mt-1">Il problema persiste?</span>
          <p>
            Qualora anomalie di rendering o problemi di accesso dovessero persistere anche dopo l'aggiornamento forzato, ti consigliamo di effettuare un test aprendo una <strong className="font-semibold text-(--color-text)">finestra in modalità di navigazione in incognito / anonima</strong>.
          </p>
          <p>
            Se l'errore non si ripresenta in incognito, significa che estensioni terze del browser (come ad-blocker o gestori cookie) stanno bloccando alcune chiamate dell'applicazione. In caso contrario, puoi <Link to="/guida/supporto/assistenza" className="font-bold underline underline-offset-2 text-(--color-text)">aprire un ticket di assistenza</Link> indicando i dettagli del dispositivo.
          </p>
        </div>
      </section>
    </div>
  );
}