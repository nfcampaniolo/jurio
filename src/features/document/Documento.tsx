import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams } from "react-router-dom";
import { Helmet } from "@dr.pogodin/react-helmet";

// Hooks
import { useAuth } from '@/context/useAuth';
import { useDocumento } from "@/features/document/hooks/useDocumento";

// Componenti Core
import { Header } from '../../shared/components/Header';
import { Footer } from '../../shared/components/Footer';
import { AccessDenied } from "../../shared/components/AccessDenied";
import { MassimaCard } from './components/Massima';

const LoadingSpinner = () => (
  <div className="flex items-center justify-center py-20 w-full">
    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-neutral-900"></div>
  </div>
);

export const Documento = () => {
  const { user, loading: authLoading } = useAuth();
  const { id } = useParams<{ id: string }>();
  // Assicurati che il router passi sempre l'ID a questo componente, quindi facciamo un check cautelativo
  const { selectedDoc, pdfUrl, loading: docLoading, deny, isGiurisprudenza } = useDocumento(id || "");

  const isLoading = authLoading || docLoading;

  const seoData = useMemo(() => (
    <Helmet>
      {/* Qui puoi poi rendere il title dinamico in base a selectedDoc.titolo se lo desideri */}
      <title>Dettaglio Documento Giurisprudenziale | Jurio</title>
      <meta name="description" content="Analisi documento giurisprudenziale." />
      <meta name="twitter:card" content="summary_large_image" />
      <meta httpEquiv="Content-Language" content="it" />
    </Helmet>
  ), []);

  return (
    <>
      {seoData}
      <Header />
      
      <main className="px-2 min-h-[calc(100vh-200px)] flex flex-col">
        <h1 className="sr-only">Dettaglio e Analisi Documento Giurisprudenziale</h1>

        {isLoading ? (
          <LoadingSpinner />
        ) : deny ? (
          <div className="py-20"><AccessDenied /></div>
        ) : (
          <AnimatePresence mode="wait">
            {selectedDoc ? (
              <motion.div
                key={`massima-${id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-10 mt-8 max-w-7xl mx-auto w-full"
              >
                <MassimaCard 
                  result={selectedDoc} 
                  file={pdfUrl} 
                  share={isGiurisprudenza} 
                  uid={user?.uid || ""} 
                  id={id!}
                />
              </motion.div>
            ) : (
              <div className="py-20 text-center">
                <p className="text-xl">Documento non trovato o non valido.</p>
              </div>
            )}
          </AnimatePresence>
        )}
      </main>

      <Footer />
    </>
  );
};