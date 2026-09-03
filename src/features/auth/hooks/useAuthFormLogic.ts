import { useState } from "react";
import { loginWithEmail, registerWithEmail, resetPassword } from "./auth";
import { useUserStore } from "@/infrastructure/userStore";
import { useNavigate } from "react-router-dom";
import { userExists } from "@/shared/services/user";
import { toast } from "react-hot-toast"; 

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
          navigate("/profilo");
        } else {
          navigate("/registrati");
        }
      } else {
          // Controllo requisiti password
        const passwordRequirements = [
          { regex: /[A-Z]/, message: "Almeno una lettera maiuscola" },
          { regex: /[a-z]/, message: "Almeno una lettera minuscola" },
          { regex: /\d/, message: "Almeno un numero" },
          { regex: /[!@#$%^&*(),.?":{}|<>]/, message: "Almeno un carattere speciale" },
          { regex: /^.{8,20}$/, message: "Lunghezza tra 8 e 20 caratteri" }
        ];

        const failedRequirements = passwordRequirements
          .filter(req => !req.regex.test(password))
          .map(req => `• ${req.message}`);

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
          setMode("login"); // switch automatico alla modalità login
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
        setError("Email di recupero inviata"); // temporaneo, poi toast
    } catch (err) {
        setError(
        err instanceof Error
            ? err.message
            : "Errore durante il reset password"
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