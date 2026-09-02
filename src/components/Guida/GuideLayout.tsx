// src/components/GuideLayout.tsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { guideNavigation } from '@/hooks/guideConfig';

interface GuideLayoutProps {
  children: React.ReactNode;
  currentSlug: string;
}

export default function GuideLayout({ children, currentSlug }: GuideLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const isActive = (href: string) => {
    if (href === "/guida" && currentSlug === "introduzione") return true;
    return href === `/guida/${currentSlug}`;
  };

  return (
    <div className="flex min-h-screen bg-(--color-bg) text-(--color-text)">
      
      {/* HEADER MOBILE */}
      <div className="md:hidden flex items-center justify-between p-4 bg-(--color-surface) border-b border-(--color-border) fixed w-full top-0 z-20 shadow-xs transition-colors duration-300">
        <span className="text-sm font-medium tracking-tight" >Guida Jurio</span>
        <button 
          type="button"
          onClick={() => setIsMobileMenuOpen(prev => !prev)}
          className="px-3 py-1.5 text-md font-bold uppercase tracking-widest bg-(--color-bg) border border-(--color-border) rounded-md hover:border-(--color-text) transition-colors outline-none cursor-pointer shadow-xs"
        >
          {isMobileMenuOpen ? 'Chiudi' : 'Menu'}
        </button>
      </div>

      {/* OVERLAY MOBILE */}
      {isMobileMenuOpen && (
        <div 
          role="button"
          tabIndex={0}
          aria-label="Chiudi menu"
          className="fixed inset-0 bg-black/40 z-30 md:hidden mt-14.25 backdrop-blur-xs outline-none" 
          onClick={closeMobileMenu}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              closeMobileMenu();
            }
          }}
        />
      )}

      {/* SIDEBAR */}
      <aside 
        className={`
          fixed md:sticky top-14.25 md:top-0 left-0 z-40 h-[calc(100vh-57px)] md:h-screen w-75 bg-(--color-surface) border-r border-(--color-border) p-6 overflow-y-auto 
          transition-transform duration-300 ease-out will-change-transform
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <nav className="space-y-6">
          {guideNavigation.map((section, idx) => (
            <div key={idx} className="space-y-1.5">
              {section.href ? (
                 <Link 
                  to={section.href} 
                  onClick={closeMobileMenu}
                  className={`block text-md font-bold uppercase tracking-widest transition-colors ${
                    isActive(section.href) ? 'text-(--color-text)' : 'text-(--color-muted) hover:text-(--color-text)'
                  }`}
                  style={{ textDecoration: 'none' }}
                 >
                   {section.title}
                 </Link>
              ) : (
                 <h3 className="text-md font-bold uppercase tracking-widest text-(--color-text)">{section.title}</h3>
              )}
              
              {section.items && section.items.length > 0 && (
                <ul className="space-y-1 border-l border-(--color-border) ml-1 pl-3.5">
                  {section.items.map((item, itemIdx) => (
                    <li key={itemIdx}>
                      <Link 
                        to={item.href} 
                        onClick={closeMobileMenu}
                        className={`block text-md py-1 transition-colors no-underline ${
                          isActive(item.href) 
                            ? 'text-(--color-text) font-bold border-l-2 border-(--color-text) -ml-3.75 pl-3.25' 
                            : 'text-(--color-muted) font-light hover:text-(--color-text)'
                        }`}
                        style={{ textDecoration: 'none' }}
                      >
                        {item.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* CONTENUTO PRINCIPALE */}
      <main className="flex-1 p-6 md:p-12 mt-14.25 md:mt-0 w-full max-w-7xl mx-auto bg-(--color-bg) min-h-screen">
        <div className="relative p-6 sm:p-10 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden">
          {/* LA LINEA DI RIGORE SUPERIORE (Unico tocco di colore) */}
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

          <div className="prose prose-sm sm:prose max-w-none text-(--color-text) font-light leading-relaxed mt-1">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}