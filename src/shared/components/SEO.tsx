// src/shared/components/SEO.tsx
import React from "react";
import { Helmet } from "@dr.pogodin/react-helmet";

export interface SEOProps {
  title: string;
  description: string;
  path?: string;
  canonical?: string;
  image?: string;
  type?: "website" | "article";
  noIndex?: boolean;
  children?: React.ReactNode;
}

const DOMAIN = "https://jurio.it";
const DEFAULT_IMAGE = `${DOMAIN}/logo.webp`;
const SITE_NAME = "Jurio";

export const SEO: React.FC<SEOProps> = ({
  title,
  description,
  path = "",
  canonical,
  image = DEFAULT_IMAGE,
  type = "website",
  noIndex = false,
  children,
}) => {
  // Costruzione e normalizzazione dell'URL canonico
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = canonical || (path ? `${DOMAIN}${normalizedPath}` : DOMAIN);

  // Evita duplicazioni se il titolo contiene già "Jurio"
  const fullTitle = title.toLowerCase().includes("jurio")
    ? title
    : `${title} | ${SITE_NAME}`;

  // Normalizza l'URL dell'immagine se viene passata una path relativa
  const imageUrl = image.startsWith("http")
    ? image
    : `${DOMAIN}${image.startsWith("/") ? image : `/${image}`}`;

  return (
    <Helmet>
      <html lang="it" />
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      {/* Controllo indicizzazione */}
      {noIndex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow" />
      )}

      {/* Open Graph */}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:locale" content="it_IT" />

      {/* Twitter Cards */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />

      <meta httpEquiv="Content-Language" content="it" />

      {/* Supporto per eventuali script JSON-LD o meta tag custom */}
      {children}
    </Helmet>
  );
};