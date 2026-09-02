import { Link } from 'react-router-dom';

export default function GestionePiano() {
  return (
    <div className="space-y-8">
      {/* Intestazione Sezione */}
      <div>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="text-md font-bold tracking-widest text-(--color-text) uppercase bg-(--color-surface) border border-(--color-border) px-2.5 py-1 rounded-sm shadow-xs">
            3. Account
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-(--color-text) bg-(--color-surface) border border-(--color-border) px-2.5 py-0.5 rounded-sm shadow-xs">
            Abbonamenti & Workspace
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-medium text-(--color-text) tracking-tight mt-1 mb-2.5" >
          Gestione del Piano e Workspace di Studio
        </h1>
        <p className="text-md  text-(--color-muted) font-light leading-relaxed">
          La sezione <strong className="font-semibold text-(--color-text)">Il tuo Piano</strong>, accessibile dal menu del profilo utente, è l'ambiente dedicato al monitoraggio del proprio stato contrattuale, all'acquisto o rinnovo delle licenze e alla gestione centralizzata degli accessi per i gruppi di lavoro.
        </p>
      </div>

      <hr className="border-(--color-border)" />

      {/* SEZIONE 1: Monitoraggio dello Status e Promozioni */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            Monitoraggio dello Status e Promozioni
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            Nella parte superiore della schermata viene visualizzato in tempo reale il livello di accesso corrente dell'account:
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <h3 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Stato dell'Account</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Specifica il piano attualmente assegnato (es. <em>Business</em>, <em>Essential</em> o <em>Periodo di Prova</em>) e il tipo di copertura attiva con la relativa scadenza.
            </p>
          </div>

          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <h3 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Codici Promozionali e Sconti</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Evidenzia eventuali coupon promozionali applicati all'account, con il dettaglio della percentuale di sconto riservata sul listino.
            </p>
          </div>
        </div>

        {/* --- PLACEHOLDER IMMAGINE 1 (Stato Account e Piani) --- */}
        <div className="my-4">
          <div className="flex justify-center">
            <img
              src="https://jurio.it/guida-image/piano.webp"
              alt="Schermata di autenticazione con opzione Single Sign-On e recupero credenziali"
              loading="lazy"
            />
          </div>
          <p className="text-md text-(--color-muted) font-light mt-2 text-center italic">
            Figura 1: Schermata di gestione del piano con indicatore di status e sconti applicati.
          </p>
        </div>
      </section>

      <hr className="border-(--color-border)" />

      {/* SEZIONE 2: Selezione e Upgrade del Piano Individuale */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            Selezione e Upgrade del Piano Individuale
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            Dalla medesima interfaccia è possibile effettuare l'upgrade o acquistare una nuova licenza scegliendo tra fatturazione <strong className="font-semibold text-(--color-text)">mensile</strong> o <strong className="font-semibold text-(--color-text)">annuale</strong> (con agevolazioni sui prezzi finali e IVA sempre inclusa):
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
            <span className="inline-block text-md font-bold text-(--color-text) uppercase tracking-widest bg-(--color-bg) border border-(--color-border) px-2 py-0.5 rounded-sm shadow-xs mt-1">
              Piano Individuale
            </span>
            <h3 className="text-sm sm:text-base font-medium text-(--color-text) tracking-tight" >Piano Essential</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Ottimizzato per la ricerca giurisprudenziale mirata, con consultazione illimitata della banca dati nomofilattica, ricerca semantica e strumenti di navigazione avanzata.
            </p>
          </div>

          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
            <span className="inline-block text-md font-bold text-(--color-text) uppercase tracking-widest bg-(--color-bg) border border-(--color-border) px-2 py-0.5 rounded-sm shadow-xs mt-1">
              Set Completo AI
            </span>
            <h3 className="text-sm sm:text-base font-medium text-(--color-text) tracking-tight" >Piano Business</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Sblocca l'acquisizione documentale intelligente nel cloud riservato, l'analisi di coerenza tra atti e giurisprudenza, la gestione fascicoli, la redazione assistita e l'assistenza tecnica prioritaria.
            </p>
          </div>
        </div>
      </section>

      <hr className="border-(--color-border)" />

      {/* SEZIONE 3: Soluzioni Team & Workspace per Studi Legali */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            Soluzioni Team & Workspace per Studi Legali
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            Per le realtà professionali strutturate che necessitano di coordinare più professionisti, la piattaforma mette a disposizione pacchetti <strong className="font-semibold text-(--color-text)">Workspace a 12 mesi</strong> con fatturazione unica:
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <h3 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Tagli Disponibili</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Pacchetti preconfigurati per team da <strong className="font-semibold text-(--color-text)">3, 5 o 7 utenti</strong>, con una sensibile riduzione del costo unitario per licenza rispetto ai singoli acquisti individuali.
            </p>
          </div>

          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <h3 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Lavoro Simultaneo e Condivisione</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              I collaboratori lavorano congiuntamente sugli stessi fascicoli, documenti analizzati e bozze AI, con ruoli e permessi di visibilità configurabili dall'amministratore.
            </p>
          </div>
        </div>

        {/* Box Voucher Flessibili */}
        <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2.5">
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
          <h3 className="text-md font-bold uppercase tracking-wider text-(--color-text) mt-1">Sistema di Voucher Flessibili a 365 Giorni</h3>
          <ul className="text-md text-(--color-muted) font-light space-y-2">
            <li className="flex items-start">
              <span className="text-(--color-text) mr-2 font-bold">•</span>
              <span><strong className="font-semibold text-(--color-text)">Codici Licenza Business Annuali:</strong> L'amministratore riceve voucher riscattabili per l'attivazione o il rinnovo delle utenze dei colleghi.</span>
            </li>
            <li className="flex items-start">
              <span className="text-(--color-text) mr-2 font-bold">•</span>
              <span><strong className="font-semibold text-(--color-text)">Nessuna Scadenza dei Voucher non Riscattati:</strong> La validità di 365 giorni decorre solo dal momento in cui il singolo utente riscatta il codice, azzerando gli sprechi per licenze non ancora assegnate.</span>
            </li>
          </ul>
        </div>

        <div className="p-4 rounded-lg border border-(--color-border) bg-(--color-surface) text-md text-(--color-text) flex items-center justify-between flex-wrap gap-2 shadow-xs">
          <span className="font-light">
            Per studi con <strong className="font-semibold">oltre 7 professionisti</strong> o con esigenze infrastrutturali dedicate, è disponibile una quotazione <strong className="font-semibold">Enterprise</strong> con integrazioni API, contrattualistica su misura e onboarding dedicato.
          </span>
          <Link to="/contatti" className="font-bold uppercase tracking-wider text-(--color-text) hover:underline underline-offset-2">
            Richiedi Quotazione Enterprise →
          </Link>
        </div>

        {/* --- PLACEHOLDER IMMAGINE 2 (Pannello Workspace e Voucher) --- */}
        <div className="my-4">
          <div className="flex justify-center">
            <img
              src="https://jurio.it/guida-image/voucher.webp"
              alt="Schermata di autenticazione con opzione Single Sign-On e recupero credenziali"
              loading="lazy"
            />
          </div>
          <p className="text-md text-(--color-muted) font-light mt-2 text-center italic">
            Figura 2: Dashboard Workspace con gestione dei voucher e assegnazione delle utenze di studio.
          </p>
        </div>
      </section>

      <hr className="border-(--color-border)" />

      {/* SEZIONE 4: Storico Pagamenti e Tracciamento Transazioni */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            Storico Pagamenti e Tracciamento Transazioni
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            La sezione inferiore ospita il registro contabile di tutte le operazioni economiche effettuate dall'account:
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-md">
          <div className="p-3 bg-(--color-surface) border border-(--color-border) rounded-md shadow-xs">
            <span className="font-bold uppercase tracking-wider text-(--color-text) block mb-1 text-[10px]">Data di Esecuzione</span>
            <span className="text-(--color-muted) font-light">Giorno e ora del pagamento effettuato.</span>
          </div>
          <div className="p-3 bg-(--color-surface) border border-(--color-border) rounded-md shadow-xs">
            <span className="font-bold uppercase tracking-wider text-(--color-text) block mb-1 text-[10px]">Piano / Modulo</span>
            <span className="text-(--color-muted) font-light">Tipologia di licenza o pacchetto acquistato.</span>
          </div>
          <div className="p-3 bg-(--color-surface) border border-(--color-border) rounded-md shadow-xs">
            <span className="font-bold uppercase tracking-wider text-(--color-text) block mb-1 text-[10px]">Importo Complessivo</span>
            <span className="text-(--color-muted) font-light">Totale corrisposto (IVA inclusa).</span>
          </div>
          <div className="p-3 bg-(--color-surface) border border-(--color-border) rounded-md shadow-xs">
            <span className="font-bold uppercase tracking-wider text-(--color-text) block mb-1 text-[10px]">Metodo & ID Transazione</span>
            <span className="text-(--color-muted) font-light">Canale (es. Stripe) e codice univoco per verifiche o fatturazione.</span>
          </div>
        </div>
      </section>
    </div>
  );
}