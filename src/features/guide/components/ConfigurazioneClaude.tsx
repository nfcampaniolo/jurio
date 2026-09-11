import { toast } from "react-hot-toast";
import { FiCopy } from "react-icons/fi";

export default function ConfigurazioneClaude() {
  const mcpUrl = "https://jurio.it/mcp";

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(mcpUrl);
    toast.success("URL copiato negli appunti!");
  };

  return (
    <div className="space-y-8">
      {/* Intestazione Sezione */}
      <div>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="text-md font-bold tracking-widest text-(--color-text) uppercase bg-(--color-surface) border border-(--color-border) px-2.5 py-1 rounded-sm shadow-xs">
            Configurazione
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-(--color-text) bg-(--color-surface) border border-(--color-border) px-2.5 py-0.5 rounded-sm shadow-xs">
            Integrazione Claude
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-medium text-(--color-text) tracking-tight mt-1 mb-2.5">
          Connessione a Claude
        </h1>
        <p className="text-md text-(--color-muted) font-light leading-relaxed">
          Questa guida illustra i passaggi per integrare Jurio all'interno di Claude utilizzando il protocollo MCP (Model Context Protocol) e l'autenticazione tramite <strong className="font-semibold text-(--color-text)">OAuth2</strong>.
        </p>
      </div>

      <hr className="border-(--color-border)" />

      {/* SEZIONE 1: Aggiunta del Connettore */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5">
            1. Creazione del connettore MCP
          </h2>
          <p className="text-md text-(--color-muted) font-light leading-relaxed">
            Aggiungi Jurio come server MCP esterno direttamente all'interno delle impostazioni di Claude.ai.
          </p>
        </div>

        {/* Passaggi Creazione */}
        <div className="space-y-3.5 pt-1">
          {/* Step 1: Login Claude */}
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <h3 className="font-medium text-(--color-text) text-md tracking-tight mt-0.5">Accesso a Claude</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Accedi al tuo account su{" "}
              <a
                href="https://claude.ai/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold underline underline-offset-2 text-(--color-text) hover:text-(--color-primary)"
              >
                https://claude.ai/
              </a>.
            </p>
          </div>

          {/* Step 2: Navigazione Impostazioni */}
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <h3 className="font-medium text-(--color-text) text-md tracking-tight mt-0.5">Navigazione nelle impostazioni</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Vai nella sezione <strong className="font-semibold text-(--color-text)">Personalizza</strong> dalla barra laterale, seleziona la tab <strong className="font-semibold text-(--color-text)">Connettori</strong> e clicca su <strong className="font-semibold text-(--color-text)">Aggiungi</strong> (o <em>Aggiungi connettore personalizzato</em>).
            </p>
          </div>

          {/* IMMAGINE 1: Directory Connettori */}
          <div className="my-4">
            <div className="flex justify-center">
              <img
                src="https://jurio.it/guida-image/claude_1.webp"
                alt="Schermata della directory dei connettori su Claude"
                loading="lazy"
                className="rounded-lg border border-(--color-border) shadow-xs max-w-full"
              />
            </div>
            <p className="text-md text-(--color-muted) font-light mt-2 text-center italic">
              Figura 1: Accesso alla sezione Connettori e pulsante di aggiunta.
            </p>
          </div>

          {/* Step 3: Parametri Iniziali */}
          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
            <h3 className="text-md font-bold uppercase tracking-wider text-(--color-text) mt-1">Parametri Iniziali</h3>
            <ul className="space-y-2 text-md text-(--color-muted) font-light leading-relaxed">
              <li className="flex items-start">
                <span className="text-(--color-text) mr-2 font-bold">1.</span>
                <span>Inserisci <strong className="font-semibold text-(--color-text)">Jurio</strong> nel campo nome.</span>
              </li>
              <li className="flex items-center gap-2 flex-wrap">
                <span className="text-(--color-text) mr-2 font-bold">2.</span>
                <span>URL Server:</span>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-(--color-border) bg-(--color-bg) hover:border-(--color-text) hover:text-(--color-text) text-(--color-muted) text-sm font-mono transition-colors shadow-xs outline-none"
                  title="Copia URL MCP"
                >
                  <span>{mcpUrl}</span>
                  <FiCopy size={12} className="opacity-70" />
                </button>
              </li>
              <li className="flex items-start">
                <span className="text-(--color-text) mr-2 font-bold">3.</span>
                <span>Clicca su <strong className="font-semibold text-(--color-text)">Continua</strong>.</span>
              </li>
            </ul>
          </div>

          {/* IMMAGINE 2: Modale di inserimento URL e Nome */}
          <div className="my-4">
            <div className="flex justify-center">
              <img
                src="https://jurio.it/guida-image/mcp_claude_1.webp"
                alt="Modale di inserimento dei dati del connettore Jurio"
                loading="lazy"
                className="rounded-lg border border-(--color-border) shadow-xs max-w-full"
              />
            </div>
            <p className="text-md text-(--color-muted) font-light mt-2 text-center italic">
              Figura 2: Inserimento del nome e dell'URL del server MCP.
            </p>
          </div>

          {/* Step 4: Autenticazione e Client OAuth */}
          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
            <h3 className="text-md font-bold uppercase tracking-wider text-(--color-text) mt-1">Impostazioni di Autenticazione</h3>
            <ul className="space-y-1.5 text-md text-(--color-muted) font-light leading-relaxed">
              <li className="flex items-start">
                <span className="text-(--color-text) mr-2 font-bold">1.</span>
                <span>Alla voce <strong className="font-semibold text-(--color-text)">Autenticazione</strong>, seleziona spuntando <strong className="font-semibold text-(--color-text)">Richiesto quando il server lo richiede</strong> (consigliato) oppure <em>Sempre obbligatorio</em>.</span>
              </li>
              <li className="flex items-start">
                <span className="text-(--color-text) mr-2 font-bold">2.</span>
                <span>Nella sezione <strong className="font-semibold text-(--color-text)">Client OAuth</strong>, seleziona <strong className="font-semibold text-(--color-text)">Nessun client ID — registratene uno automaticamente</strong> (sfrutta la registrazione dinamica del server) oppure imposta un client personalizzato se richiesto.</span>
              </li>
              <li className="flex items-start">
                <span className="text-(--color-text) mr-2 font-bold">3.</span>
                <span>Conferma e salva la configurazione.</span>
              </li>
            </ul>
          </div>

          {/* IMMAGINE 3: Selezione Autenticazione e Client OAuth */}
          <div className="my-4">
            <div className="flex justify-center">
              <img
                src="https://jurio.it/guida-image/mcp_claude_2.webp"
                alt="Schermata di selezione delle opzioni di autenticazione e Client OAuth"
                loading="lazy"
                className="rounded-lg border border-(--color-border) shadow-xs max-w-full"
              />
            </div>
            <p className="text-md text-(--color-muted) font-light mt-2 text-center italic">
              Figura 3: Configurazione dei permessi di autenticazione e della registrazione OAuth.
            </p>
          </div>
        </div>
      </section>

      <hr className="border-(--color-border)" />

      {/* SEZIONE 2: Connessione e Utilizzo */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5">
            2. Connessione e Autorizzazione
          </h2>
          <p className="text-md text-(--color-muted) font-light leading-relaxed">
            Una volta completato il salvataggio, il connettore richiederà l'attivazione dell'account utente.
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
            {/* Pulsante Collega */}
            <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
              <h3 className="font-medium text-(--color-text) text-md tracking-tight mt-0.5">
                Il pulsante "Collega"
              </h3>
              <p className="text-md text-(--color-muted) font-light leading-relaxed mt-1">
                Nella schermata dei connettori vedrai la scheda di Jurio con lo stato <strong className="font-semibold text-(--color-text)">"Non sei ancora connesso a Jurio"</strong>. Clicca sul pulsante <strong className="font-semibold text-(--color-text)">Collega</strong> per avviare il reindirizzamento al login protetto.
              </p>
            </div>

            {/* Autorizzazione Tools */}
            <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
              <h3 className="font-medium text-(--color-text) text-md tracking-tight mt-0.5">
                Operatività
              </h3>
              <p className="text-md text-(--color-muted) font-light leading-relaxed mt-1">
                Dopo aver effettuato l'accesso sulla pagina di Jurio, il token verrà registrato e Claude potrà interrogare la banca dati giuridica in totale autonomia.
              </p>
            </div>
          </div>

          {/* IMMAGINE 4: Schermata "Non sei ancora connesso" con tasto Collega */}
          <div className="my-4">
            <div className="flex justify-center">
              <img
                src="https://jurio.it/guida-image/mcp_claude_3.webp"
                alt="Schermata di Claude con il pulsante Collega il connettore Jurio"
                loading="lazy"
                className="rounded-lg border border-(--color-border) shadow-xs max-w-full"
              />
            </div>
            <p className="text-md text-(--color-muted) font-light mt-2 text-center italic">
              Figura 4: Schermata finale con il pulsante "Collega" per attivare la sessione OAuth.
            </p>
          </div>

          {/* Supporto / Contatti */}
          <div className="px-1 text-sm text-(--color-muted) font-light">
            Hai riscontrato problemi durante la procedura di collegamento OAuth? Visita la pagina{" "}
            <a
              href="/contatti"
              className="font-semibold underline underline-offset-2 text-(--color-text) hover:text-(--color-primary) transition-colors"
            >
              /contatti
            </a>{" "}
            per ricevere assistenza immediata.
          </div>
        </div>
      </section>
    </div>
  );
}