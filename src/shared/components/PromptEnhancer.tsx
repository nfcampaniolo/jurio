import { useState } from "react";
import { Sparkles, Loader2, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePromptEnhancer, type HistoryMessage } from "../hooks/usePromptEnhancer";

interface PromptEnhancerProps {
  inputValue: string;
  setInputValue: (value: string) => void;
  type: "chat" | "approfondimento";
  history?: HistoryMessage[];
  disabled?: boolean;
}

export const PromptEnhancer = ({
  inputValue,
  setInputValue,
  type,
  history,
  disabled
}: PromptEnhancerProps) => {
  const { enhancePrompt, isEnhancing } = usePromptEnhancer();
  const [originalPrompt, setOriginalPrompt] = useState<string | null>(null);
  const [enhancedPrompt, setEnhancedPrompt] = useState<string | null>(null);

  const isInputSubstantial = inputValue.trim().length > 15;

  // DERIVED STATE: Il tasto Undo è disponibile solo se abbiamo salvato il prompt originale
  // e l'input attuale coincide esattamente con quello ottimizzato.
  // Se l'utente digita una sola lettera, canUndo diventa falso e riappare la bacchetta magica.
  const canUndo = Boolean(originalPrompt && enhancedPrompt && inputValue === enhancedPrompt);

  const handleEnhance = async () => {
    if (!inputValue.trim()) return;
    
    setOriginalPrompt(inputValue);
    setEnhancedPrompt(null); // Resettiamo in attesa della nuova API

    const result = await enhancePrompt(inputValue, type, history);

    if (result) {
      setInputValue(result);
      setEnhancedPrompt(result);
    } else {
      // In caso di errore API, ripristiniamo la UI
      setOriginalPrompt(null);
    }
  };

  const handleUndo = () => {
    if (originalPrompt) {
      setInputValue(originalPrompt);
      setOriginalPrompt(null);
      setEnhancedPrompt(null);
    }
  };

  return (
    <AnimatePresence mode="wait">
      {canUndo && !isEnhancing ? (
        <motion.div
          key="undo"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
        >
          <button
            onClick={handleUndo}
            title="Annulla miglioramento"
            className="w-10 h-10 flex items-center justify-center rounded-md text-(--color-muted) hover:text-red-500 hover:bg-red-500/10 transition-colors outline-none"
          >
            <RotateCcw size={16} />
          </button>
        </motion.div>
      ) : (
        <motion.div
          key="enhance"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className={!isInputSubstantial ? "hidden md:block opacity-30 pointer-events-none" : ""}
        >
          <button
            onClick={handleEnhance}
            disabled={disabled || isEnhancing || !isInputSubstantial}
            title="Migliora il prompt con l'IA"
            className={`w-10 h-10 flex items-center justify-center rounded-md transition-all duration-300 shrink-0 outline-none
              ${isEnhancing 
                ? 'text-(--color-text) bg-(--color-bg)' 
                : 'text-(--color-muted) hover:text-(--color-text) hover:bg-(--color-bg)'}`}
          >
            {isEnhancing ? (
              <Loader2 size={18} className="animate-spin text-blue-500" />
            ) : (
              <Sparkles size={18} />
            )}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};