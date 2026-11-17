import { useState } from "react";
import { loginWithEmail, registerWithEmail, resetPassword, needsEmailVerification, sendVerificationEmail } from "./auth";
import { useUserStore } from "@/infrastructure/userStore";
import { useNavigate } from "react-router-dom";
import { userExists } from "@/shared/services/user";
import { toast } from "react-hot-toast"; 
import { getPasswordFailures } from "../passwordRules";

export function useAuthFormLogic(initialMode: "login" | "register") {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setUser = useUserStore((s) => s.setUser);
  const navigate = useNavigate();

  const toggleMode = () =>
    setMode((m) => (m === "login" ? "register" : "login"));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "login") {
        const res = await loginWithEmail(email, password);
        setUser(res.user);
        console.log(res.user);
        const exists = await userExists(res.user.uid);
        if (exists) {
          void navigate("/profilo");
        } else if (needsEmailVerification(res.user)) {
          void navigate("/verifica-email");
        } else {
          void navigate("/registrati");
        }
      } else {
        const failedRequirements = getPasswordFailures(password).map((msg) => `• ${msg}`);

        if (failedRequirements.length > 0) {
          toast.error(`La password deve contenere:\n${failedRequirements.join("\n")}`, {
            duration: 5000,
            style: {
              whiteSpace: 'pre-line', // per rispettare le newline
              maxWidth: '350px',
              lineHeight: '1.5',
            }
          });
        } else {
          // password ok, procedi con la registrazione
          await registerWithEmail(email, password);
          try {
            await sendVerificationEmail();
          } catch (sendErr) {
            // La pagina di verifica permette comunque di richiedere un nuovo invio
            console.error("[register] Invio email di verifica fallito:", sendErr);
          }
          void navigate("/verifica-email", { replace: true, state: { emailSent: true } });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore di autenticazione");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
        setError("Inserisci l’email per reimpostare la password");
        return;
    }

    setLoading(true);
    setError(null);

    try {
        await resetPassword(email);
        toast.success("Se l'indirizzo è registrato, riceverai un'email con il link per reimpostare la password.", { duration: 6000 });
    } catch (err) {
        setError(
        err instanceof Error && err.message === "rate_limited"
            ? "Troppe richieste. Attendi qualche minuto e riprova."
            : err instanceof Error && err.message === "invalid_email"
            ? "Inserisci un indirizzo email valido"
            : "Errore durante l'invio. Riprova tra poco."
        );
    } finally {
        setLoading(false);
    }
  };
  
  return {
    mode,
    email,
    password,
    loading,
    error,
    setEmail,
    setPassword,
    toggleMode,
    handleSubmit,
    handleResetPassword,
  };
}