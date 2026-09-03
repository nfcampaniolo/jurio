import { useParams } from 'react-router-dom';
import { Helmet } from "@dr.pogodin/react-helmet";
import GuideLayout from '@/features/guide/components/GuideLayout';
import { guideContent } from '@/features/guide/hooks/guideContent';

export default function Guida() {
  const { slug } = useParams<{ slug: string }>();
  const currentSlug = slug || "introduzione";
  const Content = guideContent[currentSlug];

  // Gestione dinamica dei metadata in base alla guida corrente o stato di 404
  const isNotFound = !Content;
  const title = isNotFound 
    ? "Pagina non trovata | Jurio" 
    : `Guida ${currentSlug.charAt(0).toUpperCase() + currentSlug.slice(1).replace(/-/g, ' ')} | Jurio`;
  
  const description = isNotFound
    ? "L'articolo che stai cercando non esiste o è stato spostato."
    : `Leggi la guida completa su ${currentSlug.replace(/-/g, ' ')} all'interno del nostro portale.`;

  // URL canonico dinamico (modifica con il tuo dominio reale)
  const canonicalUrl = `https://www.jurio.it/guida/${currentSlug}`;

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonicalUrl} />

        {/* Open Graph / Social Sharing */}
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="article" />

        {/* Robots: indicizza se esiste, altrimenti noindex se 404 */}
        {isNotFound ? (
          <meta name="robots" content="noindex, nofollow" />
        ) : (
          <meta name="robots" content="index, follow" />
        )}
      </Helmet>

      <GuideLayout currentSlug={currentSlug}>
        <style>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(15px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in-up {
            opacity: 0;
            animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `}</style>

        {/* 
          La prop key ricarica il div al cambio di slug, 
          triggerando l'animazione animate-fade-in-up 
        */}
        <div key={currentSlug} className="animate-fade-in-up">
          {Content ? (
            Content
          ) : (
            <div className="text-center py-20 space-y-2">
              <h1 className="text-xl sm:text-2xl font-medium text-(--color-text) tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
                Pagina non trovata
              </h1>
              <p className="text-xs sm:text-sm text-(--color-muted) font-light">
                L'articolo che stai cercando non esiste o è stato spostato.
              </p>
            </div>
          )}
        </div>
      </GuideLayout>
    </>
  );
}