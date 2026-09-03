export default function ConsiglioStato() {
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
          Consiglio di Stato
        </h1>
        <p className="text-md  text-(--color-muted) font-light leading-relaxed">
          Il <strong className="font-semibold text-(--color-text)">Consiglio di Stato</strong> è il massimo organo della giustizia amministrativa italiana. Decide le controversie in grado d'appello tra cittadini, imprese e Pubblica Amministrazione, svolgendo inoltre funzioni consultive di rilievo costituzionale.
        </p>
      </div>

      <hr className="border-(--color-border)" />

      {/* Articolazione delle Sezioni Giurisdizionali */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1" >
            Articolazione delle Sezioni Giurisdizionali
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            La banca dati indicizza i provvedimenti delle sezioni giurisdizionali e le decisioni dell'Adunanza Plenaria:
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <span className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5 block" >Sezione II</span>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">Ricorsi straordinari al Presidente della Repubblica e ulteriori funzioni giurisdizionali.</p>
          </div>
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <span className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5 block" >Sezione III</span>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">Sanità, assistenza sociale, diritto dell'immigrazione e misure interdittive antimafia.</p>
          </div>
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <span className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5 block" >Sezione IV</span>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">Urbanistica, governo del territorio, edilizia, espropriazioni e tutela dell'ambiente.</p>
          </div>
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <span className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5 block" >Sezione V</span>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">Appalti pubblici, contratti pubblici, procedure di gara e concessioni.</p>
          </div>
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <span className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5 block" >Sezione VI</span>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">Università, istruzione, energia, provvedimenti delle Autorità Indipendenti (Antitrust, Privacy) e beni culturali.</p>
          </div>
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <span className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5 block" >Sezione VII</span>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">Smaltimento dell'arretrato e trattazione di materie trasversali di giustizia amministrativa.</p>
          </div>
        </div>

        {/* Adunanza Plenaria */}
        <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-2 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
          <span className="inline-block text-md font-bold text-(--color-text) uppercase tracking-widest bg-(--color-bg) border border-(--color-border) px-2 py-0.5 rounded-sm shadow-xs mt-1">
            Nomofilachia Amministrativa
          </span>
          <h3 className="text-sm sm:text-base font-medium text-(--color-text) tracking-tight" >Adunanza Plenaria</h3>
          <p className="text-md text-(--color-muted) font-light leading-relaxed">
            È l'organo nomofilattico supremo della magistratura amministrativa. Risolve i contrasti giurisprudenziali tra le singole sezioni e definisce i principi di diritto vincolanti per la successiva trattazione delle questioni di massima importanza.
          </p>
        </div>

        {/* --- PLACEHOLDER IMMAGINE 1 (Consiglio di Stato) --- */}
        <div className="my-4">
          <div className="flex justify-center">
            <img
              src="https://jurio.it/guida-image/consiglio.webp"
              alt="Schermata di autenticazione con opzione Single Sign-On e recupero credenziali"
              loading="lazy"
            />
          </div>
          <p className="text-md text-(--color-muted) font-light mt-2 text-center italic">
            Figura 1: Consultazione delle decisioni e dei principi di diritto del Consiglio di Stato.
          </p>
        </div>
      </section>

      <hr className="border-(--color-border)" />

      {/* Monitoraggio Orientamenti */}
      <section className="space-y-2">
        <h3 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight" >Analisi e Ricerca Semantica</h3>
        <p className="text-md  text-(--color-muted) font-light leading-relaxed">
          Grazie all'indicizzazione continua delle decisioni depositate dal 2021 ad oggi, il motore semantico di Jurio consente di rintracciare orientamenti consolidati, contrasti di merito e recenti <em>revirement</em> nell'ambito del diritto amministrativo e degli appalti.
        </p>
      </section>
    </div>
  );
}