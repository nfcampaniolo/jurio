import { useRef, useState } from "react";
import { type Consents } from "@/interfaces/interfaces";
import { toast } from "react-hot-toast";
import { saveUserData } from "@/shared/services/user";
import { useAuth } from "@/context/useAuth";
import { useNavigate } from "react-router-dom";
import { trackEvent } from "@/infrastructure/analytics";
import { fetchWithSecurity } from "@/config/apiClient";

const GET_REGISTER_URL = import.meta.env.VITE_GET_REGISTER_URL as string;
if (!GET_REGISTER_URL) throw new Error("Missing API endpoint env variables");

export function useRegisterPageLogic() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const initialName = user?.displayName?.trim().split(" ")[0] || "";
  const initialSurname = user?.displayName?.trim().split(" ").slice(1).join(" ") || "";

  const [name, setName] = useState(initialName);
  const [surname, setSurname] = useState(initialSurname);
  const [isAdult, setIsAdult] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [role, setRole] = useState<string>("");
  const [roleOther, setRoleOther] = useState<string>("");

  const [consents, setConsents] = useState<Consents>({
    privacy: false,
    terms: false,
    comms: false,
    marketing: false,
  });

  const inFlightRef = useRef(false);

  const handleConsentChange = (key: keyof Consents) => {
    setConsents((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const validateAndContinue = () => {
    if (!name.trim()) {
      toast.error("Inserisci il tuo nome per procedere.");
      return false;
    }
    if (!isAdult) {
      toast.error("Devi dichiarare di avere più di 18 anni per proseguire.");
      return false;
    }
    if (!consents.privacy || !consents.terms) {
      toast.error("Accetta privacy e termini per proseguire.");
      return false;
    }
    return true;
  };

  const saveToDb = async () => {
    if (inFlightRef.current) return;
    if (!validateAndContinue()) return;
    if (!user) return toast.error("Utente non loggato.");

    inFlightRef.current = true;
    setIsSaving(true);

    try {
      await saveUserData(user.uid, {
        name: name.trim(),
        surname: surname.trim(),
        isAdult,
        consents,
        email: user.email,
        ...(role.trim() === "altro"
          ? roleOther.trim()
            ? { role: roleOther.trim() }
            : {}
          : role.trim()
          ? { role: role.trim() }
          : {}),
      });

      const r = await fetchWithSecurity(GET_REGISTER_URL, {});
      const text = await r.text();
      if (!r.ok) throw new Error(`getRegister failed (${r.status}): ${text}`);

      void trackEvent("sign_up", { method: "email", success: true });
      void trackEvent("profile_updated", { type: true });
      void trackEvent("free_trial_start", {});

      toast.success("Dati salvati e prova gratuita attivata!");
      await navigate("/profilo", { replace: true });
    } catch (error: unknown) {
      console.error(error);
      const err = error as Error;
      void trackEvent("analytics_error", {
        name: "register_flow",
        reason: err.message || "unknown_error",
      });
      toast.error("Errore durante il salvataggio dei dati.");
    } finally {
      inFlightRef.current = false;
      setIsSaving(false);
    }
  };

  return {
    name,
    setName,
    surname,
    setSurname,
    isAdult,
    setIsAdult,
    consents,
    handleConsentChange,
    saveToDb,
    role,
    setRole,
    roleOther,
    setRoleOther,
    isSaving,
  };
}