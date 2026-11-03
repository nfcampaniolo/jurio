import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { FiArrowLeft, FiArrowRight, FiBookOpen, FiStar, FiX } from "react-icons/fi";

import { resolveOnboardingSection } from "@/features/onboarding/config";
import { useOnboardingCache } from "@/features/onboarding/useOnboardingCache";

export const OnboardingPopups = () => {
  const { pathname } = useLocation();
  const { hasSeen, markAsSeen } = useOnboardingCache();
  const [dismissedMap, setDismissedMap] = useState<Record<string, boolean>>({});
  const [stepMap, setStepMap] = useState<Record<string, number>>({});

  const section = useMemo(() => resolveOnboardingSection(pathname), [pathname]);

  if (!section) {
    return null;
  }

  const currentStepIndex = Math.min(
    stepMap[section.id] ?? 0,
    Math.max(section.slides.length - 1, 0)
  );
  const currentSlide = section.slides[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === section.slides.length - 1;
  const shouldShow = !dismissedMap[section.id] && !hasSeen(section.id);

  if (!shouldShow) {
    return null;
  }

  const dismiss = () => {
    markAsSeen(section.id);
    setDismissedMap((previousMap) => ({
      ...previousMap,
      [section.id]: true,
    }));
  };

  const goNext = () => {
    if (isLastStep) {
      dismiss();
      return;
    }

    setStepMap((previousMap) => ({
      ...previousMap,
      [section.id]: Math.min(currentStepIndex + 1, section.slides.length - 1),
    }));
  };

  const goBack = () => {
    if (isFirstStep) return;

    setStepMap((previousMap) => ({
      ...previousMap,
      [section.id]: Math.max(currentStepIndex - 1, 0),
    }));
  };

  const jumpToStep = (stepIndex: number) => {
    setStepMap((previousMap) => ({
      ...previousMap,
      [section.id]: stepIndex,
    }));
  };

  return (
    <AnimatePresence>
      <motion.aside
        key={section.id}
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        className="fixed bottom-5 right-5 z-[70] w-[min(95vw,440px)] rounded-2xl border p-4 shadow-2xl"
        style={{
          background: "color-mix(in oklab, var(--color-surface) 85%, transparent)",
          borderColor: "color-mix(in oklab, var(--color-border) 72%, transparent)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
        role="dialog"
        aria-label={`Onboarding ${section.title}`}
        aria-live="polite"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-(--color-text)">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-(--color-bg)">
              <FiStar size={14} />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-(--color-muted)">
                Onboarding guidato
              </p>
              <p className="text-sm font-semibold">{section.title}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={dismiss}
            aria-label="Chiudi onboarding"
            className="rounded-md p-1 text-(--color-muted) transition-colors hover:bg-(--color-bg) hover:text-(--color-text)"
          >
            <FiX size={16} />
          </button>
        </div>

        <div className="mt-3 rounded-xl border border-(--color-border) bg-(--color-bg) px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-(--color-muted)">
            Schermata {currentStepIndex + 1} di {section.slides.length}
          </p>
          <AnimatePresence mode="wait">
            <motion.div
              key={`${section.id}-${currentStepIndex}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <p className="mt-1 text-sm font-semibold leading-relaxed text-(--color-text)">
                {currentSlide.title}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-(--color-muted)">
                {currentSlide.description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <ul className="mt-3 space-y-2">
          {currentSlide.bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2 text-xs text-(--color-text)">
              <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-(--color-primary)" aria-hidden="true" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>

        {currentSlide.manualHref && (
          <div className="mt-3">
            <Link
              to={currentSlide.manualHref}
              className="inline-flex items-center gap-2 rounded-lg border border-(--color-border) bg-(--color-bg) px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-(--color-text) transition-colors hover:bg-(--color-surface)"
            >
              <FiBookOpen size={13} />
              {currentSlide.manualLabel || "Apri manuale"}
            </Link>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {section.slides.map((slide, index) => {
              const isActive = index === currentStepIndex;

              return (
                <button
                  key={slide.title}
                  type="button"
                  onClick={() => jumpToStep(index)}
                  className={`h-2 rounded-full transition-all ${
                    isActive
                      ? "w-5 bg-(--color-text)"
                      : "w-2 bg-(--color-border) hover:bg-(--color-muted)"
                  }`}
                  aria-label={`Vai alla schermata ${index + 1}`}
                />
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goBack}
              disabled={isFirstStep}
              className="inline-flex items-center gap-1 rounded-xl border border-(--color-border) bg-(--color-bg) px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-(--color-text) transition-colors enabled:hover:bg-(--color-surface) disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FiArrowLeft size={12} />
              Indietro
            </button>

            <button
              type="button"
              onClick={goNext}
              className="inline-flex items-center gap-1 rounded-xl border border-(--color-border) bg-(--color-bg) px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-(--color-text) transition-colors hover:bg-(--color-surface)"
            >
              {isLastStep ? "Chiudi" : "Avanti"}
              {!isLastStep && <FiArrowRight size={12} />}
            </button>
          </div>
        </div>

        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={dismiss}
            className="text-[11px] font-medium text-(--color-muted) underline-offset-4 transition-colors hover:text-(--color-text) hover:underline"
          >
            Non mostrare più questa guida
          </button>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
};

