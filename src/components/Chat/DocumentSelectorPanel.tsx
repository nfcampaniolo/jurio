import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileText, Loader2, Info, Play } from "lucide-react";
import { Menu, Transition, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { Fragment } from "react";
import { FaChevronDown, FaCheck } from "react-icons/fa";
import { toast } from "react-hot-toast";

// Assicurati che SavedPrompt sia esportato da interfaces.ts
import type { AttachedDocument, DocumentSelectorPanelProps } from "@/interfaces/interfaces";

import { DropZoneUploader } from "../Document/DropZoneUploader";
import { DocumentCard } from "../Document/DocumentCard";
import { DocumentModals } from "../Document/DocumentModals";

// IMPORTA IL TUO COMPONENTE (Assicurati che il percorso sia corretto in base alla tua cartella)
import { PromptSelector } from "@/components/PromptSelector";

export const DocumentSelectorPanel: React.FC<DocumentSelectorPanelProps> = ({ 
  isOpen, 
  onClose, 
  archiveDocs,
  attachedDocs,
  onToggleDoc,
  onProcessFiles,
  onToggleFascicoloLink,
  isLoading = false,
  isProcessing = false,
  onRenameDocumento,
  onDeleteDocumento
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]); 
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<"name" | "date">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [itemToRename, setItemToRename] = useState<AttachedDocument | null>(null);
  const [newName, setNewName] = useState("");
  
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<AttachedDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // --- STATO PER I PROMPT CUSTOM ---
  const [selectedPromptId, setSelectedPromptId] = useState<string>("default");

  const { fascicoloId } = useParams<{ fascicoloId?: string }>();

  const maxAllowed = 10;
  const totalCount = attachedDocs.length + pendingFiles.length;

  
  const processedDocs = archiveDocs
    .filter(doc => doc.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortField === "name") {
        return sortDirection === "asc"
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }
      return sortDirection === "asc"
        ? new Date(a.dataSentenza?.toDate() || 0).getTime() - new Date(b.dataSentenza?.toDate() || 0).getTime()
        : new Date(b.dataSentenza?.toDate() || 0).getTime() - new Date(a.dataSentenza?.toDate() || 0).getTime();
    });

  const priorityDocs = processedDocs.filter(doc => {
    const d = doc as AttachedDocument;
    return !!(fascicoloId && d.fascicoloIds?.includes(fascicoloId));
  });

  const otherDocs = processedDocs.filter(doc => {
    const d = doc as AttachedDocument;
    const isLinkedToCurrentFascicolo = fascicoloId && d.fascicoloIds?.includes(fascicoloId);
    return !fascicoloId || !isLinkedToCurrentFascicolo;
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave" || e.type === "drop") setDragActive(false);
  };

  const addPendingFiles = (files: File[]) => {
    if (totalCount + files.length > maxAllowed) {
      toast.error(`Puoi allegare al massimo ${maxAllowed} documenti in totale.`);
      return;
    }
    setPendingFiles(prev => [...prev, ...files]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addPendingFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addPendingFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleProcessAndClose = async () => {
    if (pendingFiles.length > 0) {
      // ATTENZIONE: Assicurati che `onProcessFiles` supporti il terzo parametro (promptId)
      await onProcessFiles(pendingFiles, selectedPromptId, fascicoloId);
      setPendingFiles([]); 
    }
    onClose();
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemToRename || !newName.trim()) return;
    try {
      await onRenameDocumento?.(itemToRename.id, newName.trim());
      setIsRenameOpen(false);
      setItemToRename(null);
      setNewName("");
    } catch (err) {
      console.error("Errore rinomina:", err);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    try {
      setIsDeleting(true);
      await onDeleteDocumento?.(itemToDelete.id);
      setIsDeleteOpen(false);
      setItemToDelete(null);
    } catch (err) {
      console.error("Errore eliminazione:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={!isProcessing ? onClose : undefined} 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-60"
          />

          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-5xl bg-(--color-surface) border-l border-(--color-border) shadow-2xl z-70 flex flex-col overflow-hidden"
          >
            {/* LA LINEA DI RIGORE SUPERIORE */}
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

            <div className="flex items-center justify-between p-5 border-b border-(--color-border) bg-(--color-bg)">
              <div className="flex flex-col mt-1">
                <h2 className="text-lg font-medium text-(--color-text)" style={{ fontFamily: 'var(--font-serif)' }}>
                  Documenti Sessione
                </h2>
                <div className="flex items-center gap-2 mt-1">
                   <span className={`text-[10px] px-2 py-0.5 rounded-sm font-bold uppercase tracking-widest border ${totalCount >= 10 ? 'border-(--color-text) text-(--color-text) bg-(--color-surface)' : 'border-(--color-border) text-(--color-muted) bg-(--color-surface)'}`}>
                    {totalCount} / 10 Allegati
                  </span>
                </div>
              </div>
              <button 
                onClick={onClose} 
                disabled={isProcessing} 
                className="p-2 hover:bg-(--color-surface) rounded-md transition-colors text-(--color-muted) hover:text-(--color-text) disabled:opacity-50 outline-none mt-1"
                aria-label="Chiudi pannello documenti"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-8 scrollbar-hide">
              <DropZoneUploader
                dragActive={dragActive}
                isProcessing={isProcessing}
                pendingFiles={pendingFiles}
                maxAllowed={maxAllowed}
                totalCount={totalCount}
                onDrag={handleDrag}
                onDrop={handleDrop}
                onFileChange={handleFileChange}
                removePendingFile={removePendingFile}
              />

              <section className={`flex flex-col gap-3 ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="flex flex-col md:flex-row gap-3 justify-between items-center">
                  <input
                    type="text"
                    placeholder="Cerca documenti..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full md:max-w-md rounded-md border border-(--color-border) px-4 py-2.5 bg-(--color-surface) text-(--color-text) placeholder:text-(--color-muted) outline-none text-sm font-light"
                  />

                  <div className="flex gap-2">
                    <Menu as="div" className="relative">
                      <MenuButton className="inline-flex items-center gap-2 rounded-md border border-(--color-border) bg-(--color-surface) px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-(--color-text) hover:bg-(--color-bg) transition-colors outline-none">
                        {sortField === "date" ? (sortDirection === "desc" ? "Più recenti" : "Meno recenti") : (sortDirection === "asc" ? "Nome A–Z" : "Nome Z–A")}
                        <FaChevronDown className="text-[10px] opacity-60" />
                      </MenuButton>
                      <Transition as={Fragment} enter="transition duration-150 ease-out" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="transition duration-100 ease-in" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                        <MenuItems className="absolute right-0 mt-2 w-56 origin-top-right rounded-md border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) p-1 z-50">
                          {[
                            { label: "Più recenti", field: "date", direction: "desc" },
                            { label: "Meno recenti", field: "date", direction: "asc" },
                            { label: "Nome A–Z", field: "name", direction: "asc" },
                            { label: "Nome Z–A", field: "name", direction: "desc" },
                          ].map((item) => {
                            const active = sortField === item.field && sortDirection === item.direction;
                            return (
                              <MenuItem key={item.label}>
                                {({ active: hover }) => (
                                  <button
                                    onClick={() => {
                                      setSortField(item.field as "name" | "date");
                                      setSortDirection(item.direction as "asc" | "desc");
                                    }}
                                    className={`w-full flex items-center justify-between rounded-sm px-3 py-2 text-xs uppercase tracking-wider transition-colors outline-none ${hover ? "bg-(--color-bg) text-(--color-text)" : "text-(--color-muted)"}`}
                                  >
                                    <span>{item.label}</span>
                                    {active && <FaCheck className="text-(--color-text) text-[10px]" />}
                                  </button>
                                )}
                              </MenuItem>
                            );
                          })}
                        </MenuItems>
                      </Transition>
                    </Menu>
                  </div>
                </div>

                <h3 className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted) flex items-center gap-2 pt-3">
                  <FileText size={14} /> Il tuo Archivio
                </h3>
                
                <div className="space-y-4">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-10 text-(--color-muted) gap-3">
                      <Loader2 size={24} className="animate-spin text-(--color-text)" />
                      <span className="text-xs font-light italic">Sincronizzazione archivio in corso...</span>
                    </div>
                  ) : archiveDocs.length === 0 ? (
                    <div className="p-8 text-center border border-dashed rounded-lg border-(--color-border) bg-(--color-bg)">
                      <Info className="mx-auto text-(--color-muted) mb-2 opacity-60" size={20} />
                      <p className="text-xs text-(--color-muted) font-light">Non ci sono ancora documenti salvati nel tuo profilo.</p>
                    </div>
                  ) : (
                    <>
                      {priorityDocs.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-[10px] font-bold text-(--color-text) uppercase tracking-wider pl-1">
                            Documenti in questo fascicolo
                          </div>
                          {priorityDocs.map((doc, index) => (
                            <DocumentCard
                              key={doc.id || `priority-${index}`}
                              doc={doc}
                              fallbackIndex={index}
                              listType="priority"
                              isSelected={attachedDocs.some(d => d.id === doc.id)}
                              isLinkedToCurrent={!!(fascicoloId && doc.fascicoloIds?.includes(fascicoloId))}
                              fascicoloId={fascicoloId}
                              totalCount={totalCount}
                              maxAllowed={maxAllowed}
                              onToggleDoc={onToggleDoc}
                              onToggleFascicoloLink={onToggleFascicoloLink}
                              openRenameModal={(d) => { setItemToRename(d); setNewName(d.name); setIsRenameOpen(true); }}
                              openDeleteModal={(d) => { setItemToDelete(d); setIsDeleteOpen(true); }}
                              onRenameDocumento={onRenameDocumento}
                              onDeleteDocumento={onDeleteDocumento}
                              onErrorLimit={() => toast.error("Limite massimo raggiunto.")}
                            />
                          ))}
                        </div>
                      )}

                      {otherDocs.length > 0 && (
                        <div className="space-y-2">
                          {priorityDocs.length > 0 && (
                            <div className="text-[10px] font-bold text-(--color-muted) uppercase tracking-wider pl-1 pt-2">
                              Altri documenti in archivio
                            </div>
                          )}
                          {otherDocs.map((doc, index) => (
                            <DocumentCard
                              key={doc.id || `other-${index}`}
                              doc={doc}
                              fallbackIndex={index}
                              listType="other"
                              isSelected={attachedDocs.some(d => d.id === doc.id)}
                              isLinkedToCurrent={!!(fascicoloId && doc.fascicoloIds?.includes(fascicoloId))}
                              fascicoloId={fascicoloId}
                              totalCount={totalCount}
                              maxAllowed={maxAllowed}
                              onToggleDoc={onToggleDoc}
                              onToggleFascicoloLink={onToggleFascicoloLink}
                              openRenameModal={(d) => { setItemToRename(d); setNewName(d.name); setIsRenameOpen(true); }}
                              openDeleteModal={(d) => { setItemToDelete(d); setIsDeleteOpen(true); }}
                              onRenameDocumento={onRenameDocumento}
                              onDeleteDocumento={onDeleteDocumento}
                              onErrorLimit={() => toast.error("Limite massimo raggiunto.")}
                            />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </section>
            </div>

            {/* SEZIONE AZIONI E CONFERMA */}
            <div className="p-5 border-t border-(--color-border) bg-(--color-surface) flex flex-col gap-4">
               
              {/* MOSTRA IL SELECTOR SOLO SE CI SONO NUOVI FILE DA ANALIZZARE */}
              {pendingFiles.length > 0 && (
                  <div className="bg-(--color-bg) p-3 rounded-md border border-(--color-border)">
                    {/* ECCO IL COMPONENTE RIUTILIZZABILE! */}
                    <PromptSelector 
                      value={selectedPromptId}
                      onChange={setSelectedPromptId} // Aggiorna direttamente lo stato
                      disabled={isProcessing}
                      label="Modello di Analisi per i nuovi file"
                    />
                  </div>
              )}

               <div className="flex items-center gap-2 text-(--color-muted) px-1">
                 <Info size={12} className="shrink-0" />
                 <span className="text-[10px] font-light">I file selezionati verranno inclusi nel contesto dell'analisi.</span>
               </div>
               
               <button
                onClick={handleProcessAndClose}
                disabled={isProcessing || totalCount > maxAllowed}
                className="w-full py-3 bg-(--color-text) text-(--color-surface) rounded-md font-bold text-xs uppercase tracking-widest hover:opacity-80 transition-opacity flex justify-center items-center gap-2 disabled:opacity-50 outline-none shadow-sm"
              >
                {isProcessing ? (
                  <><Loader2 size={16} className="animate-spin" /> Elaborazione in corso...</>
                ) : pendingFiles.length > 0 ? (
                  <><Play size={16} /> Carica ed Elabora ({pendingFiles.length})</>
                ) : (
                  "Conferma e chiudi"
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}

      <DocumentModals
        isRenameOpen={isRenameOpen}
        isDeleteOpen={isDeleteOpen}
        isDeleting={isDeleting}
        itemToRename={itemToRename}
        itemToDelete={itemToDelete}
        newName={newName}
        setNewName={setNewName}
        closeRenameModal={() => { setIsRenameOpen(false); setItemToRename(null); setNewName(""); }}
        closeDeleteModal={() => { setIsDeleteOpen(false); setItemToDelete(null); }}
        handleRenameSubmit={handleRenameSubmit}
        handleDeleteConfirm={handleDeleteConfirm}
      />
    </AnimatePresence>
  );
};