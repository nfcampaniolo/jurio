// useJurioChatbot.ts
import { useState, useEffect } from 'react';
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
    if (!inputValue.trim() || isLoading) return;

    setError(null);
    setCurrentStatus("Analisi della richiesta in corso...");
    
    const currentInputValue = inputValue.trim(); 
    const userMsg: ChatMessage = { role: "user", content: currentInputValue };
    const newHistory = [...messages, userMsg];
    
    setMessages(newHistory);
    chatCache.set(newHistory);
    setInputValue("");
    setIsLoading(true);

    try {
      const { botReply, fonti } = await sendSupportMessage(newHistory, (statusText: string) => {
        setCurrentStatus(statusText);
      });

      const botMsg: ChatMessage = { 
        role: "assistant", 
        content: botReply,
        sources: fonti as SourceItem[]
      };
      
      const updatedHistory = [...newHistory, botMsg];
      setMessages(updatedHistory);
      chatCache.set(updatedHistory);
      
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Si è verificato un errore imprevisto.");
      }
      
      // Rollback state: aggiornamento funzionale che evita il warning di Sonar 
      // rimuovendo in sicurezza l'ultimo messaggio inviato dall'array corrente.
      setMessages((prevHistory) => prevHistory.slice(0, -1));

      // Il ripristino della cache usa la variabile 'messages' che fa riferimento 
      // in modo corretto allo snapshot iniziale grazie alla closure.
      chatCache.set(messages);

      setInputValue(currentInputValue);
      
    } finally {
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