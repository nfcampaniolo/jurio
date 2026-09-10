import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { SEO } from "@/shared/components/SEO";

/* ---------- mock helmet per isolare i metadati e prevenire l'errore di nesting <html> ---------- */
vi.mock("@dr.pogodin/react-helmet", () => ({
  Helmet: ({ children }: { children: React.ReactNode }) => {
    const childrenArray = React.Children.toArray(children);

    childrenArray.forEach((child) => {
      if (React.isValidElement(child) && child.type === "html") {
        const props = child.props as { lang?: string };
        if (props.lang) {
          document.documentElement.lang = props.lang;
        }
      }
    });

    const validChildren = childrenArray.filter(
      (child) => !(React.isValidElement(child) && child.type === "html")
    );

    return <>{validChildren}</>;
  },
}));

describe("SEO Component Suite", () => {
  const defaultProps = {
    title: "Assistente Giuridico",
    description: "Analisi semantica e intelligenza artificiale per professionisti legali.",
  };

  beforeEach(() => {
    document.title = "";
    document.documentElement.lang = "";
  });

  test("applica il suffisso '| Jurio' se il titolo non include il brand e usa i valori predefiniti", () => {
    render(<SEO {...defaultProps} />);

    expect(document.title).toBe("Assistente Giuridico | Jurio");
    expect(document.documentElement.lang).toBe("it");

    const metaDesc = document.querySelector('meta[name="description"]');
    expect(metaDesc?.getAttribute("content")).toBe(defaultProps.description);

    const canonicalLink = document.querySelector('link[rel="canonical"]');
    expect(canonicalLink?.getAttribute("href")).toBe("https://jurio.it");

    const robotsMeta = document.querySelector('meta[name="robots"]');
    expect(robotsMeta?.getAttribute("content")).toBe("index, follow");

    const ogType = document.querySelector('meta[property="og:type"]');
    expect(ogType?.getAttribute("content")).toBe("website");

    const ogImage = document.querySelector('meta[property="og:image"]');
    expect(ogImage?.getAttribute("content")).toBe("https://jurio.it/logo.webp");

    const twitterCard = document.querySelector('meta[name="twitter:card"]');
    expect(twitterCard?.getAttribute("content")).toBe("summary_large_image");
  });

  test("non duplica il nome del brand se il titolo include già 'Jurio'", () => {
    render(
      <SEO {...defaultProps} title="Jurio - Piattaforma di Ricerca Precedenti" />
    );

    expect(document.title).toBe("Jurio - Piattaforma di Ricerca Precedenti");
  });

  test("normalizza correttamente il path per l'URL canonico con o senza slash iniziale", () => {
    const { unmount } = render(
      <SEO {...defaultProps} path="analisi/approfondimento" />
    );
    expect(
      document.querySelector('link[rel="canonical"]')?.getAttribute("href")
    ).toBe("https://jurio.it/analisi/approfondimento");

    unmount();

    render(
      <SEO {...defaultProps} path="/analisi/approfondimento" />
    );
    expect(
      document.querySelector('link[rel="canonical"]')?.getAttribute("href")
    ).toBe("https://jurio.it/analisi/approfondimento");
  });

  test("privilegia il prop canonical esplicito rispetto al path", () => {
    render(
      <SEO
        {...defaultProps}
        path="/path-secondario"
        canonical="https://jurio.it/pagina-principale"
      />
    );

    expect(
      document.querySelector('link[rel="canonical"]')?.getAttribute("href")
    ).toBe("https://jurio.it/pagina-principale");
  });

  test("normalizza l'URL dell'immagine se viene passata una path relativa", () => {
    const { unmount: u1 } = render(
      <SEO {...defaultProps} image="images/og-preview.png" />
    );
    expect(
      document
        .querySelector('meta[property="og:image"]')
        ?.getAttribute("content")
    ).toBe("https://jurio.it/images/og-preview.png");
    u1();

    const { unmount: u2 } = render(
      <SEO {...defaultProps} image="/images/og-preview.png" />
    );
    expect(
      document
        .querySelector('meta[property="og:image"]')
        ?.getAttribute("content")
    ).toBe("https://jurio.it/images/og-preview.png");
    u2();

    render(
      <SEO {...defaultProps} image="https://cdn.example.com/custom-og.jpg" />
    );
    expect(
      document
        .querySelector('meta[property="og:image"]')
        ?.getAttribute("content")
    ).toBe("https://cdn.example.com/custom-og.jpg");
  });

  test("imposta la direttiva robots 'noindex, nofollow' quando noIndex è true", () => {
    render(<SEO {...defaultProps} noIndex={true} />);

    const robotsMeta = document.querySelector('meta[name="robots"]');
    expect(robotsMeta?.getAttribute("content")).toBe("noindex, nofollow");
  });

  test("supporta il tipo 'article' e renderizza i tag figli personalizzati (es. JSON-LD)", () => {
    render(
      <SEO {...defaultProps} type="article">
        <script type="application/ld+json" data-testid="json-ld">
          {JSON.stringify({ "@context": "https://schema.org", "@type": "Article" })}
        </script>
      </SEO>
    );

    const ogType = document.querySelector('meta[property="og:type"]');
    expect(ogType?.getAttribute("content")).toBe("article");

    const jsonLdScript = screen.getByTestId("json-ld");
    expect(jsonLdScript).toBeInTheDocument();
    expect(jsonLdScript.textContent).toContain('"@type":"Article"');
  });
});