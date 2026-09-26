import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

interface TypewriterProps {
  text: string;
  speed?: number;
  animate?: boolean;
  isStreaming?: boolean;
  onComplete?: () => void;
}

export const Typewriter: React.FC<TypewriterProps> = ({ 
  text, 
  speed = 50, 
  animate = true,
  isStreaming = false,
  onComplete 
}) => {
  // Tracciamo unicamente l'indice di avanzamento
  const [currentIndex, setCurrentIndex] = useState(animate ? 0 : text.length);

  // Manteniamo il riferimento aggiornato alla callback per evitare re-trigger
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // STATO DERIVATO: se animate è false o il messaggio è storico, restituisce subito text
  const displayedText = animate ? text.slice(0, currentIndex) : text;

  useEffect(() => {
    // Se non deve animare, l'effetto non deve eseguire né impostare alcuno stato
    if (!animate) return;

    // Se ci sono ancora caratteri da digitare nel buffer
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        const nextIndex = currentIndex + 1;
        setCurrentIndex(nextIndex);

        // Notifica il completamento solo all'ultimo carattere e quando lo streaming è terminato
        if (nextIndex >= text.length && !isStreaming) {
          onCompleteRef.current?.();
        }
      }, speed);

      return () => clearTimeout(timeout);
    }

    // Se lo streaming termina quando il cursore ha già raggiunto la fine del testo
    if (currentIndex >= text.length && text.length > 0 && !isStreaming) {
      const timer = setTimeout(() => {
        onCompleteRef.current?.();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, text.length, speed, animate, isStreaming]);

  return (
    <div className="
      /* Layout base e adattamento tema */
      prose prose-sm md:prose-base max-w-none dark:prose-invert 
      
      /* Tipografia Istituzionale */
      text-neutral-800 dark:text-neutral-100
      antialiased font-normal tracking-tight
      
      /* Paragrafi: Giustificati e con interlinea da 'Brief' legale */
      prose-p:leading-7 prose-p:text-justify prose-p:my-3
      
      /* Grassetti: Più marcati per evidenziare citazioni e norme */
      prose-strong:font-bold prose-strong:text-neutral-900 dark:prose-strong:text-white
      
      /* Elenchi: Puliti e con icone meno invasive */
      prose-ul:list-disc prose-ul:pl-5 prose-li:marker:text-yellow-600
      prose-li:my-1
      
      /* Citazioni/Blockquotes: Stile 'Massima Giurisprudenziale' */
      prose-blockquote:border-l-2 prose-blockquote:border-yellow-600 
      prose-blockquote:bg-neutral-50/50 dark:prose-blockquote:bg-neutral-800/30
      prose-blockquote:py-2 prose-blockquote:pr-4 prose-blockquote:rounded-r-lg
      prose-blockquote:not-italic prose-blockquote:text-sm
    ">
      <ReactMarkdown>{displayedText}</ReactMarkdown>
    </div>
  );
};