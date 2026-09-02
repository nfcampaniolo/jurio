import type { Team } from "@/interfaces/interfaces";
import { motion, AnimatePresence, type Variants, useReducedMotion } from "framer-motion";
import { FiUsers, FiCopy, FiCheck, FiInfo, FiAlertCircle, FiMail, FiSend, FiX } from "react-icons/fi";
import { useTeamVouchers } from "@/hooks/teams";
import { Loader2 } from "lucide-react";

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.99 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: "easeOut" } },
};

const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

const listVariants: Variants = { 
  hidden: {}, 
  show: { transition: { staggerChildren: 0.05 } } 
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: "easeOut" } },
};

export default function TeamVouchers({ team }: { team: Team }) {
  const shouldReduceMotion = useReducedMotion();
  const {
    email,
    setEmail,
    loading,
    voucherEmail,
    setVoucherEmail,
    emailingVoucherId,
    sendingVoucherId,
    copiedId,
    message,
    availableVouchers,
    handleAssignSeat,
    handleSendInviteEmail,
    copyToClipboard,
    openEmailForm,
    closeEmailForm,
  } = useTeamVouchers({ team });

  return (
    <motion.section
      className="relative p-6 sm:p-8 rounded-lg border border-(--color-border) shadow-(--shadow-soft) mx-auto w-full bg-(--color-surface) overflow-hidden"
      variants={cardVariants}
      initial="hidden"
      animate="show"
    >
      {/* LA LINEA DI RIGORE SUPERIORE (Unico tocco di colore) */}
      <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

      {/* Intestazione */}
      <motion.div className="mb-6 mt-1" variants={fadeUpVariants}>
        <h2 className="text-lg sm:text-xl font-medium text-(--color-text) tracking-tight flex items-center gap-2.5" style={{ fontFamily: 'var(--font-serif)' }}>
          <span className="p-1.5 rounded-md border border-(--color-border) bg-(--color-bg)">
            <FiUsers className="w-4 h-4 text-(--color-text) opacity-80" />
          </span>
          Gestione Inviti
        </h2>
        <p className="text-xs sm:text-sm text-(--color-muted) font-light mt-2 leading-relaxed">
          Hai <strong className="font-semibold text-(--color-text)">{availableVouchers.length}</strong>{" "}
          {availableVouchers.length === 1 ? "invito disponibile" : "inviti disponibili"} dal tuo abbonamento.
        </p>
      </motion.div>

      {/* Messaggi Globali */}
      <AnimatePresence mode="wait">
        {message && (
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: -10, height: 0 }}
            animate={shouldReduceMotion ? {} : { opacity: 1, y: 0, height: "auto" }}
            exit={shouldReduceMotion ? {} : { opacity: 0, y: -10, height: 0 }}
            className={`mb-6 p-4 rounded-md border flex items-start gap-3 overflow-hidden text-xs font-light ${
              message.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                : message.type === "info"
                ? "bg-sky-500/10 border-sky-500/30 text-sky-600 dark:text-sky-400"
                : "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400"
            }`}
          >
            {message.type === "success" && <FiCheck className="w-4 h-4 shrink-0 mt-0.5" />}
            {message.type === "info" && <FiInfo className="w-4 h-4 shrink-0 mt-0.5" />}
            {message.type === "error" && <FiAlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            <p className="leading-relaxed">{message.text}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {availableVouchers.length === 0 ? (
        /* Empty State */
        <motion.div
          variants={fadeUpVariants}
          className="flex items-start gap-3.5 p-4 bg-(--color-bg) border border-(--color-border) rounded-md mb-4 shadow-xs"
        >
          <FiInfo className="w-4 h-4 text-(--color-text) opacity-75 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-(--color-text)">Posti esauriti</h3>
            <p className="text-xs text-(--color-muted) font-light mt-0.5 leading-relaxed">
              Hai esaurito i posti inclusi nel tuo team. Fai l'upgrade del piano per poter invitare altre persone.
            </p>
          </div>
        </motion.div>
      ) : (
        /* Workflow Assegnazione Rapida */
        <motion.form variants={fadeUpVariants} onSubmit={handleAssignSeat} className="mb-8 space-y-2">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-(--color-muted) ml-1">
            Aggiungi utente già registrato:
          </label>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="collega@azienda.com"
              disabled={loading}
              className="flex-1 px-3.5 py-2.5 rounded-md border border-(--color-border) text-(--color-text) bg-(--color-bg) focus:border-(--color-text) outline-none text-sm font-light placeholder:text-(--color-muted) shadow-xs transition-colors disabled:opacity-35"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-(--color-text) text-(--color-surface) hover:opacity-90 px-5 py-2.5 rounded-md text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-35 disabled:cursor-not-allowed shadow-xs whitespace-nowrap outline-none flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              <span>{loading ? "Assegnazione..." : "Aggiungi al Team"}</span>
            </button>
          </div>
        </motion.form>
      )}

      {/* Workflow Voucher Singoli (Copia o Email) */}
      {availableVouchers.length > 0 && (
        <motion.div variants={fadeUpVariants}>
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted) mb-3 ml-1">
            Oppure condividi un codice d'invito
          </h3>
          <motion.ul className="grid gap-2.5" variants={listVariants} initial="hidden" animate="show">
            {availableVouchers.map((v) => {
              const isCopied = copiedId === v.id;
              const isEmailing = emailingVoucherId === v.id;
              const isSendingThis = sendingVoucherId === v.id;

              return (
                <motion.li
                  key={v.id}
                  variants={itemVariants}
                  className="flex flex-col md:flex-row justify-between items-start md:items-center bg-(--color-bg) p-3.5 rounded-md border border-(--color-border) gap-3 shadow-xs"
                >
                  {/* Etichetta Codice */}
                  <div className="flex items-center px-3 py-1.5 bg-(--color-surface0 border border-(--color-border) rounded-sm shadow-xs">
                    <span className="font-mono font-medium text-sm tracking-wider text-(--color-text)">
                      {v.id}
                    </span>
                  </div>

                  {/* Azioni: Form Email o Bottoni Base */}
                  <AnimatePresence mode="popLayout">
                    {isEmailing ? (
                      <motion.form
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                        className="flex flex-col sm:flex-row w-full md:w-auto items-stretch sm:items-center gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSendInviteEmail(v.id);
                        }}
                      >
                        <input
                          type="email"
                          autoFocus
                          placeholder="Email destinatario"
                          value={voucherEmail}
                          onChange={(e) => setVoucherEmail(e.target.value)}
                          disabled={isSendingThis}
                          required
                          className="px-3 py-2 rounded-md border border-(--color-border) bg-(--color-surface) text-xs sm:text-sm font-light text-(--color-text) outline-none focus:border-(--color-text) shadow-xs transition-colors placeholder:text-(--color-muted)"
                        />
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={isSendingThis}
                            className="flex-1 sm:flex-none flex justify-center items-center gap-1.5 px-4 py-2 bg-(--color-text) text-(--color-surface) hover:opacity-90 rounded-md text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-35 shadow-xs outline-none"
                          >
                            {isSendingThis && <Loader2 size={14} className="animate-spin" />}
                            <span>{isSendingThis ? "Invio..." : "Invia"}</span>
                            {!isSendingThis && <FiSend className="w-3.5 h-3.5 opacity-70" />}
                          </button>
                          <button
                            type="button"
                            onClick={closeEmailForm}
                            disabled={isSendingThis}
                            className="flex-1 sm:flex-none flex justify-center items-center px-3 py-2 bg-(--color-surface) border border-(--color-border) text-(--color-text) hover:border-(--color-text) rounded-md transition-colors shadow-xs outline-none"
                          >
                            <FiX className="w-4 h-4 opacity-70" />
                          </button>
                        </div>
                      </motion.form>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col sm:flex-row w-full md:w-auto items-stretch sm:items-center gap-2"
                      >
                        <button
                          type="button"
                          onClick={() => copyToClipboard(v.id)}
                          className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-all outline-none shadow-xs ${
                            isCopied
                              ? "bg-emerald-500 text-white"
                              : "bg-(--color-surface) border border-(--color-border) text-(--color-text) hover:border-(--color-text)"
                          }`}
                        >
                          {isCopied ? <><FiCheck className="w-3.5 h-3.5" /> Copiato</> : <><FiCopy className="w-3.5 h-3.5 opacity-70" /> Copia</>}
                        </button>

                        <button
                          type="button"
                          onClick={() => openEmailForm(v.id)}
                          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-(--color-surface) border border-(--color-border) text-(--color-text) hover:border-(--color-text) rounded-md text-xs font-bold uppercase tracking-widest transition-colors shadow-xs outline-none"
                        >
                          <FiMail className="w-3.5 h-3.5 opacity-70" /> Invia Email
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.li>
              );
            })}
          </motion.ul>
        </motion.div>
      )}
    </motion.section>
  );
}