import { toast } from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";
import { ensureAnonAuth } from "@/features/auth/hooks/auth";
import { getDb } from "@/infrastructure/db";
import { buildGenkitFilters } from "@/features/search/hooks/searchBarTypes";
import { getChatUrl } from "@/config/env";
import type { AttachedDocument, Message, SessionType } from "@/interfaces/interfaces";
import type { User } from "firebase/auth";
import type { AgentState } from "./useLegalChat";

const LEGAL_AGENT_ENDPOINT = getChatUrl();

export interface FilterState {
  filterGrado: string;
  filterSezione: string;
  filterTipo: string;
  filterTipologia: string;
  startDate: string;
  endDate: string;
}

export interface MessagingProps {
  user: User | null;
  inputValue: string;
  attachedDocs: AttachedDocument[];
  activeQuote: string[];
  activeFiltersCount: number;
  filterState: FilterState;
  sessionType: SessionType;
  chatId?: string;
  threadId?: string;
  fascicoloId?: string;
  sessionTitle: string;
  activeThreadId: string | null;
  isStreaming: boolean;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
  setAgentState: React.Dispatch<React.SetStateAction<AgentState>>;
  setAgentStatusText: React.Dispatch<React.SetStateAction<string>>;
  setShowFilters: React.Dispatch<React.SetStateAction<boolean>>;
  setDenyOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSessionTitle: React.Dispatch<React.SetStateAction<string>>;
  setThreadTitle: React.Dispatch<React.SetStateAction<string>>;
  setThreads: React.Dispatch<React.SetStateAction<{id: string, title: string, createdAt: Date}[]>>;
}

export const useChatMessaging = ({
  user, inputValue, attachedDocs, activeQuote, activeFiltersCount, filterState,
  sessionType, chatId, threadId, fascicoloId, sessionTitle, activeThreadId,
  isStreaming, setMessages, setInputValue, setAgentState, setAgentStatusText,
  setShowFilters, setDenyOpen, setSessionTitle, setThreadTitle, setThreads
}: MessagingProps) => {

  const handleSendMessage = async () => {
    if (!LEGAL_AGENT_ENDPOINT || ((!inputValue.trim() && attachedDocs.length === 0 && (!activeQuote || activeQuote.length === 0)) || isStreaming)) return;
    if (activeFiltersCount > 2) { 
      toast.error("Puoi attivare al massimo 2 filtri contemporaneamente."); 
      setShowFilters(true); 
      return; 
    }

    const genkitFilters = buildGenkitFilters(filterState);
    const userText = inputValue;

    setMessages(prev => [...prev, { id: uuidv4(), role: "user", content: userText, timestamp: new Date() }]);
    setInputValue("");
    setAgentState("connecting");
    setAgentStatusText("");
    const agentMsgId = uuidv4();
    setMessages(prev => [...prev, { id: agentMsgId, role: "model", content: "", timestamp: new Date() }]);

    try {
      await ensureAnonAuth();
      const { getSecurityTokens } = await import("@/infrastructure/security");
      const { authToken, appCheckToken } = await getSecurityTokens();

      let finalPrompt = userText;
      let finalDocs = attachedDocs.map(d => d.id);
      if (activeQuote && activeQuote.length > 0) {
        finalPrompt = `${userText}\n\n[Testo selezionato in riferimento]:\n"""\n${activeQuote.join("\n\n")}\n"""`;
        finalDocs = [];
      }

      let attualiMetadati: Record<string, unknown> = {};
      if (fascicoloId) {
        try {
          const { doc, getDoc } = await import("firebase/firestore");
          const db = await getDb();
          const fascicoloSnap = await getDoc(doc(db, "fascicoli", fascicoloId));
          if (fascicoloSnap.exists() && fascicoloSnap.data().metadati) attualiMetadati = fascicoloSnap.data().metadati;
        } catch (error) { console.warn("⚠️ Impossibile recuperare i metadati del fascicolo:", error); }
      }

      const payload = {
        prompt: finalPrompt, userId: user?.uid, filters: genkitFilters, docs: finalDocs,
        fascicoloId: fascicoloId || null, metadatiFascicolo: attualiMetadati,
        context: { type: sessionType, chat_uuid: chatId || null, thread_uuid: threadId || null, fascicolo_uuid: fascicoloId || null, title: sessionTitle }
      };

      const headers: HeadersInit = { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` };
      if (appCheckToken) headers["X-Firebase-AppCheck"] = appCheckToken;

      const response = await fetch(LEGAL_AGENT_ENDPOINT, { method: "POST", headers, body: JSON.stringify(payload) });
      if (response.status === 403) { setDenyOpen(true); throw new Error("Accesso negato o piano scaduto."); }
      if (!response.ok || !response.body) throw new Error(`Errore Server: ${response.status}`);

      setAgentState("streaming");
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        
        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const chunkStr = buffer.slice(0, boundary).trim();
          buffer = buffer.slice(boundary + 2);
          
          if (chunkStr.startsWith("data:")) {
            const dataStr = chunkStr.slice(5).trim();
            
            if (dataStr === "[DONE]") { 
              setAgentState("idle"); 
              return; 
            }
            if (!dataStr) {
              boundary = buffer.indexOf("\n\n");
              continue;
            }

            // Isola il parsing JSON per evitare che blocchi gli errori di logica
            let parsed;
            try {
              parsed = JSON.parse(dataStr);
            } catch (err) {
              console.error("Errore parsing chunk JSON ignorato:", err);
              boundary = buffer.indexOf("\n\n");
              continue; // Salta il chunk se è corrotto ma prosegue il ciclo
            }

            // 1. SE IL SERVER CI NOTIFICA UN ERRORE, LO LANCIAMO VERSO IL CATCH ESTERNO
            if (parsed.error) {
              throw new Error(parsed.error.message || "Errore imprevisto durante l'analisi giuridica.");
            }
              
            // 2. Intercetta gli status di Root (es: Avvio dell'agente legale...)
            if (parsed.status) {
              setAgentStatusText(parsed.status);
            }

            // 3. Flusso di messaggi Genkit (testo parziale)
            if (parsed.message) {
              if (typeof parsed.message === "object") {
                if (parsed.message.status) setAgentStatusText(parsed.message.status);
                if (parsed.message.text) {
                  setMessages(prev => prev.map(msg => msg.id === agentMsgId ? { ...msg, content: (msg.content || "") + parsed.message.text } : msg));
                }
              } else if (typeof parsed.message === "string") {
                setMessages(prev => prev.map(msg => msg.id === agentMsgId ? { ...msg, content: (msg.content || "") + parsed.message } : msg));
              }
            }

            // 4. Risultato finale
            if (parsed.result) {
              if (parsed.result.titoloGenerato) {
                if (sessionType === "temporanea") setSessionTitle(parsed.result.titoloGenerato);
                else if (sessionType === "fascicolo") {
                  setThreadTitle(parsed.result.titoloGenerato);
                  setThreads(prev => prev.map(t => t.id === (threadId || activeThreadId) ? { ...t, title: parsed.result.titoloGenerato } : t));
                }
              }
              setMessages(prev => prev.map(msg => msg.id === agentMsgId ? { 
                ...msg, 
                content: parsed.result.risposta || msg.content, 
                sources: parsed.result.fonti || [] 
              } : msg));
            }
          }
          boundary = buffer.indexOf("\n\n");
        }
      }
    } catch (error: unknown) {
      console.error("🚨 ERRORE CHAT:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Connessione fallita o errore sconosciuto.";
      
      // 👈 MOSTRA IL TOAST VISIBILE IN ALTO
      toast.error(errorMessage);
      
      setAgentState("error");
      setMessages(prev => prev.map(msg => msg.id === agentMsgId ? { 
        ...msg, 
        content: `⚠️ Si è verificato un errore:\n\n*${errorMessage}*` 
      } : msg));
      
      setTimeout(() => setAgentState("idle"), 5000);
    } finally { 
      setAgentStatusText(""); 
    }
  };

  return { handleSendMessage };
};