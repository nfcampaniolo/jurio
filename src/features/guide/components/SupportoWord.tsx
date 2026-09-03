import { Header } from "@/shared/components/Header";
import { Footer } from "@/shared/components/Footer";
import { Helmet } from "@dr.pogodin/react-helmet";
import { motion, useReducedMotion } from "framer-motion";

export default function SupportoWord() {
  const reduceMotion = useReducedMotion();

  return (
    <>
      <Helmet htmlAttributes={{ lang: "it" }}>
        <title>Integrazione Microsoft Word | Jurio — In Arrivo</title>
        <meta
          name="description"
          content="L'add-in di Microsoft Word per Jurio è in fase di sviluppo avanzato. Accedi temporaneamente ai servizi di sintesi e analisi tramite la chat e i link dedicati."
        />
        <link rel="canonical" href="https://jurio.it/supporto-word" />
        <meta name="robots" content="index, follow" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Integrazione Microsoft Word | Jurio — In Arrivo" />
        <meta property="og:description" content="L'add-in di Microsoft Word per Jurio è in fase di sviluppo avanzato. Accedi temporaneamente ai servizi di sintesi e analisi tramite la chat e i link dedicati." />
        <meta property="og:url" content="https://jurio.it/supporto-word" />
        <meta property="og:image" content="https://jurio.it/logo.webp" />

        {/* JSON-LD Schema.org */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": "Integrazione Microsoft Word",
            "description": "Pagina informativa sullo stato di sviluppo dell'add-in Microsoft Word per la piattaforma Jurio.",
            "url": "https://jurio.it/supporto-word",
            "inLanguage": "it",
            "isPartOf": {
              "@type": "WebSite",
              "name": "Jurio",
              "url": "https://jurio.it/"
            }
          })}
        </script>
      </Helmet>

      <Header />

      <main className="mx-auto w-full max-w-4xl px-6 py-16 sm:py-24 text-(--color-text)">
        <motion.article
          initial={reduceMotion ? false : { opacity: 0, y: 15 }}
          animate={reduceMotion ? false : { opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-10"
        >
          <header className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-(--color-surface) border border-(--color-border) text-xs font-medium text-(--color-primary) tracking-wide uppercase" role="status">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" aria-hidden="true" />
              <span>In fase di implementazione</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-medium tracking-tight" style={{ fontFamily: "var(--font-serif)" }}>
              Integrazione Microsoft Word
            </h1>
            <p className="text-base sm:text-lg text-(--color-muted) font-light leading-relaxed">
              Stiamo sviluppando il componente aggiuntivo ufficiale per Microsoft Word, progettato per integrare la ricerca giuridica avanzata di Jurio direttamente nel tuo ambiente di lavoro.
            </p>
          </header>

          <section className="p-6 sm:p-8 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) space-y-4" aria-labelledby="roadmap-heading">
            <h2 id="roadmap-heading" className="text-xl font-medium" style={{ fontFamily: "var(--font-serif)" }}>
              Roadmap di rilascio
            </h2>
            <p className="text-sm sm:text-base text-(--color-muted) font-light leading-relaxed">
              Il plugin consentirà di interrogare il database di giurisprudenza, generare citazioni conformi e inserire approfondimenti normativi senza la necessità di cambiare finestra o interrompere la stesura dell'atto. Il rilascio ufficiale è previsto nel corso dei prossimi mesi per tutti gli utenti professionisti.
            </p>
          </section>

          <section className="p-6 sm:p-8 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) space-y-6" aria-labelledby="alternative-heading">
            <h2 id="alternative-heading" className="text-xl font-medium" style={{ fontFamily: "var(--font-serif)" }}>
              Soluzioni alternative immediate
            </h2>
            <p className="text-sm sm:text-base text-(--color-muted) font-light leading-relaxed">
              Nel frattempo, puoi accedere a tutte le funzionalità di analisi, estrazione e sintesi documentale direttamente attraverso i nostri canali interattivi dedicati:
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <a
                href="/chat"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-(--color-text) text-(--color-surface) px-5 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all shadow-xs focus:ring-2 focus:ring-offset-2 focus:ring-(--color-primary) outline-none"
                aria-label="Accedi alla chat per i servizi di sintesi"
              >
                <span>Accedi alla Chat</span>
                <span aria-hidden="true">→</span>
              </a>
            </div>
          </section>
        </motion.article>
      </main>

      <Footer />
    </>
  );
}