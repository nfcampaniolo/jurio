import { toast } from "react-hot-toast";
import { FiCopy } from "react-icons/fi"; 

export default function ConfigurazioneLeChat() {
  return (
    <div className="space-y-8">
      {/* Intestazione Sezione */}
      <div>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="text-md font-bold tracking-widest text-(--color-text) uppercase bg-(--color-surface) border border-(--color-border) px-2.5 py-1 rounded-sm shadow-xs">
            Configurazione
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-(--color-text) bg-(--color-surface) border border-(--color-border) px-2.5 py-0.5 rounded-sm shadow-xs">
            Integrazione Vibe
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-medium text-(--color-text) tracking-tight mt-1 mb-2.5">
          Connessione a Vibe
        </h1>
        <p className="text-md text-(--color-muted) font-light leading-relaxed">
          Questa guida illustra i passaggi per integrare Jurio all'interno di Vibe utilizzando il protocollo MCP (Model Context Protocol). L'integrazione richiede la creazione di un connettore personalizzato e l'autenticazione tramite <strong className="font-semibold text-(--color-text)">Token</strong>.
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
            Il primo passo consiste nel dichiarare Jurio come fonte di strumenti aggiuntivi direttamente all'interno delle impostazioni di Vibe.
          </p>
        </div>

      
        {/* Passaggi Creazione */}
        <div className="space-y-3.5 pt-1">
          {/* Step 1: Login Mistral */}
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <h3 className="font-medium text-(--color-text) text-md tracking-tight mt-0.5">Accesso alla Piattaforma</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Prima di tutto, è necessario effettuare il login. Vai su <a href="https://console.mistral.ai/" target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-2 text-(--color-text) hover:text-(--color-primary)">https://console.mistral.ai/</a> e accedi con le tue credenziali.
            </p>
          </div>

          {/* Step 2: Navigazione */}
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <h3 className="font-medium text-(--color-text) text-md tracking-tight mt-0.5">Navigazione nel menu</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Una volta effettuato l'accesso, nella sidebar laterale di Vibe individua ed espandi la voce <strong className="font-semibold text-(--color-text)">Contesto</strong>, quindi clicca su <strong className="font-semibold text-(--color-text)">Connettori</strong>. Nella pagina che si aprirà, fai clic sul pulsante <strong className="font-semibold text-(--color-text)">+ Aggiungi connettore</strong> situato in alto a destra.
            </p>
          </div>

          {/* Step 3: Parametri */}
          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
            <h3 className="text-md font-bold uppercase tracking-wider text-(--color-text) mt-1">Parametri del Connettore</h3>
            <ul className="space-y-1.5 text-md text-(--color-muted) font-light leading-relaxed">
              <li className="flex items-start">
                <span className="text-(--color-text) mr-2 font-bold">1.</span>
                <span>Seleziona la tab <strong className="font-semibold text-(--color-text)">Connettore MCP personalizzato</strong>.</span>
              </li>
              <li className="flex items-start">
                <span className="text-(--color-text) mr-2 font-bold">2.</span>
                <span>Inserisci <strong className="font-semibold text-(--color-text)">Jurio</strong> nel campo nome.</span>
              </li>
              <li className="flex items-start">
                <span className="text-(--color-text) mr-2 font-bold">3.</span>
                <span>Inserisci l'URL del server (es. <strong className="font-semibold text-(--color-text)">https://juriomcpserver-vqoobrenua-ew.a.run.app</strong>).</span>
              </li>
              <li className="flex items-start">
                <span className="text-(--color-text) mr-2 font-bold">4.</span>
                <span>Clicca su <strong className="font-semibold text-(--color-text)">Crea</strong> per confermare l'operazione.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>
      {/* --- PLACEHOLDER IMMAGINE 1 (Screenshot Connettori) --- */}
        <div className="my-4">
          <div className="flex justify-center">
            <img
              src="https://jurio.it/guida-image/vibe_1.webp"
              alt="Schermata delle impostazioni di Vibe per l'aggiunta di un nuovo connettore MCP"
              loading="lazy"
            />
          </div>
          <p className="text-md text-(--color-muted) font-light mt-2 text-center italic">
            Figura 1: Aggiunta di un nuovo connettore personalizzato dalla sezione Contesto.
          </p>
        </div>
      <hr className="border-(--color-border)" />

      {/* SEZIONE 2: Autenticazione e Permessi */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5">
            2. Autenticazione Token e Permessi
          </h2>
          <p className="text-md text-(--color-muted) font-light leading-relaxed">
            Affinché Vibe possa comunicare in modo sicuro con Jurio, è necessario configurare l'autenticazione tramite Token e concedere le autorizzazioni di esecuzione.
          </p>
        </div>
     {/* --- PLACEHOLDER IMMAGINE 1 (Screenshot Connettori) --- */}
        <div className="my-4">
          <div className="flex justify-center">
            <img
              src="https://jurio.it/guida-image/vibe_2.webp"
              alt="Schermata delle impostazioni di Vibe per l'aggiunta di un nuovo connettore MCP"
              loading="lazy"
            />
          </div>
          <p className="text-md text-(--color-muted) font-light mt-2 text-center italic">
            Figura 2: Configurazione Token di Autenticazione
          </p>
        </div>
      {/* Passaggi Autenticazione e Tool */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
            
            {/* Autenticazione (Configurazione Header) */}
            <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
              <h3 className="font-medium text-(--color-text) text-md tracking-tight mt-0.5">
                Configurazione Intestazione
              </h3>
              <div className="text-md text-(--color-muted) font-light leading-relaxed mt-1">
                In fase di configurazione, per autorizzare la connessione, devi <strong className="font-semibold text-(--color-text)">assolutamente</strong> aggiungere un'intestazione personalizzata:
                <ul className="list-disc list-inside mt-2 space-y-2 ml-1">
                  <li className="flex items-center gap-2">
                    <span className="font-semibold text-(--color-text)">Intestazione connessione:</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText("Authorization");
                        toast.success("Authorization copiato!");
                      }}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-(--color-border) bg-(--color-bg) hover:border-(--color-text) hover:text-(--color-text) text-(--color-muted) text-sm font-mono transition-colors shadow-xs outline-none"
                      title="Copia 'Authorization'"
                    >
                      <span>Authorization</span>
                      <FiCopy size={12} className="opacity-70" />
                    </button>
                  </li>
                  <li>
                    <span className="font-semibold text-(--color-text)">Valore:</span> inserisci il token segreto copiato dal tuo{' '}
                    <a 
                      href="https://jurio.it/profilo/modifica" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="font-bold underline underline-offset-2 text-(--color-text) hover:text-(--color-primary) transition-colors"
                    >
                      /profilo
                    </a>.
                  </li>
                </ul>
              </div>
            </div>

            {/* Autorizzazione Tools */}
            <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
              <h3 className="font-medium text-(--color-text) text-md tracking-tight mt-0.5">
                Approvazione dei Tool
              </h3>
              <p className="text-md text-(--color-muted) font-light leading-relaxed mt-1">
                Durante l'utilizzo, se Vibe ti chiede di approvare le chiamate ai tool, assicurati di <strong className="font-semibold text-(--color-text)">consentire l'esecuzione</strong>. Questo permetterà all'assistente di effettuare ricerche e operazioni utilizzando Jurio direttamente all'interno della conversazione.
              </p>
            </div>
          </div>
          
          {/* Supporto / Contatti */}
          <div className="px-1 text-sm text-(--color-muted) font-light">
            Hai difficoltà con la configurazione o il token restituisce errore? Visita la pagina{' '}
            <a 
              href="/contatti" 
              className="font-semibold underline underline-offset-2 text-(--color-text) hover:text-(--color-primary) transition-colors"
            >
              /contatti
            </a>{' '}
            per ricevere supporto o per qualsiasi evenienza.
          </div>
        </div>
         {/* --- PLACEHOLDER IMMAGINE 1 (Screenshot Connettori) --- */}
        <div className="my-4">
          <div className="flex justify-center">
            <img
              src="https://jurio.it/guida-image/vibe.webp"
              alt="Schermata delle impostazioni di Vibe per l'aggiunta di un nuovo connettore MCP"
              loading="lazy"
            />
          </div>
          <p className="text-md text-(--color-muted) font-light mt-2 text-center italic">
            Figura 3: Vista Vibe con connettore Jurio
          </p>
        </div>
      </section>
    </div>
  );
}