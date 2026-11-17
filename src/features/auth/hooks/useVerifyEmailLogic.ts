import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { useAuth } from "@/context/useAuth";
import { userExists } from "@/shared/services/user";
import {
  confirmEmailVerification,
  logout,
  needsEmailVerification,
  sendVerificationEmail,
} from "./auth";

export type VerifyEmailPhase = "verifying" | "verified" | "invalid" | "pending";

const RESEND_COOLDOWN_SECONDS = 60;

function readActionCode(params: URLSearchParams): string | null {
  const mode = params.get("mode");
  const oobCode = params.get("oobCode");
  return mode === "verifyEmail" && oobCode ? oobCode : null;
}

export function useVerifyEmailLogic() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, status, refreshUser } = useAuth();

  // Il codice viene letto una sola volta: dopo l'uso lo togliamo dall'URL.
  const [oobCode] = useState(() => readActionCode(searchParams));
  const [phase, setPhase] = useState<VerifyEmailPhase>(oobCode ? "verifying" : "pending");
  const [isSending, setIsSending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [cooldown, setCooldown] = useState(() =>
    (location.state as { emailSent?: boolean } | null)?.emailSent ? RESEND_COOLDOWN_SECONDS : 0
  );

  const appliedRef = useRef(false);

  // 1. Applicazione del codice ricevuto via email (protetto dal doppio mount di StrictMode:
  //    un oobCode è monouso e una seconda chiamata fallirebbe).
  useEffect(() => {
    if (!oobCode || appliedRef.current) return;
    appliedRef.current = true;

    void (async () => {
      try {
        await confirmEmailVerification(oobCode);
        setPhase("verified");
      } catch (err) {
        console.error("[verifyEmail] Codice non valido o scaduto:", err);
        // Il link potrebbe essere già stato usato: se l'utente risulta verificato va bene così.
        const refreshed = await refreshUser().catch(() => null);
        setPhase(refreshed?.emailVerified ? "verified" : "invalid");
      } finally {
        setSearchParams({}, { replace: true });
      }
    })();
  }, [oobCode, refreshUser, setSearchParams]);

  // 2. Dopo la verifica, aggiorna l'utente loggato (claim email_verified nel token).
  useEffect(() => {
    if (phase !== "verified" || status !== "authenticated" || !user || user.emailVerified) return;
    void refreshUser().catch((err) => console.error("[verifyEmail] Refresh utente fallito:", err));
  }, [phase, status, user, refreshUser]);

  // 3. Account registrati prima dell'introduzione della verifica: non vanno bloccati.
  useEffect(() => {
    if (phase !== "pending" || status !== "authenticated" || !user) return;
    let mounted = true;
    userExists(user.uid)
      .then((exists) => mounted && setHasProfile(exists))
      .catch(() => mounted && setHasProfile(false));
    return () => {
      mounted = false;
    };
  }, [phase, status, user]);

  // 4. Countdown per il reinvio.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  const checkVerification = useCallback(
    async (silent = false) => {
      if (!silent) setIsChecking(true);
      try {
        const refreshed = await refreshUser();
        if (refreshed?.emailVerified) {
          toast.success("Email confermata!");
          void navigate("/registrati", { replace: true });
        } else if (!silent) {
          toast.error("L'indirizzo non risulta ancora confermato. Controlla la tua casella di posta.");
        }
      } catch (err) {
        console.error("[verifyEmail] Verifica stato fallita:", err);
        if (!silent) toast.error("Impossibile verificare lo stato. Riprova.");
      } finally {
        if (!silent) setIsChecking(false);
      }
    },
    [navigate, refreshUser]
  );

  // 5. Quando l'utente torna su questa scheda (dopo aver cliccato il link altrove), ricontrolla.
  useEffect(() => {
    if (phase !== "pending" || !needsEmailVerification(user)) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void checkVerification(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [phase, user, checkVerification]);

  const resend = async () => {
    if (isSending || cooldown > 0) return;
    setIsSending(true);
    try {
      const { alreadyVerified } = await sendVerificationEmail();
      if (alreadyVerified) {
        await checkVerification(true);
        return;
      }
      toast.success("Ti abbiamo inviato una nuova email di conferma.");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      if (err instanceof Error && err.message === "rate_limited") {
        toast.error("Hai richiesto troppe email. Attendi qualche minuto e riprova.");
        setCooldown(RESEND_COOLDOWN_SECONDS);
      } else {
        toast.error("Invio non riuscito. Riprova tra poco.");
      }
    } finally {
      setIsSending(false);
    }
  };

  const switchAccount = async () => {
    try {
      await logout();
    } finally {
      void navigate("/login", { replace: true });
    }
  };

  return {
    phase,
    user,
    status,
    hasProfile,
    cooldown,
    isSending,
    isChecking,
    resend,
    checkVerification: () => checkVerification(false),
    switchAccount,
  };
}
