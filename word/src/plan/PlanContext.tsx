import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { PianoWord, postWordAgent, UsageResponse } from "../api/wordApi";

export interface PlanState {
  loading: boolean;
  error: string;
  piano: PianoWord | null;
  /** null = nessun tetto mensile (Business, admin). */
  limiteMensile: number | null;
  usateMese: number;
  /** null se non c'è tetto. */
  rimaste: number | null;
  aiEsaurita: boolean;
  refresh: () => Promise<void>;
}

const noop = async () => {};

const PlanContext = createContext<PlanState>({
  loading: false,
  error: "",
  piano: null,
  limiteMensile: null,
  usateMese: 0,
  rimaste: null,
  aiEsaurita: false,
  refresh: noop,
});

export const PIANO_LABEL: Record<PianoWord, string> = {
  essential: "Essential",
  business: "Business",
  prova: "Prova gratuita",
  admin: "Admin",
  nessuno: "Nessun piano attivo",
};

export const PlanProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const data = await postWordAgent<UsageResponse>({ action: "usage" });
      setUsage(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile leggere il piano.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<PlanState>(() => {
    const limiteMensile = usage?.ai.limiteMensile ?? null;
    const usateMese = usage?.ai.usateMese ?? 0;
    const rimaste = limiteMensile === null ? null : Math.max(0, limiteMensile - usateMese);
    return {
      loading,
      error,
      piano: usage?.piano ?? null,
      limiteMensile,
      usateMese,
      rimaste,
      aiEsaurita: rimaste === 0,
      refresh,
    };
  }, [usage, loading, error, refresh]);

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
};

export const usePlan = () => useContext(PlanContext);
