import React, { useState } from "react";
import { useProfile } from "@/features/profile/hooks/useProfile";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { AnimatePresence, motion } from "framer-motion";
import { ConfirmModal } from "@/shared/components/ConfirmModal";
import { HeaderProfile } from "@/features/profile/components/HeaderProfile";
import type { Action } from "@/interfaces/interfaces";
import { FiHome, FiSearch, FiDatabase, FiTag, FiUploadCloud, FiEdit3 } from "react-icons/fi";
import { navigateItem } from "@/routes/navigation";

// --- COMPONENTI ADMIN ---
import { UploadMaxima } from "@/features/admin/components/UploadMaxima";
import { AdminMaintenanceSection } from "@/features/admin/components/AdminMaintenanceSection";
import { AdminTaxonomySection } from "@/features/admin/components/AdminTaxonomySection";
import FirebaseManual from "@/features/admin/components/FirebaseManual";
import { AdminFooterLinks } from "@/features/admin/components/AdminFooterLinks";

import { 
  executeAdminMaintenanceTask, 
  executeAdminMergeCategoryTask,
  type AdminMaintenanceParams, 
  type MaintenanceProgressData 
} from "./hooks/admin"; 

// Tipi per i Tab
type AdminTab = "upload" | "content" | "taxonomy" | "maintenance";

export const Admin: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading, userData, name, surname, avatar, deleteAccount } = useProfile();
  
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>("upload");

  // --- STATI: MANUTENZIONE ---
  const [isUpdating, setIsUpdating] = useState(false);
  const [progressData, setProgressData] = useState<MaintenanceProgressData | null>(null);
  const [maintenanceParams, setMaintenanceParams] = useState<AdminMaintenanceParams>({
    materia: "", 
    sezione: "", 
    organo_giudicante: "", 
    newFonte: "", 
    newFonteLogo: ""
  });

  // --- STATI: UNIFICAZIONE CATEGORIA ---
    const [isMerging, setIsMerging] = useState(false);
    const [mergeParams, setMergeParams] = useState<{
      vecchiaCategoria: string;
      nuovaCategoria: string | null;
    }>({ 
      vecchiaCategoria: "", 
      nuovaCategoria: "" 
    });

  if (loading || !user || !userData) {
    return (
      <div className="h-screen flex justify-center items-center text-neutral-500 dark:text-neutral-400">
        Caricamento...
      </div>
    );
  }

  const actions: Action[] = [
    { 
      id: "home", 
      label: "Chat", 
      icon: <FiHome />, 
      onClick: () => navigateItem({ type: "route", target: "/chat" }, navigate) 
    },
    { 
      id: "search", 
      label: "Ricerca Sentenze", 
      icon: <FiSearch />, 
      onClick: () => navigateItem({ type: "route", target: "/ricerca" }, navigate) 
    },
  ];

  // --- HANDLERS ---
  const handleMaintenance = async () => {
    setIsUpdating(true);
    setProgressData(null);
    const cleanedParams = Object.fromEntries(
      Object.entries(maintenanceParams).filter(([, v]) => typeof v === 'string' && v.trim() !== "")
    ) as AdminMaintenanceParams;

    try {
      await executeAdminMaintenanceTask(cleanedParams, (progress) => setProgressData(progress));
      toast.success("Task di manutenzione completato!");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Errore imprevisto durante la manutenzione.";
      toast.error(errorMessage);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleMergeCategory = async () => {
    if (!mergeParams.vecchiaCategoria.trim()) {
      toast.error("Compila il campo della categoria da eliminare.");
      return;
    }
    
    setIsMerging(true);
    try {
      const targetCategory = mergeParams.nuovaCategoria?.trim() || null;
      const result = await executeAdminMergeCategoryTask(mergeParams.vecchiaCategoria.trim(), targetCategory);
      
      toast.success(result.message || "Operazione completata!");
      setMergeParams({ vecchiaCategoria: "", nuovaCategoria: "" });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Errore imprevisto durante l'unificazione.";
      toast.error(errorMessage);
    } finally {
      setIsMerging(false);
    }
  };

  // --- CONFIGURAZIONE TAB ---
  const TABS = [
    { id: "upload", label: "Upload Massivo", icon: <FiUploadCloud className="mb-1 text-lg" /> },
    { id: "content", label: "Contenuti & Prompt", icon: <FiEdit3 className="mb-1 text-lg" /> },
    { id: "taxonomy", label: "Tassonomia", icon: <FiTag className="mb-1 text-lg" /> },
    { id: "maintenance", label: "Manutenzione DB", icon: <FiDatabase className="mb-1 text-lg" /> },
  ] as const;

  return (
    <>
      <HeaderProfile name={name} surname={surname} avatar={avatar} actions={actions} />
      
      <main className="max-w-5xl mx-auto px-5 py-8 flex flex-col gap-8 min-h-[calc(100vh-80px)]">
        
        {/* NAVIGAZIONE TAB */}
        {userData.status === "admin" && (
          <div className="flex overflow-x-auto hide-scrollbar border-b border-(--color-border) gap-2 pb-px">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AdminTab)}
                className={`relative flex flex-col items-center min-w-30 pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-colors ${
                  activeTab === tab.id ? "text-(--color-text)" : "text-(--color-muted) hover:text-(--color-text)"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeAdminTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-(--color-primary)"
                  />
                )}
              </button>
            ))}
          </div>
        )}

        {/* CONTENUTO DEL TAB ATTIVO */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            {userData.status === "admin" ? (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-8"
              >
                {/* 1. Upload Massivo */}
                {activeTab === "upload" && (
                  <section className="bg-bg text-text flex flex-col items-center text-center gap-6 py-4">
                    <UploadMaxima />
                  </section>
                )}

                {/* 2. Contenuti Manuali & Prompts */}
                {activeTab === "content" && (
                  <div className="grid grid-cols-1 gap-8">
                    <FirebaseManual />
                  </div>
                )}

                {/* 3. Tassonomia */}
                {activeTab === "taxonomy" && (
                  <AdminTaxonomySection
                    mergeParams={mergeParams}
                    setMergeParams={setMergeParams}
                    isMerging={isMerging}
                    onMergeSubmit={handleMergeCategory}
                  />
                )}

                {/* 4. Manutenzione Database */}
                {activeTab === "maintenance" && (
                  <AdminMaintenanceSection
                    maintenanceParams={maintenanceParams}
                    isUpdating={isUpdating}
                    progressData={progressData}
                    onParamChange={(e) => setMaintenanceParams({ ...maintenanceParams, [e.target.name]: e.target.value })}
                    onMaintenanceSubmit={handleMaintenance}
                  />
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* FOOTER & MODALS */}
        <AdminFooterLinks />
        <ConfirmModal
          isOpen={confirmOpen}
          title="Elimina Profilo"
          message="Sei sicuro di voler eliminare l'account? Questa azione è irreversibile."
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => {
            deleteAccount();
            toast.success("Profilo eliminato");
            navigate("/registrati", { replace: true });
            setConfirmOpen(false);
          }}
        />
      </main>
    </>
  );
};