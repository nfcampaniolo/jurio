import { Link } from 'react-router-dom';

export default function Introduzione() {
  return (
    <div className="space-y-8">
      {/* Intestazione */}
      <div>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="text-md font-bold tracking-widest text-(--color-text) uppercase bg-(--color-surface) border border-(--color-border) px-2.5 py-1 rounded-sm shadow-xs">
            Documentazione Ufficiale
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-medium text-(--color-text) tracking-tight mt-1 mb-2.5" >
          Introduzione a Jurio
        </h1>
        <p className="text-md  text-(--color-muted) font-light leading-relaxed">
          Jurio è un assistente legale virtuale innovativo che combina l'intelligenza artificiale con una vasta banca dati delle Corti Supreme italiane. Progettato specificamente per avvocati e professionisti del settore legale, Jurio trasforma la complessità legale in semplicità operativa.
        </p>
      </div>

      {/* --- PLACEHOLDER IMMAGINE 1 (Overview Piattaforma) --- */}
      <div className="my-4">
          <div className="flex justify-center">
            <img
              src="https://jurio.it/guida-image/introduzione.webp"
              alt="Schermata di autenticazione con opzione Single Sign-On e recupero credenziali"
              loading="lazy"
            />
          </div>
          <p className="text-md text-(--color-muted) font-light mt-2 text-center italic">
              Figura 1: Panoramica dell'interfaccia principale di Jurio.
          </p>
      </div>

      <hr className="border-(--color-border)" />

      {/* Sezione: Cosa Offre Jurio */}
      <section className="space-y-4">
        <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
          Cosa Offre Jurio
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: IA Specializzata */}
          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
            <div className="w-7 h-7 rounded-sm border border-(--color-border) bg-(--color-bg) text-(--color-text) flex items-center justify-center font-bold text-md mt-1 shadow-xs">
              1
            </div>
            <h3 className="text-sm sm:text-base font-medium text-(--color-text) tracking-tight" >
              Intelligenza Artificiale Specializzata
            </h3>
            <ul className="space-y-1.5 text-md text-(--color-muted) font-light leading-relaxed">
              <li className="flex items-start">
                <span className="text-(--color-text) mr-2 font-bold">•</span>
                <span>Tecnologia basata su <strong className="font-semibold text-(--color-text)">Intelligenza Artificiale generativa</strong>, specificamente istruita sulla normativa e giurisprudenza italiana.</span>
              </li>
              <li className="flex items-start">
                <span className="text-(--color-text) mr-2 font-bold">•</span>
                <span>Generazione di contenuti accurati e verificati attraverso le fonti ufficiali.</span>
              </li>
              <li className="flex items-start">
                <span className="text-(--color-text) mr-2 font-bold">•</span>
                <span>Disponibile <strong className="font-semibold text-(--color-text)">24/7</strong> come supporto continuo al lavoro quotidiano.</span>
              </li>
            </ul>
          </div>

          {/* Card 2: Banca Dati Completa */}
          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
            <div className="w-7 h-7 rounded-sm border border-(--color-border) bg-(--color-bg) text-(--color-text) flex items-center justify-center font-bold text-md mt-1 shadow-xs">
              2
            </div>
            <h3 className="text-sm sm:text-base font-medium text-(--color-text) tracking-tight" >
              Banca Dati Completa
            </h3>
            <ul className="space-y-1.5 text-md text-(--color-muted) font-light leading-relaxed">
              <li className="flex items-start">
                <span className="text-(--color-text) mr-2 font-bold">•</span>
                <span>
                  Migliaia di pronunce dalle tre principali fonti giurisprudenziali italiane (Corte di Cassazione, Consiglio di Stato e Corte Costituzionale); il dato di copertura aggiornato è indicato nella sezione <Link to="/fonti" className="font-bold underline underline-offset-2 text-(--color-text)">/fonti</Link>.
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-(--color-text) mr-2 font-bold">•</span>
                <span>Vasta raccolta di massime giuridiche e massime generate con l'intelligenza artificiale.</span>
              </li>
              <li className="flex items-start">
                <span className="text-(--color-text) mr-2 font-bold">•</span>
                <span>Quadro normativo nazionale costantemente aggiornato, tratto direttamente da fonti istituzionali e ufficiali.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* 3. Cosa puoi fare con Jurio */}
        <div className="pt-2">
          <h3 className="text-sm sm:text-base font-medium text-(--color-text) tracking-tight mb-1.5" >3. Cosa puoi fare con Jurio</h3>
          <p className="text-md  text-(--color-muted) font-light mb-3 leading-relaxed">
            All'interno della chat, puoi accedere a tutte le funzionalità di Jurio in modo naturale ed integrato:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
              <h4 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Ricerca Legale</h4>
              <p className="text-md text-(--color-muted) font-light leading-relaxed">
                Ottieni compendi personalizzati di norme, massime e sentenze semplicemente formulando il tuo quesito.
              </p>
            </div>
            <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
              <h4 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Analisi Documentale</h4>
              <p className="text-md text-(--color-muted) font-light leading-relaxed">
                Carica i tuoi documenti per riassumerli, fare domande specifiche, richiedere revisioni o integrazioni di normativa e giurisprudenza a supporto.
              </p>
            </div>
            <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
              <h4 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Redazione Assistita</h4>
              <p className="text-md text-(--color-muted) font-light leading-relaxed">
                Tramite l'integrazione con Microsoft Word, è possibile redigere atti e pareri descrivendo le caratteristiche del documento desiderato. Il sistema genera automaticamente una bozza strutturata pronta per la revisione e la formattazione.
              </p>
            </div>
            <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
              <h4 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Ricerca Avanzata</h4>
              <p className="text-md text-(--color-muted) font-light leading-relaxed">
                Accedi rapidamente a sentenze e massime specifiche attraverso ricerche mirate.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- PLACEHOLDER IMMAGINE 2 (Chat & Word Add-in) --- */}
      <div className="my-4">
          <div className="flex justify-center">
            <img
              src="https://jurio.it/guida-image/add-in.webp"
              alt="Schermata di autenticazione con opzione Single Sign-On e recupero credenziali"
              loading="lazy"
            />
          </div>
          <p className="text-md text-(--color-muted) font-light mt-2 text-center italic">
             Figura 2: Interazione diretta via chat ed elaborazione assistita.
          </p>
      </div>

      <hr className="border-(--color-border)" />

      {/* Sezione Vantaggi Principali */}
      <section className="space-y-4">
        <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
          Vantaggi Principali
        </h2>
        
        <div className="space-y-3.5">
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <h3 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Efficienza Operativa</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Jurio trasforma radicalmente i tempi del tuo lavoro quotidiano. La piattaforma riduce significativamente i tempi di ricerca e analisi, permettendoti di concentrarti sugli aspetti più strategici della tua attività. Grazie all'automazione delle attività ripetitive, puoi dedicare più tempo alle questioni che richiedono la tua expertise professionale. L'accesso immediato alle informazioni necessarie ti permette di prendere decisioni rapide e informate, aumentando significativamente la tua produttività.
            </p>
          </div>

          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <h3 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Accuratezza</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              La qualità delle informazioni è al centro del nostro sistema. Ogni citazione viene verificata e controllata accuratamente, garantendo la massima affidabilità nelle tue ricerche. Le informazioni normative sono costantemente aggiornate per assicurarti di lavorare sempre con le fonti più recenti. Inoltre, tutti i contenuti generati passano attraverso rigorosi controlli di qualità, permettendoti di utilizzare le informazioni con la massima fiducia.
            </p>
          </div>

          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <h3 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Versatilità</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Jurio supporta i principali formati documentali indicati nella sezione <Link to="/guida/analisi-documenti" className="font-bold underline underline-offset-2 text-(--color-text)">Analisi documentale</Link>, entro i limiti tecnici descritti nella guida. Le funzionalità integrate coprono ricerca, analisi e redazione assistita, adattandosi a esigenze professionali diverse.
            </p>
          </div>
        </div>
      </section>

      <hr className="border-(--color-border)" />

      {/* Sezione Come Utilizzare questa Guida */}
      <section className="space-y-2">
        <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight" >
          Come Utilizzare questa Guida
        </h2>
        <p className="text-md  text-(--color-muted) font-light leading-relaxed">
          Questa guida utente è strutturata per accompagnarti nell'utilizzo ottimale di Jurio:
        </p>
        <ul className="space-y-1.5 text-md text-(--color-muted) font-light leading-relaxed">
          <li className="flex items-start">
            <span className="text-(--color-text) mr-2 font-bold">•</span>
            <span><strong className="font-semibold text-(--color-text)">Casi d'uso:</strong> per esplorare le funzionalità operative (ricerca semantica, redazione assistita, analisi documenti, integrazione Word).</span>
          </li>
          <li className="flex items-start">
            <span className="text-(--color-text) mr-2 font-bold">•</span>
            <span><strong className="font-semibold text-(--color-text)">Giurisprudenza:</strong> per consultare le specificità di copertura e interrogazione di Cassazione, Consiglio di Stato e Corte Costituzionale.</span>
          </li>
          <li className="flex items-start">
            <span className="text-(--color-text) mr-2 font-bold">•</span>
            <span><strong className="font-semibold text-(--color-text)">Account & Supporto:</strong> per gestire licenze, workspace di studio, limiti di utilizzo e configurazioni tecniche.</span>
          </li>
        </ul>
      </section>
    </div>
  );
}