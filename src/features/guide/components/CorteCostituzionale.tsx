import { Link } from 'react-router-dom';

export default function CorteCostituzionale() {
  return (
    <div className="space-y-8">
      {/* Intestazione Sezione */}
      <div>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="text-md font-bold tracking-widest text-(--color-text) uppercase bg-(--color-surface) border border-(--color-border) px-2.5 py-1 rounded-sm shadow-xs">
            2. Giurisprudenza
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-(--color-text) bg-(--color-surface) border border-(--color-border) px-2.5 py-0.5 rounded-sm shadow-xs">
            Copertura dal 2021 a oggi
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-medium text-(--color-text) tracking-tight mt-1 mb-2.5" >
          Corte Costituzionale
        </h1>
        <p className="text-md  text-(--color-muted) font-light leading-relaxed">
          La <strong className="font-semibold text-(--color-text)">Corte Costituzionale</strong> è l'organo supremo di garanzia che assicura il rispetto della Costituzione della Repubblica Italiana. La piattaforma indicizza tutte le pronunce depositate a partire dal 2021, consentendo verifiche immediate di conformità costituzionale e studio dei precedenti.
        </p>
      </div>

      <hr className="border-(--color-border)" />

      {/* Ambiti di Giudizio */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            Ambiti di Competenza e Tipologie di Giudizio
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            I provvedimenti della Consulta sono classificati in base alla natura del giudizio di legittimità costituzionale:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
            <span className="inline-block text-md font-bold text-(--color-text) uppercase tracking-widest bg-(--color-bg) border border-(--color-border) px-2 py-0.5 rounded-sm shadow-xs mt-1">
              Giudizio di Legittimità
            </span>
            <h3 className="text-sm sm:text-base font-medium text-(--color-text) tracking-tight" >Controllo di Costituzionalità</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Verifica che le leggi e gli atti aventi forza di legge dello Stato e delle Regioni siano conformi ai principi e ai diritti sanciti dalla Costituzione (giudizi in via incidentale e in via principale).
            </p>
          </div>

          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
            <span className="inline-block text-md font-bold text-(--color-text) uppercase tracking-widest bg-(--color-bg) border border-(--color-border) px-2 py-0.5 rounded-sm shadow-xs mt-1">
              Conflitti Istituzionali
            </span>
            <h3 className="text-sm sm:text-base font-medium text-(--color-text) tracking-tight" >Conflitti di Attribuzione</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Risolve le controversie relative alla delimitazione dei poteri tra organi dello Stato e quelle insorte tra Stato e Regioni (o tra Regioni).
            </p>
          </div>

          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
            <span className="inline-block text-md font-bold text-(--color-text) uppercase tracking-widest bg-(--color-bg) border border-(--color-border) px-2 py-0.5 rounded-sm shadow-xs mt-1">
              Partecipazione Popolare
            </span>
            <h3 className="text-sm sm:text-base font-medium text-(--color-text) tracking-tight" >Giudizio sui Referendum</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Valuta l'ammissibilità dei quesiti di referendum abrogativo presentati ai sensi dell'art. 75 della Costituzione.
            </p>
          </div>
        </div>

        {/* --- PLACEHOLDER IMMAGINE 1 (Corte Costituzionale) --- */}
        <div className="my-4">
          <div className="flex justify-center">
            <img
              src="https://jurio.it/guida-image/costituzionale.webp"
              alt="Schermata di autenticazione con opzione Single Sign-On e recupero credenziali"
              loading="lazy"
            />
          </div>
          <p className="text-md text-(--color-muted) font-light mt-2 text-center italic">
            Figura 1: Dettaglio di una sentenza della Consulta con parametri costituzionali e dispositivo.
          </p>
        </div>
      </section>

      <hr className="border-(--color-border)" />

      {/* Tipologia Atti */}
      <section className="space-y-2">
        <h3 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight" >Tipologia di Provvedimenti Catalogati</h3>
        <p className="text-md  text-(--color-muted) font-light leading-relaxed">
          Il corpus include sentenze di accoglimento, sentenze di rigetto, sentenze interpretative, ordinanze di manifesta inammissibilità o infondatezza e ordinanze di restituzione atti al giudice <em>a quo</em>. Il dettaglio della copertura complessiva è disponibile alla pagina <Link to="/fonti" className="font-bold underline underline-offset-2 text-(--color-text)">/fonti</Link>.
        </p>
      </section>
    </div>
  );
}