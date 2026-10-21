import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";
import type { Timestamp } from "firebase/firestore";

import type { SessionType, Source, Message, AttachedDocument, PastFascicolo, PastChat, DBThreadPayload } from "@/interfaces/interfaces";
import { useAuth } from "@/context/useAuth";
import { listDocumentsByUser, listFascicoliByUser, listChatsByUser, fetchChatMessages, fetchFascicoloData } from "@/shared/services/document";
import { getChatUrl } from "@/config/env";

// Import dei sotto-hook
import { useEntityOperations } from "../../document/hooks/useEntityOperations";
import { useFileProcessor } from "./useFileProcessor";
import { useChatMessaging } from "./useChatMessaging";

const LEGAL_AGENT_ENDPOINT = getChatUrl();
export type AgentState = 'idle' | 'connecting' | 'streaming' | 'error';

export const useLegalChat = (initialData?: {
  docs?: AttachedDocument[];
  title?: string;
  isNewFascicolo?: boolean;
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { chatId, fascicoloId, threadId } = useParams();
  const isNewFascicolo = Boolean(initialData?.isNewFascicolo);

  // Stati
  // Parte già dal tipo giusto in base alla rotta, per evitare il passaggio dalla schermata di selezione (flash)
  const [sessionType, setSessionType] = useState<SessionType>(chatId ? 'temporanea' : fascicoloId ? 'fascicolo' : 'seleziona');
  const [sessionTitle, setSessionTitle] = useState(initialData?.title || "");
  const [threadTitle, setThreadTitle] = useState(""); 
  const [isSetupComplete, setIsSetupComplete] = useState(Boolean(chatId || fascicoloId));
  const [isConverting, setIsConverting] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [agentState, setAgentState] = useState<AgentState>('idle'); 
  const [agentStatusText, setAgentStatusText] = useState<string>(""); 
  const isStreaming = agentState === 'connecting' || agentState === 'streaming';
  const [showFilters, setShowFilters] = useState(false);
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [attachedDocs, setAttachedDocs] = useState<AttachedDocument[]>(initialData?.docs || []);
  const [threads, setThreads] = useState<{id: string, title: string, createdAt: Date}[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  // Filtri
  const [filterGrado, setFilterGrado] = useState("");
  const [filterSezione, setFilterSezione] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [filterTipologia, setFilterTipologia] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const filterState = { filterGrado, filterSezione, filterTipo, filterTipologia, startDate, endDate };
  const setFilterState = { setFilterGrado, setFilterSezione, setFilterTipo, setFilterTipologia, setStartDate, setEndDate };
  const activeFiltersCount = [filterGrado, filterSezione, filterTipo, filterTipologia, startDate, endDate].filter(Boolean).length;
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollFrameRef = useRef<number | null>(null);
  useEffect(() => {
    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
      scrollFrameRef.current = null;
    });
    return () => {
      if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
    };
  }, [messages.length, activeThreadId, chatId, fascicoloId, threadId]);

  // DB States
  const [archiveDocs, setArchiveDocs] = useState<AttachedDocument[]>([]);
  const [pastFascicoli, setPastFascicoli] = useState<PastFascicolo[]>([]);
  const [pastChats, setPastChats] = useState<PastChat[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [showTitleModal, setShowTitleModal] = useState(false);
  const [denyOpen, setDenyOpen] = useState(false);
  const [activeQuote, setActiveQuote] = useState<string[]>([]);
  const [isReadOnly, setIsReadOnly] = useState<boolean>(false);

  // --- HOOKS INIETTATI ---
  const { renameFascicolo, renameChat, deleteChat, deleteFascicolo, deleteThread, renameThread: renameThreadInList, handleToggleFascicoloLink, handleDeleteDocumento, handleRenameDocumento } = useEntityOperations({
    archiveDocs, setPastFascicoli, setPastChats, setThreads, setArchiveDocs
  });

  const renameThread = async (parentId: string, targetThreadId: string, newTitle: string) => {
    if (targetThreadId === activeThreadId && newTitle.trim()) setThreadTitle(newTitle.trim());
    await renameThreadInList(parentId, targetThreadId, newTitle);
  };

  const { processFilesParallel } = useFileProcessor({
    user, setIsProcessingFiles, setAttachedDocs, setArchiveDocs, setDenyOpen
  });

  const { handleSendMessage } = useChatMessaging({
    user, inputValue, attachedDocs, activeQuote, activeFiltersCount, filterState,
    sessionType, chatId, threadId, fascicoloId, sessionTitle, activeThreadId,
    isStreaming, setMessages, setInputValue, setAgentState, setAgentStatusText,
    setShowFilters, setDenyOpen, setSessionTitle, setThreadTitle, setThreads
  });

  // --- Inizializzazione Dati Base ---
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user?.uid) return;
      setIsLoadingData(true);
      try {
        const [docsRes, fascicoliRes, chatsRes] = await Promise.all([ listDocumentsByUser(user.uid), listFascicoliByUser(user.uid), listChatsByUser(user.uid) ]);
        setArchiveDocs(docsRes.map(doc => ({
          id: String(doc.id), name: doc.nome_file || "Documento senza nome",
          metadata: doc.tipo_documento === "documento_giurisprudenza_generico" ? doc.sottotipo_documento : doc.massima,
          type: "pdf", dataSentenza: doc.dataSentenza || undefined, fascicoloIds: doc.fascicoloIds || undefined, user: doc.user
        })));
        setPastFascicoli(fascicoliRes); setPastChats(chatsRes);           
      } catch (error) { console.error(error); } finally { setIsLoadingData(false); }
    };
    void fetchUserData();
  }, [user?.uid]);
  
  // --- Sincronizzazione Rotte / Dati ---
  const loadedEntityRef = useRef<string | null>(null);
  const loadedThreadRef = useRef<string | null>(null);
  const threadMessagesCacheRef = useRef<Map<string, Message[]>>(new Map());

  const loadPastChat = useCallback(async (chat: PastChat) => {
    setIsLoadingData(true);
    setMessages([]);
    const getTime = (ts: unknown): number => {
      if (!ts) return 0;
      if (typeof ts === 'object' && ts !== null && 'seconds' in ts) return (ts as { seconds: number }).seconds * 1000;
      const d = new Date(ts as string | number | Date); return isNaN(d.getTime()) ? 0 : d.getTime();
    };
    try {
      const dbMessages = await fetchChatMessages(chat.id);
      if (loadedEntityRef.current !== `chat:${chat.id}`) return;
      const sortedMessages = [...dbMessages].sort((a, b) => {
        const diff = getTime(a.timestamp) - getTime(b.timestamp);
        if (diff !== 0) return diff; if (a.role === 'user' && b.role === 'model') return -1; if (a.role === 'model' && b.role === 'user') return 1; return 0;
      });
      setSessionTitle(chat.title); setMessages(sortedMessages.map((m: Message) => ({ ...m, isHistorical: true })));
      setAttachedDocs([]); void navigate(`/chat/${chat.id}`);
    } catch (error) { console.error(`[❌ ChatLoad] Errore`); console.error(error);} finally { setIsLoadingData(false); }
  }, [navigate]);

  const loadPastFascicolo = useCallback(async (fascicolo: PastFascicolo) => {
    setIsLoadingData(true);
    setMessages([]);
    try {
      const threadsData = await fetchFascicoloData(fascicolo.id);
      if (loadedEntityRef.current !== `fascicolo:${fascicolo.id}`) return;
      for (const thread of threadsData) {
        threadMessagesCacheRef.current.set(
          `${fascicolo.id}:${thread.threadId}`,
          thread.messages.map((message: Message) => ({ ...message, isHistorical: true }))
        );
      }
      setSessionTitle(fascicolo.title);
      if (threadsData.length > 0) {
        setThreads(threadsData.map((t: DBThreadPayload) => {
          let date = new Date();
          const dbDate: Timestamp = t.threadData?.updatedAt || t.threadData?.createdAt;
          if (dbDate) date = typeof dbDate.toDate === 'function' ? dbDate.toDate() : new Date();
          return { id: t.threadId, title: t.threadData?.title || "Conversazione", createdAt: date };
        }));
        const targetThreadId = threadId || threadsData[0].threadId;
        const activeThread = threadsData.find((t: DBThreadPayload) => t.threadId === targetThreadId) || threadsData[0];
        loadedThreadRef.current = `${fascicolo.id}:${activeThread.threadId}`;
        setActiveThreadId(activeThread.threadId); setThreadTitle(activeThread.threadData?.title || "Conversazione");
        setMessages(activeThread.messages.map((m: Message) => ({ ...m, isHistorical: true })));
        if (!threadId) void navigate(`/fascicolo/${fascicolo.id}/${targetThreadId}`);
      } else {
        const newThreadUid = uuidv4();
        loadedThreadRef.current = `${fascicolo.id}:${newThreadUid}`;
        setThreads([{ id: newThreadUid, title: "Nuova conversazione", createdAt: new Date() }]);
        setMessages([]); setThreadTitle("Nuova conversazione"); void navigate(`/fascicolo/${fascicolo.id}/${newThreadUid}`);
      }
    } catch (error) { toast.error("Errore nel caricamento."); console.error(error);} finally { setIsLoadingData(false); }
  }, [threadId, navigate]);

  useEffect(() => {
    const currentThreadKey = loadedThreadRef.current;
    if (fascicoloId && currentThreadKey?.startsWith(`${fascicoloId}:`)) {
      threadMessagesCacheRef.current.set(currentThreadKey, messages);
    }

    if (!chatId && !fascicoloId) {
      setSessionType('seleziona');
      setIsSetupComplete(false);
      loadedEntityRef.current = null;
      loadedThreadRef.current = null;
      setIsReadOnly(false);
      return;
    }
    const routeEntityKey = chatId ? `chat:${chatId}` : `fascicolo:${fascicoloId}`;
    if (isNewFascicolo && fascicoloId && threadId) {
      const threadKey = `${fascicoloId}:${threadId}`;
      setSessionType("fascicolo");
      setIsSetupComplete(true);
      setIsReadOnly(false);
      setActiveThreadId(threadId);
      setThreads((currentThreads) => {
        if (currentThreads.some((thread) => thread.id === threadId)) return currentThreads;
        return [{ id: threadId, title: "Nuova conversazione", createdAt: new Date() }, ...currentThreads];
      });
      setThreadTitle((currentTitle) => currentTitle || "Nuova conversazione");
      if (!threadMessagesCacheRef.current.has(threadKey)) {
        threadMessagesCacheRef.current.set(threadKey, []);
      }
      loadedEntityRef.current = routeEntityKey;
      if (loadedThreadRef.current !== threadKey) {
        loadedThreadRef.current = threadKey;
        setMessages(threadMessagesCacheRef.current.get(threadKey) ?? []);
        setThreadTitle(
          threads.find((thread) => thread.id === threadId)?.title || "Nuova conversazione"
        );
      }
      return;
    }
    if (loadedEntityRef.current && loadedEntityRef.current !== routeEntityKey) {
      loadedEntityRef.current = null;
      loadedThreadRef.current = null;
      setMessages([]);
    }
    if (isLoadingData) return;

    if (chatId) {
      setSessionType('temporanea'); setIsSetupComplete(true); setIsReadOnly(false);
      const entityKey = `chat:${chatId}`;
      if (loadedEntityRef.current !== entityKey && pastChats.length > 0) {
        const chatToLoad = pastChats.find(c => c.id === chatId);
        if (chatToLoad) {
          loadedEntityRef.current = entityKey;
          loadedThreadRef.current = null;
          void loadPastChat(chatToLoad);
        }
      }
    } else if (fascicoloId) {
      setSessionType('fascicolo'); setIsSetupComplete(true);
      if (threadId) setActiveThreadId(threadId);
      const entityKey = `fascicolo:${fascicoloId}`;
      if (loadedEntityRef.current !== entityKey && pastFascicoli.length > 0) {
        const fascicoloToLoad = pastFascicoli.find(f => f.id === fascicoloId);
        if (fascicoloToLoad) {
          loadedEntityRef.current = entityKey;
          loadedThreadRef.current = null;
          setIsReadOnly(fascicoloToLoad.user !== user?.uid);
          void loadPastFascicolo(fascicoloToLoad);
        }
        else { setMessages([]); setThreadTitle(""); setIsReadOnly(false); }
      } else if (loadedEntityRef.current === entityKey && threadId) {
        const threadKey = `${fascicoloId}:${threadId}`;
        if (loadedThreadRef.current !== threadKey) {
          loadedThreadRef.current = threadKey;
          const cachedMessages = threadMessagesCacheRef.current.get(threadKey);
          if (cachedMessages) {
            setActiveThreadId(threadId);
            setThreadTitle(threads.find((thread) => thread.id === threadId)?.title || "Conversazione");
            setMessages(cachedMessages);
          } else {
            setMessages([]);
            setThreadTitle("");
            void fetchFascicoloData(fascicoloId).then((threadsData: DBThreadPayload[]) => {
              if (loadedEntityRef.current !== entityKey || loadedThreadRef.current !== threadKey) return;
              for (const thread of threadsData) {
                threadMessagesCacheRef.current.set(
                  `${fascicoloId}:${thread.threadId}`,
                  thread.messages.map((message: Message) => ({ ...message, isHistorical: true }))
                );
              }
              const activeThread = threadsData.find(t => t.threadId === threadId);
              if (activeThread) {
                setActiveThreadId(threadId);
                setThreadTitle(activeThread.threadData?.title || "Conversazione");
                setMessages(threadMessagesCacheRef.current.get(threadKey) ?? []);
              } else {
                setMessages([]);
              }
            }).catch((error: unknown) => {
              console.error("[ChatLoad] Errore caricamento thread:", error);
              toast.error("Errore nel caricamento della conversazione.");
            });
          }
        }
      }
    }
  }, [
    chatId, 
    fascicoloId, 
    threadId, 
    isLoadingData, 
    pastChats, 
    pastFascicoli, 
    user?.uid, 
    loadPastChat, 
    loadPastFascicolo,
    activeThreadId,
    messages,
    threads,
    isNewFascicolo
  ]);
  
  // Navigazione & Helpers
  const startTempChat = () => void navigate(`/chat/${uuidv4()}`);
  const startFascicoloSetup = (): void => { setSessionTitle(""); setThreadTitle(""); setSessionType('fascicolo'); setIsSetupComplete(false); void navigate('/crea-nuovo-fascicolo'); };
  const finalizeFascicoloCreation = () => { setIsSetupComplete(true); void navigate(`/fascicolo/${uuidv4()}/${uuidv4()}`); };
  const closeSession = () => void navigate(-1);
  const clearFilters = () => { setFilterGrado(""); setFilterSezione(""); setFilterTipo(""); setFilterTipologia(""); setStartDate(""); setEndDate(""); };
  const toggleDocSelection = (doc: AttachedDocument) => setAttachedDocs(prev => prev.find(d => d.id === doc.id) ? prev.filter(d => d.id !== doc.id) : [...prev, doc]);
  const removeAttachment = (id: string) => setAttachedDocs(prev => prev.filter(d => d.id !== id));

  const startThread = (selectedThreadId: string) => { if (!fascicoloId) return; setActiveThreadId(selectedThreadId); void navigate(`/fascicolo/${fascicoloId}/${selectedThreadId}`); };
  const createNewThread = () => {
    if (!fascicoloId) { toast.error("Nessun fascicolo attivo."); return; }
    const newThreadId = uuidv4();
    setMessages([]); setThreadTitle("Nuova conversazione"); setAttachedDocs([]); clearFilters();
    setThreads(prev => [{ id: newThreadId, title: "Nuova conversazione", createdAt: new Date() }, ...prev]);
    threadMessagesCacheRef.current.set(`${fascicoloId}:${newThreadId}`, []);
    loadedThreadRef.current = `${fascicoloId}:${newThreadId}`;
    setActiveThreadId(newThreadId); void navigate(`/fascicolo/${fascicoloId}/${newThreadId}`);
  };

  const convertChatToFascicolo = async (title: string) => {
    const finalTitle = title.trim() || sessionTitle.trim();
    if (!finalTitle || !chatId || !LEGAL_AGENT_ENDPOINT) { toast.error("Impossibile convertire la chat in fascicolo."); return; }
    setIsConverting(true);
    const newFascicoloId = uuidv4(); const newThreadId = chatId;
    try {
      const { getSecurityTokens } = await import('@/infrastructure/security');
      const { authToken, appCheckToken } = await getSecurityTokens();
      const headers: HeadersInit = { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` };
      if (appCheckToken) headers['X-Firebase-AppCheck'] = appCheckToken;
      const response = await fetch(LEGAL_AGENT_ENDPOINT, { method: 'POST', headers, body: JSON.stringify({ action: 'migrate', old_chat_uuid: chatId, new_fascicolo_uuid: newFascicoloId, title: finalTitle, metadatiFascicolo: {} }) });
      if (!response.ok) throw new Error(`Errore migrazione. Status: ${response.status}`);
      // Ricarica completa: il nuovo fascicolo non è nell'archivio già caricato, serve rileggere thread e metadati.
      window.location.assign(`/fascicolo/${newFascicoloId}/${newThreadId}`);
    } catch (error) { console.error('🚨 Errore:', error); toast.error("Errore durante la conversione in fascicolo."); setIsConverting(false); }
  };

  const handleSourceClick = async (e: React.MouseEvent, source: Source) => {
      e.stopPropagation();
      if (source._type === 'web_search' && source.url_riferimento) { window.open(source.url_riferimento, '_blank', 'noopener,noreferrer'); return; }
      try {
        const docId = source.documento_id; if(!docId) throw new Error("Documento non identificato");
        const basePath = (source._type === 'document_chunk' || !!source.id_fascicolo) ? "documento" : "giurisprudenza";
        window.open(`/${basePath}/${docId}`, window.innerWidth < 768 ? "_self" : "_blank", "noopener,noreferrer");
      } catch (error) { console.error(error); } 
  };

  const getSeoData = () => {
    switch(sessionType) {
      case 'storico': return { title: "Archivio | Jurio", desc: "Consultazioni passate." };
      case 'fascicolo': case 'temporanea': return { title: "Consulente Legale | Jurio", desc: "Analisi in corso." };
      default: return { title: "Consultazione | Jurio", desc: "Ricerca AI." };
    }
  };

  return {
    sessionType, setSessionType, isSetupComplete, setIsSetupComplete,
    isConverting, setIsConverting, messages, setMessages,
    inputValue, setInputValue, activeSourceId, setActiveSourceId,
    agentState, isStreaming, agentStatusText, showFilters, setShowFilters,
    showDocsModal, setShowDocsModal, attachedDocs, setAttachedDocs,
    filterState, setFilterState, activeFiltersCount, clearFilters,
    messagesEndRef, handleSendMessage, toggleDocSelection, removeAttachment, loadPastFascicolo, loadPastChat,
    seo: getSeoData(), startTempChat, startFascicoloSetup, finalizeFascicoloCreation, convertChatToFascicolo, closeSession,
    createNewThread, sessionTitle, setSessionTitle, threadTitle, setThreadTitle, 
    threads, activeThreadId, archiveDocs, pastFascicoli, pastChats, isLoadingData, processFilesParallel, isProcessingFiles,
    handleSourceClick, showTitleModal, setShowTitleModal, startThread, denyOpen,
    renameFascicolo, renameChat, deleteChat, deleteFascicolo, deleteThread, renameThread,
    handleToggleFascicoloLink, handleDeleteDocumento, handleRenameDocumento,
    setActiveQuote, activeQuote, isReadOnly,
  };
};