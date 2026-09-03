import { Link } from 'react-router-dom';

export default function ProvaGratuita() {
  return (
    <div className="space-y-8">
      {/* Intestazione Sezione */}
      <div>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="text-md font-bold tracking-widest text-(--color-text) uppercase bg-(--color-surface) border border-(--color-border) px-2.5 py-1 rounded-sm shadow-xs">
            3. Account
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-(--color-text) bg-(--color-surface) border border-(--color-border) px-2.5 py-0.5 rounded-sm shadow-xs">
            7 Giorni di Prova Completa
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-(--color-text) bg-(--color-surface) border border-(--color-border) px-2.5 py-0.5 rounded-sm shadow-xs">
            Nessuna Carta di Credito
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-medium text-(--color-text) tracking-tight mt-1 mb-2.5" >
          Periodo di Prova Gratuita
        </h1>
        <p className="text-md  text-(--color-muted) font-light leading-relaxed">
          Al termine della registrazione si attiva automaticamente una finestra di <strong className="font-semibold text-(--color-text)">prova gratuita di 7 giorni</strong>. Per accedere alla prova non è richiesta alcuna carta di credito né l'inserimento di metodi di pagamento, escludendo a monte qualsiasi vincolo o addebito alla scadenza.
        </p>
      </div>

      <hr className="border-(--color-border)" />

      {/* SEZIONE: Funzionalità Business Sbloccate */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            Funzionalità Incluse nel Trial
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            Durante l'intero periodo di prova, l'utente può usufruire dell'applicativo con <strong className="font-semibold text-(--color-text)">tutte le funzionalità attive</strong>, esattamente come se fosse in possesso del Piano Business:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <div className="flex items-center gap-2.5 mt-0.5">
              <span className="w-5 h-5 rounded-sm border border-(--color-border) bg-(--color-bg) text-(--color-text) flex items-center justify-center font-bold text-md shadow-xs">1</span>
              <h3 className="font-medium text-(--color-text) text-md  tracking-tight" >Ricerca Semantica e Nomofilattica</h3>
            </div>
            <p className="text-md text-(--color-muted) font-light leading-relaxed pl-7">
              Interrogazione illimitata e completa della banca dati delle Corti Supreme (Cassazione, Consiglio di Stato, Corte Costituzionale) in linguaggio naturale.
            </p>
          </div>

          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <div className="flex items-center gap-2.5 mt-0.5">
              <span className="w-5 h-5 rounded-sm border border-(--color-border) bg-(--color-bg) text-(--color-text) flex items-center justify-center font-bold text-md shadow-xs">2</span>
              <h3 className="font-medium text-(--color-text) text-md  tracking-tight" >Consulente Legale & Fascicoli</h3>
            </div>
            <p className="text-md text-(--color-muted) font-light leading-relaxed pl-7">
              Ambiente interattivo completo con creazione di fascicoli di studio persistenti, thread di discussione dedicati e sessioni guidate con citazione puntuale delle fonti.
            </p>
          </div>

          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <div className="flex items-center gap-2.5 mt-0.5">
              <span className="w-5 h-5 rounded-sm border border-(--color-border) bg-(--color-bg) text-(--color-text) flex items-center justify-center font-bold text-md shadow-xs">3</span>
              <h3 className="font-medium text-(--color-text) text-md  tracking-tight" >Analisi Documentale, OCR & Trascrizioni</h3>
            </div>
            <p className="text-md text-(--color-muted) font-light leading-relaxed pl-7">
              Upload di file esterni in qualsiasi formato supportato, motore OCR per scansioni/PDF, trascrizione automatica di registrazioni MP3 e configurazione del <Link to="/profilo/prompt-builder#crea" className="font-bold underline underline-offset-2 text-(--color-text)">Prompt Builder</Link>.
            </p>
          </div>

          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <div className="flex items-center gap-2.5 mt-0.5">
              <span className="w-5 h-5 rounded-sm border border-(--color-border) bg-(--color-bg) text-(--color-text) flex items-center justify-center font-bold text-md shadow-xs">4</span>
              <h3 className="font-medium text-(--color-text) text-md  tracking-tight" >Verifica Coerenza & Redazione Assistita</h3>
            </div>
            <p className="text-md text-(--color-muted) font-light leading-relaxed pl-7">
              Confronto sistematico tra atti difensivi e giurisprudenza prevalente, con supporto alla generazione di bozze strutturate e integrazione con gli strumenti di drafting.
            </p>
          </div>
        </div>

        {/* --- PLACEHOLDER IMMAGINE 1 (Dashboard durante la prova) --- */}
        <div className="my-4">
          <div className="flex justify-center">
            <img
              src="https://jurio.it/guida-image/prova.webp"
              alt="Schermata di autenticazione con opzione Single Sign-On e recupero credenziali"
              loading="lazy"
            />
          </div>
          <p className="text-md text-(--color-muted) font-light mt-2 text-center italic">
            Figura 1: Stato dell'account durante i 7 giorni di prova con accesso completo a tutti i moduli.
          </p>
        </div>
        
      </section>

      <hr className="border-(--color-border)" />

      {/* SEZIONE: Scadenza e Nessun Vincolo */}
      <section className="space-y-4">
        <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1" >
          Cosa Succede alla Scadenza dei 7 Giorni
        </h2>
        
        <div className="relative p-5 sm:p-6 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-3">
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
          <h3 className="text-md font-bold uppercase tracking-wider text-(--color-text) mt-1">Nessun Rinnovo o Addebito Automatico</h3>
          <p className="text-md text-(--color-muted) font-light leading-relaxed">
            Allo scadere dei 7 giorni, il periodo di prova si conclude senza alcuna transazione economica. 
          </p>
          <ul className="text-md text-(--color-muted) font-light space-y-1.5 leading-relaxed">
            <li>• <strong className="font-semibold text-(--color-text)">Conservazione dei Dati:</strong> L'utente mantiene sempre l'accesso al proprio archivio personale per consultare e scaricare i documenti precedentemente elaborati.</li>
            <li>• <strong className="font-semibold text-(--color-text)">Scelta in Autonomia:</strong> Sarà possibile scegliere in qualsiasi momento se acquistare una licenza d'uso (Essential o Business) per proseguire le attività operative quotidiane, senza perdita di storico.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}