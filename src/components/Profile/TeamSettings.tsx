import type { Team } from "@/interfaces/interfaces";
import { useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { FiSettings, FiSave, FiShare2, FiAlertTriangle, FiTrash2 } from "react-icons/fi";
import { ConfirmModal } from "../ConfirmModal";
import { useTeamSettings } from "@/hooks/teams";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const cardVariants: Variants = {
  hidden: { opacity: 1, y: 0 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

const fadeUpVariants: Variants = { 
  hidden: { opacity: 1, y: 0 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

// Varianti per la modale Danger
const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.15, ease: "easeOut" } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.1 } },
};

interface TeamSettingsProps {
  team: Team;
  isManager: boolean;
}

export default function TeamSettings({ team, isManager }: TeamSettingsProps) {
  const {
    name,
    setName,
    isTeamDefault,
    toggleTeamDefault,
    saving,
    isSharingAll,
    isShareConfirmOpen,
    handleSave,
    handleShareAllPastDocuments,
    closeShareConfirm,
    executeShareAll,
    deleteTeamAction 
  } = useTeamSettings({ team, isManager });

  const navigate = useNavigate();

  // Stati per la modale di eliminazione
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [revokeDocs, setRevokeDocs] = useState(true);

  const isFormDisabled = !isManager || saving || isSharingAll || isDeleting;

  const handleDeleteTeam = async () => {
    setIsDeleting(true);
    try {
      await deleteTeamAction(team.id, revokeDocs);
      navigate("/profilo");
    } catch (error) {
      console.error("Errore eliminazione:", error);
      // Mostra toast di errore
    } finally {
      setIsDeleting(false);
      setDeleteModalOpen(false);
    }
  };

  return (
    <>
      <motion.section 
        className="relative p-6 sm:p-8 rounded-lg border border-(--color-border) shadow-(--shadow-soft) bg-(--color-surface) overflow-hidden"
        variants={cardVariants}
        initial="hidden"
        animate="show"
      >
        {/* LA LINEA DI RIGORE SUPERIORE */}
        <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

        {/* Intestazione */}
        <motion.div className="mb-6 mt-1" variants={fadeUpVariants}>
          <h2 className="text-lg sm:text-xl font-medium text-(--color-text) tracking-tight flex items-center gap-2.5" style={{ fontFamily: 'var(--font-serif)' }}>
            <span className="p-1.5 rounded-md border border-(--color-border) bg-(--color-bg)">
              <FiSettings className="w-4 h-4 text-(--color-text) opacity-80" />
            </span>
            Impostazioni Workspace
          </h2>
          <p className="text-xs sm:text-sm text-(--color-muted) font-light mt-2 leading-relaxed">
            {isManager 
              ? "Modifica il nome del team e le preferenze di visibilità dei documenti." 
              : "Visualizza le impostazioni attuali del Workspace (modificabili solo dai manager)."}
          </p>
        </motion.div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Nome Workspace */}
          <motion.div variants={fadeUpVariants} className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted) ml-1">
              Nome Workspace
            </label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              disabled={isFormDisabled}
              className="w-full px-3.5 py-2.5 rounded-md border border-(--color-border) text-(--color-text) bg-(--color-bg) focus:border-(--color-text) outline-none text-sm font-light placeholder:text-(--color-muted) shadow-xs transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
              required
            />
          </motion.div>

          {/* Switch Visibilità Documenti Predefinita */}
          <motion.div variants={fadeUpVariants} className="flex flex-col gap-2 pt-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted) ml-1">
              Visibilità Documenti Predefinita
            </label>
            <p className="text-xs text-(--color-muted) font-light leading-relaxed ml-1">
              Determina se i documenti creati dai membri del team partono già condivisi con tutto il workspace o se sono privati per impostazione predefinita. 
            </p>

            <label className={`flex items-start gap-3.5 p-4 rounded-md border border-(--color-border) bg-(--color-bg) select-none mt-2 shadow-xs transition-colors ${!isFormDisabled ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
              <input
                type="checkbox"
                checked={isTeamDefault}
                onChange={toggleTeamDefault}
                disabled={isFormDisabled}
                className="sr-only"
              />

              <motion.span
                className={`w-10 h-5 flex items-center shrink-0 p-0.5 rounded-sm transition-colors duration-200 mt-0.5 border ${
                  isTeamDefault
                    ? "bg-(--color-text) border-(--color-text)"
                    : "bg-(--color-surface) border-(--color-border)"
                }`}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 380, damping: 18 }}
                aria-hidden="true"
              >
                <motion.span
                  className="w-4 h-4 rounded-xs bg-(--color-surface) shadow-xs flex items-center justify-center"
                  animate={{ x: isTeamDefault ? 20 : 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                >
                  <AnimatePresence initial={false}>
                    {isTeamDefault && (
                      <motion.svg
                        key="check"
                        className="w-3 h-3 text-(--color-text)"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={3}
                        viewBox="0 0 24 24"
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.7 }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </motion.svg>
                    )}
                  </AnimatePresence>
                </motion.span>
              </motion.span>

              <div className="flex flex-col">
                <span className="text-xs font-bold uppercase tracking-wider text-(--color-text)">
                  {isTeamDefault ? "Visibile al Team di default" : "Privato di default"}
                </span>
                <span className="text-xs text-(--color-muted) font-light mt-0.5 leading-relaxed">
                  {isTeamDefault 
                    ? "I nuovi documenti sono immediatamente accessibili a tutti i colleghi del team." 
                    : "I nuovi documenti sono visibili solo all'autore (con opzione di condivisione manuale)."}
                </span>
              </div>
            </label>
          </motion.div>
          
          {/* Bottone di salvataggio Impostazioni Base */}
          {isManager && (
            <motion.div variants={fadeUpVariants} className="pt-2 flex justify-end">
              <button 
                type="submit" 
                disabled={isFormDisabled} 
                className="inline-flex items-center gap-2 bg-(--color-text) text-(--color-surface) hover:opacity-90 px-5 py-2.5 rounded-md text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-35 disabled:cursor-not-allowed shadow-xs outline-none cursor-pointer"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                <FiSave className="w-3.5 h-3.5 opacity-70" />
                <span>{saving ? "Salvataggio..." : "Salva Modifiche"}</span>
              </button>
            </motion.div>
          )}
        </form>

        {/* Sezione Azioni di Massa */}
        {isManager && (
          <motion.div variants={fadeUpVariants} className="mt-8 pt-6 border-t border-(--color-border)">
            <h3 className="text-xs font-bold uppercase tracking-wider text-(--color-text) mb-2 flex items-center gap-2">
              <FiShare2 className="w-4 h-4 text-blue-500 shrink-0" />
              Azioni di massa (Storico)
            </h3>
            <p className="text-xs text-(--color-muted) font-light leading-relaxed mb-4">
              Puoi forzare la condivisione di <strong className="font-semibold text-(--color-text)">tutti i fascicoli e documenti già esistenti</strong>. 
              Questa azione renderà immediatamente visibile al team l'intero storico caricato da qualsiasi membro.
            </p>
            
            <button 
              type="button" 
              onClick={handleShareAllPastDocuments}
              disabled={isFormDisabled} 
              className="inline-flex items-center gap-2 bg-(--color-surface) border border-(--color-border) text-(--color-text) hover:border-(--color-text) px-4 py-2.5 rounded-md text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-35 disabled:cursor-not-allowed shadow-xs outline-none cursor-pointer"
            >
              {isSharingAll && <Loader2 size={14} className="animate-spin" />}
              <FiShare2 className="w-3.5 h-3.5 opacity-70" />
              <span>{isSharingAll ? "Elaborazione in corso..." : "Condividi tutto lo storico"}</span>
            </button>
          </motion.div>
        )}

        {/* DANGER ZONE - Chiusura Workspace */}
        {isManager && (
          <motion.div variants={fadeUpVariants} className="mt-8 pt-6 border-t border-red-900/20">
            <h3 className="text-xs font-bold uppercase tracking-wider text-red-500 mb-2 flex items-center gap-2">
              <FiAlertTriangle className="w-4 h-4 shrink-0" />
              Danger Zone
            </h3>
            <p className="text-xs text-(--color-muted) font-light leading-relaxed mb-4">
              Chiudi definitivamente questo workspace. Tutti i membri verranno rimossi immediatamente, i voucher associati andranno <strong className="font-semibold text-(--color-text)">persi per sempre</strong> e l'operazione non è reversibile.
            </p>
            
            <button 
              type="button" 
              onClick={() => setDeleteModalOpen(true)}
              disabled={isFormDisabled} 
              className="inline-flex items-center gap-2 bg-(--color-surface) border border-red-900/30 text-red-500 hover:bg-red-500/10 hover:border-red-500/50 px-4 py-2.5 rounded-md text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-35 disabled:cursor-not-allowed shadow-xs outline-none cursor-pointer"
            >
              <FiTrash2 className="w-3.5 h-3.5" />
              <span>Elimina Workspace</span>
            </button>
          </motion.div>
        )}

        <ConfirmModal
          isOpen={isShareConfirmOpen}
          title="Condivisione massiva documenti"
          message="Attenzione: Stai per rendere visibili a tutto il team TUTTI i documenti e i fascicoli creati finora. Questa operazione non può essere annullata in modo massivo. Vuoi procedere?"
          confirmText="Procedi"
          cancelText="Annulla"
          onCancel={closeShareConfirm}
          onConfirm={executeShareAll}
        />
      </motion.section>

      {/* Modale dedicata per l'eliminazione del Team */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              className="bg-(--color-bg) border border-(--color-border) rounded-lg shadow-xl w-full max-w-md p-6 relative"
            >
              <h3 className="text-lg font-medium text-(--color-text) flex items-center gap-2 mb-2">
                <FiAlertTriangle className="text-red-500" />
                Elimina Workspace
              </h3>
              
              <div className="space-y-4 mb-6">
                <p className="text-sm text-(--color-muted) font-light">
                  Sei sicuro di voler chiudere <strong className="font-semibold text-(--color-text)">{name}</strong>? Questa operazione è <strong className="font-semibold text-red-400">irreversibile</strong>.
                </p>
                
                <ul className="text-xs text-(--color-muted) font-light space-y-2 list-disc pl-4">
                  <li>Tutti i membri perderanno immediatamente l'accesso.</li>
                  <li>Tutti i <strong className="font-semibold text-(--color-text)">voucher</strong> (utilizzati e non) legati al team andranno persi per sempre.</li>
                  <li>I membri riceveranno un'email di notifica della chiusura.</li>
                </ul>
              </div>

              {/* Checkbox riassegnazione documenti */}
              <label className="flex items-start gap-3 p-3 border border-(--color-border) rounded-md bg-(--color-surface) cursor-pointer hover:border-(--color-text) transition-colors mb-6">
                <div className="relative flex items-center mt-0.5">
                  <input
                    type="checkbox"
                    checked={revokeDocs}
                    onChange={(e) => setRevokeDocs(e.target.checked)}
                    className="appearance-none w-4 h-4 border border-(--color-text) rounded-sm bg-transparent checked:bg-(--color-primary) checked:border-(--color-primary) transition-colors cursor-pointer"
                  />
                  {revokeDocs && (
                    <svg className="absolute w-3 h-3 text-white left-0.5 top-0.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-(--color-text)">
                    Riassegna i fascicoli
                  </span>
                  <span className="text-xs text-(--color-muted) font-light mt-0.5">
                    Trasferisci la proprietà di tutti i documenti e fascicoli degli altri membri al tuo account personale per non perdere lo storico.
                  </span>
                </div>
              </label>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteModalOpen(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-md text-sm font-medium text-(--color-text) border border-(--color-border) hover:bg-(--color-surface) transition-colors disabled:opacity-50"
                >
                  Annulla
                </button>
                <button
                  onClick={handleDeleteTeam}
                  disabled={isDeleting}
                  className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors border border-transparent disabled:opacity-50 cursor-pointer"
                >
                  {isDeleting && <Loader2 size={14} className="animate-spin" />}
                  Sì, elimina Workspace
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}