import { Link } from 'react-router-dom';

export default function AssistenzaSupporto() {
  return (
    <div className="space-y-8">
      {/* Intestazione Sezione */}
      <div>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="text-md font-bold tracking-widest text-(--color-text) uppercase bg-(--color-surface) border border-(--color-border) px-2.5 py-1 rounded-sm shadow-xs">
            4. Supporto
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-(--color-text) bg-(--color-surface) border border-(--color-border) px-2.5 py-0.5 rounded-sm shadow-xs">
            Assistenza & Ticket
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-medium text-(--color-text) tracking-tight mt-1 mb-2.5" >
          Assistenza e Canali di Supporto
        </h1>
        <p className="text-md  text-(--color-muted) font-light leading-relaxed">
          Per qualsiasi necessità tecnica, amministrativa o operativa, Jurio mette a disposizione un sistema di assistenza integrato accessibile direttamente dalla pagina dedicata ai contatti e alle segnalazioni (<Link to="/contatti" className="font-bold underline underline-offset-2 text-(--color-text)">/contatti</Link>).
        </p>
      </div>

      <hr className="border-(--color-border)" />

      {/* SEZIONE 1: Canali Diretti di Contatto */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            Canali Diretti di Contatto
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            La piattaforma combina la tempestività dell'assistenza guidata via intelligenza artificiale con la gestione strutturata dei ticket da parte del team tecnico:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
            <span className="inline-block text-md font-bold text-(--color-text) uppercase tracking-widest bg-(--color-bg) border border-(--color-border) px-2 py-0.5 rounded-sm shadow-xs mt-1">
              Supporto Istantaneo
            </span>
            <h3 className="text-sm sm:text-base font-medium text-(--color-text) tracking-tight" >Assistente Virtuale (Jurio AI)</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Attivo direttamente nell'interfaccia, consente di ottenere risposte immediate ai quesiti più frequenti sulle funzionalità della piattaforma, sulla navigazione dei menu e sulle configurazioni di base del profilo.
            </p>
          </div>

          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
            <span className="inline-block text-md font-bold text-(--color-text) uppercase tracking-widest bg-(--color-bg) border border-(--color-border) px-2 py-0.5 rounded-sm shadow-xs mt-1">
              Helpdesk Tecnico
            </span>
            <h3 className="text-sm sm:text-base font-medium text-(--color-text) tracking-tight" >Apertura Ticket di Supporto</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Il modulo formale per inoltrare segnalazioni tecniche complesse, problematiche amministrative o richieste di personalizzazione direttamente al team di sviluppo.
            </p>
          </div>
        </div>
      </section>

      <hr className="border-(--color-border)" />

      {/* SEZIONE 2: Come Inviare una Richiesta (Apertura Ticket) */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            Come Inviare una Richiesta (Apertura Ticket)
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            Per consentire una rapida presa in carico della segnalazione, il modulo richiede la compilazione di dati specifici:
          </p>
        </div>

        <div className="relative p-5 sm:p-6 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-4">
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-md mt-1">
            <div className="p-3 bg-(--color-bg) border border-(--color-border) rounded-md shadow-xs">
              <span className="font-bold uppercase tracking-wider text-(--color-text) block mb-1 text-[10px]">Nome Completo</span>
              <span className="text-(--color-muted) font-light">Nominativo dell'utente o del referente dello studio.</span>
            </div>
            <div className="p-3 bg-(--color-bg) border border-(--color-border) rounded-md shadow-xs">
              <span className="font-bold uppercase tracking-wider text-(--color-text) block mb-1 text-[10px]">Email Account</span>
              <span className="text-(--color-muted) font-light">L'indirizzo di posta associato al profilo Jurio interessato.</span>
            </div>
            <div className="p-3 bg-(--color-bg) border border-(--color-border) rounded-md shadow-xs">
              <span className="font-bold uppercase tracking-wider text-(--color-text) block mb-1 text-[10px]">Oggetto Richiesta</span>
              <span className="text-(--color-muted) font-light">Sintesi chiara del motivo del contatto (es. fatturazione, upload, bug).</span>
            </div>
          </div>

          <div className="p-4 rounded-md bg-(--color-bg) border border-(--color-border) text-md text-(--color-muted) font-light space-y-2 shadow-xs">
            <span className="font-bold uppercase tracking-widest text-(--color-text) block text-[10px]">Dettagli Utili per la Descrizione del Problema:</span>
            <ul className="space-y-1.5 list-disc list-inside font-light">
              <li><strong className="font-semibold text-(--color-text)">Sezione o strumento:</strong> es. Ricerca Semantica, Consulente Legale, Add-in Word.</li>
              <li><strong className="font-semibold text-(--color-text)">Messaggio di errore:</strong> il testo esatto visualizzato a video.</li>
              <li><strong className="font-semibold text-(--color-text)">Ambiente operativo:</strong> browser utilizzato (Chrome, Edge, Safari, Firefox) e dispositivo.</li>
              <li><strong className="font-semibold text-(--color-text)">Caratteristiche del file:</strong> formato e dimensione dell'eventuale allegato coinvolto (evitando di includere dati riservati non necessari).</li>
            </ul>
          </div>

          <p className="text-md text-(--color-muted) font-light">
            * È richiesta la spunta sul <strong className="font-semibold text-(--color-text)">Consenso Privacy</strong> per autorizzare il trattamento dei dati ai fini esclusivi della risoluzione del ticket.
          </p>
        </div>

        {/* --- PLACEHOLDER IMMAGINE 1 (Schermata Contatti / Ticket) --- */}
        <div className="my-4">
          <div className="flex justify-center">
            <img
              src="https://jurio.it/guida-image/contatti.webp"
              alt="Schermata di autenticazione con opzione Single Sign-On e recupero credenziali"
              loading="lazy"
            />
          </div>
          <p className="text-md text-(--color-muted) font-light mt-2 text-center italic">
            Figura 1: Modulo di apertura ticket per richieste tecniche e amministrative.
          </p>
        </div>
      </section>

      <hr className="border-(--color-border)" />

      {/* SEZIONE 3: Quando Contattare il Supporto */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            Quando Contattare il Supporto
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            Il canale di assistenza è a disposizione per diverse necessità di studio:
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <h3 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Assistenza Tecnica</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Difficoltà di accesso, anomalie di rendering, errori nell'elaborazione file o supporto per l'Add-in Microsoft Word.
            </p>
          </div>

          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <h3 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Gestione Amministrativa</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Chiarimenti su fatturazione elettronica, ricevute di pagamento Stripe, upgrade o estensione delle licenze.
            </p>
          </div>

          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <h3 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Feedback & Feature Request</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Condivisione di suggerimenti operativi, richieste di nuove funzionalità o personalizzazioni per grandi studi legali.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}