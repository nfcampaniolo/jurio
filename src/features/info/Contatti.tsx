import { lazy, Suspense } from "react";
import { Header } from "@/shared/components/Header";
import { Helmet } from "@dr.pogodin/react-helmet";
import { motion, useReducedMotion } from "framer-motion";
import { SupportForm } from "@/features/info/components/SupportForm";
import { SupportSidebar } from "@/features/info/components/SupportSidebar";

const JurioChatbot = lazy(() => import('@/features/info/components/JurioChatbot'));

export default function Supporto() {
  const reduceMotion = useReducedMotion();

  return (
    <>
      <Helmet>
        <title>Assistenza e Supporto Clienti | Jurio</title>
        <meta name="description" content="Hai bisogno di assistenza con Jurio? Contatta il supporto tecnico o usa l'AI per risolvere problemi legali e tecnici. Risposte entro 24h." />
        <meta property="og:title" content="Assistenza e Supporto Clienti | Jurio" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.jurio.it/supporto" /> 
        <link rel="canonical" href="https://www.jurio.it/supporto" />
        <meta name="robots" content="index, follow" />
      </Helmet>

      <Header />

      <main className="mx-auto w-full max-w-7xl px-5 py-12 sm:py-20">
        <motion.div
          className="grid gap-12 lg:grid-cols-12 lg:gap-16"
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={reduceMotion ? false : { opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <SupportForm />
          <SupportSidebar />
        </motion.div>
        
        <Suspense fallback={null}>
          <JurioChatbot />
        </Suspense>
      </main>
    </>
  );
}