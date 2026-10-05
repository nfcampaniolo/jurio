import { Suspense, lazy, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Helmet } from "@dr.pogodin/react-helmet";

// Hooks
import { useAuth } from '@/context/useAuth';

// Componenti Core
import { Header } from '../../shared/components/Header';
import { Footer } from '../../shared/components/Footer';
import { SearchBar } from './components/SearchBar';

// Componenti Lazy
const ComeFunziona = lazy(() => import('./components/ComeFunziona').then(m => ({ default: m.ComeFunziona })));
const CTASection = lazy(() => import('./components/CTASection'));
const CTADocument = lazy(() => import('./components/CTADocument').then(m => ({ default: m.CTADocument })));

// ============================================================================
// STATI DI CARICAMENTO PREMIUM
// ============================================================================

const LoadingSpinner = () => (
  <div 
    role="status" 
    aria-label="Verifica credenziali in corso"
    className="flex flex-col items-center justify-center py-32 w-full gap-6"
  >
    <svg 
      className="animate-spin h-12 w-12 text-(--color-primary)" 
      xmlns="http://www.w3.org/2000/svg" 
      fill="none" 
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="var(--color-border)" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    <span className="text-xs font-semibold text-(--color-muted) tracking-[0.2em] uppercase">
      Jurio
    </span>
  </div>
);

const SearchSkeleton = () => (
  <div className="space-y-10 w-full animate-pulse" aria-hidden="true">
    {/* Mock della SearchBar */}
    <div className="h-16 bg-(--color-surface) border border-(--color-border) rounded-full w-full flex items-center px-6 shadow-(--shadow-soft)">
      <div className="w-5 h-5 rounded-full bg-(--color-border) mr-4 opacity-70"></div>
      <div className="h-4 bg-(--color-border) rounded w-1/3 opacity-40"></div>
      <div className="ml-auto w-24 h-10 bg-(--color-border) rounded-full opacity-60"></div>
    </div>
    
    {/* Mock del CTADocument (Pannello analisi/caricamento) */}
    <div className="h-56 bg-(--color-surface) border border-(--color-border) rounded-2xl w-full p-8 shadow-(--shadow-soft) flex flex-col justify-between">
      <div className="space-y-4">
        <div className="h-5 bg-(--color-border) rounded w-1/4 opacity-60"></div>
        <div className="h-4 bg-(--color-border) rounded w-3/4 opacity-30"></div>
        <div className="h-4 bg-(--color-border) rounded w-1/2 opacity-30"></div>
      </div>
      <div className="h-12 bg-(--color-border) rounded-xl w-40 self-end opacity-50"></div>
    </div>
  </div>
);

const InfoSkeleton = () => (
  <div className="space-y-12 w-full animate-pulse" aria-hidden="true">
    {/* Mock della sezione "Come Funziona" */}
    <div className="bg-(--color-surface)er border-(--color-border)ded-3xl w-full p-10 shadow-(--shadow-soft) flex flex-col items-center">
      <div className="h-8 bg-(--color-border)ded w-1/3 mb-10 opacity-60"></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
         <div className="h-40 bg-(--color-border) rounded-2xl w-full opacity-30"></div>
         <div className="h-40 bg-(--color-border) rounded-2xl w-full opacity-30"></div>
         <div className="h-40 bg-(--color-border) rounded-2xl w-full opacity-30"></div>
      </div>
    </div>
    
    {/* Mock della CTA Section */}
    <div className="h-48 bg-(--color-border) rounded-3xl w-full opacity-20"></div>
  </div>
);

// ============================================================================
// COMPONENTE PRINCIPALE
// ============================================================================

export const Tool = () => {
  const { user, status } = useAuth();
  const authLoading = status === 'loading';

  const seoData = useMemo(() => (
    <Helmet>
      <title>Ricerca Giurisprudenziale | Jurio - Trova Sentenze e Massime Italiane</title>
      <meta name="description" content="Effettua ricerche giurisprudenziali avanzate su Jurio con intelligenza artificiale." />
      <link rel="canonical" href="https://jurio.it/ricerca" />
      <meta property="og:title" content="Ricerca Giurisprudenziale | Jurio" />
      <meta property="og:url" content="https://jurio.it/ricerca" />
      <meta property="og:image" content="https://jurio.it/logo.webp" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta httpEquiv="Content-Language" content="it" />
    </Helmet>
  ), []);

  return (
    <>
      {seoData}
      <Header />
      
      <main className="px-4 min-h-[calc(100vh-200px)] flex flex-col bg-(--color-bg) transition-colors duration-300">
        <h1 className="sr-only">Ricerca Giurisprudenziale Avanzata con Intelligenza Artificiale</h1>

        {authLoading ? (
          <LoadingSpinner />
        ) : (
          <div className="max-w-5xl mx-auto w-full mt-10 mb-20">
            <Suspense fallback={user ? <SearchSkeleton /> : <InfoSkeleton />}>
              <AnimatePresence mode="wait">
                {!user ? (
                  <motion.div
                    key="guest-view"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="space-y-12"
                  >
                    <ComeFunziona />
                    <CTASection />
                  </motion.div>
                ) : (
                  <motion.div
                    key="user-view"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-10"
                  >
                    <SearchBar />
                    <CTADocument />
                  </motion.div>
                )}
              </AnimatePresence>
            </Suspense>
          </div>
        )}
      </main>

      <Footer />
    </>
  );
};