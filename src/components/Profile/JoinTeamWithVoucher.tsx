import { motion, AnimatePresence, type Variants } from "framer-motion";
import { FiKey, FiArrowRight, FiCheckCircle, FiX, FiShield } from "react-icons/fi";
import { useJoinTeamWithVoucher } from "@/hooks/teams";
import { Loader2 } from "lucide-react";

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.99 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: "easeOut" } },
};

const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

interface JoinTeamWithVoucherProps {
  onJoinSuccess?: () => void;
}

export default function JoinTeamWithVoucher({ onJoinSuccess }: JoinTeamWithVoucherProps) {
  const {
    step,
    setStep,
    voucherCode,
    setVoucherCode,
    loading,
    joining,
    teams,
    selectedTeamId,
    setSelectedTeamId,
    handleVerifyVoucher,
    handleJoinTeam,
  } = useJoinTeamWithVoucher({ onJoinSuccess });

  return (
    <motion.section
      className="relative p-6 sm:p-8 rounded-lg border border-(--color-border) shadow-(--shadow-soft) max-w-xl mx-auto w-full bg-(--color-surface) overflow-hidden"
      variants={cardVariants}
      initial="hidden"
      animate="show"
    >
      {/* LA LINEA DI RIGORE SUPERIORE (Unico tocco di colore) */}
      <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

      <motion.div className="mb-6 mt-1" variants={fadeUpVariants}>
        <h2 className="text-lg sm:text-xl font-medium text-(--color-text) tracking-tight flex items-center gap-2.5" style={{ fontFamily: 'var(--font-serif)' }}>
          <span className="p-1.5 rounded-md border border-(--color-border) bg-(--color-bg)">
            <FiShield className="w-4 h-4 text-(--color-text) opacity-80" />
          </span>
          Unisciti a un Workspace
        </h2>
        <p className="text-xs sm:text-sm text-(--color-muted) font-light mt-2 leading-relaxed">
          Hai ricevuto un codice d'invito? Inseriscilo qui per accedere al team e sbloccare le funzionalità Business.
        </p>
      </motion.div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.form
            key="step1"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleVerifyVoucher}
            className="space-y-4"
          >
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted) flex items-center gap-2 ml-1">
                <FiKey className="w-3.5 h-3.5 opacity-70" />
                Codice d'Invito (Voucher)
              </label>
              <input
                type="text"
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                disabled={loading}
                placeholder="Es. VCH-123ABC"
                className="w-full px-4 py-3 rounded-md border border-(--color-border) font-mono text-center text-base sm:text-lg tracking-widest text-(--color-text) bg-(--color-bg) outline-none focus:border-(--color-text) uppercase transition-colors disabled:opacity-35 shadow-xs placeholder:text-(--color-muted) placeholder:font-sans placeholder:text-xs"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || !voucherCode.trim()}
              className="w-full flex items-center justify-center gap-2 bg-(--color-text) text-(--color-surface) px-5 py-3 rounded-md text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-35 disabled:cursor-not-allowed shadow-xs outline-none"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              <span>{loading ? "Verifica in corso..." : "Verifica Codice"}</span>
              {!loading && <FiArrowRight className="w-3.5 h-3.5 opacity-70" />}
            </button>
          </motion.form>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            <div className="p-4 bg-(--color-bg) rounded-md border border-(--color-border)">
              <p className="text-xs sm:text-sm text-(--color-muted) font-light mb-4 leading-relaxed">
                {teams.length > 1
                  ? "Abbiamo trovato più Workspace associati a questo codice. Scegli a quale vuoi unirti:"
                  : "Codice verificato! Confermi di volerti unire a questo Workspace?"}
              </p>

              <div className="space-y-2">
                {teams.map((team) => (
                  <label
                    key={team.id}
                    className={`flex items-center gap-3 p-3.5 rounded-md border cursor-pointer transition-all ${
                      selectedTeamId === team.id
                        ? "bg-(--color-surface) border-(--color-text) shadow-xs"
                        : "bg-(--color-surface)/50 border-(--color-border) hover:border-(--color-text)"
                    }`}
                  >
                    <input
                      type="radio"
                      name="teamSelection"
                      value={team.id}
                      checked={selectedTeamId === team.id}
                      onChange={() => setSelectedTeamId(team.id)}
                      className="w-4 h-4 rounded border-(--color-border) text-(--color-text) focus:ring-0 cursor-pointer accent-(--color-text)"
                    />
                    <span className="text-xs sm:text-sm font-medium text-(--color-text) tracking-tight">{team.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={joining}
                className="flex-1 flex items-center justify-center gap-2 bg-(--color-surface) border border-(--color-border) text-(--color-text) px-4 py-3 rounded-md text-xs font-bold uppercase tracking-widest hover:border-(--color-text) transition-colors disabled:opacity-35 outline-none shadow-xs"
              >
                <FiX className="w-3.5 h-3.5 opacity-70" /> Annulla
              </button>

              <button
                type="button"
                onClick={handleJoinTeam}
                disabled={joining || !selectedTeamId}
                className="flex-2 flex items-center justify-center gap-2 bg-(--color-text) text-(--color-surface) px-5 py-3 rounded-md text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-35 disabled:cursor-not-allowed shadow-xs outline-none"
              >
                {joining && <Loader2 size={14} className="animate-spin" />}
                <span>{joining ? "Accesso in corso..." : "Conferma e Accedi"}</span>
                {!joining && <FiCheckCircle className="w-3.5 h-3.5 opacity-70" />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}