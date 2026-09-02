import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Folder, ChevronRight, MessageSquare, Files, Loader2, Trash2, Pencil } from "lucide-react";
import type { PastFascicolo, PastChat } from "@/interfaces/interfaces";
import { Timestamp } from "firebase/firestore";

interface PastFascicoliProps {
  fascicoli: PastFascicolo[];
  chats: PastChat[]; 
  onSelectFascicolo: (fascicolo: PastFascicolo) => Promise<void> | void; 
  onSelectChat: (chat: PastChat) => Promise<void> | void; 
  onBack: () => void;
  onDeleteFascicolo: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onRenameFascicolo: (id: string, currentName: string) => void;
  onRenameChat: (id: string, currentName: string) => void;
}

const isTimestamp = (v: unknown): v is Timestamp => {
  return (
    typeof v === "object" &&
    v !== null &&
    "toDate" in v &&
    typeof (v as { toDate?: unknown }).toDate === "function"
  );
};

const formatDate = (v: unknown): string => {
  if (!v) return "";
  if (isTimestamp(v)) return v.toDate().toLocaleDateString();
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString();
  }
  if (v instanceof Date) return v.toLocaleDateString();
  return "";
};

export const PastFascicoli: React.FC<PastFascicoliProps> = ({ 
  fascicoli, 
  chats, 
  onSelectFascicolo, 
  onSelectChat, 
  onDeleteFascicolo,
  onDeleteChat,
  onRenameFascicolo,
  onRenameChat
}) => {
  // 1. Inizializza lo stato leggendo l'hash dall'URL, se presente
  const [activeTab, setActiveTab] = useState<'fascicoli' | 'chats'>(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace("#", "");
      if (hash === "chats") return "chats";
    }
    return "fascicoli"; // fallback predefinito
  });
  
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // 2. Aggiorna l'URL quando l'utente cambia tab
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Uso replaceState per non riempire la history del browser con i click sulle tab
      window.history.replaceState(null, "", `#${activeTab}`);
    }
  }, [activeTab]);

  // 3. Ascolta i cambiamenti dell'hash (es. se l'utente usa i tasti Indietro/Avanti del browser)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash === "chats" || hash === "fascicoli") {
        setActiveTab(hash);
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const handleSelectFascicolo = async (f: PastFascicolo) => {
    if (loadingId !== null) return;
    setLoadingId(f.id);
    await onSelectFascicolo(f);
    setLoadingId(null);
  };

  const handleSelectChat = async (c: PastChat) => {
    if (loadingId !== null) return;
    setLoadingId(c.id);
    await onSelectChat(c);
    setLoadingId(null);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} 
      animate={{ opacity: 1, x: 0 }} 
      exit={{ opacity: 0, x: -20 }} 
      className="flex flex-col h-full w-full max-w-5xl mx-auto px-6 py-10"
    >
      {/* LA LINEA DI RIGORE SUPERIORE */}
      <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

      {/* HEADER */}
      <div className="flex items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-medium text-(--color-text) flex items-center gap-3">
            <Files className="shrink-0 w-6 h-6 md:w-7 md:h-7 opacity-80" />
            <span className="leading-tight">Archivio Consultazioni</span>
          </h1>
          <p className="text-sm text-(--color-muted) font-light mt-1 leading-relaxed">
            Riprendi il lavoro dai tuoi fascicoli o dalle ricerche veloci.
          </p>
        </div>
      </div>

      {/* TABS CONTROLLER */}
      <div className="flex items-center gap-2 mb-8 bg-(--color-surface) border border-(--color-border) p-1.5 rounded-lg w-fit shadow-xs">
        <button
          onClick={() => setActiveTab('fascicoli')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-md font-bold text-xs uppercase tracking-wider transition-all outline-none ${
            activeTab === 'fascicoli' 
              ? 'bg-(--color-text) text-(--color-surface) shadow-xs' 
              : 'text-(--color-muted) hover:text-(--color-text) bg-transparent'
          }`}
        >
          <Folder size={16} /> Fascicoli ({fascicoli.length})
        </button>
        <button
          onClick={() => setActiveTab('chats')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-md font-bold text-xs uppercase tracking-wider transition-all outline-none ${
            activeTab === 'chats' 
              ? 'bg-(--color-text) text-(--color-surface) shadow-xs' 
              : 'text-(--color-muted) hover:text-(--color-text) bg-transparent'
          }`}
        >
          <MessageSquare size={16} /> Chat Veloci ({chats.length})
        </button>
      </div>

      {/* LISTA DINAMICA */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 pb-10">
        <AnimatePresence mode="popLayout">
          {activeTab === 'fascicoli' && fascicoli.map((f) => (
            <motion.div 
              key={`fascicolo-${f.id}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={() => handleSelectFascicolo(f)}
              role="button"
              tabIndex={0}
              className={`flex flex-col p-6 bg-(--color-surface) border border-(--color-border) rounded-lg transition-all text-left group shadow-(--shadow-soft) outline-none
                ${loadingId !== null ? 'opacity-70 cursor-wait' : 'cursor-pointer hover:border-(--color-text)'}`}
            >
              <div className="flex items-start justify-between w-full mb-4">
                <div className="p-3 bg-(--color-bg) border border-(--color-border) rounded-md text-(--color-text)">
                  <Folder size={20} className="opacity-80" />
                </div>
                
                {/* Azioni: Rinomina, Elimina e Vai */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRenameFascicolo(f.id, f.title);
                    }}
                    className="p-1.5 text-(--color-muted) hover:text-(--color-text) hover:bg-(--color-bg) rounded-sm transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 outline-none"
                    title="Rinomina"
                    aria-label="Rinomina fascicolo"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFascicolo(f.id);
                    }}
                    className="p-1.5 text-(--color-muted) hover:text-red-600 hover:bg-red-500/10 rounded-sm transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 outline-none"
                    title="Elimina"
                    aria-label="Elimina fascicolo"
                  >
                    <Trash2 size={15} />
                  </button>
                  <div className="p-1.5 bg-(--color-bg) border border-(--color-border) rounded-sm shrink-0">
                    {loadingId === f.id ? (
                      <Loader2 size={16} className="animate-spin text-(--color-text)" />
                    ) : (
                      <ChevronRight size={16} className="text-(--color-text) opacity-70 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </div>
              </div>
              
              <h3 className="text-base font-bold text-(--color-text) leading-tight mb-3 flex-1 tracking-tight">
                {f.title}
              </h3>
              
              <span className="flex items-center gap-1.5 text-xs text-(--color-muted) font-light">
                <Clock size={13} className="opacity-70" /> 
                {formatDate(f.updatedAt)} 
              </span>
            </motion.div>
          ))}

          {activeTab === 'chats' && chats.map((c) => (
            <motion.div 
              key={`chat-${c.id}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={() => handleSelectChat(c)}
              role="button"
              tabIndex={0}
              className={`flex flex-col p-6 bg-(--color-surface) border border-(--color-border) rounded-lg transition-all text-left group shadow-(--shadow-soft) outline-none
                ${loadingId !== null ? 'opacity-70 cursor-wait' : 'cursor-pointer hover:border-(--color-text)'}`}
            >
              <div className="flex items-start justify-between w-full mb-4">
                <div className="p-3 bg-(--color-bg) border border-(--color-border) rounded-md text-(--color-text)">
                  <MessageSquare size={20} className="opacity-80" />
                </div>
                
                {/* Azioni: Rinomina, Elimina e Vai */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRenameChat(c.id, c.title || "Nuova Ricerca");
                    }}
                    className="p-1.5 text-(--color-muted) hover:text-(--color-text) hover:bg-(--color-bg) rounded-sm transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 outline-none"
                    title="Rinomina"
                    aria-label="Rinomina chat"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteChat(c.id);
                    }}
                    className="p-1.5 text-(--color-muted) hover:text-red-600 hover:bg-red-500/10 rounded-sm transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 outline-none"
                    title="Elimina"
                    aria-label="Elimina chat"
                  >
                    <Trash2 size={15} />
                  </button>
                  <div className="p-1.5 bg-(--color-bg) border border-(--color-border) rounded-sm shrink-0">
                    {loadingId === c.id ? (
                      <Loader2 size={16} className="animate-spin text-(--color-text)" />
                    ) : (
                      <ChevronRight size={16} className="text-(--color-text) opacity-70 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </div>
              </div>
              
              <h3 className="text-base font-bold text-(--color-text) leading-tight mb-3 flex-1 tracking-tight">
                {c.title || "Nuova Ricerca"}
              </h3>
              
              <div className="flex items-center gap-3 text-xs text-(--color-muted) font-light border-t border-(--color-border) pt-3 mt-2">
                <span className="flex items-center gap-1.5"><Clock size={13} className="opacity-70" /> {formatDate(c.updatedAt)}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};