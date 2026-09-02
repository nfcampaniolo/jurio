import { Link } from 'react-router-dom';

export default function Cassazione() {
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
          Corte Suprema di Cassazione
        </h1>
        <p className="text-md  text-(--color-muted) font-light leading-relaxed">
          La Corte di Cassazione costituisce il vertice della giurisdizione ordinaria e il nucleo principale dell'archivio integrato. L'indicizzazione copre integralmente le sentenze, le ordinanze e i principi di diritto delle sezioni civili e penali.
        </p>
      </div>

      <hr className="border-(--color-border)" />

      {/* SEZIONE CIVILE */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1" >
            Corte di Cassazione - Sezioni Civili
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            In ambito civile assicura l'uniforme interpretazione della legge e la corretta applicazione delle norme nei rapporti tra privati e con la Pubblica Amministrazione.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <span className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5 block" >Prima Sezione Civile</span>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">Diritto di famiglia, stato delle persone, diritto d'autore, diritto bancario e procedure concorsuali.</p>
          </div>
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <span className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5 block" >Seconda Sezione Civile</span>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">Proprietà, diritti reali, successioni, condominio e responsabilità professionale.</p>
          </div>
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <span className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5 block" >Terza Sezione Civile</span>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">Responsabilità civile, risarcimento del danno, assicurazioni, locazioni e contratti atipici.</p>
          </div>
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <span className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5 block" >Quarta Sezione Civile (Lavoro)</span>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">Diritto del lavoro, previdenza sociale e pubblico impiego contrattualizzato.</p>
          </div>
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <span className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5 block" >Quinta Sezione Civile (Tributaria)</span>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">Controversie tra contribuenti e amministrazione finanziaria.</p>
          </div>
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <span className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5 block" >Sesta Sezione Civile</span>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">Valuta preliminarmente l'ammissibilità dei ricorsi e svolge funzione di filtro.</p>
          </div>
        </div>

        <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden text-md text-(--color-muted) font-light">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
          <span className="font-bold uppercase tracking-wider text-(--color-text) block mb-0.5 text-[10px]">Sezioni Unite Civili:</span>
          Risolvono contrasti interpretativi tra le sezioni ordinarie e decidono questioni di massima e particolare importanza.
        </div>
      </section>

      {/* --- PLACEHOLDER IMMAGINE 1 (Ricerca Cassazione) --- */}
      <div className="my-4">
          <div className="flex justify-center">
            <img
              src="https://jurio.it/guida-image/cassazione.webp"
              alt="Schermata di autenticazione con opzione Single Sign-On e recupero credenziali"
              loading="lazy"
            />
          </div>
          <p className="text-md text-(--color-muted) font-light mt-2 text-center italic">
          Figura 1: Interrogazione del repertorio delle Sezioni Civili e Penali della Suprema Corte.
          </p>
        </div>

      <hr className="border-(--color-border)" />

      {/* SEZIONE PENALE */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1" >
            Corte di Cassazione - Sezioni Penali
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            In materia penale verifica la corretta applicazione delle norme sostanziali e processuali, senza rivalutare i fatti accertati nei gradi di merito.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <span className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5 block" >Prima Sezione Penale</span>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">Omicidi, criminalità organizzata, misure di prevenzione ed esecuzione penale.</p>
          </div>
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <span className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5 block" >Seconda Sezione Penale</span>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">Furti, rapine, reati contro il patrimonio e reati informatici.</p>
          </div>
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <span className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5 block" >Terza Sezione Penale</span>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">Reati ambientali, urbanistici, tributari e delitti contro la libertà sessuale.</p>
          </div>
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <span className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5 block" >Quarta Sezione Penale</span>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">Responsabilità medica, infortuni sul lavoro e reati colposi da circolazione stradale.</p>
          </div>
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <span className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5 block" >Quinta Sezione Penale</span>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">Reati contro la persona, diffamazione, reati fallimentari e a mezzo stampa.</p>
          </div>
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <span className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5 block" >Sesta Sezione Penale</span>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">Reati contro la Pubblica Amministrazione e contro l'amministrazione della giustizia.</p>
          </div>
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <span className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5 block" >Settima Sezione Penale</span>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">Filtro per l'inammissibilità dei ricorsi penali.</p>
          </div>
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <span className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5 block" >Sezione Feriale</span>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">Gestione delle questioni urgenti e con termini in scadenza durante la sospensione estiva.</p>
          </div>
        </div>

        <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden text-md text-(--color-muted) font-light">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
          <span className="font-bold uppercase tracking-wider text-(--color-text) block mb-0.5 text-[10px]">Sezioni Unite Penali:</span>
          Garantiscono l'uniformità interpretativa e dirimono i contrasti giurisprudenziali tra le singole sezioni ordinarie.
        </div>
      </section>

      <hr className="border-(--color-border)" />

      {/* Indicizzazione */}
      <section className="space-y-2">
        <h3 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight" >Criteri di Indicizzazione dei Provvedimenti</h3>
        <p className="text-md  text-(--color-muted) font-light leading-relaxed">
          Tutti i depositi vengono catalogati per <strong className="font-semibold text-(--color-text)">Organo e Sezione</strong>, <strong className="font-semibold text-(--color-text)">Tipologia di Atto</strong> (sentenza, ordinanza, decreto) e <strong className="font-semibold text-(--color-text)">Materia/Profilo Giuridico</strong>. I dati di copertura aggiornati in tempo reale sono consultabili alla pagina <Link to="/fonti" className="font-bold underline underline-offset-2 text-(--color-text)">/fonti</Link>.
        </p>
      </section>
    </div>
  );
}