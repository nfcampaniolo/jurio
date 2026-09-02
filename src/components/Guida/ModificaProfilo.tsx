import { Link } from 'react-router-dom';

export default function ModificaProfilo() {
  return (
    <div className="space-y-8">
      {/* Intestazione Sezione */}
      <div>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="text-md font-bold tracking-widest text-(--color-text) uppercase bg-(--color-surface) border border-(--color-border) px-2.5 py-1 rounded-sm shadow-xs">
            3. Account
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-(--color-text) bg-(--color-surface) border border-(--color-border) px-2.5 py-0.5 rounded-sm shadow-xs">
            Profilo & Preferenze
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-medium text-(--color-text) tracking-tight mt-1 mb-2.5" >
          Modifica del Profilo e Preferenze
        </h1>
        <p className="text-md  text-(--color-muted) font-light leading-relaxed">
          La schermata <strong className="font-semibold text-(--color-text)">Modifica Profilo</strong>, accessibile dalla propria area personale tramite il comando <em>Torna al profilo</em>, consente di aggiornare in qualsiasi momento le informazioni anagrafiche, personalizzare la propria identità visiva e gestire le preferenze relative ai consensi.
        </p>
      </div>

      <hr className="border-(--color-border)" />

      {/* SEZIONE 1: Avatar e Riconoscimento */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            Personalizzazione Avatar e Dati di Riconoscimento
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            Nella parte superiore della pagina è possibile aggiornare l'immagine del proprio profilo per personalizzare l'esperienza d'uso individuale e all'interno del team.
          </p>
        </div>

        <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2">
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
          <h3 className="text-md font-bold uppercase tracking-wider text-(--color-text) mt-1">Caricamento e Visibilità Avatar</h3>
          <ul className="text-md text-(--color-muted) font-light space-y-1.5 leading-relaxed">
            <li>• È sufficiente cliccare direttamente sull'icona dell'avatar per selezionare e caricare una nuova immagine dal proprio computer.</li>
            <li>• L'immagine impostata sarà visualizzata all'interno dell'header, nei fascicoli di lavoro e nelle interazioni all'interno dei workspace condivisi dello studio.</li>
          </ul>
        </div>

        {/* --- PLACEHOLDER IMMAGINE 1 (Modifica Avatar e Informazioni) --- */}
        <div className="my-4">
          <div className="flex justify-center">
            <img
              src="https://jurio.it/guida-image/profilo.webp"
              alt="Schermata di autenticazione con opzione Single Sign-On e recupero credenziali"
              loading="lazy"
            />
          </div>
          <p className="text-md text-(--color-muted) font-light mt-2 text-center italic">
            Figura 1: Pannello di aggiornamento delle informazioni personali e caricamento avatar.
          </p>
      </div>
      </section>

      <hr className="border-(--color-border)" />

      {/* SEZIONE 2: Aggiornamento Categoria Professionale */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            Aggiornamento della Categoria Professionale
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            L'indicazione del proprio ambito lavorativo è facoltativa, ma permette alla piattaforma di calibrare i suggerimenti, l'albero delle categorie e gli schemi di redazione AI sui contesti di studio più frequenti per il proprio ruolo.
          </p>
        </div>

        <div className="relative p-5 sm:p-6 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-3">
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
          <h3 className="text-md font-bold uppercase tracking-wider text-(--color-text) mt-1">Qualifiche Selezionabili dal Menu Rapido:</h3>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-md text-(--color-muted) font-light">
            <div className="p-2.5 bg-(--color-bg) border border-(--color-border) rounded-md shadow-xs">Studente di giurisprudenza</div>
            <div className="p-2.5 bg-(--color-bg) border border-(--color-border) rounded-md shadow-xs">Praticante avvocato</div>
            <div className="p-2.5 bg-(--color-bg) border border-(--color-border) rounded-md shadow-xs font-bold text-(--color-text)">Avvocato</div>
            <div className="p-2.5 bg-(--color-bg) border border-(--color-border) rounded-md shadow-xs">Magistrato</div>
            <div className="p-2.5 bg-(--color-bg) border border-(--color-border) rounded-md shadow-xs">Notaio</div>
            <div className="p-2.5 bg-(--color-bg) border border-(--color-border) rounded-md shadow-xs">Consulente legale</div>
            <div className="p-2.5 bg-(--color-bg) border border-(--color-border) rounded-md shadow-xs">Assistente legale</div>
            <div className="p-2.5 bg-(--color-bg) border border-(--color-border) rounded-md shadow-xs">Personale di cancelleria</div>
            <div className="p-2.5 bg-(--color-bg) border border-(--color-border) rounded-md shadow-xs">Accademico</div>
          </div>

          <div className="p-3 bg-(--color-bg) border border-(--color-border) rounded-md text-md text-(--color-muted) font-light mt-2 shadow-xs">
            <strong className="font-bold uppercase tracking-wider text-(--color-text) block mb-0.5 text-[10px]">Opzione "Altro (specifica)":</strong> include un campo di testo libero per digitare ruoli, incarichi speciali o specializzazioni non presenti nell'elenco standard.
          </div>
        </div>
      </section>

      <hr className="border-(--color-border)" />

      {/* SEZIONE 3: Gestione Consensi e Salvataggio */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            Gestione Consensi e Salvataggio
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            Nella sezione inferiore dedicata alle <strong className="font-semibold text-(--color-text)">Preferenze</strong> è possibile riesaminare e modificare liberamente i consensi facoltativi precedentemente espressi (come le preferenze di ricezione di newsletter, aggiornamenti normativi e comunicazioni di prodotto).
          </p>
        </div>

        <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-3">
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
          <h3 className="text-md font-bold uppercase tracking-wider text-(--color-text) mt-1">Trasparenza e Note Legali</h3>
          <p className="text-md text-(--color-muted) font-light leading-relaxed">
            Sono sempre consultabili a fondo pagina i collegamenti diretti alla <Link to="/privacy" className="font-bold underline underline-offset-2 text-(--color-text)">Privacy Policy</Link>, ai <Link to="/termini" className="font-bold underline underline-offset-2 text-(--color-text)">Termini di servizio</Link> e all'informativa estesa sul <Link to="/gdpr" className="font-bold underline underline-offset-2 text-(--color-text)">Trattamento dati (GDPR)</Link>.
          </p>
          <div className="flex items-center gap-3 pt-1 text-md">
            <span className="font-bold uppercase tracking-wider text-(--color-text) text-[10px]">Pulsante Salva:</span>
            <span className="text-(--color-muted) font-light">Rende immediatamente effettive le modifiche apportate.</span>
          </div>
          <div className="flex items-center gap-3 text-md">
            <span className="font-bold uppercase tracking-wider text-(--color-text) text-[10px]">Pulsante Annulla:</span>
            <span className="text-(--color-muted) font-light">Revoca i cambiamenti e torna alla schermata precedente senza sovrascrivere le impostazioni.</span>
          </div>
        </div>        
      </section>
    </div>
  );
}