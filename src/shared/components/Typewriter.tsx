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
  const [currentIndex, setCurrentIndex] = useState(animate ? 0 : text.length);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const displayedText = animate ? text.slice(0, currentIndex) : text;

  useEffect(() => {
    if (!animate) return;

    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        const nextIndex = currentIndex + 1;
        setCurrentIndex(nextIndex);

        if (nextIndex >= text.length && !isStreaming) {
          onCompleteRef.current?.();
        }
      }, speed);

      return () => clearTimeout(timeout);
    }

    if (currentIndex >= text.length && text.length > 0 && !isStreaming) {
      const timer = setTimeout(() => {
        onCompleteRef.current?.();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, text.length, speed, animate, isStreaming]);

  return (
    <div className="
      /* Layout base e tipografia */
      prose prose-sm md:prose-base max-w-none dark:prose-invert 
      text-neutral-800 dark:text-neutral-100
      antialiased font-normal tracking-tight
      
      /* Paragrafi e Line-height */
      prose-p:leading-relaxed prose-p:text-justify prose-p:my-3
      
      /* Titoli interni con accento ocra/ambra e serif elegante */
      prose-headings:font-serif prose-headings:tracking-tight 
      prose-headings:text-neutral-900 dark:prose-headings:text-neutral-50
      
      /* Grassetti: Risalto istituzionale per norme e intestazioni */
      prose-strong:font-semibold prose-strong:text-neutral-900 dark:prose-strong:text-white
      
      /* Elenchi Numerati / Liste generiche */
      prose-ol:pl-0 prose-ol:space-y-4 prose-ol:my-4
      prose-ul:list-disc prose-ul:pl-5 prose-ul:my-3
      prose-li:marker:text-[#e0a32e] prose-li:my-1.5
      
      /* Citazioni / Blockquotes */
      prose-blockquote:border-l-2 prose-blockquote:border-[#e0a32e] 
      prose-blockquote:bg-amber-50/40 dark:prose-blockquote:bg-neutral-800/20
      prose-blockquote:py-2.5 prose-blockquote:px-4 prose-blockquote:rounded-r-lg
      prose-blockquote:not-italic prose-blockquote:text-sm
    ">
      <ReactMarkdown
        components={{
          hr: ({ ...props }) => (
            <hr 
              className="my-8 md:my-10 border-none h-px bg-neutral-200/80 dark:bg-neutral-800/80" 
              {...props} 
            />
          )
        }}
      >
        {displayedText}
      </ReactMarkdown>
    </div>
  );
};