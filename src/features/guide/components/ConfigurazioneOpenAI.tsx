import { toast } from "react-hot-toast";
import { FiCopy } from "react-icons/fi";

export default function ConfigurazioneOpenAI() {
  const mcpUrl = "https://jurio.it/mcp";

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(mcpUrl);
    toast.success("URL copiato negli appunti!");
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="text-md font-bold tracking-widest text-(--color-text) uppercase bg-(--color-surface) border border-(--color-border) px-2.5 py-1 rounded-sm shadow-xs">Configurazione</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-(--color-text) bg-(--color-surface) border border-(--color-border) px-2.5 py-0.5 rounded-sm shadow-xs">Integrazione ChatGPT</span>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-medium text-(--color-text) tracking-tight mt-1 mb-2.5">Connessione a ChatGPT</h1>
        <p className="text-md text-(--color-muted) font-light leading-relaxed">
          Collega Jurio a ChatGPT tramite il protocollo MCP (Model Context Protocol) per cercare giurisprudenza direttamente nelle conversazioni. La disponibilità dei connettori MCP personalizzati dipende dal piano e dalle autorizzazioni del tuo account o workspace.
        </p>
      </div>

      <hr className="border-(--color-border)" />

      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5">1. Creazione del connettore MCP</h2>
          <p className="text-md text-(--color-muted) font-light leading-relaxed">Aggiungi il server remoto di Jurio dalla sezione Plugin di ChatGPT. I nomi delle voci possono variare in base all'esperienza attiva nel tuo workspace.</p>
        </div>
        <div className="space-y-3.5 pt-1">
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <h3 className="font-medium text-(--color-text) text-md tracking-tight mt-0.5">Accesso a ChatGPT</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">Accedi a <a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-2 text-(--color-text) hover:text-(--color-primary)">https://chatgpt.com/</a> con l'account o workspace che vuoi collegare.</p>
          </div>
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <h3 className="font-medium text-(--color-text) text-md tracking-tight mt-0.5">Apri la sezione Plugin</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">Apri <strong className="font-semibold text-(--color-text)">Plugin</strong>, seleziona il pulsante <strong className="font-semibold text-(--color-text)">+</strong> e scegli <strong className="font-semibold text-(--color-text)">Aggiungi server MCP personalizzato</strong>. Se la voce non compare, il piano o le impostazioni del workspace potrebbero non consentire la creazione di connettori personalizzati.</p>
          </div>
          <figure className="my-4">
            <div className="flex justify-center"><img src="/guida-image/open_ai_add.webp" alt="Schermata di ChatGPT per aggiungere un server MCP personalizzato" loading="lazy" className="rounded-lg border border-(--color-border) shadow-xs max-w-full" /></div>
            <figcaption className="text-md text-(--color-muted) font-light mt-2 text-center italic">Figura 1: Aggiunta di un server MCP personalizzato dalla sezione Plugin.</figcaption>
          </figure>
          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-2">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
            <h3 className="text-md font-bold uppercase tracking-wider text-(--color-text) mt-1">Parametri del connettore</h3>
            <ul className="space-y-2 text-md text-(--color-muted) font-light leading-relaxed">
              <li>1. Inserisci <strong className="font-semibold text-(--color-text)">Jurio</strong> come nome.</li>
              <li className="flex items-center gap-2 flex-wrap">2. URL endpoint MCP: <button type="button" onClick={handleCopyUrl} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-(--color-border) bg-(--color-bg) hover:border-(--color-text) hover:text-(--color-text) text-(--color-muted) text-sm font-mono transition-colors shadow-xs outline-none" title="Copia URL MCP"><span>{mcpUrl}</span><FiCopy size={12} className="opacity-70" /></button></li>
              <li>3. Configura l'autenticazione richiesta dal server, quindi conferma l'avviso di sicurezza e crea il connettore.</li>
            </ul>
          </div>
          <figure className="my-4">
            <div className="flex justify-center"><img src="/guida-image/open_ai_config_1.webp" alt="Configurazione del nome e dell'endpoint MCP di Jurio in ChatGPT" loading="lazy" className="rounded-lg border border-(--color-border) shadow-xs max-w-full" /></div>
            <figcaption className="text-md text-(--color-muted) font-light mt-2 text-center italic">Figura 2: Inserimento del nome Jurio e dell'endpoint MCP.</figcaption>
          </figure>
        </div>
      </section>

      <hr className="border-(--color-border)" />

      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5">2. Autorizzazione e verifica</h2>
          <p className="text-md text-(--color-muted) font-light leading-relaxed">Completa il collegamento OAuth e controlla gli strumenti disponibili prima di usare il connettore.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden"><div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" /><h3 className="font-medium text-(--color-text) text-md tracking-tight mt-0.5">Autorizzazione OAuth</h3><p className="text-md text-(--color-muted) font-light leading-relaxed mt-1">Se richiesto, completa l'accesso a Jurio nella finestra di autorizzazione. Attendi che ChatGPT termini la scansione degli strumenti e salva la configurazione.</p></div>
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden"><div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" /><h3 className="font-medium text-(--color-text) text-md tracking-tight mt-0.5">Prova in una chat</h3><p className="text-md text-(--color-muted) font-light leading-relaxed mt-1">Avvia una conversazione, seleziona Jurio tra gli strumenti disponibili e prova: <em>«Cerca su Jurio sentenze della Cassazione sul licenziamento disciplinare»</em>. Esamina i risultati e conferma le richieste di utilizzo degli strumenti quando compaiono.</p></div>
        </div>
        <figure className="my-4">
          <div className="flex justify-center"><img src="/guida-image/open_ai_config_2.webp" alt="Schermata di autorizzazione OAuth e verifica degli strumenti MCP" loading="lazy" className="rounded-lg border border-(--color-border) shadow-xs max-w-full" /></div>
          <figcaption className="text-md text-(--color-muted) font-light mt-2 text-center italic">Figura 3: Autorizzazione OAuth e scansione degli strumenti disponibili.</figcaption>
        </figure>
        <figure className="my-4">
          <div className="flex justify-center"><img src="/guida-image/open_ai_config_3.webp" alt="ChatGPT con Jurio selezionato tra gli strumenti di una conversazione" loading="lazy" className="rounded-lg border border-(--color-border) shadow-xs max-w-full" /></div>
          <figcaption className="text-md text-(--color-muted) font-light mt-2 text-center italic">Figura 4: Selezione di Jurio e verifica del connettore in una chat.</figcaption>
        </figure>
        <p className="text-sm text-(--color-muted) font-light">Se non puoi creare il connettore, chiedi all'amministratore del workspace di verificare piano, autorizzazioni e impostazioni MCP. Per assistenza, visita <a href="/contatti" className="font-bold underline underline-offset-2 text-(--color-text) hover:text-(--color-primary)">/contatti</a>.</p>
      </section>
    </div>
  );
}
