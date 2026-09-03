import { FaLinkedin, FaInstagram } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import React from 'react';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  const linkClasses =
    "text-(--color-muted) hover:text-(--color-text) transition-colors text-left focus:outline-none font-light";

  return (
    <footer
      className="relative pt-16 pb-12 px-10 border-t border-(--color-border) bg-(--color-surface) text-(--color-text)"
      aria-label="footer-heading"
    >
      <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-10" />

      <h2 id="footer-heading" className="sr-only">
        Footer
      </h2>

      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between gap-12">
        {/* Logo e descrizione */}
        <div className="flex flex-col gap-6 max-w-sm">
          <button
            type="button"
            className="text-2xl md:text-3xl lg:text-4xl font-serif font-bold cursor-pointer hover:opacity-80 transition-opacity text-left focus:outline-none w-fit"
            style={{ fontFamily: 'var(--font-serif)' }}
            aria-label="Torna all'inizio della pagina"
          >
            Jurio
          </button>

          <p className="text-sm md:text-base text-(--color-muted) font-light leading-relaxed">
            Strumenti avanzati per la ricerca giuridica, l’analisi e la sintesi dei documenti con supporto AI, progettati per rendere il lavoro legale più rapido, preciso ed efficiente.
          </p>

          {/* Social */}
          <div className="flex flex-col gap-3 pt-2">
            <span className="font-bold text-xs uppercase tracking-widest text-(--color-text)">
              Seguici
            </span>

            <div className="flex gap-4">
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-(--color-muted) hover:text-(--color-text) transition-colors focus:outline-none"
                aria-label="Visita la nostra pagina LinkedIn"
              >
                <FaLinkedin
                  className="w-5 h-5"
                  aria-hidden="true"
                  focusable={false}
                />
              </a>

              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-(--color-muted) hover:text-(--color-text) transition-colors focus:outline-none"
                aria-label="Visita la nostra pagina Instagram"
              >
                <FaInstagram
                  className="w-5 h-5"
                  aria-hidden="true"
                  focusable={false}
                />
              </a>

            </div>
          </div>
        </div>

        {/* Link principali */}
        <nav
          className="grid grid-cols-2 md:grid-cols-3 gap-8 lg:gap-16 text-sm"
          aria-label="Link del footer"
        >
          <div className="flex flex-col gap-3">
            <span className="font-bold text-xs uppercase tracking-widest text-(--color-text) mb-1">
              Supporto
            </span>

            <Link to="/prezzi" className={linkClasses}>
              Prezzi
            </Link>

            <Link to="/contatti" className={linkClasses}>
              Contattaci
            </Link>

            <a href="/fonti" className={linkClasses}>
              Fonti
            </a>

             <a href="/casi-studio" className={linkClasses}>
              Casi di studio
            </a>

            <Link to="/guida" className={linkClasses}>
              Guida utente
            </Link>
        
          </div>

          <div className="flex flex-col gap-3 col-span-2 md:col-span-1">
            <span className="font-bold text-xs uppercase tracking-widest text-(--color-text) mb-1">
              Legale
            </span>

            {/* Modificati da <Link> ad <a> nativi per puntare ai file statici */}
            <a href="/privacy" className={linkClasses}>
              Privacy Policy
            </a>

            <a href="/termini" className={linkClasses}>
              Termini di servizio
            </a>

            <a href="/gdpr" className={linkClasses}>
              Trattamento dei dati
            </a>
          </div>
        </nav>
      </div>

      {/* Disclaimer e Copyright */}
      <div className="mt-16 pt-8 border-t border-(--color-border) flex flex-col items-center gap-4">
        <p className="text-[11px] md:text-xs text-(--color-muted) text-center font-light max-w-4xl opacity-80 leading-relaxed">
          Le fonti documentali indicizzate provengono esclusivamente da archivi istituzionali ufficiali (Corte Suprema di Cassazione, Corte Costituzionale, Giustizia Amministrativa). Ogni elaborazione, sintesi e statistica generata dalla piattaforma si fonda rigorosamente su tali dati.
        </p>
        <div className="text-[10px] uppercase tracking-widest text-(--color-muted) text-center font-medium opacity-70">
          &copy; {currentYear} Jurio. Tutti i diritti riservati.
        </div>
      </div>
    </footer>
  );
};