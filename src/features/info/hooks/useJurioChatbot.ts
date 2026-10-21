// useJurioChatbot.ts
import { useState, useEffect, useRef } from 'react';
import { chatCache, sendSupportMessage, type ChatMessage } from '@/features/chat/hooks/chatLogic';

export interface SourceItem {
  readonly id: string;
  readonly text: string;
  readonly links: readonly string[];
  readonly images?: string;
  readonly _type: string;
}

export const useJurioChatbot = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isSendingRef = useRef(false);

  // Inizializzazione della cronologia da cache
  useEffect(() => {
    const history = chatCache.get();

    if (history.length > 0) {
      setMessages(history);
    } else {
      setMessages([{ 
        role: "assistant", 
        content: "Benvenuto nel supporto **Jurio**. Sono il tuo Agente Virtuale. Come posso assisterti oggi con le nostre funzionalità o i piani tariffari?" 
      }]);
    }
  }, []);

  const handleSend = async (): Promise<void> => {
    if (!inputValue.trim() || isSendingRef.current) return;

    isSendingRef.current = true;
    setError(null);
    setCurrentStatus("Analisi della richiesta in corso...");
    
    const currentInputValue = inputValue.trim(); 
    const userMsg: ChatMessage = { role: "user", content: currentInputValue };
    
    const historyBeforeSend = messages;
    const pendingHistory = [...historyBeforeSend, userMsg, { role: "assistant" as const, content: "" }];
    chatCache.set([...historyBeforeSend, userMsg]);
    setMessages(pendingHistory);

    setInputValue("");
    setIsLoading(true);

    try {
      // Chiamata all'helper di chatLogic rispettando la firma originale
      const { botReply, fonti } = await sendSupportMessage(
        [...historyBeforeSend, userMsg], 
        (statusText: string) => {
          setCurrentStatus(statusText);
        },
        (text: string) => {
          setMessages((prevHistory) => {
            const lastMessage = prevHistory[prevHistory.length - 1];
            if (lastMessage?.role !== "assistant") return prevHistory;
            return [
              ...prevHistory.slice(0, -1),
              { ...lastMessage, content: text },
            ];
          });
        },
      );

      const botMsg: ChatMessage = { 
        role: "assistant", 
        content: botReply,
        sources: fonti as SourceItem[]
      };
      
      setMessages((prevHistory) => {
        const updatedHistory = prevHistory[prevHistory.length - 1]?.role === "assistant"
          ? [...prevHistory.slice(0, -1), botMsg]
          : [...prevHistory, botMsg];
        chatCache.set(updatedHistory);
        return updatedHistory;
      });
      
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Si è verificato un errore imprevisto.");
      }
      
      // Rollback sicuro dello stato e della cache al momento pre-invio
      setMessages(historyBeforeSend);
      chatCache.set(historyBeforeSend);

      // Ripristina il testo nella textarea per evitare di perderlo
      setInputValue(currentInputValue);
      
    } finally {
      isSendingRef.current = false;
      setIsLoading(false);
      setCurrentStatus(null);
    }
  };

  const clearChat = (): void => {
    chatCache.clear();
    setMessages([{ role: "assistant", content: "Cronologia pulita. Come posso aiutarti?" }]);
    setError(null);
    setCurrentStatus(null);
  };

  return {
    isOpen,
    setIsOpen,
    messages,
    inputValue,
    setInputValue,
    isLoading,
    currentStatus,
    error,
    handleSend,
    clearChat
  };
};