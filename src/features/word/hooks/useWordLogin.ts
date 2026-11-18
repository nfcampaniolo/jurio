import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchWithSecurity } from "@/config/apiClient";
import { getWordAuthUrl } from "@/config/env";

export type WordLoginPhase = "loading" | "ready" | "submitting" | "approved" | "denied" | "error";

const SESSION_ID = /^[A-Za-z0-9_-]{43}$/;
const INVALID_LINK = "Collegamento non valido. Avvia di nuovo l'accesso dal pannello Jurio in Word.";

async function callWordAuth<T>(body: Record<string, unknown>): Promise<T> {
  const url = getWordAuthUrl();
  if (!url) throw new Error("Servizio di collegamento a Word non configurato.");
  const res = await fetchWithSecurity(url, body);
  const data = (await res.json().catch(() => ({}))) as T & { details?: string };
  if (!res.ok) throw new Error(data.details || "Richiesta non riuscita. Riprova.");
  return data;
}

/** Autorizzazione dell'add-in Word dalla web app: mostra il codice e conferma o rifiuta. */
export function useWordLogin() {
  const [params] = useSearchParams();
  const sessionId = params.get("s") ?? "";
  const valid = SESSION_ID.test(sessionId);
  const [phase, setPhase] = useState<WordLoginPhase>(valid ? "loading" : "error");
  const [code, setCode] = useState("");
  const [error, setError] = useState(valid ? "" : INVALID_LINK);

  useEffect(() => {
    if (!valid) return undefined;
    let cancelled = false;
    callWordAuth<{ code: string }>({ action: "describe", sessionId })
      .then((data) => {
        if (cancelled) return;
        setCode(data.code);
        setPhase("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Richiesta non valida.");
        setPhase("error");
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, valid]);

  const decide = useCallback(
    async (action: "approve" | "deny") => {
      setPhase("submitting");
      setError("");
      try {
        await callWordAuth({ action, sessionId });
        setPhase(action === "approve" ? "approved" : "denied");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Richiesta non riuscita.");
        setPhase("error");
      }
    },
    [sessionId]
  );

  return {
    phase,
    code,
    error,
    approve: () => decide("approve"),
    deny: () => decide("deny"),
  };
}
