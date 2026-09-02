import React from 'react';
import { ButtonCTA } from '@/components/ButtonCTA';
import { useNavigate } from 'react-router-dom';

const CTASection: React.FC = () => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/login');
  };

  return (
    <section aria-labelledby="cta-heading" className="pb-10 bg-(--color-bg)">
      <div className="max-w-5xl mx-auto px-6">
        
        {/* Contenitore stile "Documento Formale" */}
        <div className="relative  p-8 md:p-12 lg:p-16 rounded-lg shadow-(--shadow-soft) flex flex-col lg:flex-row items-start lg:items-center gap-12 lg:gap-20">
          
          {/* Linea superiore di rigore */}
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) rounded-t-lg opacity-90" />

          {/* Colonna Sinistra: Copywriting allineato a sinistra */}
          <div className="flex-1 space-y-6">
            <h2
              id="cta-heading"
              className="text-3xl md:text-4xl lg:text-5xl text-(--color-text) leading-[1.1] tracking-tight"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              L’essenziale della <br className="hidden lg:block" />
              {/* L'UNICO PUNTO DI COLORE NELL'INTERO COMPONENTE */}
              <span className="text-(--color-primary) italic">ricerca giuridica.</span>
            </h2>

            <p className="text-lg text-(--color-muted) font-light leading-relaxed max-w-2xl">
              Prova Jurio per 7 giorni: giurisprudenza delle Corti Supreme già analizzata, massimizzata e
              interrogabile con un agente AI, in un ambiente essenziale e sicuro.
            </p>

            <div className="flex flex-wrap items-center gap-x-8 gap-y-4 pt-2">
              <Benefit text="Nessuna carta richiesta" />
              <Benefit text="7 giorni full access" />
              <Benefit text="Cloud privato" />
            </div>
          </div>

          {/* Colonna Destra: Azione */}
          <div className="flex flex-col items-start lg:items-center shrink-0 w-full lg:w-auto mt-4 lg:mt-0">
            <ButtonCTA 
              onClick={handleClick} 
              aria-label="Attiva la prova gratuita di Jurio"
            >
              Prova gratuita 1 settimana
            </ButtonCTA>
            <span className="mt-4 text-[10px] uppercase tracking-[0.2em] font-medium text-(--color-muted) opacity-80">
              Attivazione istantanea
            </span>
          </div>
          
        </div>
      </div>
    </section>
  );
};

// Componente Benefit minimalista e privo di distrazioni cromatiche
function Benefit({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-medium text-(--color-muted)">
      {/* Icona neutra (colore del testo, leggermente opaca) per non rubare l'attenzione al titolo */}
      <svg
        className="w-4 h-4 text-(--color-text) opacity-70"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="square"
          strokeLinejoin="miter"
          strokeWidth={2.5}
          d="M5 13l4 4L19 7"
        />
      </svg>
      {text}
    </div>
  );
}

export default CTASection;