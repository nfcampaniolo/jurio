import { Link } from 'react-router-dom';

export default function GestioneTeam() {
  return (
    <div className="space-y-8">
      {/* Intestazione Sezione */}
      <div>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="text-md font-bold tracking-widest text-(--color-text) uppercase bg-(--color-surface) border border-(--color-border) px-2.5 py-1 rounded-sm shadow-xs">
            3. Account
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-(--color-text) bg-(--color-surface) border border-(--color-border) px-2.5 py-0.5 rounded-sm shadow-xs">
            Soluzioni Workspace Studio
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-medium text-(--color-text) tracking-tight mt-1 mb-2.5" >
          Gestione del Team e Workspace Condiviso
        </h1>
        <p className="text-md  text-(--color-muted) font-light leading-relaxed">
          La funzionalità <strong className="font-semibold text-(--color-text)">Team</strong> consente di coordinare l'attività di più professionisti all'interno di un unico ambiente di lavoro centralizzato, ottimizzando la condivisione delle risorse, dei fascicoli di studio e dei documenti analizzati.
        </p>
      </div>

      <hr className="border-(--color-border)" />

      {/* SEZIONE 1: Attivazione Workspace e Voucher */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            Attivazione del Workspace e Assegnazione Voucher
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            Per creare un team è necessario acquistare uno dei pacchetti Workspace disponibili (es. soluzioni per 3, 5 o 7 utenti).
          </p>
        </div>

        <div className="relative p-5 sm:p-6 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-3">
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
          <h3 className="text-md font-bold uppercase tracking-wider text-(--color-text) mt-1">Generazione e Validità dei Voucher</h3>
          <ul className="text-md text-(--color-muted) font-light space-y-2 leading-relaxed">
            <li className="flex items-start">
              <span className="text-(--color-text) mr-2 font-bold">•</span>
              <span><strong className="font-semibold text-(--color-text)">Pacchetto di Voucher Business:</strong> Al perfezionamento dell'acquisto, la piattaforma genera automaticamente un numero di voucher equivalente alle licenze previste dal pacchetto. Ciascun voucher sblocca un accesso annuale completo (365 giorni) al Piano Business.</span>
            </li>
            <li className="flex items-start">
              <span className="text-(--color-text) mr-2 font-bold">•</span>
              <span><strong className="font-semibold text-(--color-text)">Flessibilità Totale (No Sprechi):</strong> La validità di 365 giorni decorre <em>esclusivamente dal momento del suo riscatto</em> da parte del singolo professionista.</span>
            </li>
          </ul>

          <div className="pt-2">
            <Link 
              to="/profilo/team" 
              className="inline-flex items-center text-md font-bold uppercase tracking-widest text-(--color-text) hover:underline underline-offset-2"
            >
              Pannello di Amministrazione Team (/profilo/team) →
            </Link>
          </div>
        </div>

        {/* --- PLACEHOLDER IMMAGINE 1 (Dashboard Team & Voucher) --- */}
        <div className="my-4">
          <div className="flex justify-center">
            <img
              src="https://jurio.it/guida-image/team.webp"
              alt="Schermata di autenticazione con opzione Single Sign-On e recupero credenziali"
              loading="lazy"
            />
          </div>
          <p className="text-md text-(--color-muted) font-light mt-2 text-center italic">
            Figura 1: Pannello di controllo del workspace con riepilogo licenze e membri attivi.
          </p>
        </div>
      </section>

      <hr className="border-(--color-border)" />

      {/* SEZIONE 2: Ruoli e Permessi nel Team */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            Ruoli e Permessi nel Team
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            All'interno dell'area di lavoro, i componenti del gruppo possono assumere ruoli e livelli di autorizzazione differenti:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card Owner */}
          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
            <span className="inline-block text-md font-bold text-(--color-text) uppercase tracking-widest bg-(--color-bg) border border-(--color-border) px-2 py-0.5 rounded-sm shadow-xs mt-1">
              Amministratore
            </span>
            <h3 className="text-sm sm:text-base font-medium text-(--color-text) tracking-tight" >Owner (Proprietario)</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              L'utente che effettua l'acquisto assume di default il ruolo di Owner. Ha facoltà di invitare nuovi membri, assegnare i voucher, rimuovere collaboratori o promuovere altri colleghi ad Owner. Gestisce inoltre le impostazioni globali di visibilità e riservatezza.
            </p>
          </div>

          {/* Card Membri */}
          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-3">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
            <span className="inline-block text-md font-bold text-(--color-text) uppercase tracking-widest bg-(--color-bg) border border-(--color-border) px-2 py-0.5 rounded-sm shadow-xs mt-1">
              Collaboratori
            </span>
            <h3 className="text-sm sm:text-base font-medium text-(--color-text) tracking-tight" >Membri del Team</h3>
            <div className="space-y-2 text-md text-(--color-muted) font-light">
              <div className="p-2.5 bg-(--color-bg) border border-(--color-border) rounded-md shadow-xs">
                <span className="font-bold uppercase tracking-wider text-(--color-text) block mb-0.5 text-[10px]">Viewer</span>
                Profilo di sola consultazione dei fascicoli e dei documenti condivisi.
              </div>
              <div className="p-2.5 bg-(--color-bg) border border-(--color-border) rounded-md shadow-xs">
                <span className="font-bold uppercase tracking-wider text-(--color-text) block mb-0.5 text-[10px]">Editor</span>
                Profilo abilitato alla funzionalità di lavoro collaborativo simultaneo sulle bozze e sugli atti in comune.
              </div>
            </div>
          </div>
        </div>
      </section>

      <hr className="border-(--color-border)" />

      {/* SEZIONE 3: Invito e Accesso dei Collaboratori */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            Invito e Accesso dei Collaboratori
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            L'Owner può integrare nuovi componenti all'interno del team in due modalità:
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <h3 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >1. Invito Diretto via Email</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Inserendo l'indirizzo di posta elettronica del collega per trasmettere l'invito formale ad accedere al workspace dello studio.
            </p>
          </div>

          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <h3 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >2. Condivisione Codice Voucher</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Fornendo direttamente il codice generato, che il destinatario potrà inserire e riscattare nella propria area personale.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-lg border border-(--color-border) bg-(--color-surface) text-md text-(--color-muted) font-light leading-relaxed shadow-xs">
          <strong className="font-bold text-(--color-text)">Requisito di Accesso:</strong> Per unirsi al team e riscattare la licenza, gli utenti invitati devono disporre di un account registrato e attivo su Jurio.
        </div>
      </section>

      <hr className="border-(--color-border)" />

      {/* SEZIONE 4: Regole di Condivisione, Visibilità e Riservatezza */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            Regole di Condivisione, Visibilità e Riservatezza
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            L'Owner può abilitare la condivisione centralizzata dei documenti e dei fascicoli, rendendo visibile il patrimonio informativo dello studio a tutti i membri. Per preservare l'integrità professionale, la condivisione rispetta vincoli rigorosi:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <h3 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Consultazione Protetta</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              I membri del team possono visionare e analizzare i documenti elaborati e i fascicoli creati dai colleghi dello studio.
            </p>
          </div>

          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <h3 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Inviolabilità delle Sessioni Conversazionali</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Non è consentito modificare documenti altrui né intervenire o scrivere all'interno delle chat e dei thread di fascicoli appartenenti ad altri professionisti. Ogni sessione rimane strettamente riservata al rispettivo proprietario.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}