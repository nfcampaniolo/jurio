import React from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowLeft, FiCopy } from "react-icons/fi";
import { toast } from "react-hot-toast";
import { motion, type Variants, useReducedMotion } from "framer-motion";
import { useProfile } from "@/features/profile/hooks/useProfile";
import { EditProfileAvatar } from "@/features/profile/components/EditProfileAvatar";
import { EditProfileForm } from "@/features/profile/components/EditProfileForm";
import { EditProfileConsents } from "@/features/profile/components/EditProfileConsents";
import { Loader2 } from "lucide-react";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

const page: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.35, when: "beforeChildren", staggerChildren: 0.06 } },
};

const card: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.99 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: "easeOut" as const } },
};

export const EditProfile: React.FC = () => {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const {
    user,
    loading,
    userData,
    name,
    surname,
    avatar,
    consents,
    saving,
    setName,
    setSurname,
    setAvatar,
    setAvatarFile,
    handleConsentChange,
    handleSave,
    role,
    setRole,
    roleOther,
    setRoleOther,
  } = useProfile();

  if (loading || !user || !userData) {
    return (
      <div className="h-screen flex items-center justify-center text-(--color-muted) gap-2 bg-(--color-bg)">
        <Loader2 size={16} className="animate-spin text-(--color-text)" />
        <span className="text-xs font-bold uppercase tracking-widest">Caricamento...</span>
      </div>
    );
  }

  const onSave = async () => {
    try {
      await handleSave();
      toast.success("Profilo aggiornato");
      navigate("/profilo", { replace: true });
    } catch (e) {
      console.error(e);
      toast.error("Errore durante il salvataggio.");
    }
  };

  const copyMcpToken = () => {
    // Sostituisci user.uid con l'attributo corretto se il tuo auth provider usa un nome diverso (es. user.id)
    if (user?.uid) {
      navigator.clipboard.writeText(`Bearer ${user.uid}`);
      toast.success("Token MCP copiato!");
    } else {
      toast.error("Impossibile recuperare l'ID utente");
    }
  };

  return (
    <motion.main
      className="min-h-screen px-4 py-10 max-w-5xl mx-auto"
      style={{ backgroundColor: "var(--color-bg)", color: "var(--color-text)" }}
      variants={page}
      initial="hidden"
      animate="show"
    >
      <div>
        {/* Header */}
        <motion.div className="flex items-start justify-between gap-4 mb-8" variants={fadeUp}>
          <div>
            <motion.h1 className="text-2xl sm:text-3xl font-medium tracking-tight" style={{ fontFamily: 'var(--font-serif)' }} variants={fadeUp}>
              Modifica profilo
            </motion.h1>
            <motion.p className="mt-2 text-xs sm:text-sm text-(--color-muted) font-light leading-relaxed" variants={fadeUp}>
              Aggiorna le informazioni del tuo account. I consensi opzionali possono essere modificati in qualsiasi momento.
            </motion.p>
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex w-fit items-center gap-2 px-4 py-2.5 rounded-md border border-(--color-border) bg-(--color-surface) hover:border-(--color-text) text-(--color-text) text-xs font-bold uppercase tracking-widest transition-colors shadow-xs outline-none"
            aria-label="Torna al profilo"
          >
            <FiArrowLeft size={15} className="opacity-70" />
            <span>Torna al profilo</span>
          </button>
        </motion.div>

        {/* Card */}
        <motion.div
          className="relative rounded-lg border border-(--color-border) shadow-(--shadow-soft) p-6 sm:p-8 overflow-hidden bg-(--color-surface)"
          variants={card}
        >
          {/* LA LINEA DI RIGORE SUPERIORE (Unico tocco di colore) */}
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

          <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 mt-1">
            <EditProfileAvatar
              avatar={avatar}
              name={name}
              shouldReduceMotion={shouldReduceMotion ?? null}
              setAvatar={setAvatar}
              setAvatarFile={setAvatarFile}
            />

            <EditProfileForm
              name={name}
              setName={setName}
              surname={surname}
              setSurname={setSurname}
              role={role}
              setRole={setRole}
              roleOther={roleOther}
              setRoleOther={setRoleOther}
              shouldReduceMotion={shouldReduceMotion ?? null}
            />
          </div>

          <EditProfileConsents
            consents={consents}
            handleConsentChange={handleConsentChange}
            shouldReduceMotion={shouldReduceMotion ?? null}
          />

          {/* Azioni */}
          <motion.div className="flex flex-col sm:flex-row justify-between gap-6 pt-10" variants={fadeUp}>
            
            {/* Pulsante Copia Token (Allineato a sinistra) */}
            <motion.button
              type="button"
              onClick={copyMcpToken}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md border border-(--color-border) text-(--color-muted) bg-(--color-surface) hover:text-(--color-text) hover:border-(--color-text) transition-colors text-xs font-bold uppercase tracking-widest outline-none shadow-xs"
              whileHover={shouldReduceMotion ? undefined : { y: -1 }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
              title="Copia token per integrazione Mistral AI MCP"
            >
              <FiCopy size={15} className="opacity-70" />
              <span>Copia Token MCP</span>
            </motion.button>

            {/* Azioni Form (Allineate a destra) */}
            <div className="flex flex-row gap-3">
              <motion.button
                type="button"
                onClick={() => navigate("/profilo")}
                className="w-full sm:w-auto px-5 py-2.5 rounded-md border border-(--color-border) text-(--color-text) bg-(--color-surface) hover:bg-(--color-bg) transition-colors text-xs font-bold uppercase tracking-widest outline-none shadow-xs"
                disabled={saving}
                whileHover={shouldReduceMotion ? undefined : { y: -1 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
              >
                Annulla
              </motion.button>

              <motion.div whileHover={shouldReduceMotion ? undefined : { y: -1 }} whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={saving}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-md bg-(--color-text) text-(--color-surface) text-xs font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-35 disabled:cursor-not-allowed transition-all shadow-xs outline-none flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  <span>{saving ? "Salvataggio..." : "Salva"}</span>
                </button>
              </motion.div>
            </div>
            
          </motion.div>
        </motion.div>

        {/* Footer link legali */}
        <motion.div
          className="mt-8 flex justify-center gap-6 text-xs text-(--color-muted) font-light uppercase tracking-widest"
          variants={fadeUp}
        >
          <a href="/privacy" className="hover:text-(--color-text) transition-colors underline underline-offset-2">
            Privacy
          </a>
          <a href="/termini" className="hover:text-(--color-text) transition-colors underline underline-offset-2">
            Termini
          </a>
          <a href="/gdpr" className="hover:text-(--color-text) transition-colors underline underline-offset-2">
            Trattamento dati
          </a>
        </motion.div>
      </div>
    </motion.main>
  );
};

export default EditProfile;