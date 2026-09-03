import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import type { NavigateFunction } from "react-router-dom";
import { navigateItem, type NavItem } from "@/routes/navigation"; // <-- adegua il path se necessario

describe("navigateItem Suite", () => {
  const mockNavigate = vi.fn() as unknown as NavigateFunction;
  const mockCloseMenu = vi.fn();
  const mockScrollIntoView = vi.fn();

  const setPathname = (path: string) => {
    window.history.pushState({}, "", path);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setPathname("/");
    document.body.innerHTML = "";
    window.HTMLElement.prototype.scrollIntoView = mockScrollIntoView;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Chiusura del menu (closeMenu callback)", () => {
    test("invoca closeMenu se fornito", () => {
      const item: NavItem = { type: "route", target: "/tariffe" };

      navigateItem(item, mockNavigate, mockCloseMenu);

      expect(mockCloseMenu).toHaveBeenCalledTimes(1);
    });

    test("non solleva errori se closeMenu è omesso", () => {
      const item: NavItem = { type: "route", target: "/tariffe" };

      expect(() => navigateItem(item, mockNavigate)).not.toThrow();
    });
  });

  describe("Navigazione diretta (type: 'route')", () => {
    test("esegue navigate sul target specificato senza interagire con lo scroll", () => {
      const item: NavItem = { type: "route", target: "/profilo/abbonamento" };
      const getElementByIdSpy = vi.spyOn(document, "getElementById");

      navigateItem(item, mockNavigate, mockCloseMenu);

      expect(mockNavigate).toHaveBeenCalledWith("/profilo/abbonamento");
      expect(getElementByIdSpy).not.toHaveBeenCalled();
      expect(mockScrollIntoView).not.toHaveBeenCalled();
    });
  });

  describe("Scroll ancorato (type: 'scroll')", () => {
    test("esegue immediatamente lo scroll se già sulla root '/'", () => {
      setPathname("/");

      const targetElement = document.createElement("div");
      targetElement.id = "sezione-faq";
      document.body.appendChild(targetElement);

      const item: NavItem = { type: "scroll", target: "sezione-faq" };

      navigateItem(item, mockNavigate, mockCloseMenu);

      expect(mockNavigate).not.toHaveBeenCalled();
      expect(mockScrollIntoView).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "start",
      });
    });

    test("reindirizza a '/ricerca' e ritarda lo scroll di 100ms se su un path differente da '/'", () => {
      vi.useFakeTimers();
      setPathname("/guida/cassazione");

      const targetElement = document.createElement("div");
      targetElement.id = "sezione-filtri";
      document.body.appendChild(targetElement);

      const item: NavItem = { type: "scroll", target: "sezione-filtri" };

      navigateItem(item, mockNavigate, mockCloseMenu);

      expect(mockNavigate).toHaveBeenCalledWith("/ricerca");
      expect(mockScrollIntoView).not.toHaveBeenCalled();

      // Avanzamento temporale per attivare il setTimeout(..., 100)
      vi.advanceTimersByTime(100);

      expect(mockScrollIntoView).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "start",
      });
    });

    test("gestisce in sicurezza elementi DOM non trovati senza generare eccezioni", () => {
      vi.useFakeTimers();
      setPathname("/impostazioni");

      const item: NavItem = { type: "scroll", target: "elemento-inesistente" };

      expect(() => {
        navigateItem(item, mockNavigate);
        vi.advanceTimersByTime(100);
      }).not.toThrow();

      expect(mockScrollIntoView).not.toHaveBeenCalled();
    });
  });
});