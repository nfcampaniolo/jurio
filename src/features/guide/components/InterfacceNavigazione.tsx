import { Link } from 'react-router-dom';

export default function InterfacceNavigazione() {
  return (
    <div className="space-y-8">
      {/* Intestazione Sezione */}
      <div>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="text-md font-bold tracking-widest text-(--color-text) uppercase bg-(--color-surface) border border-(--color-border) px-2.5 py-1 rounded-sm shadow-xs">
            1. Casi d'uso
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-(--color-text) bg-(--color-surface) border border-(--color-border) px-2.5 py-0.5 rounded-sm shadow-xs">
            Navigazione Globale
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-medium text-(--color-text) tracking-tight mt-1 mb-2.5" >
          Interfacce di Navigazione
        </h1>
        <p className="text-md  text-(--color-muted) font-light leading-relaxed">
          La navigazione all'interno dell'applicazione web è strutturata principalmente attorno a due elementi sempre accessibili: l'<strong className="font-semibold text-(--color-text)">Header</strong> (la barra superiore) e il <strong className="font-semibold text-(--color-text)">Footer</strong> (il piè di pagina).
        </p>
      </div>

      <hr className="border-(--color-border)" />

      {/* SEZIONE 1: Barra di intestazione (Header) */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            Barra di intestazione (Header)
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            L'header rappresenta il fulcro operativo della piattaforma e consente di spostarsi rapidamente tra le diverse sezioni informative e gli strumenti di lavoro quotidiani.
          </p>
        </div>

        {/* --- PLACEHOLDER IMMAGINE 1 (Screenshot Header) --- */}
        <div className="my-4">
          <div className="flex justify-center">
            <img
              src="https://jurio.it/guida-image/header.webp"
              alt="Schermata di autenticazione con opzione Single Sign-On e recupero credenziali"
              loading="lazy"
            />
          </div>
          <p className="text-md text-(--color-muted) font-light mt-2 text-center italic">
            Figura 1: Dettaglio della barra superiore e delle voci di accesso rapido.
          </p>
        </div>
    
        {/* Suddivisione Voci Header */}
        <div className="space-y-3.5 pt-1">
          {/* Voci Informative */}
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <h3 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Panoramica del Servizio</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Nella prima parte della barra si trovano i collegamenti a <strong className="font-semibold text-(--color-text)">Come Funziona</strong>, <strong className="font-semibold text-(--color-text)">Prezzi</strong> e <strong className="font-semibold text-(--color-text)">Domande Frequenti</strong>, pensati per offrire chiarimenti immediati sulle caratteristiche e sui costi della piattaforma.
            </p>
          </div>

          {/* Strumenti Operativi */}
          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
            <h3 className="text-md font-bold uppercase tracking-wider text-(--color-text) mt-1">Strumenti Operativi Centrali</h3>
            <ul className="space-y-1.5 text-md text-(--color-muted) font-light leading-relaxed">
              <li className="flex items-start">
                <span className="text-(--color-text) mr-2 font-bold">•</span>
                <span><strong className="font-semibold text-(--color-text)">Ricerca Giurisprudenza:</strong> apre il motore di ricerca per consultare massime e pronunce integrali.</span>
              </li>
              <li className="flex items-start">
                <span className="text-(--color-text) mr-2 font-bold">•</span>
                <span><strong className="font-semibold text-(--color-text)">Consulente Legale:</strong> avvia l'assistente conversazionale e permette di creare, organizzare e gestire i propri fascicoli di lavoro.</span>
              </li>
            </ul>
          </div>

          {/* Area Personale e Servizi */}
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-2 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <h3 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Area Personale e Servizi</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              La barra è completata dall'area personale <strong className="font-semibold text-(--color-text)">Il tuo profilo</strong>, da cui è possibile aggiornare i propri dati e consultare i documenti caricati, oltre che dai pulsanti di servizio dedicati:
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link to="/contatti" className="px-2.5 py-1 bg-(--color-bg) border border-(--color-border) text-(--color-text) text-[10px] font-bold uppercase tracking-wider rounded-sm shadow-xs hover:border-(--color-text)">
                Assistenza (/contatti)
              </Link>
              <Link to="/notifiche" className="px-2.5 py-1 bg-(--color-bg) border border-(--color-border) text-(--color-text) text-[10px] font-bold uppercase tracking-wider rounded-sm shadow-xs hover:border-(--color-text)">
                Centro Notifiche (/notifiche)
              </Link>
              <Link to="/guida" className="px-2.5 py-1 bg-(--color-bg) border border-(--color-border) text-(--color-text) text-[10px] font-bold uppercase tracking-wider rounded-sm shadow-xs hover:border-(--color-text)">
                Guida Utente (/guida)
              </Link>
            </div>
          </div>
        </div>
      </section>

      <hr className="border-(--color-border)" />

      {/* SEZIONE 2: Piè di pagina (Footer) */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            Piè di pagina (Footer)
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            Il footer, posizionato a fondo pagina in tutte le schermate, è organizzato per fornire riferimenti istituzionali, risorse di approfondimento e documentazione contrattuale.
          </p>
        </div>

        {/* --- PLACEHOLDER IMMAGINE 2 (Screenshot Footer) --- */}
        <div className="my-4">
          <div className="flex justify-center">
            <img
              src="https://jurio.it/guida-image/footer.webp"
              alt="Schermata di autenticazione con opzione Single Sign-On e recupero credenziali"
              loading="lazy"
            />
          </div>
          <p className="text-md text-(--color-muted) font-light mt-2 text-center italic">
            Figura 2: Organizzazione delle sezioni informative e legali nel footer.
          </p>
        </div>
    
        {/* Colonne Footer */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
          {/* Colonna 1: Social e Prodotto */}
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <h3 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Canali & Prodotto</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Link ai canali social ufficiali (LinkedIn e Instagram) e accesso diretto alle sezioni informative e alla pagina dedicata alle fonti consultate dal sistema (<Link to="/fonti" className="font-bold underline underline-offset-2 text-(--color-text)">/fonti</Link>).
            </p>
          </div>

          {/* Colonna 2: Supporto e Risorse */}
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <h3 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Supporto & Risorse</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Canali di assistenza tecnica (<Link to="/contatti" className="font-bold underline underline-offset-2 text-(--color-text)">/contatti</Link>) e sezione dedicata ai casi studio applicativi (<Link to="/casi-studio" className="font-bold underline underline-offset-2 text-(--color-text)">/casi-studio</Link>).
            </p>
          </div>

          {/* Colonna 3: Area Legale */}
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <h3 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Area Legale</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Informativa completa su <Link to="/privacy" className="font-bold underline underline-offset-2 text-(--color-text)">Privacy Policy (/privacy)</Link>, <Link to="/termini" className="font-bold underline underline-offset-2 text-(--color-text)">Termini di Servizio (/termini)</Link> e conformità al trattamento dei dati personali (<Link to="/gdpr" className="font-bold underline underline-offset-2 text-(--color-text)">/gdpr</Link>).
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}