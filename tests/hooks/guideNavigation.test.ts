import { describe, test, expect } from "vitest";
import { guideNavigation } from "@/hooks/guideConfig"; // <-- adegua il path di import se necessario

describe("Guide Navigation Config Suite", () => {
  const allHrefs: string[] = [];

  // Raccoglie tutti gli href (sia di livello radice che annidati)
  guideNavigation.forEach((section) => {
    if (section.href) allHrefs.push(section.href);
    section.items.forEach((item) => {
      if (item.href) allHrefs.push(item.href);
    });
  });

  describe("Integrità Strutturale delle Categorie", () => {
    test("contiene tutte le 5 sezioni principali attese", () => {
      const sectionTitles = guideNavigation.map((s) => s.title);

      expect(guideNavigation).toHaveLength(5);
      expect(sectionTitles).toEqual([
        "Introduzione",
        "Casi d'uso",
        "Giurisprudenza",
        "Account",
        "Supporto",
      ]);
    });

    test("ogni sezione principale possiede un titolo valido e un array items", () => {
      guideNavigation.forEach((section) => {
        expect(section.title).toBeTruthy();
        expect(typeof section.title).toBe("string");
        expect(Array.isArray(section.items)).toBe(true);
      });
    });

    test("la sezione radice 'Introduzione' punta all'indice '/guida'", () => {
      const introSection = guideNavigation.find((s) => s.title === "Introduzione");

      expect(introSection).toBeDefined();
      expect(introSection?.href).toBe("/guida");
      expect(introSection?.items).toHaveLength(0);
    });
  });

  describe("Integrità e Formattazione dei Percorsi (href)", () => {
    test("tutti gli href iniziano con '/guida' e seguono la convenzione kebab-case", () => {
      const routeRegex = /^\/guida(\/[a-z0-9-]+)?$/;

      allHrefs.forEach((href) => {
        expect(href).toMatch(routeRegex);
      });
    });

    test("non contiene rotte duplicate nell'intero albero di navigazione", () => {
      const uniqueHrefs = new Set(allHrefs);

      expect(uniqueHrefs.size).toBe(allHrefs.length);
    });

    test("nessun href contiene spazi o barre finali (trailing slashes)", () => {
      allHrefs.forEach((href) => {
        expect(href).not.toContain(" ");
        if (href !== "/guida") {
          expect(href.endsWith("/")).toBe(false);
        }
      });
    });
  });

  describe("Validità dei Sottomenu", () => {
    test("ogni elemento figlio possiede un titolo non vuoto e un href valido", () => {
      const subItems = guideNavigation.flatMap((section) => section.items);

      expect(subItems.length).toBeGreaterThan(0);
      subItems.forEach((item) => {
        expect(item.title.trim().length).toBeGreaterThan(0);
        expect(item.href).toBeDefined();
        expect(item.href?.startsWith("/guida/")).toBe(true);
      });
    });

    test("include i moduli chiave dell'applicazione (Add-in Word, Organi Giurisprudenziali, MCP)", () => {
      const expectedKeyRoutes = [
        "/guida/add-in-word",
        "/guida/cassazione",
        "/guida/consiglio-di-stato",
        "/guida/corte-costituzionale",
        "/guida/mcp-vibe",
      ];

      expectedKeyRoutes.forEach((route) => {
        expect(allHrefs).toContain(route);
      });
    });
  });
});