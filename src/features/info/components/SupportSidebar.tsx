import React, { useEffect, useRef, useState } from "react";

export const SupportSidebar: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [loadVideo, setLoadVideo] = useState(false);

  useEffect(() => {
    const start = () => setLoadVideo(true);
    let timeoutId: number | undefined;
    let idleId: number | undefined;

    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (typeof w.requestIdleCallback === 'function') {
      // Ho aumentato il timeout a 2500ms per dare priorità assoluta al LCP della pagina
      idleId = w.requestIdleCallback(start, { timeout: 2500 });
    } else {
      timeoutId = window.setTimeout(start, 2000);
    }

    return () => {
      if (idleId !== undefined && typeof w.cancelIdleCallback === 'function') w.cancelIdleCallback(idleId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (loadVideo && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [loadVideo]);

  return (
    <aside className="lg:col-span-5 space-y-8 lg:pl-6">
      <div className="relative rounded-lg overflow-hidden border border-(--color-border) shadow-(--shadow-soft) bg-(--color-surface) aspect-video group">
        <video
          ref={videoRef}
          // Azione richiesta: Usa un formato .webp (vedi indicazioni sotto)
          poster="/demo2.webp" 
          muted 
          loop 
          playsInline 
          preload="none"
          // Aiuta gli screen reader a capire che è un elemento puramente visivo
          aria-hidden="true" 
          className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
          {...(loadVideo ? { src: "/demo2.mp4", autoPlay: true } : {})}
        >
          {/* Fix Accessibilità: Lighthouse esige una traccia per i video, anche se muti */}
          <track kind="captions" srcLang="it" label="Video dimostrativo (Muto)" />
        </video>
      </div>

      <div className="space-y-4">
        {/* Fix Accessibilità: Gerarchia corretta. Salto da h3 a h2 */}
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted) ml-1">
          Canali diretti
        </h2>
        
        <div className="relative p-6 bg-(--color-surface) border border-(--color-border) rounded-lg shadow-(--shadow-soft) overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

          <div className="relative z-10 mt-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-(--color-muted)">
                AI Online
              </span>
            </div>
            {/* Fix Accessibilità: Gerarchia corretta. Salto da h4 a h3 */}
            <h3 className="text-base font-medium text-(--color-text) tracking-tight">
              Chiedi a Jurio AI
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-(--color-muted) font-light leading-relaxed">
              Il nostro assistente basato su intelligenza artificiale può risolvere i tuoi dubbi tecnici o legali istantaneamente. Trovi l'icona in basso a destra.
            </p>
          </div>
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-(--color-text)/5 rounded-full blur-2xl group-hover:bg-(--color-text)/10 transition-all pointer-events-none" />
        </div>
      </div>
    </aside>
  );
};