import { toast } from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";
import { ensureAnonAuth } from "@/services/auth";
import { getDb } from "@/services/db";
import { buildGenkitFilters } from "@/hooks/searchBarTypes";
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
    if (activeFiltersCount > 2) { toast.error("Puoi attivare al massimo 2 filtri contemporaneamente."); setShowFilters(true); return; }

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
      const { getSecurityTokens } = await import("@/services/security");
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
      if (response.status === 403) { setDenyOpen(true); throw new Error("Accesso negato."); }
      if (!response.ok || !response.body) throw new Error(`Errore API: ${response.status}`);

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
          const chunkStr = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          if (chunkStr.startsWith("data: ")) {
            const dataStr = chunkStr.slice(6);
            if (dataStr === "[DONE]") { setAgentState("idle"); return; }
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.error) throw new Error(parsed.error.message);
              
              if (parsed.message) {
                if (typeof parsed.message === "object" && parsed.message.status) setAgentStatusText(parsed.message.status);
                else {
                  const textChunk = typeof parsed.message === "string" ? parsed.message : (parsed.message.text || "");
                  if (textChunk) setMessages(prev => prev.map(msg => msg.id === agentMsgId ? { ...msg, content: (msg.content || "") + textChunk } : msg));
                }
              }

              if (parsed.result) {
                if (parsed.result.titoloGenerato) {
                  if (sessionType === "temporanea") setSessionTitle(parsed.result.titoloGenerato);
                  else if (sessionType === "fascicolo") {
                    setThreadTitle(parsed.result.titoloGenerato);
                    setThreads(prev => prev.map(t => t.id === (threadId || activeThreadId) ? { ...t, title: parsed.result.titoloGenerato } : t));
                  }
                }
                setMessages(prev => prev.map(msg => msg.id === agentMsgId ? { ...msg, content: parsed.result.risposta || msg.content, sources: parsed.result.fonti || [] } : msg));
              }
            } catch (error) { console.error("Errore parsing chunk:", error); }
          }
          boundary = buffer.indexOf("\n\n");
        }
      }
    } catch (error: unknown) {
      console.error("🚨 ERRORE CHAT:", error);
      setAgentState("error");
      setMessages(prev => prev.map(msg => msg.id === agentMsgId ? { ...msg, content: `⚠️ Si è verificato un errore: ${error instanceof Error ? error.message : "Connessione fallita."}` } : msg));
      setTimeout(() => setAgentState("idle"), 5000);
    } finally { setAgentStatusText(""); }
  };

  return { handleSendMessage };
};