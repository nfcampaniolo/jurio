import { useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { 
  FiUserCheck, 
  FiShield, 
  FiClock, 
  FiInfo, 
  FiTrash2, 
  FiLogOut, 
  FiAlertCircle 
} from "react-icons/fi";
import { useTeamMembers } from "@/hooks/teams";

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: "easeOut" },
  },
};

const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 4 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.18, ease: "easeOut" },
  },
};

const listVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { delayChildren: 0.04, staggerChildren: 0.03 },
  },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.18, ease: "easeOut" },
  },
};

// Varianti per la modale di conferma
const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.15, ease: "easeOut" } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.1 } },
};

interface TeamMembersProps {
  teamId: string;
  isManager: boolean;
  currentUserUid: string;
}

export default function TeamMembers({
  teamId,
  isManager,
  currentUserUid,
}: TeamMembersProps) {
  // Assumo che useTeamMembers ora restituisca anche una funzione per la rimozione
  const { members, loading, handleRoleChange, getInitial, removeMember } = useTeamMembers({
    teamId,
    currentUserUid,
  });

  // Stato per gestire la modale di conferma rimozione/uscita
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    uid: "",
    isSelfLeave: false,
    memberName: "",
  });
  
  // Stato per la checkbox dei documenti (default true per sicurezza del workspace)
  const [revokeDocs, setRevokeDocs] = useState(true);

  // Calcolo per impedire l'uscita dell'ultimo owner
  const ownersCount = members.filter((m) => m.role === "owner").length;

  const openDialog = (uid: string, isSelfLeave: boolean, memberName: string) => {
    setDialogState({ isOpen: true, uid, isSelfLeave, memberName });
    setRevokeDocs(true); // Resetta la checkbox all'apertura
  };

  const closeDialog = () => {
    setDialogState({ isOpen: false, uid: "", isSelfLeave: false, memberName: "" });
  };

  const handleConfirmAction = async () => {
    if (removeMember) {
      // Passa alla tua logica/Firebase l'uid e il flag per la riassegnazione documenti
      await removeMember(dialogState.uid, revokeDocs);
    }
    closeDialog();
  };

  return (
    <>
      <motion.section
        className="relative p-6 sm:p-8 rounded-lg border border-(--color-border) shadow-(--shadow-soft) bg-(--color-surface) overflow-hidden"
        variants={cardVariants}
        initial="hidden"
        animate="show"
      >
        <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

        <motion.div className="mb-6 flex justify-between items-start mt-1" variants={fadeUpVariants}>
          <div>
            <h2
              className="text-lg sm:text-xl font-medium text-(--color-text) tracking-tight flex items-center gap-2.5"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              <span className="p-1.5 rounded-md border border-(--color-border) bg-(--color-bg)">
                <FiUserCheck className="w-4 h-4 text-(--color-text) opacity-80" />
              </span>
              Membri del Workspace
            </h2>
            <p className="text-xs sm:text-sm text-(--color-muted) font-light mt-2 leading-relaxed">
              Gestisci le persone all'interno del team e i loro permessi.
            </p>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="skeleton-list" className="grid gap-2.5" variants={listVariants} initial="hidden" animate="show" exit="exit">
              {[1, 2, 3].map((idx) => (
                <motion.div
                  key={idx}
                  variants={itemVariants}
                  className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-(--color-bg) rounded-md border border-(--color-border) gap-4 animate-pulse"
                >
                  <div className="flex items-center gap-3.5 w-full sm:w-auto">
                    <div className="w-9 h-9 rounded-full bg-(--color-border) shrink-0 opacity-60" />
                    <div className="space-y-2 flex-1 sm:w-48">
                      <div className="h-3.5 bg-(--color-border) rounded-sm w-3/4 opacity-70" />
                      <div className="h-2.5 bg-(--color-border) rounded-sm w-1/2 opacity-40" />
                    </div>
                  </div>
                  <div className="h-8 w-24 bg-(--color-border) rounded-md opacity-50 ml-auto sm:ml-0" />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.ul key="members-list" className="grid gap-2.5" variants={listVariants} initial="hidden" animate="show">
              {members.map((member) => {
                const isMe = member.uid === currentUserUid;
                // Impedisci l'uscita se sei tu, sei owner e non ci sono altri owner
                const cannotLeave = isMe && member.role === "owner" && ownersCount <= 1;

                return (
                  <motion.li
                    key={member.uid}
                    variants={itemVariants}
                    whileHover={{ y: -1, transition: { duration: 0.1, ease: "easeOut" } }}
                    className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-(--color-bg) rounded-md border border-(--color-border) gap-4 transition-colors hover:bg-(--color-surface) relative shadow-xs group"
                  >
                    <div className="flex items-center gap-3.5">
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt={member.displayName}
                          className="w-9 h-9 rounded-full object-cover border border-(--color-border) shrink-0 shadow-xs"
                        />
                      ) : (
                        <div
                          className="w-9 h-9 rounded-full border border-(--color-border) bg-(--color-surface) text-(--color-text) flex items-center justify-center font-medium text-xs shrink-0 shadow-xs"
                          style={{ fontFamily: "var(--font-serif)" }}
                        >
                          {getInitial(member.displayName)}
                        </div>
                      )}

                      <div>
                        <p className="text-xs sm:text-sm font-medium text-(--color-text) flex items-center gap-2 tracking-tight">
                          {member.displayName}
                          {isMe && (
                            <span className="bg-(--color-surface) border border-(--color-border) text-(--color-text) text-[9px] px-2 py-0.5 rounded-sm font-bold uppercase tracking-widest shadow-xs">
                              Tu
                            </span>
                          )}
                        </p>
                        {member.expire && typeof member.expire.toDate === "function" && (
                          <p className="text-[11px] text-(--color-muted) font-light flex items-center gap-1 mt-0.5">
                            <FiClock className="w-3 h-3 opacity-70" />
                            Scadenza: {member.expire.toDate().toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="w-full sm:w-auto flex items-center justify-end gap-3">
                      {isManager && !isMe ? (
                        <div className="relative w-full sm:w-auto">
                          <FiShield className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-(--color-muted)" />
                          <select
                            value={member.role}
                            onChange={(e) => handleRoleChange(member.uid, e.target.value)}
                            className="appearance-none w-full sm:w-36 rounded-md border border-(--color-border) bg-(--color-surface) pl-9 pr-8 py-2 text-xs tracking-widest text-(--color-text) outline-none transition-colors cursor-pointer shadow-xs hover:border-(--color-text)"
                          >
                            <option value="owner">Owner</option>
                            <option value="editor">Editor</option>
                            <option value="viewer">Viewer</option>
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-(--color-muted)">
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-(--color-surface) border border-(--color-border) rounded-md text-[10px] font-bold uppercase tracking-widest text-(--color-text) shadow-xs min-w-24 justify-center">
                          <FiShield className="w-3.5 h-3.5 opacity-70" />
                          {member.role}
                        </span>
                      )}

                      {/* Tooltip info ruoli */}
                      <div className="relative flex items-center">
                        <FiInfo className="text-(--color-muted) hover:text-(--color-text) w-4 h-4 cursor-help transition-colors peer" />
                        <div className="absolute right-0 bottom-full mb-2 w-64 p-3.5 bg-(--color-surface) border border-(--color-border) text-(--color-text) text-xs rounded-md shadow-(--shadow-soft) opacity-0 invisible peer-hover:opacity-100 peer-hover:visible transition-all duration-200 z-30 pointer-events-none font-light">
                          <div className="space-y-2">
                            <p><strong className="font-bold text-(--color-text)">Owner:</strong> Gestione completa.</p>
                            <p><strong className="font-bold text-(--color-text)">Editor:</strong> Modifica bozze.</p>
                            <p><strong className="font-bold text-(--color-text)">Viewer:</strong> Sola lettura.</p>
                          </div>
                        </div>
                      </div>

                      {/* Azioni: Rimuovi gli altri o Esci per te stesso */}
                      {isMe ? (
                        <button
                          onClick={() => openDialog(member.uid, true, member.displayName)}
                          disabled={cannotLeave}
                          title={cannotLeave ? "Non puoi uscire: sei l'unico owner del gruppo." : "Esci dal gruppo"}
                          className={`p-2 rounded-md border flex items-center justify-center transition-colors ${
                            cannotLeave 
                              ? "bg-(--color-bg) border-(--color-border) text-(--color-muted) opacity-50 cursor-not-allowed" 
                              : "bg-(--color-surface) border-red-900/30 text-red-500 hover:bg-red-500/10 cursor-pointer"
                          }`}
                        >
                          <FiLogOut className="w-4 h-4" />
                        </button>
                      ) : isManager ? (
                        <button
                          onClick={() => openDialog(member.uid, false, member.displayName)}
                          title="Rimuovi membro"
                          className="p-2 rounded-md border border-red-900/30 bg-(--color-surface) text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      ) : null}
                    </div>
                  </motion.li>
                );
              })}
            </motion.ul>
          )}
        </AnimatePresence>
      </motion.section>

      {/* Modale di conferma */}
      <AnimatePresence>
        {dialogState.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              className="bg-(--color-bg) border border-(--color-border) rounded-lg shadow-xl w-full max-w-md p-6 relative"
            >
              <h3 className="text-lg font-medium text-(--color-text) flex items-center gap-2 mb-2">
                <FiAlertCircle className="text-red-500" />
                {dialogState.isSelfLeave ? "Abbandona il gruppo" : "Rimuovi membro"}
              </h3>
              
              <p className="text-sm text-(--color-muted) font-light mb-6">
                {dialogState.isSelfLeave 
                  ? "Sei sicuro di voler abbandonare questo workspace? Perderai l'accesso a tutte le funzionalità condivise." 
                  : `Sei sicuro di voler rimuovere ${dialogState.memberName} dal workspace?`}
              </p>

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
                    {dialogState.isSelfLeave 
                      ? "Trasferisci la proprietà dei tuoi documenti e fascicoli all'owner del gruppo."
                      : "Trasferisci la proprietà dei documenti di questo utente all'owner del gruppo."}
                  </span>
                </div>
              </label>

              <div className="flex justify-end gap-3">
                <button
                  onClick={closeDialog}
                  className="px-4 py-2 rounded-md text-sm font-medium text-(--color-text) border border-(--color-border) hover:bg-(--color-surface) transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={handleConfirmAction}
                  className="px-4 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors border border-transparent"
                >
                  {dialogState.isSelfLeave ? "Sì, esci" : "Rimuovi"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}