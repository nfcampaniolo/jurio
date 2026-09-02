import { useState, useEffect } from "react";
import { getFirestore, collection, getDocs, query, orderBy } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import type { SavedPrompt } from "@/interfaces/interfaces";

interface UsePromptSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export const usePromptSelector = ({ value, onChange }: UsePromptSelectorProps) => {
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [publicPrompts, setPublicPrompts] = useState<SavedPrompt[]>([]);

  useEffect(() => {
    const fetchAllPrompts = async () => {
      const auth = getAuth();
      const db = getFirestore();
      const user = auth.currentUser;

      try {
        // 1. Fetch Prompt Personali (se l'utente è autenticato)
        if (user) {
          const personalRef = collection(db, "register", user.uid, "prompts");
          const personalSnapshot = await getDocs(query(personalRef, orderBy("createdAt", "desc")));
          setSavedPrompts(
            personalSnapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            })) as SavedPrompt[]
          );
        }

        // 2. Fetch Prompt Pubblici dalla collezione globale prompt_list
        const publicRef = collection(db, "prompt_list");
        const publicSnapshot = await getDocs(query(publicRef, orderBy("title", "asc")));
        setPublicPrompts(
          publicSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as SavedPrompt[]
        );
      } catch (error) {
        console.error("Errore caricamento prompt:", error);
      }
    };

    fetchAllPrompts();
  }, []);

  // Gestione interna del reindirizzamento o della selezione
  const handleChange = (selectedValue: string) => {
    if (selectedValue === "create_new") {
      window.open("/profilo/prompt-builder#crea", "_blank", "noopener,noreferrer");
    } else {
      onChange(selectedValue);
    }
  };

  // Cerca il prompt selezionato sia tra quelli salvati che tra quelli pubblici
  const selectedCustomPrompt =
    savedPrompts.find((p) => p.id === value) ||
    publicPrompts.find((p) => p.id === value);

  return {
    savedPrompts,
    publicPrompts,
    selectedCustomPrompt,
    handleChange,
  };
};