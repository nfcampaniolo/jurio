import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { confirmNewPassword, verifyResetCode } from "./auth";
import { getPasswordFailures } from "../passwordRules";

export type ResetPasswordPhase = "checking" | "form" | "done" | "invalid";

function readResetCode(params: URLSearchParams): string | null {
  const oobCode = params.get("oobCode");
  return params.get("mode") === "resetPassword" && oobCode ? oobCode : null;
}

export function useResetPasswordLogic() {
  const [searchParams] = useSearchParams();
  const [oobCode] = useState(() => readResetCode(searchParams));

  const [phase, setPhase] = useState<ResetPasswordPhase>(oobCode ? "checking" : "invalid");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkedRef = useRef(false);

  // Verifica del codice senza consumarlo: serve a mostrare l'email e a scartare link scaduti.
  useEffect(() => {
    if (!oobCode || checkedRef.current) return;
    checkedRef.current = true;
    verifyResetCode(oobCode)
      .then((accountEmail) => {
        setEmail(accountEmail);
        setPhase("form");
      })
      .catch((err) => {
        console.error("[resetPassword] Codice non valido o scaduto:", err);
        setPhase("invalid");
      });
  }, [oobCode]);

  const failures = getPasswordFailures(password);
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = !submitting && password.length > 0 && failures.length === 0 && confirm === password;

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!oobCode || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await confirmNewPassword(oobCode, password);
      setPhase("done");
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      if (code === "auth/expired-action-code" || code === "auth/invalid-action-code") {
        setPhase("invalid");
      } else if (code === "auth/weak-password") {
        setError("La password scelta è troppo debole.");
      } else {
        setError("Non è stato possibile aggiornare la password. Riprova.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return {
    phase,
    email,
    password,
    setPassword,
    confirm,
    setConfirm,
    failures,
    mismatch,
    canSubmit,
    submitting,
    error,
    submit,
  };
}
