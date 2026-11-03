import { useEffect, useRef, useState } from "react";

interface SmoothLoadingOptions {
  showDelayMs?: number;
  minVisibleMs?: number;
}

export function useSmoothLoading(
  isLoading: boolean,
  { showDelayMs = 140, minVisibleMs = 220 }: SmoothLoadingOptions = {}
) {
  const [isVisible, setIsVisible] = useState(false);
  const shownAtRef = useRef<number | null>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }

    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (isLoading) {
      if (!isVisible) {
        showTimerRef.current = setTimeout(() => {
          shownAtRef.current = Date.now();
          setIsVisible(true);
          showTimerRef.current = null;
        }, showDelayMs);
      }
      return () => {
        if (showTimerRef.current) {
          clearTimeout(showTimerRef.current);
          showTimerRef.current = null;
        }
      };
    }

    if (!isVisible) {
      shownAtRef.current = null;
      return;
    }

    const elapsed = shownAtRef.current ? Date.now() - shownAtRef.current : 0;
    const remaining = Math.max(minVisibleMs - elapsed, 0);

    hideTimerRef.current = setTimeout(() => {
      setIsVisible(false);
      shownAtRef.current = null;
      hideTimerRef.current = null;
    }, remaining);

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [isLoading, isVisible, minVisibleMs, showDelayMs]);

  useEffect(() => {
    return () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  return isVisible;
}
