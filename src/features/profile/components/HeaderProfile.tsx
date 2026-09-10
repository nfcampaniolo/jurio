import React, { useEffect, useId, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { FiMoreVertical } from "react-icons/fi";
import type { Action } from "@/interfaces/interfaces";

interface HeaderProfileProps {
  name: string;
  surname: string;
  avatar?: string | null;
  actions: Action[];
}

export const HeaderProfile: React.FC<HeaderProfileProps> = ({
  name,
  surname,
  avatar,
  actions,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const closeMenu = () => setMenuOpen(false);
  const toggleMenu = () => setMenuOpen((v) => !v);

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeMenu();
        triggerRef.current?.focus();
      }
      if (e.key === "Tab") {
        const menuEl = menuRef.current;
        if (!menuEl) return;

        const focusables = menuEl.querySelectorAll<HTMLElement>(
          'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  useEffect(() => {
    if (menuOpen) {
      requestAnimationFrame(() => {
        const first = menuRef.current?.querySelector<HTMLElement>("button");
        first?.focus();
      });
    }
  }, [menuOpen]);

  return (
    <motion.div
      className="flex items-center justify-between p-6 gap-4 mx-auto max-w-6xl"
      initial={shouldReduceMotion ? false : { opacity: 0, y: -10 }}
      animate={shouldReduceMotion ? {} : { opacity: 1, y: 0 }}
      transition={shouldReduceMotion ? {} : { duration: 0.4 }}
    >
      {/* Avatar e Dati */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-(--color-border)">
          {avatar ? (
            <img
              src={avatar}
              alt={`Foto profilo di ${name} ${surname}`}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div
              className="w-full h-full bg-(--color-bg) flex items-center justify-center text-(--color-text) text-xl font-semibold"
              style={{ fontFamily: 'var(--font-serif)' }}
              aria-hidden="true"
            >
              {(name?.[0] || "?").toUpperCase()}
            </div>
          )}
        </div>

        <div>
          <p className="font-semibold text-lg text-(--color-text)" style={{ fontFamily: 'var(--font-serif)' }}>
            {name} {surname}
          </p>
        </div>
      </div>

      {/* Menu & Workspace */}
      <div className="flex items-center gap-3">
        {/* Pulsante Workspace Dedicato */}
        <div className="relative">
          <button
            ref={triggerRef}
            type="button"
            className="p-2 rounded-full hover:bg-(--color-bg) transition-colors focus:outline-none text-(--color-text)"
            onClick={toggleMenu}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? "Chiudi menu azioni profilo" : "Apri menu azioni profilo"}
          >
            <FiMoreVertical size={20} aria-hidden="true" focusable={false} />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={closeMenu}
                  aria-label="Chiudi menu"
                />
                <motion.div
                  ref={menuRef}
                  id={menuId}
                  role="menu"
                  aria-label="Azioni profilo"
                  className="absolute right-0 mt-2 w-64 sm:w-72 bg-(--color-surface) rounded-lg shadow-(--shadow-soft) border border-(--color-border) p-1.5 flex flex-col z-50 overflow-hidden origin-top-right backdrop-blur-md"
                  initial={shouldReduceMotion ? false : { opacity: 0, y: -8, scale: 0.97 }}
                  animate={shouldReduceMotion ? {} : { opacity: 1, y: 0, scale: 1 }}
                  exit={shouldReduceMotion ? {} : { opacity: 0, y: -8, scale: 0.97 }}
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }
                  }
                >
                  {/* Accento superiore coordinato */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-80" />

                  <div className="flex flex-col gap-0.5 pt-0.5">
                    {actions.map((action) => {
                      const isDestructive = action.destructive;
                      return (
                        <button
                          key={action.id}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            action.onClick();
                            closeMenu();
                            triggerRef.current?.focus();
                          }}
                          className={`group flex items-center gap-3 px-3 py-2.5 w-full text-left rounded-md text-xs sm:text-[13px] font-medium transition-all duration-150 outline-none cursor-pointer select-none focus-visible:ring-1 focus-visible:ring-(--color-primary) ${
                            isDestructive
                              ? "text-red-600 dark:text-red-400 hover:bg-red-500/10 focus-visible:bg-red-500/10"
                              : "text-(--color-text) hover:bg-(--color-bg) hover:text-(--color-primary) focus-visible:bg-(--color-bg)"
                          }`}
                        >
                          {action.icon && (
                            <span
                              className={`shrink-0 text-sm sm:text-base transition-transform duration-150 group-hover:scale-105 ${
                                isDestructive
                                  ? "text-red-500/80"
                                  : "text-(--color-muted) group-hover:text-(--color-primary)"
                              }`}
                              aria-hidden="true"
                            >
                              {action.icon}
                            </span>
                          )}
                          <span className="truncate tracking-tight">{action.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};