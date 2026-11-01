import { Loader2 } from "lucide-react";
import { useContentUploader } from  "../hooks/admin";

export default function FirebaseManual() {
  const {
    id, 
    setId,
    text,
    setText,
    linksText,
    setLinksText,
    images,
    setImages,
    status,
    errorMessage,
    handleUpload,
  } = useContentUploader();

  return (
    <section
      id="manual-uploader-section"
      className="relative border border-(--color-border) rounded-lg p-6 md:p-8 bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden"
    >
      {/* LINEA DI RIGORE SUPERIORE */}
      <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

      <div className="mb-6 mt-1">
        <h2 className="text-xl sm:text-2xl font-medium text-(--color-text) tracking-tight mb-2" style={{ fontFamily: 'var(--font-serif)' }}>
          Nuovo Elemento Manuale
        </h2>
        <p className="text-xs sm:text-sm text-(--color-muted) font-light leading-relaxed">
          Compila tutti i campi sottostanti. I link multipli possono essere inseriti andando a capo per ognuno.
        </p>
      </div>

      <div className="space-y-4 mb-6">
        {/* INPUT ID */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-(--color-text) mb-1.5">
            ID (Identificativo Univoco)
          </label>
          <input
            type="text"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="es. doc-analisi-123"
            className="w-full p-3 font-mono text-xs sm:text-sm bg-(--color-bg) text-(--color-text) rounded-md border border-(--color-border) outline-none focus:border-(--color-text) shadow-xs transition-colors placeholder:text-(--color-muted)"
          />
        </div>

        {/* INPUT TEXT */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-(--color-text) mb-1.5">
            Testo Principale
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Inserisci il testo qui..."
            className="w-full h-32 p-3 text-xs sm:text-sm bg-(--color-bg) text-(--color-text) rounded-md border border-(--color-border) outline-none focus:border-(--color-text) shadow-xs transition-colors resize-none placeholder:text-(--color-muted)"
          />
        </div>

        {/* INPUT LINKS */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-(--color-text) mb-1.5">
            Links (Uno per riga)
          </label>
          <textarea
            value={linksText}
            onChange={(e) => setLinksText(e.target.value)}
            placeholder="https://esempio.com/1&#10;https://esempio.com/2"
            className="w-full h-24 p-3 font-mono text-xs sm:text-sm bg-(--color-bg) text-(--color-text) rounded-md border border-(--color-border) outline-none focus:border-(--color-text) shadow-xs transition-colors resize-none placeholder:text-(--color-muted)"
            spellCheck="false"
          />
        </div>

        {/* INPUT IMAGES */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-(--color-text) mb-1.5">
            Immagine (URL o Stringa)
          </label>
          <input
            type="text"
            value={images}
            onChange={(e) => setImages(e.target.value)}
            placeholder="https://..."
            className="w-full p-3 font-mono text-xs sm:text-sm bg-(--color-bg) text-(--color-text) rounded-md border border-(--color-border) outline-none focus:border-(--color-text) shadow-xs transition-colors placeholder:text-(--color-muted)"
          />
        </div>
      </div>

      {/* BOTTONE E FEEDBACK */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <button
          type="button"
          onClick={handleUpload}
          disabled={status === 'loading' || status === 'success'}
          className={`w-full sm:w-auto px-5 py-2.5 rounded-md text-xs font-bold uppercase tracking-widest transition-all shadow-xs outline-none flex items-center justify-center gap-2 ${
            status === 'idle' ? 'bg-(--color-text) text-(--color-surface) hover:opacity-90 cursor-pointer' :
            status === 'loading' ? 'bg-(--color-text) text-(--color-surface) opacity-50 cursor-not-allowed' :
            status === 'success' ? 'bg-emerald-600 text-white cursor-default' :
            'bg-red-600 text-white hover:opacity-90 cursor-pointer'
          }`}
        >
          {status === 'loading' && <Loader2 size={14} className="animate-spin" />}
          <span>
            {status === 'idle' && 'Salva Contenuto'}
            {status === 'loading' && 'Caricamento...'}
            {status === 'success' && '✓ Salvato'}
            {status === 'error' && 'Riprova'}
          </span>
        </button>

        {/* MESSAGGI D'ERRORE */}
        {status === 'error' && (
          <div className="flex-1 p-3 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-light rounded-md shadow-xs leading-relaxed w-full">
            <strong className="font-bold uppercase tracking-wider mr-1.5">Attenzione:</strong> {errorMessage}
          </div>
        )}

        {/* MESSAGGI DI SUCCESSO */}
        {status === 'success' && (
          <div className="flex-1 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-light rounded-md shadow-xs leading-relaxed w-full">
            Dati processati e salvati correttamente!
          </div>
        )}
      </div>
    </section>
  );
}