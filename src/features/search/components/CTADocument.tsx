import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ButtonCTA } from '@/shared/components/ButtonCTA';
import { FaFileUpload } from 'react-icons/fa';

export const CTADocument: React.FC = () => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/profilo#section1');
  };

  return (
    <section
      aria-labelledby="cta-document-heading"
      className="py-16 md:py-24 bg-(--color-bg)"
    >
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Contenitore stile "Documento/Modulo" coerente con le card precedenti */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-10 lg:gap-16 p-8 md:p-12 border border-(--color-border) bg-(--color-surface) rounded-lg shadow-(--shadow-soft) relative">
          
          {/* Linea superiore di rigore (Usa il colore del testo, zero distrazioni cromatiche) */}
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) rounded-t-lg opacity-90" />

          {/* Testi e Icona (Allineati a sinistra per autorevolezza editoriale) */}
          <div className="flex-1 flex flex-col space-y-6">
            <div className="flex flex-col md:flex-row md:items-center gap-5">
              
              {/* Icona racchiusa in un blocco geometrico neutro */}
              <span 
                className="shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-md bg-(--color-border) opacity-80 text-(--color-text)" 
                aria-hidden="true"
              >
                <FaFileUpload className="text-xl" focusable="false" />
              </span>
              
              <h2
                id="cta-document-heading"
                className="text-2xl md:text-3xl text-(--color-text) leading-snug tracking-tight"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                Non trovi il provvedimento? <span className="text-(--color-primary) italic">Caricalo.</span>
              </h2>
            </div>

            <p className="text-base md:text-lg text-(--color-muted) font-light leading-relaxed max-w-3xl">
              Quando il corpus delle Corti Supreme non restituisce il provvedimento che ti serve, Jurio ti permette di
              analizzare documenti esterni in un ambiente riservato. Carica il file nel tuo cloud privato e lascia che
              l’Agente AI estragga i passaggi rilevanti, la ratio decidendi e i profili utili alla ricerca.
            </p>
          </div>

          {/* Azione CTA (Lato destro su desktop) */}
          <div className="flex flex-col items-start lg:items-center shrink-0 w-full lg:w-auto mt-2 lg:mt-0">
            <ButtonCTA
              onClick={handleClick}
              aria-label="Attiva l'analisi assistita su un documento esterno"
            >
              Analizza il documento
            </ButtonCTA>
            <span className="mt-4 text-[10px] uppercase tracking-[0.2em] font-medium text-(--color-muted) opacity-80">
              Cloud privato &middot; AI integrata
            </span>
          </div>
          
        </div>
      </div>
    </section>
  );
};