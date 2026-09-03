import { Input } from "../../../shared/components/Input";
import { HiOutlineEye, HiOutlineEyeOff } from "react-icons/hi";
import { useState } from "react";
import { useAuthFormLogic } from "../hooks/useAuthFormLogic";
import { motion, AnimatePresence } from "framer-motion";
import { ButtonCTA } from "../../../shared/components/ButtonCTA";

interface Props {
  initialMode: "login" | "register";
}

export function AuthForm({ initialMode }: Props) {
  const {
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
  } = useAuthFormLogic(initialMode);

  const [showPassword, setShowPassword] = useState(false);

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="relative flex flex-col gap-5 w-full max-w-md p-8 md:p-10 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden"
    >
      {/* LA LINEA DI RIGORE SUPERIORE (Unico tocco di colore) */}
      <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) rounded-t-lg opacity-90 z-10" />

      {/* Titolo Formale */}
      <div className="text-center mb-2 mt-2">
        <AnimatePresence mode="wait">
          <motion.h1
            key={mode}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="text-2xl md:text-3xl text-(--color-text) tracking-tight"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            {mode === "login" ? "Accedi a Jurio" : "Registrati a Jurio"}
          </motion.h1>
        </AnimatePresence>
        <p className="text-sm text-(--color-muted) font-light mt-2">
          {mode === "login" 
            ? "Inserisci le tue credenziali per continuare." 
            : "Crea il tuo ambiente di lavoro riservato."}
        </p>
      </div>

      <div className="space-y-4 mt-2">
        {/* Campo Email */}
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        {/* Campo Password */}
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            aria-label={showPassword ? "Nascondi password" : "Mostra password"}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 outline-none group"
          >
            {showPassword ? (
              <HiOutlineEyeOff className="text-(--color-muted) group-hover:text-(--color-text) transition-colors" />
            ) : (
              <HiOutlineEye className="text-(--color-muted) group-hover:text-(--color-text) transition-colors" />
            )}
          </button>
        </div>
      </div>

      {/* Link Password Dimenticata (Monocromatico) */}
      {mode === "login" && (
        <div className="text-right -mt-2">
          <button
            type="button"
            onClick={handleResetPassword}
            disabled={loading}
            className="text-xs text-(--color-muted) hover:text-(--color-text) underline underline-offset-4 decoration-transparent hover:decoration-(--color-border) transition-all disabled:opacity-50 outline-none"
          >
            Password dimenticata?
          </button>
        </div>
      )}

      {/* Messaggio di Errore Istituzionale */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="border-l-2 border-red-500/50 bg-red-500/5 px-3 py-2 mt-1">
              <p className="text-sm text-red-600 dark:text-red-400 font-medium leading-snug">
                {error}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pulsante Principale */}
      <div className="mt-2">
        <AnimatePresence mode="wait">
          <ButtonCTA
            key={mode + "-submit"}
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Elaborazione..."
              : mode === "login"
              ? "Accedi"
              : "Registrati"}
          </ButtonCTA>
        </AnimatePresence>
      </div>

      {/* Toggle Modalità (Monocromatico, Stile editoriale) */}
      <div className="text-center mt-4 pt-4 border-t border-(--color-border)">
        <button
          type="button"
          onClick={toggleMode}
          className="text-sm text-(--color-text) font-medium underline underline-offset-4 decoration-(--color-border) hover:decoration-(--color-text) transition-colors outline-none"
        >
          {mode === "login"
            ? "Non hai un account? Registrati"
            : "Hai già un account? Accedi"}
        </button>
      </div>
    </motion.form>
  );
}