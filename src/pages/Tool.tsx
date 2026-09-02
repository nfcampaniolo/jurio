import { Suspense, lazy, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams } from "react-router-dom";
import { Helmet } from "@dr.pogodin/react-helmet";

// Hooks e Context
import { useAuth } from '@/context/useAuth';
import { useDocumento } from "@/hooks/useDocumento";

// Componenti Core
import { Header } from '../components/Info/Header';
import { Footer } from '../components/Info/Footer';
import { SearchBar } from '../components/Search/SearchBar';
import { AccessDenied } from "../components/AccessDenied";
import { MassimaCard } from '../components/Document/Massima';

// Componenti Lazy
const ComeFunziona = lazy(() => import('../components/Info/ComeFunziona').then(m => ({ default: m.ComeFunziona })));
const CTASection = lazy(() => import('../components/Info/CTASection'));
const CTADocument = lazy(() => import('../components/Info/CTADocument').then(m => ({ default: m.CTADocument })));

// Componente Spinner (ora si adatta al contenitore, non all'intero schermo)
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

// Skeleton per Ospite (Simula ComeFunziona e CTASection)
const InfoSkeleton = () => (
  <div className="space-y-12 w-full animate-pulse">
    <div className="h-64 bg-stone-100 dark:bg-neutral-900 rounded-3xl w-full" />
    <div className="h-40 bg-stone-200 dark:bg-neutral-800 rounded-3xl w-full" />
  </div>
);

export const Tool = () => {
  const { user, loading: authLoading } = useAuth();
  const { id } = useParams<{ id: string }>();
  const { selectedDoc, pdfUrl, loading: docLoading, deny, isGiurisprudenza } = useDocumento(id);

  const isLoading = authLoading || (!!id && docLoading);

  const seoData = useMemo(() => (
    <Helmet>
      <title>Ricerca Giurisprudenziale | Jurio - Trova Sentenze e Massime Italiane</title>
      <meta name="description" content="Effettua ricerche giurisprudenziali avanzate su Jurio." />
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
      
      {/* Aggiunto min-h-screen qui per evitare che il footer salti su e giù */}
      <main className="px-2 min-h-[calc(100vh-200px)] flex flex-col">
        <h1 className="sr-only">
          {id 
            ? "Dettaglio e Analisi Documento Giurisprudenziale" 
            : "Ricerca Giurisprudenziale Avanzata con Intelligenza Artificiale"}
        </h1>

        {/* Gestione dei contenuti principali preservando Header/Footer */}
        {isLoading ? (
          <LoadingSpinner />
        ) : deny ? (
          <div className="py-20"><AccessDenied /></div>
        ) : (
          <>
            <AnimatePresence mode="wait">
              {id && selectedDoc ? (
                <motion.div
                  key={`massima-${id}`} // CHIAVE DINAMICA: previene bug di Framer Motion
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-10 mt-8" // Margine aggiunto per pulizia visiva
                >
                  <MassimaCard 
                    result={selectedDoc} 
                    file={pdfUrl} 
                    share={isGiurisprudenza} 
                    uid={user?.uid || ""} 
                    id={id}
                  />
                </motion.div>
              ) : id && !docLoading ? (
                <div className="py-20 text-center">
                  <p className="text-xl">Documento non trovato o non valido.</p>
                </div>
              ) : null}
            </AnimatePresence>

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
          </>
        )}
      </main>

      <Footer />
    </>
  );
};