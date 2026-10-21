import React, { useRef, useState } from "react";
import { MessageSquare, Plus, Trash2, ChevronRight, Lock, Pencil } from "lucide-react";
import type { ThreadItem } from "@/interfaces/interfaces";

interface ThreadSectionProps {
  threads: ThreadItem[];
  activeThreadId?: string;
  activeFascicoloId: string;
  onThreadSelect?: (id: string) => void;
  onNewThread?: () => void;
  onDeleteThread?: (fascicoloId: string, threadId: string) => void;
  onRenameThread?: (fascicoloId: string, threadId: string, title: string) => void | Promise<void>;
  isReadOnly?: boolean;
}

export const ThreadSection: React.FC<ThreadSectionProps> = ({
  threads,
  activeThreadId,
  activeFascicoloId,
  onThreadSelect,
  onNewThread,
  onDeleteThread,
  onRenameThread,
  isReadOnly = false,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const cancelledRef = useRef(false);

  const startEditing = (id: string, title: string) => {
    cancelledRef.current = false;
    setEditingId(id);
    setDraftTitle(title);
  };

  const commitEditing = (id: string, currentTitle: string) => {
    const next = draftTitle.trim();
    setEditingId(null);
    if (cancelledRef.current) return;
    if (next && next !== currentTitle) void onRenameThread?.(activeFascicoloId, id, next);
  };
  return (
    <div className="relative flex flex-col border-b border-(--color-border) bg-(--color-surface) max-h-[30%] shrink-0">
      {/* LA LINEA DI RIGORE SUPERIORE (Unico tocco di colore) */}
      <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

      <div className="p-4 border-b border-(--color-border) flex justify-between items-center bg-(--color-bg)">
        <h2 className="font-bold text-[10px] tracking-widest flex items-center gap-2 text-(--color-muted)">
          <MessageSquare size={14} className="opacity-70" /> Conversazioni
          {isReadOnly && (
            <span className="inline-flex items-center gap-1 ml-2 text-[9px] px-1.5 py-0.5 bg-(--color-surface) border border-(--color-border) rounded-sm text-(--color-muted)">
              <Lock size={10} /> Sola lettura
            </span>
          )}
        </h2>
        
        {/* Mostra il tasto Nuova Chat solo se NON è in sola lettura */}
        {!isReadOnly && (
          <button 
            onClick={onNewThread} 
            className="p-1.5 hover:bg-(--color-surface) rounded-sm text-(--color-text) transition-colors border border-transparent hover:border-(--color-border) outline-none"
            title="Nuova conversazione"
            aria-label="Nuova conversazione"
          >
            <Plus size={16} />
          </button>
        )}
      </div>

      <div className="p-2 overflow-y-auto space-y-1 bg-(--color-surface)">
        {threads.length === 0 ? (
          <div className="p-4 text-center text-xs text-(--color-muted) font-light italic">Nessuna conversazione attiva</div>
        ) : (
          threads.map(t => {
            const isActive = activeThreadId === t.id;

            return (
              <div
                key={t.id}
                onClick={() => onThreadSelect?.(t.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault(); // Previene lo scroll della pagina con lo Spazio
                    onThreadSelect?.(t.id);
                  }
                }}
                role="button"
                tabIndex={0}
                className={`w-full flex items-center justify-between p-2.5 rounded-sm text-left cursor-pointer transition-all group outline-none border focus-visible:ring-1 focus-visible:ring-(--color-text) ${
                  isActive 
                    ? 'bg-(--color-bg) border-(--color-text)' 
                    : 'bg-(--color-surface) hover:bg-(--color-bg) border-transparent hover:border-(--color-border)'
                }`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <MessageSquare size={14} className={`shrink-0 ${isActive ? 'text-(--color-text)' : 'text-(--color-muted)'}`} />
                  {editingId === t.id ? (
                    <input
                      autoFocus
                      value={draftTitle}
                      maxLength={120}
                      aria-label="Nuovo nome conversazione"
                      onChange={(e) => setDraftTitle(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') commitEditing(t.id, t.title);
                        else if (e.key === 'Escape') { cancelledRef.current = true; setEditingId(null); }
                      }}
                      onBlur={() => commitEditing(t.id, t.title)}
                      className="w-full min-w-0 px-1.5 py-0.5 text-xs bg-(--color-bg) border border-(--color-text) rounded-sm text-(--color-text) outline-none"
                    />
                  ) : (
                    <span className={`text-xs truncate ${isActive ? 'font-bold text-(--color-text)' : 'font-light text-(--color-muted)'}`}>
                      {t.title || "Nuova Chat"}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-1">
                  {!isReadOnly && onRenameThread && editingId !== t.id && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(t.id, t.title || "");
                      }}
                      className="p-1 text-(--color-muted) hover:text-(--color-text) transition-colors outline-none opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                      title="Rinomina conversazione"
                      aria-label="Rinomina conversazione"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                  {/* Mostra il cestino solo se NON è in sola lettura */}
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteThread?.(activeFascicoloId, t.id);
                      }}
                      className="p-1 text-(--color-muted) hover:text-red-600 transition-colors outline-none opacity-0 group-hover:opacity-100"
                      title="Elimina conversazione"
                      aria-label="Elimina conversazione"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                  <ChevronRight size={14} className={isActive ? 'text-(--color-text)' : 'text-(--color-muted)'} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};