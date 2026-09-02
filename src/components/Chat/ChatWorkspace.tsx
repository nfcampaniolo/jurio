import { motion, AnimatePresence } from "framer-motion";
import { FileText, X } from "lucide-react";
import { DocumentViewer } from "@/components/Chat/DocumentViewer";
import { type AttachedDocument } from "@/interfaces/interfaces";

interface ChatWorkspaceProps {
  viewMode: 'chat' | 'workspace';
  setViewMode: (mode: 'chat' | 'workspace') => void;
  attachedDocs: AttachedDocument[];
  activeQuote: string[];
  handleDocumentAction: (actionType: 'quote' | 'semaforo' | 'distinguish', selectedText: string) => void;
  removeQuote: (index: number) => void;
}

export const ChatWorkspace = ({
  viewMode,
  setViewMode,
  attachedDocs,
  activeQuote,
  handleDocumentAction,
  removeQuote
}: ChatWorkspaceProps) => {
  return (
    <AnimatePresence>
      {viewMode === 'workspace' && (
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
          className="absolute inset-0 w-full md:relative md:w-[55%] h-full border-r border-neutral-200 dark:border-neutral-800 bg-stone-50 dark:bg-neutral-950 flex flex-col z-40 md:z-20 shrink-0 overflow-hidden shadow-2xl md:shadow-none"
        >
          <div className="h-14 sm:h-13 min-h-14 sm:min-h-13 flex items-center justify-between px-4 border-b border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-2 text-neutral-800 dark:text-neutral-200 overflow-hidden">
              <FileText size={16} className="text-yellow-600 dark:text-yellow-500 shrink-0" />
              <span className="font-bold text-sm truncate">
                {attachedDocs.length > 0 ? attachedDocs[0].name : "Documento in Analisi"}
              </span>
            </div>
            <button 
              onClick={() => setViewMode('chat')} 
              className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 dark:hover:text-white dark:hover:bg-neutral-800 transition-colors shrink-0 ml-2"
            >
              <X size={18} />
            </button>
          </div>

          <AnimatePresence>
            {attachedDocs.length > 0 && (
             <DocumentViewer 
                documents={attachedDocs}
                onClose={() => setViewMode('chat')}
                onActionRequest={handleDocumentAction}
                activeQuotes={activeQuote}
                onRemoveQuote={removeQuote}
              />
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};