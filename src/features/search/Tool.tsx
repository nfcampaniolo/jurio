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

const LoadingSpinner = () => (
  <div className="flex items-center justify-center py-20 w-full">
    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-neutral-900"></div>
  </div>
);

const SearchSkeleton = () => (
  <div className="space-y-8 w-full animate-pulse">
    <div className="h-14 bg-stone-200 dark:bg-neutral-800 rounded-full w-full" />
    <div className="h-32 bg-stone-100 dark:bg-neutral-900 rounded-2xl w-full" />
  </div>
);

const InfoSkeleton = () => (
  <div className="space-y-12 w-full animate-pulse">
    <div className="h-64 bg-stone-100 dark:bg-neutral-900 rounded-3xl w-full" />
    <div className="h-40 bg-stone-200 dark:bg-neutral-800 rounded-3xl w-full" />
  </div>
);

export const Tool = () => {
  const { user, loading: authLoading } = useAuth();

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
      
      <main className="px-2 min-h-[calc(100vh-200px)] flex flex-col">
        <h1 className="sr-only">Ricerca Giurisprudenziale Avanzata con Intelligenza Artificiale</h1>

        {authLoading ? (
          <LoadingSpinner />
        ) : (
          <div className="max-w-5xl mx-auto w-full mt-8">
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