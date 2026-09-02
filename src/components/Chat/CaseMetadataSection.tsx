import React, { useState, useEffect } from "react";
import { Tag, ChevronUp, ChevronDown, Plus, Trash2, Check, X, Edit2, Lock } from "lucide-react";
import { doc, onSnapshot, updateDoc, deleteField } from "firebase/firestore";
import { getDb } from "@/services/db"; 
import toast from "react-hot-toast";

interface CaseMetadataSectionProps {
  activeFascicoloId: string;
  initialMetadati: Record<string, string>;
  isReadOnly?: boolean; // <-- AGGIUNTO
}

export const CaseMetadataSection: React.FC<CaseMetadataSectionProps> = ({ 
  activeFascicoloId, 
  initialMetadati,
  isReadOnly = false // <-- Valore di default
}) => {
  const [metadati, setMetadati] = useState<Record<string, string>>(initialMetadati);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(true);

  useEffect(() => {
    let unsubscribe = () => {};

    const setupListener = async () => {
      try {
        const db = await getDb();
        const fascicoloRef = doc(db, "fascicoli", activeFascicoloId);
        
        unsubscribe = onSnapshot(fascicoloRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setMetadati(data.metadati || {});
          }
        }, (err) => {
          console.error("Errore ascolto metadati:", err);
        });
      } catch (error) {
        console.error("Errore inizializzazione db per metadati:", error);
      }
    };

    setupListener();

    return () => {
      unsubscribe();
    };
  }, [activeFascicoloId]);

  const handleSaveEdit = async (key: string) => {
    if (!activeFascicoloId || isReadOnly) return;
    try {
      const db = await getDb();
      const fascicoloRef = doc(db, "fascicoli", activeFascicoloId);
      await updateDoc(fascicoloRef, {
        [`metadati.${key}`]: editValue.trim()
      });
      setEditingKey(null);
      toast.success("Metadato aggiornato");
    } catch (err) {
      console.error("Errore modifica metadato:", err);
      toast.error("Impossibile aggiornare");
    }
  };

  const handleDeleteSingle = async (key: string) => {
    if (!activeFascicoloId || isReadOnly) return;
    try {
      const db = await getDb();
      const fascicoloRef = doc(db, "fascicoli", activeFascicoloId);
      await updateDoc(fascicoloRef, {
        [`metadati.${key}`]: deleteField()
      });
      toast.success("Metadato rimosso");
    } catch (err) {
      console.error("Errore rimozione metadato:", err);
      toast.error("Impossibile rimuovere il metadato");
    }
  };

  const handleDeleteAll = async () => {
    if (!activeFascicoloId || isReadOnly || !window.confirm("Vuoi eliminare tutti i metadati del fascicolo?")) return;
    try {
      const db = await getDb();
      const fascicoloRef = doc(db, "fascicoli", activeFascicoloId);
      await updateDoc(fascicoloRef, {
        metadati: {}
      });
      toast.success("Tutti i metadati sono stati puliti");
    } catch (err) {
      console.error("Errore pulizia metadati:", err);
      toast.error("Impossibile ripulire i metadati");
    }
  };

  const handleAddNew = async () => {
    if (!activeFascicoloId || isReadOnly || !newKey.trim() || !newValue.trim()) return;
    try {
      const db = await getDb();
      const safeKey = newKey.trim().replace(/[./]/g, '');
      const fascicoloRef = doc(db, "fascicoli", activeFascicoloId);
      await updateDoc(fascicoloRef, {
        [`metadati.${safeKey}`]: newValue.trim()
      });
      setNewKey("");
      setNewValue("");
      setIsAddingNew(false);
      toast.success("Metadato aggiunto");
    } catch (err) {
      console.error("Errore aggiunta metadato:", err);
      toast.error("Impossibile aggiungere il metadato");
    }
  };

  return (
    <div className="border-b border-(--color-border) shrink-0 bg-(--color-surface)">
      <div className="py-2.5 px-3 flex justify-between items-center text-(--color-muted)">
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-1.5 hover:text-(--color-text) transition-colors text-left outline-none"
        >
          <Tag size={12} className="opacity-70" /> 
          <span className="font-bold text-[10px] uppercase tracking-widest text-(--color-text)">Info sul caso</span>
          {isReadOnly && (
            <span className="inline-flex items-center gap-1 ml-1 text-[9px] px-1.5 py-0.2 bg-(--color-surface) border border-(--color-border) rounded-sm text-(--color-muted)">
              <Lock size={9} /> Sola lettura
            </span>
          )}
          {isCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </button>

        {/* Mostra i pulsanti di aggiunta ed eliminazione globale solo se NON è in sola lettura */}
        {!isReadOnly && (
          <div className="flex items-center gap-0.5">
            <button 
              onClick={() => setIsAddingNew(!isAddingNew)} 
              className="p-1 hover:text-(--color-text) rounded-sm transition-colors outline-none"
              title="Aggiungi info"
              aria-label="Aggiungi info"
            >
              <Plus size={13} />
            </button>
            {Object.keys(metadati).length > 0 && (
              <button 
                onClick={handleDeleteAll} 
                className="p-1 hover:text-red-600 dark:hover:text-red-400 rounded-sm transition-colors outline-none"
                title="Elimina tutto"
                aria-label="Elimina tutto"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        )}
      </div>

      {!isCollapsed && (
        <div className="px-3 pb-3 space-y-1.5 text-xs max-h-[30vh] overflow-y-auto bg-(--color-bg)">
          {!isReadOnly && isAddingNew && (
            <div className="py-2 space-y-1.5 border-b border-(--color-border) mb-2">
              <input
                type="text"
                placeholder="Etichetta (es. Giudice)"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-(--color-surface) border border-(--color-border) rounded-sm text-[11px] text-(--color-text) placeholder:text-(--color-muted) outline-none focus:border-(--color-text) font-light transition-colors"
              />
              <input
                type="text"
                placeholder="Valore"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-(--color-surface) border border-(--color-border) rounded-sm text-[11px] text-(--color-text) placeholder:text-(--color-muted) outline-none focus:border-(--color-text) font-light transition-colors"
              />
              <div className="flex justify-end gap-2 pt-1 text-[10px]">
                <button onClick={() => setIsAddingNew(false)} className="text-(--color-muted) hover:text-(--color-text) font-bold uppercase tracking-widest outline-none">Annulla</button>
                <button onClick={handleAddNew} className="font-bold uppercase tracking-widest text-(--color-text) outline-none">Salva</button>
              </div>
            </div>
          )}

          {Object.keys(metadati).length === 0 && !isAddingNew ? (
            <div className="py-2 text-[10px] text-(--color-muted) font-light italic">Nessuna informazione</div>
          ) : (
            Object.entries(metadati).map(([key, value]) => (
              <div key={key} className="group flex items-center justify-between py-1 px-1.5 rounded-sm hover:bg-(--color-surface) transition-colors border border-transparent hover:border-(--color-border)">
                <div className="flex flex-col overflow-hidden pr-2 w-full">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-(--color-muted)">{key}</span>
                  
                  {!isReadOnly && editingKey === key ? (
                    <div className="flex items-center gap-1 mt-1">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full px-1.5 py-1 bg-(--color-surface) border border-(--color-border) rounded-sm text-xs text-(--color-text) outline-none focus:border-(--color-text)"
                        autoFocus
                      />
                      <button onClick={() => handleSaveEdit(key)} className="text-(--color-text) p-1 outline-none" aria-label="Salva modifica">
                        <Check size={12} />
                      </button>
                      <button onClick={() => setEditingKey(null)} className="text-(--color-muted) p-1 outline-none" aria-label="Annulla modifica">
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-(--color-text) truncate font-light">{String(value)}</span>
                  )}
                </div>

                {/* Mostra i tasti di modifica/eliminazione singoli solo se NON è in sola lettura */}
                {!isReadOnly && editingKey !== key && (
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1 shrink-0">
                    <button 
                      onClick={() => { setEditingKey(key); setEditValue(String(value)); }} 
                      className="p-1 text-(--color-muted) hover:text-(--color-text) transition-colors outline-none"
                      title="Modifica"
                      aria-label="Modifica metadato"
                    >
                      <Edit2 size={11} />
                    </button>
                    <button 
                      onClick={() => handleDeleteSingle(key)} 
                      className="p-1 text-(--color-muted) hover:text-red-600 transition-colors outline-none"
                      title="Elimina"
                      aria-label="Elimina metadato"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};