import React, { useMemo, useState } from "react";
import { FaFileAlt } from "react-icons/fa";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import { useDocuments, useSavedSentenze } from "@/shared/hooks/useDocuments";
import type { DocumentoGiurisprudenziale, ViewMode } from "@/interfaces/interfaces";
import { ConfirmModal } from "./ConfirmModal";
import { AccessDenied } from "./AccessDenied"; 
import { Menu, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { FaChevronDown, FaCheck } from "react-icons/fa";
import { DocumentCard } from "./YourDocumentCard";
import { DocumentRenameModal } from "./YourDocumentRenameModal";
import { useAuth } from "@/context/useAuth";

export const YourDocument: React.FC = () => {
  const PAGE_SIZE = 10;
  const { user } = useAuth();

  const [mode, setMode] = useState<ViewMode>("uploaded");

  const uploaded = useDocuments();
  const [uploadedVisible, setUploadedVisible] = useState(PAGE_SIZE);
  const [uploadedDeletingId, setUploadedDeletingId] = useState<string | number | null>(null);
  const [uploadedDeleteError, setUploadedDeleteError] = useState<string | null>(null);

  const saved = useSavedSentenze();
  const [savedVisible, setSavedVisible] = useState(PAGE_SIZE);
  const [savedDeletingId, setSavedDeletingId] = useState<string | number | null>(null);
  const [savedDeleteError, setSavedDeleteError] = useState<string | null>(null);

  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [itemToRename, setItemToRename] = useState<DocumentoGiurisprudenziale | null>(null);
  const [newName, setNewName] = useState("");

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingDoc, setPendingDoc] = useState<DocumentoGiurisprudenziale | null>(null);

  const isUploaded = mode === "uploaded";

  const list = (isUploaded ? uploaded.documents : saved.savedSentenze) as DocumentoGiurisprudenziale[];
  
  const loading = isUploaded ? uploaded.loading : saved.loading;
  const error = isUploaded ? uploaded.error : saved.error;

  const visibleCount = isUploaded ? uploadedVisible : savedVisible;
  const setVisibleCount = isUploaded ? setUploadedVisible : setSavedVisible;

  const deletingId = isUploaded ? uploadedDeletingId : savedDeletingId;
  const setDeletingId = isUploaded ? setUploadedDeletingId : setSavedDeletingId;

  const deleteError = isUploaded ? uploadedDeleteError : savedDeleteError;
  const setDeleteError = isUploaded ? setUploadedDeleteError : setSavedDeleteError;

  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<"name" | "date">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    let docs = [...list];

    if (q) {
      docs = docs.filter((doc) => {
        const titolo = doc.nome_file ?? doc.organo_giudicante ?? doc.tipo_documento ?? "";
        const anteprima = doc.massima ?? doc.fattispecie_rilevante ?? "";
        const numero = doc.numero_sentenza ?? "";
        const sezione = doc.sezione ?? "";

        return [titolo, anteprima, numero, sezione].join(" ").toLowerCase().includes(q);
      });
    }

    docs.sort((a, b) => {
      if (sortField === "name") {
        const aName = (a.nome_file ?? a.organo_giudicante ?? "").toLowerCase();
        const bName = (b.nome_file ?? b.organo_giudicante ?? "").toLowerCase();

        return sortDirection === "asc" ? aName.localeCompare(bName) : bName.localeCompare(aName);
      }

      const aDate = new Date(a.data_sentenza ?? a.data_riferimento_documento ?? 0).getTime();
      const bDate = new Date(b.data_sentenza ?? b.data_riferimento_documento ?? 0).getTime();

      return sortDirection === "asc" ? aDate - bDate : bDate - aDate;
    });

    return docs;
  }, [list, search, sortField, sortDirection]);

  // Suddivisione in Documenti Personali vs Documenti del Team
  const { personalDocs, teamDocs } = useMemo(() => {
    const currentUid = user?.uid;
    const personal: DocumentoGiurisprudenziale[] = [];
    const team: DocumentoGiurisprudenziale[] = [];

    filteredDocs.forEach((doc) => {
      if (!doc.user || doc.user === currentUid) {
        personal.push(doc);
      } else {
        team.push(doc);
      }
    });

    return { personalDocs: personal, teamDocs: team };
  }, [filteredDocs, user?.uid]);

  const hasMore = filteredDocs.length > visibleCount;

  const handleOpen = (doc: DocumentoGiurisprudenziale) => {
    const basePath = mode === "uploaded" ? "documento" : "giurisprudenza";
    const target = window.innerWidth < 768 ? "_self" : "_blank";
    window.open(`/${basePath}/${doc.id}`, target, "noopener,noreferrer");
  };

  const handleReload = async () => {
    await (isUploaded ? uploaded.reload() : saved.fetchSentences());
    setVisibleCount(PAGE_SIZE);
  };

  // --- CONTROLLO SICUREZZA: ELIMINAZIONE SOLO PER I PROPRI DOCUMENTI ---
  const askRemove = (e: React.MouseEvent, doc: DocumentoGiurisprudenziale) => {
    e.stopPropagation();
    if (doc.user && doc.user !== user?.uid) {
      toast.error("Non puoi eliminare documenti non tuoi.");
      return;
    }
    if (loading || deletingId !== null) return;
    setPendingDoc(doc);
    setIsConfirmOpen(true);
  };
  
  // --- CONTROLLO SICUREZZA: RINOMA SOLO PER I PROPRI DOCUMENTI ---
  const handleRename = (e: React.MouseEvent, doc: DocumentoGiurisprudenziale) => {
    e.stopPropagation();
    if (doc.user && doc.user !== user?.uid) {
      toast.error("Non puoi rinominare documenti non tuoi.");
      return;
    }
    if (loading || deletingId !== null) return;
    setItemToRename(doc);
    setNewName(doc.nome_file ?? "");
    setIsRenameOpen(true);
  };

  const closeRenameModal = () => {
    setIsRenameOpen(false);
    setItemToRename(null);
    setNewName("");
  };

  const handleRenameSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!itemToRename) return;
    try {
      await uploaded.handleRenameDocumento(String(itemToRename.id), newName.trim());
      await uploaded.reload();
      toast.success("Documento rinominato");
      closeRenameModal();
    } catch (err) {
      toast.error("Errore durante la rinomina");
      console.error("Errore durante la rinomina:", err);
    }
  };

  const getErrorMessage = (e: unknown): string => {
    if (e instanceof Error) return e.message;
    if (typeof e === "string") return e;
    return "Errore durante l'operazione.";
  };

  const confirmRemove = async () => {
    if (!pendingDoc) return;

    try {
      setDeleteError(null);
      setDeletingId(pendingDoc.id);

      if (isUploaded) {
        await uploaded.deleteDocumento(String(pendingDoc.id));
        await uploaded.reload();
        toast.success("Documento eliminato con successo");
        setUploadedVisible((prev) => Math.min(prev, Math.max(PAGE_SIZE, uploaded.documents.length - 1)));
      } else {
        await saved.unsaveSentence(String(pendingDoc.id));
        await saved.fetchSentences();
        toast.success("Sentenza rimossa dai salvati");
        setSavedVisible((prev) => Math.min(prev, Math.max(PAGE_SIZE, saved.savedSentenze.length - 1)));
      }

      setIsConfirmOpen(false);
      setPendingDoc(null);
    } catch (e: unknown) {
      const msg = getErrorMessage(e);
      setDeleteError(msg);
      toast.error(msg);
    } finally {
      setDeletingId(null);
    }
  };

  const cancelRemove = () => {
    setIsConfirmOpen(false);
    setPendingDoc(null);
  };

  return (
    <section className="space-y-6 w-full mx-auto max-w-5xl text-start px-4 md:px-0">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center border-b border-(--color-border) pb-4">
          <div className="inline-flex rounded-md border border-(--color-border) overflow-hidden shadow-xs bg-(--color-surface)">
            <button
              type="button"
              onClick={() => setMode("uploaded")}
              className={[
                "px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors outline-none",
                mode === "uploaded"
                  ? "bg-(--color-text) text-(--color-surface)"
                  : "bg-(--color-surface) text-(--color-muted) hover:text-(--color-text)",
              ].join(" ")}
            >
              Caricati
            </button>
            <button
              type="button"
              onClick={() => setMode("saved")}
              className={[
                "px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors outline-none",
                mode === "saved"
                  ? "bg-(--color-text) text-(--color-surface)"
                  : "bg-(--color-surface) text-(--color-muted) hover:text-(--color-text)",
              ].join(" ")}
            >
              Salvati
            </button>
          </div>

          <button
            type="button"
            onClick={handleReload}
            className="text-xs font-bold uppercase tracking-widest text-(--color-muted) hover:text-(--color-text) transition-colors outline-none"
            title="Ricarica"
          >
            Ricarica
          </button>
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-medium text-(--color-text) tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
            {isUploaded ? "I tuoi documenti elaborati" : "Il tuo archivio salvati"}
          </h1>
          <p className="text-xs sm:text-sm text-(--color-muted) font-light mt-1.5 leading-relaxed">
            {isUploaded
              ? "Gestisci, scarica o elimina i documenti che hai caricato e analizzato."
              : "Consulta rapidamente le sentenze e i provvedimenti che hai salvato per dopo."}
          </p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 text-(--color-muted) gap-2">
          <Loader2 size={16} className="animate-spin text-(--color-text)" />
          <span className="text-xs font-bold uppercase tracking-widest">Caricamento documenti in corso…</span>
        </div>
      )}
      {error && !(mode === "saved" && saved.isUnauthorized) && (
        <div className="text-xs font-light text-red-600 dark:text-red-400 p-4 bg-red-500/10 border border-red-500/30 rounded-md">
          {error}
        </div>
      )}
      {deleteError && (
        <div className="text-xs font-light text-red-600 dark:text-red-400 p-4 bg-red-500/10 border border-red-500/30 rounded-md">
          {deleteError}
        </div>
      )}
      {mode === "saved" && saved.isUnauthorized && (
        <div className="w-full mx-auto max-w-5xl py-10">
          <AccessDenied />
        </div>
      )}
      
      {!loading && !error && list.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-(--color-border) bg-(--color-surface) p-10 text-center shadow-xs">
          <div className="w-12 h-12 rounded-md bg-(--color-bg) border border-(--color-border) flex items-center justify-center text-(--color-text) mb-2">
            <FaFileAlt className="opacity-70" />
          </div>
          <span className="text-base font-medium text-(--color-text) tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>Nessun documento trovato</span>
          <span className="text-xs text-(--color-muted) font-light max-w-sm leading-relaxed">
            {isUploaded 
              ? "Non hai ancora elaborato nessun documento. Carica un file per iniziare." 
              : "Non hai ancora salvato nessuna sentenza. Usa il tasto 'Salva' quando leggi un provvedimento interessante."}
          </span>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-3 justify-between items-center">
        <input
          type="text"
          placeholder="Cerca documenti..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:max-w-md rounded-md border border-(--color-border) px-4 py-2.5 bg-(--color-surface) text-sm text-(--color-text) font-light placeholder:text-(--color-muted) outline-none focus:border-(--color-text) transition-colors shadow-xs"
        />
        <div className="flex gap-2 w-full md:w-auto justify-end">
          <Menu as="div" className="relative">
            <Menu.Button
              className="inline-flex items-center gap-2 rounded-md border border-(--color-border)
                        bg-(--color-surface) px-4 py-2.5 text-xs font-bold uppercase tracking-widest
                        text-(--color-text)
                        hover:border-(--color-text) transition-colors outline-none shadow-xs"
            >
              {sortField === "date"
                ? sortDirection === "desc"
                  ? "Più recenti"
                  : "Meno recenti"
                : sortDirection === "asc"
                ? "Nome A–Z"
                : "Nome Z–A"}

              <FaChevronDown className="text-[10px] opacity-60" />
            </Menu.Button>

            <Transition
              as={Fragment}
              enter="transition duration-150 ease-out"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="transition duration-100 ease-in"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Menu.Items
                className="absolute right-0 mt-2 w-56 origin-top-right rounded-md
                          border border-(--color-border)
                          bg-(--color-surface) shadow-(--shadow-soft) p-1 z-50"
              >
                {[
                  { label: "Più recenti", field: "date", direction: "desc" },
                  { label: "Meno recenti", field: "date", direction: "asc" },
                  { label: "Nome A–Z", field: "name", direction: "asc" },
                  { label: "Nome Z–A", field: "name", direction: "desc" },
                ].map((item) => {
                  const active = sortField === item.field && sortDirection === item.direction;

                  return (
                    <Menu.Item key={item.label}>
                      {({ active: hover }) => (
                        <button
                          type="button"
                          onClick={() => {
                            setSortField(item.field as "name" | "date");
                            setSortDirection(item.direction as "asc" | "desc");
                          }}
                          className={`w-full flex items-center justify-between rounded-sm px-3 py-2 text-xs uppercase font-bold tracking-wider transition-colors outline-none ${
                            hover ? "bg-(--color-bg) text-(--color-text)" : "text-(--color-muted)"
                          }`}
                        >
                          <span>{item.label}</span>
                          {active && <FaCheck className="text-(--color-text) text-xs" />}
                        </button>
                      )}
                    </Menu.Item>
                  );
                })}
              </Menu.Items>
            </Transition>
          </Menu>
        </div>
      </div>

      {/* Sezione Documenti Personali */}
      {!loading && !error && personalDocs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-(--color-muted)">I tuoi documenti</h2>
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {personalDocs.slice(0, visibleCount).map((doc) => {
              const isRemoving = deletingId === doc.id;
              return (
                <DocumentCard 
                  key={doc.id}
                  doc={doc}
                  mode={mode}
                  isOwner={true}
                  isRemoving={isRemoving}
                  onOpen={handleOpen}
                  onRemove={askRemove}
                  onRename={handleRename}
                />
              );
            })}
          </motion.div>
        </div>
      )}

      {/* Sezione Documenti del Team */}
      {!loading && !error && teamDocs.length > 0 && (
        <div className="space-y-3 pt-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-(--color-muted)">Documenti condivisi dal Team</h2>
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {teamDocs.map((doc) => {
              const isRemoving = deletingId === doc.id;
              return (
                <DocumentCard 
                  key={doc.id}
                  doc={doc}
                  mode={mode}
                  isOwner={false}
                  isRemoving={isRemoving}
                  onOpen={handleOpen}
                  onRemove={askRemove}
                  onRename={handleRename}
                />
              );
            })}
          </motion.div>
        </div>
      )}

      {!loading && !error && hasMore && (
        <div className="flex justify-center pt-4">
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredDocs.length))}
            className="rounded-md border border-(--color-border) px-6 py-2.5 text-xs font-bold uppercase tracking-widest
                       text-(--color-text) bg-(--color-surface)
                       hover:border-(--color-text) transition-all outline-none shadow-xs"
          >
            Carica altri
          </button>
        </div>
      )}

      <ConfirmModal
        isOpen={isConfirmOpen}
        title={isUploaded ? "Elimina documento" : "Rimuovi dai salvati"}
        message={
          isUploaded
            ? "Sei sicuro di voler eliminare definitivamente questo documento? L'operazione non può essere annullata."
            : "Vuoi davvero rimuovere questa sentenza dalla tua lista dei salvati?"
        }
        confirmText={isUploaded ? "Elimina" : "Rimuovi"}
        cancelText="Annulla"
        onCancel={cancelRemove}
        onConfirm={confirmRemove}
      />

      <DocumentRenameModal
        isOpen={isRenameOpen}
        itemToRename={itemToRename}
        newName={newName}
        setNewName={setNewName}
        onClose={closeRenameModal}
        onSubmit={handleRenameSubmit}
      />
    </section>
  );
};