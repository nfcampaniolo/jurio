// Sostituisci il tuo Typewriter con questo:

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

interface TypewriterProps {
  text: string;
  speed?: number;
  animate?: boolean; // <--- Nuova prop
}

export const Typewriter: React.FC<TypewriterProps> = ({ text, speed = 50, animate = true }) => {
  const [displayedText, setDisplayedText] = useState(animate ? "" : text);
  const [currentIndex, setCurrentIndex] = useState(animate ? 0 : text.length);

  useEffect(() => {

    if (!animate) return;

    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText((prev) => prev + text[currentIndex]);
        setCurrentIndex((prev) => prev + 1);
      }, speed);
  
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, text, speed, animate]);

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