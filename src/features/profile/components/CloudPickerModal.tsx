import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaGoogleDrive, FaTimes, FaMicrosoft, FaTools } from "react-icons/fa";
import { Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { useGoogleDrive } from "@/features/profile/hooks/useGoogleDrive";

interface CloudPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFile: (file: { name: string; blob: Blob }) => void;
}

type CloudProviderType = "google" | "microsoft";

export const CloudPickerModal: React.FC<CloudPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectFile,
}) => {
  const [activeTab, setActiveTab] = useState<CloudProviderType>("google");
  const [isDownloading, setIsDownloading] = useState(false);
  const [isOpeningPicker, setIsOpeningPicker] = useState(false);
  const openingTimerRef = useRef<number | null>(null);

  const google = useGoogleDrive();

  useEffect(() => {
    return () => {
      if (openingTimerRef.current) {
        window.clearTimeout(openingTimerRef.current);
      }
    };
  }, []);

  if (!isOpen) return null;

  // Questa funzione viene chiamata dal Picker di Google quando l'utente seleziona un file
  const handleGoogleFilePicked = async (fileId: string, fileName: string, mimeType: string) => {
    try {
      if (openingTimerRef.current) {
        window.clearTimeout(openingTimerRef.current);
        openingTimerRef.current = null;
      }
      setIsOpeningPicker(false);
      setIsDownloading(true);
      
      // Chiamiamo il backend per scaricare fisicamente i byte del file
      const fileObj = await google.downloadFile(fileId, fileName, mimeType);
      
      // Passiamo il file al sistema di upload di Jurio
      onSelectFile({ name: fileName, blob: fileObj });
      
      // Chiudiamo la modale
      onClose();
    } catch (err) {
      console.error(`Errore download file da Google Drive:`, err);
      toast.error("Impossibile scaricare il file. Riprova.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-2xl bg-(--color-surface) border border-(--color-border) rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* HEADER CON TABS */}
          <div className="flex flex-col border-b border-(--color-border)">
            <div className="flex items-center justify-between px-6 py-4">
              <h2 className="text-base font-medium text-(--color-text)" style={{ fontFamily: 'var(--font-serif)' }}>
                Importa dal Cloud
              </h2>
              <button
                onClick={onClose}
                className="text-(--color-muted) hover:text-(--color-text) transition-colors outline-none"
              >
                <FaTimes size={16} />
              </button>
            </div>
            
            <div className="flex px-6 gap-6">
              <button
                onClick={() => setActiveTab("google")}
                className={`pb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors outline-none border-b-2 ${
                  activeTab === "google" 
                    ? "border-blue-500 text-blue-500" 
                    : "border-transparent text-(--color-muted) hover:text-(--color-text)"
                }`}
              >
                <FaGoogleDrive size={16} />
                <span>Google Drive</span>
              </button>
              <button
                onClick={() => setActiveTab("microsoft")}
                className={`pb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors outline-none border-b-2 ${
                  activeTab === "microsoft" 
                    ? "border-blue-600 text-blue-600" 
                    : "border-transparent text-(--color-muted) hover:text-(--color-text)"
                }`}
              >
                <FaMicrosoft size={14} />
                <span>OneDrive</span>
              </button>
            </div>
          </div>

          {/* CONTENUTO PRINCIPALE */}
          <div className="p-6 overflow-y-auto flex-1 min-h-75">
            
            {/* MICROSOFT: IN LAVORAZIONE */}
            {activeTab === "microsoft" && (
              <div className="flex flex-col items-center justify-center py-10 text-center gap-4 h-full">
                <div className="relative">
                  <FaMicrosoft size={48} className="text-(--color-muted) opacity-30" />
                  <FaTools size={24} className="text-blue-500 absolute -bottom-2 -right-2" />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-(--color-text) mt-2">
                  Sezione in lavorazione
                </h3>
              </div>
            )}

            {/* GOOGLE DRIVE: INTEGRAZIONE NATIVA */}
            {activeTab === "google" && (
              <div className="flex flex-col items-center justify-center py-10 text-center gap-4 h-full">
                
                {isDownloading || google.loading || isOpeningPicker ? (
                  <div className="flex flex-col items-center justify-center gap-3">
                    <Loader2 className="animate-spin text-blue-500" size={36} />
                    <span className="text-xs font-bold uppercase tracking-widest text-(--color-muted)">
                      {isDownloading || google.loading ? "Scaricamento in corso..." : "Apertura Google Drive..."}
                    </span>
                  </div>
                ) : (
                  <>
                    <FaGoogleDrive size={56} className="text-blue-500 opacity-80" />
                    <p className="text-sm text-(--color-muted) font-light max-w-sm">
                      Sfoglia in modo sicuro i tuoi documenti su Google Drive e seleziona il file da analizzare.
                    </p>
                    <button
                      type="button"
                      className="px-4 py-2 rounded-md bg-(--color-text) text-(--color-surface) text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all outline-none"
                      onClick={() => {
                        if (openingTimerRef.current) {
                          window.clearTimeout(openingTimerRef.current);
                          openingTimerRef.current = null;
                        }

                        setIsOpeningPicker(true);

                        try {
                          google.openPicker(handleGoogleFilePicked);
                        } catch (error) {
                          console.error(error);
                          setIsOpeningPicker(false);
                          return;
                        }

                        openingTimerRef.current = window.setTimeout(() => {
                          setIsOpeningPicker(false);
                          openingTimerRef.current = null;
                        }, 1200);
                      }}
                    >
                      Sfoglia Google Drive
                    </button>
                    <span className="text-[10px] text-(--color-muted) uppercase tracking-wider mt-4">
                      I tuoi file rimangono privati.
                    </span>
                  </>
                )}
              </div>
            )}
            
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
