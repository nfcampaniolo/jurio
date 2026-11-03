import { useCallback, useState } from "react";

import { ONBOARDING_STORAGE_KEY } from "@/features/onboarding/config";

type OnboardingCacheState = Record<string, boolean>;

const readOnboardingCache = (): OnboardingCacheState => {
  if (typeof window === "undefined") return {};

  try {
    const cached = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!cached) return {};

    const parsed = JSON.parse(cached) as OnboardingCacheState;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
};

export const useOnboardingCache = () => {
  const [cache, setCache] = useState<OnboardingCacheState>(() => readOnboardingCache());

  const markAsSeen = useCallback((sectionId: string) => {
    setCache((previousCache) => {
      const nextCache = {
        ...previousCache,
        [sectionId]: true,
      };

      try {
        window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(nextCache));
      } catch {
        // no-op: se localStorage non è disponibile, manteniamo almeno lo stato runtime
      }

      return nextCache;
    });
  }, []);

  return {
    hasSeen: (sectionId: string) => Boolean(cache[sectionId]),
    markAsSeen,
  };
};

