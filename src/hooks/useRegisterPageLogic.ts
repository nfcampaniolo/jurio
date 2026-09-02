import { useRef, useState, useEffect } from "react";
import { type Consents } from "@/interfaces/interfaces";
import { toast } from "react-hot-toast";
import { saveUserData } from "@/services/user";
import { useAuth } from "@/context/useAuth";
import { useNavigate } from "react-router-dom";
import { trackEvent } from "@/services/analytics";
import { fetchWithSecurity } from "@/config/apiClient";

import { setupRecaptcha, sendPhoneVerification, confirmPhoneVerification } from "@/services/auth"; 
import type { ConfirmationResult } from "firebase/auth";

const GET_REGISTER_URL = import.meta.env.VITE_GET_REGISTER_URL as string;
if (!GET_REGISTER_URL) throw new Error("Missing API endpoint env variables");

interface FirebaseError {
  code?: string;
  message?: string;
}

export function useRegisterPageLogic() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const initialName = user?.displayName?.trim().split(" ")[0] || "";
  const initialSurname = user?.displayName?.trim().split(" ").slice(1).join(" ") || "";
  
  const userHasPhone = !!user?.phoneNumber;
  const initialPhone = user?.phoneNumber ? user.phoneNumber.replace(/^\+39/, "") : "";

  const [name, setName] = useState(initialName);
  const [surname, setSurname] = useState(initialSurname);
  
  const [phoneNumber, setPhoneNumber] = useState(initialPhone); 
  const [otpCode, setOtpCode] = useState("");
  const [isOtpSent, setIsOtpSent] = useState(false);
  
  const [isPhoneVerified, setIsPhoneVerified] = useState(userHasPhone);
  
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // NUOVO: Stato per il timer di rinvio SMS
  const [countdown, setCountdown] = useState(0);

  const [role, setRole] = useState<string>("");
  const [roleOther, setRoleOther] = useState<string>("");

  const [consents, setConsents] = useState<Consents>({
    privacy: false, terms: false, comms: false, marketing: false,
  });

  const inFlightRef = useRef(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  useEffect(() => {
    setupRecaptcha('recaptcha-container').catch(console.error);
  }, []);

  // NUOVO: Gestione del timer decrescente
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isOtpSent && countdown > 0 && !isPhoneVerified) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOtpSent, countdown, isPhoneVerified]);

  const handleConsentChange = (key: keyof Consents) => {
    setConsents((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePhoneChange = (val: string) => {
    const digitsOnly = val.replace(/\D/g, "");
    setPhoneNumber(digitsOnly);

    if (isOtpSent || isPhoneVerified) {
      setIsOtpSent(false);
      setIsPhoneVerified(false);
      setOtpCode("");
      setCountdown(0); // Resetta il timer se l'utente cambia numero
    }
  };

  const sendOtp = async () => {
    if (countdown > 0) return; // Blocca invii multipli se il timer è attivo
    if (!phoneNumber || phoneNumber.length < 8) {
      toast.error("Inserisci un numero di telefono valido.");
      return;
    }
    if (!user) {
      toast.error("Utente non autenticato.");
      return;
    }

    setIsSendingOtp(true);
    try {
      const fullPhone = `+39${phoneNumber}`;
      
      const appVerifier = window.recaptchaVerifier;
      if (!appVerifier) throw new Error("ReCaptcha non inizializzato");

      const confirmation = await sendPhoneVerification(user, fullPhone, appVerifier);
      
      setConfirmationResult(confirmation);
      setIsOtpSent(true);
      setCountdown(60); // Imposta il blocco di 60 secondi
      toast.success("Ti abbiamo inviato un codice via SMS!");

    } catch (error: unknown) {
      console.error("Errore invio SMS Firebase:", error);
      const firebaseErr = error as FirebaseError;
      
      if (firebaseErr.code === 'auth/provider-already-linked') {
        toast.success("Il tuo account ha già un numero verificato!");
        setIsPhoneVerified(true);
      } else if (firebaseErr.code === 'auth/credential-already-in-use') {
        toast.error("Questo numero è già associato a un altro account.");
      } else if (firebaseErr.code === 'auth/invalid-phone-number') {
        toast.error("Formato del numero non valido.");
      } else if (firebaseErr.code === 'auth/too-many-requests') {
        toast.error("Troppi tentativi. Riprova più tardi.");
      } else {
        toast.error("Errore durante l'invio del codice SMS.");
      }
    } finally {
      setIsSendingOtp(false);
    }
  };

  const verifyOtp = async () => {
      if (!otpCode.trim() || !confirmationResult) {
        toast.error("Inserisci il codice OTP.");
        return;
      }

      setIsVerifyingOtp(true);
      try {
        await confirmPhoneVerification(confirmationResult, otpCode);
        setIsPhoneVerified(true);
        setCountdown(0); 
        toast.success("Numero verificato con successo!");
      } catch (error: unknown) {
        console.error("Errore verifica OTP:", error);
        const firebaseErr = error as FirebaseError;

        if (firebaseErr.code === 'auth/invalid-verification-code') {
          toast.error("Codice errato, riprova.");
        } else if (firebaseErr.code === 'auth/code-expired') {
          toast.error("Il codice è scaduto. Richiedine uno nuovo.");
        } else if (
          firebaseErr.code === 'auth/credential-already-in-use' || 
          firebaseErr.code === 'auth/account-exists-with-different-credential'
        ) {
          // GESTIONE DEL TUO ERRORE QUI:
          toast.error("Questo numero è già associato a un altro account. Usa un altro numero o accedi con l'account originale.", {
            duration: 5000, // Mostriamo il messaggio un po' più a lungo
          });
          
          // Opzionale: Resettiamo gli stati per fargli inserire un nuovo numero
          setIsOtpSent(false);
          setOtpCode("");
          setCountdown(0);
        } else {
          toast.error("Errore durante la verifica.");
        }
      } finally {
        setIsVerifyingOtp(false);
      }
  };

  const validateAndContinue = () => {
    if (!name.trim()) {
      toast.error("Inserisci il tuo nome per procedere.");
      return false;
    }
    if (!isPhoneVerified) {
      toast.error("Devi verificare il tuo numero di telefono prima di proseguire.");
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
      const fullPhone = `+39${phoneNumber}`;

      await saveUserData(user.uid, {
        name: name.trim(),
        surname: surname.trim(),
        phoneNumber: fullPhone,
        consents,
        email: user.email,
        ...(role.trim() === "altro" ? (roleOther.trim() ? { role: roleOther.trim() } : {}) : (role.trim() ? { role: role.trim() } : {})),
      });

      const r = await fetchWithSecurity(GET_REGISTER_URL, {});
      const text = await r.text();
      if (!r.ok) throw new Error(`getRegister failed (${r.status}): ${text}`);

      trackEvent("sign_up", { method: "email", success: true });
      trackEvent("profile_updated", { type: true });
      trackEvent("free_trial_start", {});

      toast.success("Dati salvati e prova gratuita attivata!");
      navigate("/profilo", { replace: true });
    } catch (error: unknown) {
      console.error(error);
      const err = error as Error;
      trackEvent("analytics_error", {
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
    name, setName,
    surname, setSurname,
    phoneNumber, handlePhoneChange,
    otpCode, setOtpCode,
    isOtpSent, isPhoneVerified,
    isSendingOtp, isVerifyingOtp,
    sendOtp, verifyOtp,
    consents, handleConsentChange,
    saveToDb,
    role, setRole,
    roleOther, setRoleOther,
    isSaving,
    countdown // NUOVO: Esposto per la UI
  };
}