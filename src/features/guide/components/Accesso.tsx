import { Link } from 'react-router-dom';

export default function Accesso() {
  return (
    <div className="space-y-8">
      {/* Intestazione Sezione */}
      <div>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="text-[9px] font-bold tracking-widest text-(--color-text) uppercase bg-(--color-surface) border border-(--color-border) px-2.5 py-1 rounded-sm shadow-xs">
            3. Account
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-(--color-text) bg-(--color-surface) border border-(--color-border) px-2.5 py-0.5 rounded-sm shadow-xs">
            Autenticazione & Registrazione
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-medium text-(--color-text) tracking-tight mt-1 mb-2.5" >
          Login e Registrazione
        </h1>
        <p className="text-md  text-(--color-muted) font-light leading-relaxed">
          Per utilizzare gli strumenti di ricerca e le funzionalità avanzate di Jurio è necessario autenticarsi con il proprio account personale o crearne uno nuovo per avviare il periodo di prova.
        </p>
      </div>

      <hr className="border-(--color-border)" />

      {/* SEZIONE 1: Login */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            Login (Accesso)
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            La schermata di accesso è raggiungibile cliccando sul pulsante <strong className="font-semibold text-(--color-text)">Accedi</strong> posizionato nell'header dell'applicazione web.
          </p>
        </div>

        {/* Modalità di Autenticazione */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
            <h3 className="text-sm sm:text-base font-medium text-(--color-text) tracking-tight mt-1" >Accesso con Email e Password</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Inserisci l'indirizzo email associato al tuo profilo e la password scelta in fase di registrazione, confermando con un clic sul pulsante <strong className="font-semibold text-(--color-text)">Accedi</strong>.
            </p>
          </div>

          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
            <h3 className="text-sm sm:text-base font-medium text-(--color-text) tracking-tight mt-1" >Single Sign-On con Google</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Selezionando <strong className="font-semibold text-(--color-text)">Accedi con Google</strong>, il sistema effettua l'autenticazione istantanea tramite il tuo account Google, senza richiedere l'inserimento manuale di credenziali separate.
            </p>
          </div>
        </div>

        {/* Procedura di Recupero Password */}
        <div className="relative p-5 sm:p-6 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-3">
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
          <h3 className="text-md font-bold uppercase tracking-wider text-(--color-text) mt-1">Procedura di Recupero della Password</h3>
          <p className="text-md text-(--color-muted) font-light leading-relaxed">
            In caso di smarrimento o dimenticanza delle credenziali:
          </p>
          <ol className="text-md text-(--color-muted) font-light space-y-1.5 list-decimal list-inside">
            <li>Seleziona la voce <strong className="font-semibold text-(--color-text)">Password dimenticata?</strong> nella schermata di login.</li>
            <li>Inserisci l'indirizzo email associato al tuo account Jurio nel campo dedicato.</li>
            <li>Clicca sul pulsante di invio: riceverai un'email con il link sicuro per reimpostare la password e ripristinare l'accesso.</li>
          </ol>
        </div>

        {/* --- PLACEHOLDER IMMAGINE 1 (Schermata Login) --- */}
       <div className="my-4">
          <div className="flex justify-center">
            <img
              src="https://jurio.it/guida-image/login.webp"
              alt="Schermata di autenticazione con opzione Single Sign-On e recupero credenziali"
              loading="lazy"
            />
          </div>
          <p className="text-md text-(--color-muted) font-light mt-2 text-center italic">
            Figura 1: Schermata di autenticazione con opzione Single Sign-On e recupero credenziali.
          </p>
        </div>
      </section>

      <hr className="border-(--color-border)" />

      {/* SEZIONE 2: Registrati */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            Creazione di un Nuovo Account (Registrazione)
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            Per avviare la registrazione clicca sul pulsante <strong className="font-semibold text-(--color-text)">Registrati</strong> presente nell'header della piattaforma o subito sotto il modulo di login, scegliendo tra registrazione via email/password o accesso rapido con Google.
          </p>
        </div>

        {/* Dati di Profilo Richiesti */}
        <div className="space-y-3">
          <h3 className="text-md font-bold uppercase tracking-widest text-(--color-text)">Dati di Profilo Richiesti</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
              <span className="inline-block text-[9px] font-bold text-(--color-text) uppercase tracking-widest bg-(--color-bg) border border-(--color-border) px-2 py-0.5 rounded-sm shadow-xs mt-0.5">Obbligatorio</span>
              <h4 className="font-medium text-(--color-text) text-md  tracking-tight" >Nome e Cognome</h4>
              <p className="text-md text-(--color-muted) font-light leading-relaxed">
                Dati anagrafici necessari per l'intestazione dell'area personale e l'emissione dei documenti fiscali.
              </p>
            </div>

            <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
              <span className="inline-block text-[9px] font-bold text-(--color-text) uppercase tracking-widest bg-(--color-bg) border border-(--color-border) px-2 py-0.5 rounded-sm shadow-xs mt-0.5">Obbligatorio</span>
              <h4 className="font-medium text-(--color-text) text-md  tracking-tight" >Numero di Telefono</h4>
              <p className="text-md text-(--color-muted) font-light leading-relaxed">
                Richiesto a fini esclusivi di sicurezza informatica, verifica d'identità e prevenzione della duplicazione degli account (non ceduto a terzi né usato per fini commerciali, ai sensi del GDPR).
              </p>
            </div>

            <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
              <span className="inline-block text-[9px] font-bold text-(--color-muted) uppercase tracking-widest bg-(--color-bg) border border-(--color-border) px-2 py-0.5 rounded-sm shadow-xs mt-0.5">Opzionale</span>
              <h4 className="font-medium text-(--color-text) text-md  tracking-tight" >Categoria Professionale</h4>
              <p className="text-md text-(--color-muted) font-light leading-relaxed">
                Ambito lavorativo (es. Avvocato, Giurista d'impresa, Praticante, Magistrato) per personalizzare suggerimenti, schemi e modelli di lavoro.
              </p>
            </div>
          </div>
        </div>

        {/* Consensi e Condizioni Contrattuali */}
        <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2.5">
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
          <h3 className="text-md font-bold uppercase tracking-wider text-(--color-text) mt-1">Consensi e Condizioni Contrattuali</h3>
          <ul className="text-md text-(--color-muted) font-light space-y-2 leading-relaxed">
            <li className="flex items-start">
              <span className="text-(--color-text) mr-2 font-bold">•</span>
              <span>
                <strong className="font-semibold text-(--color-text)">Termini di Servizio e Privacy Policy (Obbligatorio):</strong> presa visione e accettazione delle condizioni contrattuali (<Link to="/termini" className="font-bold underline underline-offset-2 text-(--color-text)">/termini</Link>) e dell'informativa sul trattamento dei dati (<Link to="/privacy" className="font-bold underline underline-offset-2 text-(--color-text)">/privacy</Link> - <Link to="/gdpr" className="font-bold underline underline-offset-2 text-(--color-text)">/gdpr</Link>), indispensabile per attivare il profilo.
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-(--color-text) mr-2 font-bold">•</span>
              <span>
                <strong className="font-semibold text-(--color-text)">Comunicazioni Promozionali e Aggiornamenti (Facoltativo):</strong> consenso opzionale per ricevere la newsletter istituzionale, anticipazioni su nuove release e aggiornamenti di prodotto.
              </span>
            </li>
          </ul>
        </div>

        {/* --- PLACEHOLDER IMMAGINE 2 (Schermata Registrazione) --- */}
        <div className="my-4">
          <div className="flex justify-center">
            <img
              src="https://jurio.it/guida-image/registrati.webp"
              alt="Schermata di autenticazione con opzione Single Sign-On e recupero credenziali"
              loading="lazy"
            />
          </div>
          <p className="text-md text-(--color-muted) font-light mt-2 text-center italic">
            Figura 2: Modulo di iscrizione con campi anagrafici, sicurezza e consensi di legge.
          </p>
        </div>
      </section>
    </div>
  );
}