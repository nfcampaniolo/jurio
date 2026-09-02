import React, { useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiMenu, FiX, FiBell, FiBookOpen } from "react-icons/fi";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ButtonCTA } from "@/components/ButtonCTA";
import { useAuth } from "@/context/useAuth";
import type { NavItem } from "@/hooks/navigation";

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  
  // Dividiamo lo stato in due per capire da dove arriva la notifica non letta
  const [hasUnreadPersonal, setHasUnreadPersonal] = useState(false);
  const [hasUnreadBroadcast, setHasUnreadBroadcast] = useState(false);
  
  // Il pallino si accende se c'è ALMENO una notifica o un broadcast non letto
  const hasUnread = hasUnreadPersonal || hasUnreadBroadcast;

  const shouldReduceMotion = useReducedMotion();

  const navId = useId();
  const menuId = `mobile-menu-${navId}`;
  const toggleBtnRef = useRef<HTMLButtonElement | null>(null);

  const navItems: (NavItem & { label: string })[] = [
    { label: "Ricerca Giurisprudenza", type: "route", target: "/ricerca" },
    { label: "Consulente Legale", type: "route", target: "/chat" },
  ];

  const closeMenu = () => setIsOpen(false);
  const toggleMenu = () => setIsOpen((v) => !v);

  // Ottimizzazione: Controllo dinamico sia di 'notification' che di 'broadcast'
  useEffect(() => {
    if (!user) {
      setHasUnreadPersonal(false);
      setHasUnreadBroadcast(false);
      return;
    }

    let unsubPersonal: (() => void) | undefined;
    let unsubUser: (() => void) | undefined;
    let unsubBroadcast: (() => void) | undefined;
    let isCancelled = false;

    (async () => {
      try {
        const { collection, doc, query, where, limit, orderBy, onSnapshot } = await import("firebase/firestore");
        const { getDb } = await import("@/services/db");
        const db = await getDb();

        if (isCancelled) return;

        // 1. Ascoltatore Notifiche Personali
        const qPersonal = query(
          collection(db, "notification"),
          where("uid", "==", user.uid),
          where("isRead", "==", false),
          limit(1)
        );

        unsubPersonal = onSnapshot(qPersonal, (snapshot) => {
          setHasUnreadPersonal(!snapshot.empty);
        });

        // Variabili d'appoggio per incrociare i broadcast e le letture dell'utente
        let currentReadIds: string[] = [];
        let currentBroadcastIds: string[] = [];

        // Funzione per valutare se ci sono broadcast non letti
        const evaluateBroadcasts = () => {
          const unreadB = currentBroadcastIds.some(id => !currentReadIds.includes(id));
          setHasUnreadBroadcast(unreadB);
        };

        // 2. Ascoltatore Profilo Utente (per leggere l'array `readBroadcasts`)
        unsubUser = onSnapshot(doc(db, "users", user.uid), (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            // Assicuriamoci che l'array esista, altrimenti vuoto
            currentReadIds = data.readBroadcasts || []; 
            evaluateBroadcasts();
          }
        });

        // 3. Ascoltatore Broadcast (Prendiamo solo gli ultimi 5 per non sovraccaricare)
        const qBroadcast = query(
          collection(db, "broadcast"),
          orderBy("createdAt", "desc"),
          limit(5) 
        );

        unsubBroadcast = onSnapshot(qBroadcast, (snapshot) => {
          currentBroadcastIds = snapshot.docs.map(d => d.id);
          evaluateBroadcasts();
        });

      } catch (error) {
        console.error("Errore nel caricamento dinamico delle notifiche (Header):", error);
      }
    })();

    return () => {
      isCancelled = true;
      if (unsubPersonal) unsubPersonal();
      if (unsubUser) unsubUser();
      if (unsubBroadcast) unsubBroadcast();
    };
  }, [user]);

  const onCtaClick = () => {
    closeMenu();
    navigate(user ? "/profilo" : "/login");
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeMenu();
        toggleBtnRef.current?.focus();
      }
    };

    if (isOpen) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  return (
    <header
      className="relative border-b border-(--color-border) bg-(--color-surface) w-full z-50 px-2"
      style={{ backdropFilter: "blur(10px)" }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        {/* Logo formale */}
        <div
          role="button"
          tabIndex={0}
          onClick={closeMenu}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              closeMenu();
            }
          }}
          className="text-2xl md:text-3xl lg:text-4xl font-serif font-bold outline-none cursor-pointer focus-visible:ring-1 focus-visible:ring-(--color-text) rounded-sm"
          style={{ fontFamily: 'var(--font-serif)', textDecoration: 'none', color: 'inherit' }}
          aria-label="Vai alla home"
        >
          Jurio
        </div>
        {/* Desktop nav */}
        <nav className="hidden xl:flex items-center gap-8" aria-label="Navigazione principale">
          {navItems.map((item) => (
            <Link
              key={item.label}
              to={item.target}
              style={{ textDecoration: 'none', color: 'inherit' }}
              className="text-xs font-bold uppercase tracking-widest text-(--color-muted) hover:text-(--color-text) transition-colors outline-none pb-0.5"
            >
              {item.label}
            </Link>
          ))}

          {/* Icone Extra se l'utente è loggato */}
          {user && (
            <div className="flex items-center gap-5 border-l border-(--color-border) pl-8">
              <Link
                to="/guida"
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none', color: 'inherit' }}
                className="text-(--color-muted) hover:text-(--color-text) transition-colors outline-none relative group"
                aria-label="Guida Utente"
              >
                <FiBookOpen size={20} />
                <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold uppercase tracking-widest bg-(--color-text) text-(--color-surface) px-2 py-0.5 rounded-sm whitespace-nowrap">
                  Guida
                </span>
              </Link>

              <Link
                to="/notifiche"
                style={{ textDecoration: 'none', color: 'inherit' }}
                className="text-(--color-muted) hover:text-(--color-text) transition-colors outline-none relative group"
                aria-label="Notifiche"
              >
                <FiBell size={20} />
                {hasUnread && (
                  <span className="absolute top-0 right-0 -mt-1 -mr-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-(--color-text) opacity-40"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-(--color-text)"></span>
                  </span>
                )}
                <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold uppercase tracking-widest bg-(--color-text) text-(--color-surface) px-2 py-0.5 rounded-sm whitespace-nowrap">
                  Notifiche
                </span>
              </Link>
            </div>
          )}

          <ButtonCTA onClick={onCtaClick}>
            {user ? "Il tuo profilo" : "Accedi"}
          </ButtonCTA>
        </nav>

        {/* Mobile toggle */}
        <button
          ref={toggleBtnRef}
          type="button"
          className="xl:hidden inline-flex items-center justify-center p-2 rounded-md text-(--color-text) hover:bg-(--color-bg) transition-colors outline-none"
          onClick={toggleMenu}
          aria-label={isOpen ? "Chiudi menu" : "Apri menu"}
          aria-controls={menuId}
          aria-expanded={isOpen}
        >
          {isOpen ? <FiX size={24} aria-hidden="true" focusable={false} /> : <FiMenu size={24} aria-hidden="true" focusable={false} />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.nav
            id={menuId}
            aria-label="Menu mobile"
            initial={shouldReduceMotion ? false : { opacity: 0, height: 0 }}
            animate={shouldReduceMotion ? {} : { opacity: 1, height: "auto" }}
            exit={shouldReduceMotion ? {} : { opacity: 0, height: 0 }}
            transition={shouldReduceMotion ? {} : { duration: 0.25, ease: "easeInOut" }}
            className="xl:hidden absolute top-full left-0 right-0 flex flex-col items-end gap-5 py-6 px-8 border-b border-(--color-border) bg-(--color-surface) shadow-2xl z-50 overflow-hidden"
          >
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.target}
                onClick={closeMenu}
                style={{ textDecoration: 'none', color: 'inherit' }}
                className="text-xs font-bold uppercase tracking-widest text-(--color-muted) hover:text-(--color-text) transition-colors outline-none py-1 text-right"
              >
                {item.label}
              </Link>
            ))}

            {/* Voci Extra Menu Mobile per Utenti Loggati */}
            {user && (
              <div className="flex flex-col items-end gap-5 w-full border-t border-(--color-border) pt-5 mt-2">
                <Link
                  to="/guida"
                  onClick={closeMenu}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                  className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-(--color-muted) hover:text-(--color-text) transition-colors outline-none py-1 text-right"
                >
                  Guida Utente <FiBookOpen size={16} />
                </Link>

                <Link
                  to="/notifiche"
                  onClick={closeMenu}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                  className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-(--color-muted) hover:text-(--color-text) transition-colors outline-none py-1 text-right relative"
                >
                  Notifiche 
                  <div className="relative">
                    <FiBell size={16} />
                    {hasUnread && (
                      <span className="absolute -top-1 -right-1 flex h-2 w-2">
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-(--color-text)"></span>
                      </span>
                    )}
                  </div>
                </Link>
              </div>
            )}

            <div className="pt-4 w-full max-w-xs flex justify-end">
              <ButtonCTA onClick={onCtaClick}>
                {user ? "Il tuo profilo" : "Accedi"}
              </ButtonCTA>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
};