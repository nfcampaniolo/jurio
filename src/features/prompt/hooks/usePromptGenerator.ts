import { useState, useEffect } from "react";
import { fetchWithSecurity } from "@/config/apiClient";
import { type PromptBuilderForm } from "@/interfaces/interfaces";
import { toast } from "react-hot-toast";
import { type SavedPrompt } from "@/interfaces/interfaces";
import { getFirestore, collection, onSnapshot, doc, deleteDoc, orderBy, query } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getPrompt } from "@/config/env";
import { useNavigate } from 'react-router-dom'; 

const PROMPT_ENDPOINT = getPrompt();

export const usePromptGenerator = () => {
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAccessDenied, setIsAccessDenied] = useState(false);

  const generatePrompt = async (data: PromptBuilderForm) => {
    setIsGenerating(true);
    setGeneratedPrompt(null);
    setIsAccessDenied(false);
    
    try {
      if (!PROMPT_ENDPOINT) {
        throw new Error("PROMPT_ENDPOINT is not defined");
      }
      const response = await fetchWithSecurity(PROMPT_ENDPOINT, {
        title: data.title,
        objective: data.objective,
        notes: data.notes,
        fields: data.fields
      });

      // Intercetta l'errore 403 Forbidden
      if (response.status === 403) {
        setIsAccessDenied(true);
        return;
      }

      if (!response.ok) throw new Error("Errore dal server");
      if (!response.body) throw new Error("Risposta vuota dal server.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;

        if (value) {
          const chunkString = decoder.decode(value, { stream: true });
          const lines = chunkString.split("\n");
          
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.substring(6).trim();
              if (dataStr === "[DONE]") break;

              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.result) {
                  setGeneratedPrompt(parsed.result);
                  toast.success("Prompt generato con successo!");
                }
                if (parsed.error) throw new Error(parsed.error.message);
              } catch (parseError) {
                console.warn("Errore parsing chunk SSE:", parseError);
              }
            }
          }
        }
      }
    } catch (error: unknown) {
      console.error(error);
      toast.error("Errore durante la generazione del prompt.");
    } finally {
      setIsGenerating(false);
    }
  };

  const clearPrompt = () => setGeneratedPrompt(null);

  return { generatedPrompt, isGenerating, isAccessDenied, generatePrompt, clearPrompt };
};

export const usePromptDashboard = () => {
  // Stato Navigazione
  const navigate = useNavigate();
  const [view, setView] = useState<"list" | "create">("list");
  const [selectedTemplate, setSelectedTemplate] = useState<SavedPrompt | undefined>(undefined);

  // Stato Dati
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Stato Modale di Conferma Eliminazione
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [promptToDeleteId, setPromptIdToDelete] = useState<string | null>(null);

  const auth = getAuth();
  const db = getFirestore();

  // 1. LETTURA DA FIRESTORE IN TEMPO REALE
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const promptsRef = collection(db, "register", user.uid, "prompts");
    const q = query(promptsRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPrompts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SavedPrompt[];
      
      setPrompts(fetchedPrompts);
      setIsLoading(false);
    }, (error) => {
      console.error("Errore fetch prompts:", error);
      toast.error("Impossibile caricare i prompt.");
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [auth.currentUser, db]);

  // 2. GESTIONE MODALE ELIMINAZIONE
  const requestDelete = (id: string) => {
    setPromptIdToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const cancelDelete = () => {
    setPromptIdToDelete(null);
    setIsDeleteModalOpen(false);
  };

  const confirmDelete = async () => {
    const user = auth.currentUser;
    if (!user || !promptToDeleteId) return;

    try {
      await deleteDoc(doc(db, "register", user.uid, "prompts", promptToDeleteId));
      toast.success("Prompt eliminato con successo.");
    } catch (error) {
      console.error("Errore cancellazione:", error);
      toast.error("Errore durante l'eliminazione.");
    } finally {
      // Chiudi la modale e resetta l'ID in ogni caso
      setIsDeleteModalOpen(false);
      setPromptIdToDelete(null);
    }
  };

  // 3. NAVIGAZIONE
  const handleOpenCreator = (template?: SavedPrompt) => {
    if (template) {
      setSelectedTemplate({
        ...template,
        title: `${template.title} (Copia)`
      });
    } else {
      setSelectedTemplate(undefined);
    }
    setView("create");
  };

  const handleBackToList = () => {
    setSelectedTemplate(undefined);
    setView("list");
    navigate(-1);
  };

  return {
    view,
    prompts,
    isLoading,
    selectedTemplate,
    isDeleteModalOpen,
    handleOpenCreator,
    handleBackToList,
    requestDelete,
    confirmDelete,
    cancelDelete
  };
};